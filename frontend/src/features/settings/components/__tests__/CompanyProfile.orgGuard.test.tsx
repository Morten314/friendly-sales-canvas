import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CompanyProfile } from "../CompanyProfile";

import { server } from "@/test/msw/server";

// Spec 48 final-review fix (WS1d gap): a Firebase-created, unmapped-org user
// has currentUser but orgId: null (see AuthContext.orgResolution.test.tsx).
// Settings' company-profile save must not POST org_id: "" in that state —
// WS1d guarded lead/doc/chat writes but missed this save path.
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: null }),
}));

// The Industry combobox renders a `cmdk` popover; `cmdk` + Radix Popper use
// ResizeObserver and Element.scrollIntoView, which jsdom lacks. Polyfill locally
// (scoped to this file) so the component mounts cleanly — mirrors CompanyProfile.test.tsx.
beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

function renderWithClient(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

afterEach(() => vi.restoreAllMocks());

describe("CompanyProfile org guard", () => {
  it("does not POST /api/profile/company when orgId is null, and alerts instead", async () => {
    const posted = vi.fn();
    // Register a real handler (not left unhandled) so the assertion is "the
    // spy was never invoked" rather than an opaque MSW onUnhandledRequest:
    // 'error' failure — a cleaner, more specific RED/GREEN signal. Mirrors
    // ContextChat.orgGuard.test.tsx / useLeadStream.orgGuard.test.tsx.
    server.use(
      http.post("/api/profile/company", () => {
        posted();
        return HttpResponse.json({ ok: true });
      }),
    );
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    renderWithClient(<CompanyProfile />);
    await screen.findByText("Company Profile Settings");

    fireEvent.click(screen.getByRole("button", { name: /save company profile/i }));

    // Let a (wrongly) fire-and-forget POST's promise chain settle before asserting.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(posted).not.toHaveBeenCalled();
    // CompanyProfile.tsx has no toast wiring (unlike CompanyProfileForm.tsx) —
    // every existing error/success path in this file uses window.alert, so the
    // guard mirrors that real mechanism rather than introducing a new one.
    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/workspace is still loading/i));
  });
});
