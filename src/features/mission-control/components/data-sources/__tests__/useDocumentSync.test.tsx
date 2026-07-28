import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DataSource } from "../../../types";
import { useDocumentSync } from "../useDocumentSync";

import { server } from "@/test/msw/server";

// The hook receives its auth context via props (orgIdToUse / currentUser /
// getAuthHeader), not by importing @/shared/auth — so no auth module mock is
// needed. We pass a minimal authenticated context so the useDataSources read is
// enabled and checkDocumentStatus does not short-circuit on a missing uid.
const options = {
  orgIdToUse: "brewra",
  currentUser: { uid: "u1" } as never,
  getAuthHeader: async () => "",
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => vi.restoreAllMocks());

describe("useDocumentSync in-flight guard", () => {
  it("does not re-fetch a file whose status check is already in flight", async () => {
    let statusCalls = 0;
    let resolveStatus: () => void = () => {};
    server.use(
      // The useDataSources read (GET /api/v2/user-documents) returns an empty
      // paginated envelope so the merge keeps the seeded processing row intact.
      http.get("/api/v2/user-documents", () =>
        HttpResponse.json({ items: [], total: 0, limit: 500, offset: 0 }),
      ),
      // Per-file status check. Hang the response until the test releases it so the
      // first call stays "in flight" while the second call fires.
      http.get("/api/document-status/:fileKey", async () => {
        statusCalls += 1;
        await new Promise<void>((r) => (resolveStatus = r));
        return HttpResponse.json({ data: { status: "completed" } });
      }),
    );

    const { result } = renderHook(() => useDocumentSync(options), { wrapper });

    // Seed one processing file into the hook's state. fileKey is set so the
    // resolved status URL is deterministic (/api/document-status/f1).
    const processingFile: DataSource = {
      id: "f1",
      fileKey: "f1",
      type: "file",
      status: "processing",
      name: "a.pdf",
      tags: [],
      createdAt: new Date(),
    };
    act(() => {
      result.current.setDataSources([processingFile]);
    });

    await act(async () => {
      result.current.checkProcessingFilesStatus();
      result.current.checkProcessingFilesStatus(); // second call while first is in flight
    });

    // The guard must hold the count at exactly 1 across both explicit calls (and
    // the polling effect the processing row also triggers). Give any extra,
    // un-guarded fetches a window to land before asserting.
    await new Promise((r) => setTimeout(r, 100));
    await waitFor(() => expect(statusCalls).toBe(1));

    resolveStatus?.();
  });
});
