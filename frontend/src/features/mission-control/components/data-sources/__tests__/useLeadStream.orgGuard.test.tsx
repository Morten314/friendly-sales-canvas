import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLeadStream } from "../useLeadStream";

// Mock the hook's only react-query dependency so no QueryClient/network is
// needed (its initial-load effect calls refetch(), which fires even when the
// query is disabled).
//
// `data` and `refetch` are captured in the factory closure (not recreated
// per-call) so they are referentially stable across renders, matching real
// TanStack Query's behavior when the underlying result hasn't changed. A
// naive `() => ({ data: [], ..., refetch: vi.fn()... })` returns a fresh
// array/function every invocation; the hook's sync-effect and its
// initial-load effect both depend on these references
// (`[leadStreamQuery.data, ...]` / `[..., refreshLeadStreamStatus]`, the
// latter transitively closing over `refetch`), so an unstable mock makes
// both effects re-fire on every render, each re-render producing new
// references again — an unbounded render loop that OOMs the worker instead
// of failing the assertion (verified in isolation: a bare
// `renderHook(() => useLeadStream(...))` with no upload call crashes the
// same way, so this is a mock-shape issue, not a bug in useLeadStream.ts).
vi.mock("../../../hooks/useLeadStreamStatus", () => {
  const data: never[] = [];
  const refetch = vi.fn().mockResolvedValue({ data });
  return {
    useLeadStreamStatus: () => ({ data, isLoading: false, refetch }),
  };
});
// Bypass CSV validation/type-sniff so the flow reaches the org guard (not a
// validation early-return). Provide every named export the hook imports.
vi.mock("../csvHelpers", () => ({
  validateCsvFormat: vi.fn().mockResolvedValue({ valid: true }),
  getLeadImportKind: () => "csv",
  sniffExcelBinarySignature: vi.fn().mockResolvedValue(false),
  normalizeCsv: (s: string) => s,
  parseErrorMessage: (s: string) => s,
}));

const toast = vi.fn();
const getAuthHeader = vi.fn().mockResolvedValue("");

afterEach(() => vi.restoreAllMocks());

describe("useLeadStream upload guard", () => {
  it("refuses to POST a batch upload when the org is unresolved (empty orgIdToUse)", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const { result } = renderHook(() =>
      useLeadStream({ currentUser: { uid: "u1" } as never, orgIdToUse: "", getAuthHeader, toast }),
    );
    act(() =>
      result.current.setSelectedLeadFile(new File(["a,b\n1,2"], "leads.csv", { type: "text/csv" })),
    );
    await act(async () => {
      await result.current.handleUploadLeadCsv();
    });
    // No batch-upload POST fired; a destructive toast explained why (the org guard).
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("leads/batch-upload"))).toBe(
      false,
    );
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});
