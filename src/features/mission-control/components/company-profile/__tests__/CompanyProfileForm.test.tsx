import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import CompanyProfileForm from "../CompanyProfileForm";

import { server } from "@/test/msw/server";

// Mock auth so the form resolves a userId + orgId and the useCompanyProfile
// query is enabled (auto-fetch on mount). The form imports useAuthToken from
// @/shared/auth.
vi.mock("@/shared/auth", () => ({
  useAuthToken: () => ({ currentUser: { uid: "u1" }, orgId: "brewra" }),
}));

// The Industry combobox renders a `cmdk` popover; `cmdk` + Radix Popper use
// ResizeObserver and Element.scrollIntoView, which jsdom lacks. Polyfill locally
// (scoped to this file) so the popover mounts — mirrors IcpWizard.test.tsx.
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

function renderForm(onSavedChange?: (saved: boolean) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<CompanyProfileForm onSavedChange={onSavedChange} />, { wrapper: Wrapper });
}

afterEach(() => {
  vi.restoreAllMocks();
  // The failover test seeds localStorage; clear it so saved keys don't leak into
  // sibling tests (which assume an empty store).
  localStorage.clear();
});

describe("CompanyProfileForm", () => {
  it("hydrates the form fields from the company-profile read on mount", async () => {
    server.use(
      http.get("/api/profile/company", () =>
        HttpResponse.json({
          user_id: "u1",
          company_name: "Acme Corp",
          headquarters: "San Francisco, USA",
        }),
      ),
    );

    renderForm();

    // The company-name input is the load-bearing field — it should reflect the
    // value returned by the GET once useCompanyProfile resolves.
    await waitFor(() => expect(screen.getByLabelText(/Company Name/i)).toHaveValue("Acme Corp"));
    expect(screen.getByLabelText(/Headquarters/i)).toHaveValue("San Francisco, USA");
  });

  it("reports saved-state via onSavedChange when a saved profile is read", async () => {
    server.use(
      http.get("/api/profile/company", () =>
        HttpResponse.json({ user_id: "u1", company_name: "Acme Corp" }),
      ),
    );

    const onSavedChange = vi.fn();
    renderForm(onSavedChange);

    await waitFor(() => expect(onSavedChange).toHaveBeenCalledWith(true));
  });

  it("falls back to the localStorage profile when the company-profile GET 404s", async () => {
    // GET 404s (genuine no-profile-yet) → useCompanyProfile resolves to null (a 5xx
    // now surfaces as `error` instead — spec 48 Task 12 — and preserves whatever was
    // already hydrated rather than triggering this failover) → the read effect runs
    // the localStorage failover. This is the #1 parity edge case: a stale local cache
    // must still hydrate the form AND unlock the other tabs (onSavedChange(true)).
    server.use(http.get("/api/profile/company", () => new HttpResponse(null, { status: 404 })));

    // Seed the saved profile under the user-scoped key getUserLocalStorage reads:
    // `${baseKey}_${userId}` = "companyProfile_u1". Mocked auth uid is "u1".
    localStorage.setItem(
      "companyProfile_u1",
      JSON.stringify({
        user_id: "u1",
        company_name: "Cached Co",
        headquarters: "Berlin, Germany",
      }),
    );

    const onSavedChange = vi.fn();
    renderForm(onSavedChange);

    // (a) Fields hydrate from the localStorage profile.
    await waitFor(() => expect(screen.getByLabelText(/Company Name/i)).toHaveValue("Cached Co"));
    expect(screen.getByLabelText(/Headquarters/i)).toHaveValue("Berlin, Germany");

    // (b) onSavedChange(true) — unlocks the other tabs while offline-with-cache.
    await waitFor(() => expect(onSavedChange).toHaveBeenCalledWith(true));
  });

  it("shows an error/retry state (not a blank form) on a persistent 5xx, without falling back to localStorage", async () => {
    // Spec 48 WS4 follow-up: useCompanyProfile surfaces a 5xx as `error` (Task 12)
    // instead of resolving to null, but until this fix nothing rendered that error —
    // the form silently showed its blank initial state. Seed a saved profile in
    // localStorage first: the error branch must NOT read it — only the genuine
    // 404/null path may fail over (that risk is what Task 12/WS4 removed).
    localStorage.setItem(
      "companyProfile_u1",
      JSON.stringify({ user_id: "u1", company_name: "Cached Co" }),
    );

    vi.spyOn(console, "error").mockImplementation(() => {});

    let getCount = 0;
    server.use(
      http.get("/api/profile/company", () => {
        getCount += 1;
        if (getCount === 1) {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json({ user_id: "u1", company_name: "Acme Corp" });
      }),
    );

    renderForm();

    // The error/retry state is shown …
    await waitFor(() =>
      expect(screen.getByText(/couldn.t load your company profile/i)).toBeInTheDocument(),
    );
    const retryButton = screen.getByRole("button", { name: /try again/i });

    // … NOT the blank editable form, and NOT the seeded localStorage profile —
    // proving there is no fallback-on-error (no stale-save risk).
    expect(screen.queryByLabelText(/Company Name/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cached Co/i)).not.toBeInTheDocument();

    // "Try again" triggers a refetch — flip the mock to success on the 2nd call
    // and confirm the form then populates.
    fireEvent.click(retryButton);
    await waitFor(() => expect(screen.getByLabelText(/Company Name/i)).toHaveValue("Acme Corp"));
    expect(getCount).toBe(2);
  });

  it("POSTs the profile on Save and reports saved-state", async () => {
    // Suppress only the post-save 2s verify GET (handleSave schedules it via
    // setTimeout(…, 2000)). If it fired after teardown it would hit an un-mocked
    // request once handlers are reset. Every other timer delegates to the real
    // setTimeout.
    const realSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      fn: (...a: unknown[]) => void,
      ms?: number,
      ...rest: unknown[]
    ) => {
      if (ms === 2000) return 0 as unknown as ReturnType<typeof setTimeout>;
      return realSetTimeout(fn, ms, ...rest);
    }) as typeof setTimeout);

    let postedBody: Record<string, unknown> | null = null;
    server.use(
      // No profile yet → empty form.
      http.get("/api/profile/company", () => new HttpResponse(null, { status: 404 })),
      http.post("/api/profile/company", async ({ request }) => {
        postedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ company_name: postedBody.company_name });
      }),
    );

    const onSavedChange = vi.fn();
    renderForm(onSavedChange);

    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: "Globex" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(postedBody).not.toBeNull());
    expect(postedBody).toMatchObject({ company_name: "Globex", profile_type: "company" });
    await waitFor(() => expect(onSavedChange).toHaveBeenCalledWith(true));
  });

  it("includes a custom typed industry in the save payload", async () => {
    const realSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      fn: (...a: unknown[]) => void,
      ms?: number,
      ...rest: unknown[]
    ) => {
      if (ms === 2000) return 0 as unknown as ReturnType<typeof setTimeout>;
      return realSetTimeout(fn, ms, ...rest);
    }) as typeof setTimeout);

    let postedBody: Record<string, unknown> | null = null;
    server.use(
      http.get("/api/profile/company", () => new HttpResponse(null, { status: 404 })),
      http.post("/api/profile/company", async ({ request }) => {
        postedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ company_name: postedBody.company_name });
      }),
    );

    renderForm();

    // Company name is required for the save to proceed.
    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: "Globex" } });

    // Enter an industry that is NOT one of the suggestions via the creatable
    // combobox (its trigger is labelled "Industry").
    fireEvent.click(screen.getByRole("combobox", { name: "Industry" }));
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "Defense Logistics" },
    });
    fireEvent.click(screen.getByText(/Add "Defense Logistics"/));

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(postedBody).not.toBeNull());
    expect(postedBody).toMatchObject({ company_name: "Globex", industry: "Defense Logistics" });
  });
});
