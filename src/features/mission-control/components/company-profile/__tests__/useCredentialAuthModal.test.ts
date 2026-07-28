import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataSource } from "../connectorTypes";
import { useCredentialAuthModal } from "../useCredentialAuthModal";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal DataSource stub; only fields the hook reads are exercised. */
function makeSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: "src-1",
    name: "Salesforce",
    type: "crm",
    icon: (() => null) as unknown as DataSource["icon"],
    platform: "Salesforce",
    status: "disconnected",
    syncFrequency: "daily",
    totalRecords: 0,
    newRecordsThisWeek: 0,
    updatedRecords: 0,
    dataQualityScore: 0,
    objectsSynced: [],
    fieldsMapped: 0,
    filters: [],
    ...overrides,
  };
}

/** Default args for the hook; callers can override individual fields. */
function makeArgs(
  overrides: {
    onDataSourcesChange?: ReturnType<typeof vi.fn>;
    toast?: ReturnType<typeof vi.fn>;
    objectsSynced?: string[] | ((s: DataSource) => string[]);
    successTitle?: string | ((s: DataSource) => string);
  } = {},
) {
  return {
    onDataSourcesChange: overrides.onDataSourcesChange ?? vi.fn(),
    toast: overrides.toast ?? vi.fn(),
    objectsSynced: overrides.objectsSynced ?? ["Contacts", "Leads"],
    filters: ["filter-a"],
    successTitle: overrides.successTitle ?? "Connected!",
    successDescription: "Your data is syncing.",
    denyDescription: "Access was denied.",
  };
}

// ─── Initial state ────────────────────────────────────────────────────────────

describe("useCredentialAuthModal — initial state", () => {
  it("starts with modal closed, empty credentials, and login step", () => {
    const { result } = renderHook(() => useCredentialAuthModal(makeArgs()));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.authStep).toBe("login");
    expect(result.current.email).toBe("");
    expect(result.current.password).toBe("");
    expect(result.current.sourceToConnect).toBeNull();
    expect(result.current.isLoggingIn).toBe(false);
  });
});

// ─── handleLogin ─────────────────────────────────────────────────────────────

describe("useCredentialAuthModal — handleLogin", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does nothing when sourceToConnect is null", async () => {
    const toast = vi.fn();
    const { result } = renderHook(() => useCredentialAuthModal(makeArgs({ toast })));

    await act(async () => {
      await result.current.handleLogin();
    });

    // No toast, no step change
    expect(toast).not.toHaveBeenCalled();
    expect(result.current.authStep).toBe("login");
  });

  it("fires a destructive toast and does NOT advance when credentials are empty", async () => {
    const toast = vi.fn();
    const { result } = renderHook(() => useCredentialAuthModal(makeArgs({ toast })));

    act(() => {
      result.current.setSourceToConnect(makeSource());
    });

    await act(async () => {
      await result.current.handleLogin();
    });

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    expect(result.current.authStep).toBe("login");
  });

  it("transitions authStep to 'permissions' after the 1500ms delay when credentials are set", async () => {
    const { result } = renderHook(() => useCredentialAuthModal(makeArgs()));

    act(() => {
      result.current.setSourceToConnect(makeSource());
      result.current.setEmail("user@example.com");
      result.current.setPassword("secret");
    });

    // Start the async login — the setTimeout fires inside the function
    await act(async () => {
      const loginPromise = result.current.handleLogin();
      vi.advanceTimersByTime(1500);
      await loginPromise;
    });

    expect(result.current.authStep).toBe("permissions");
    expect(result.current.isLoggingIn).toBe(false);
  });

  it("sets isLoggingIn to true before the delay resolves", async () => {
    const { result } = renderHook(() => useCredentialAuthModal(makeArgs()));

    act(() => {
      result.current.setSourceToConnect(makeSource());
      result.current.setEmail("user@example.com");
      result.current.setPassword("secret");
    });

    // Kick off login but do NOT advance timers yet
    act(() => {
      void result.current.handleLogin();
    });

    expect(result.current.isLoggingIn).toBe(true);

    // Clean up: advance past the timer so no state update leaks
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
  });
});

// ─── handleApprove ────────────────────────────────────────────────────────────

