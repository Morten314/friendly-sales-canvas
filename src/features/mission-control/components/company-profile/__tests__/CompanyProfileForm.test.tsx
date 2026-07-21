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

  it("falls back to the localStorage profile when the company-profile GET fails", async () => {
    // GET fails (5xx) → useCompanyProfile swallows the non-ZodError and resolves to
    // null → the read effect runs the localStorage failover. This is the #1 parity
    // edge case: offline-with-cache must still hydrate the form AND unlock the other
    // tabs (onSavedChange(true)).
    server.use(http.get("/api/profile/company", () => new HttpResponse(null, { status: 500 })));

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