describe("useCredentialAuthModal — handleApprove", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when sourceToConnect is null", () => {
    const onDataSourcesChange = vi.fn();
    const toast = vi.fn();
    const { result } = renderHook(() =>
      useCredentialAuthModal(makeArgs({ onDataSourcesChange, toast })),
    );

    act(() => {
      result.current.handleApprove();
    });

    expect(onDataSourcesChange).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it("calls onDataSourcesChange with a state-updater, resets state, and fires the success toast (string[] form)", () => {
    const onDataSourcesChange = vi.fn();
    const toast = vi.fn();
    const source = makeSource();
    const { result } = renderHook(() =>
      useCredentialAuthModal(
        makeArgs({
          onDataSourcesChange,
          toast,
          objectsSynced: ["Contacts", "Leads"],
          successTitle: "Salesforce Connected",
        }),
      ),
    );

    act(() => {
      result.current.setSourceToConnect(source);
      result.current.setEmail("admin@acme.com");
    });

    act(() => {
      result.current.handleApprove();
    });

    // onDataSourcesChange is called with a functional updater
    expect(onDataSourcesChange).toHaveBeenCalledTimes(1);
    const updater = onDataSourcesChange.mock.calls[0][0] as (prev: DataSource[]) => DataSource[];

    // Run the updater with a list containing the source
    const updated = updater([source]);
    expect(updated).toHaveLength(1);
    const patched = updated[0];
    expect(patched.status).toBe("connected");
    expect(patched.account).toBe("admin@acme.com");
    expect(patched.lastSyncStatus).toBe("success");
    // objectsSynced is the static array passed in
    expect(patched.objectsSynced).toEqual(["Contacts", "Leads"]);
    // numeric fields are in expected ranges
    expect(patched.totalRecords).toBeGreaterThanOrEqual(100);
    expect(patched.totalRecords).toBeLessThanOrEqual(5100);
    expect(patched.dataQualityScore).toBeGreaterThanOrEqual(80);
    expect(patched.dataQualityScore).toBeLessThanOrEqual(100);

    // Modal closed + state reset
    expect(result.current.isOpen).toBe(false);
    expect(result.current.authStep).toBe("login");
    expect(result.current.email).toBe("");

    // Success toast uses the string title
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Salesforce Connected" }));
  });

  it("invokes the objectsSynced resolver and passes back the resolved array", () => {
    const onDataSourcesChange = vi.fn();
    const linkedInSource = makeSource({ id: "src-li", name: "LinkedIn Company", type: "social" });
    const objectsSyncedResolver = vi.fn((s: DataSource) =>
      s.name === "LinkedIn Company" ? ["Company Updates", "Follower Analytics"] : ["Sales Leads"],
    );

    const { result } = renderHook(() =>
      useCredentialAuthModal(
        makeArgs({ onDataSourcesChange, objectsSynced: objectsSyncedResolver }),
      ),
    );

    act(() => {
      result.current.setSourceToConnect(linkedInSource);
    });

    act(() => {
      result.current.handleApprove();
    });

    expect(objectsSyncedResolver).toHaveBeenCalledWith(linkedInSource);
    const updater = onDataSourcesChange.mock.calls[0][0] as (prev: DataSource[]) => DataSource[];
    const patched = updater([linkedInSource])[0];
    expect(patched.objectsSynced).toEqual(["Company Updates", "Follower Analytics"]);
  });

  it("resolver branch: different source name produces a different objectsSynced result", () => {
    const onDataSourcesChange = vi.fn();
    const salesNavSource = makeSource({
      id: "src-li2",
      name: "LinkedIn Sales Navigator",
      type: "social",
    });
    const objectsSyncedResolver = (s: DataSource) =>
      s.name === "LinkedIn Company" ? ["Company Updates", "Follower Analytics"] : ["Sales Leads"];

    const { result } = renderHook(() =>
      useCredentialAuthModal(
        makeArgs({ onDataSourcesChange, objectsSynced: objectsSyncedResolver }),
      ),
    );

    act(() => {
      result.current.setSourceToConnect(salesNavSource);
    });
    act(() => {
      result.current.handleApprove();
    });

    const updater = onDataSourcesChange.mock.calls[0][0] as (prev: DataSource[]) => DataSource[];
    const patched = updater([salesNavSource])[0];
    expect(patched.objectsSynced).toEqual(["Sales Leads"]);
  });

  it("invokes the successTitle resolver with the source", () => {
    const toast = vi.fn();
    const onDataSourcesChange = vi.fn();
    const source = makeSource({ name: "LinkedIn Company" });
    const titleResolver = vi.fn((s: DataSource) => `${s.name} Connected`);

    const { result } = renderHook(() =>
      useCredentialAuthModal(makeArgs({ toast, onDataSourcesChange, successTitle: titleResolver })),
    );

    act(() => {
      result.current.setSourceToConnect(source);
    });
    act(() => {
      result.current.handleApprove();
    });

    expect(titleResolver).toHaveBeenCalledWith(source);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "LinkedIn Company Connected" }),
    );
  });

  it("non-matching source id in the state array is left unchanged by the updater", () => {
    const onDataSourcesChange = vi.fn();
    const otherSource = makeSource({ id: "src-other" });
    const targetSource = makeSource({ id: "src-target" });

    const { result } = renderHook(() => useCredentialAuthModal(makeArgs({ onDataSourcesChange })));

    act(() => {
      result.current.setSourceToConnect(targetSource);
    });
    act(() => {
      result.current.handleApprove();
    });

    const updater = onDataSourcesChange.mock.calls[0][0] as (prev: DataSource[]) => DataSource[];
    // otherSource should not be mutated
    const updated = updater([otherSource, targetSource]);
    expect(updated[0]).toBe(otherSource);
    expect(updated[1].status).toBe("connected");
  });
});

// ─── handleDeny ───────────────────────────────────────────────────────────────

describe("useCredentialAuthModal — handleDeny", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resets state and fires a deny toast", () => {
    const toast = vi.fn();
    const { result } = renderHook(() => useCredentialAuthModal(makeArgs({ toast })));

    act(() => {
      result.current.setIsOpen(true);
      result.current.setSourceToConnect(makeSource());
      result.current.setEmail("user@example.com");
    });

    act(() => {
      result.current.handleDeny();
    });

    // State reset
    expect(result.current.isOpen).toBe(false);
    expect(result.current.email).toBe("");
    expect(result.current.authStep).toBe("login");
    expect(result.current.sourceToConnect).toBeNull();

    // Deny toast
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Connection not authorized",
        description: "Access was denied.",
      }),
    );
  });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe("useCredentialAuthModal — reset", () => {
  it("clears all form and auth state back to initial values", () => {
    const { result } = renderHook(() => useCredentialAuthModal(makeArgs()));

    act(() => {
      result.current.setIsOpen(true);
      result.current.setEmail("someone@example.com");
      result.current.setPassword("hunter2");
      result.current.setSourceToConnect(makeSource());
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.email).toBe("");
    expect(result.current.password).toBe("");
    expect(result.current.sourceToConnect).toBeNull();
    expect(result.current.authStep).toBe("login");
  });
});
