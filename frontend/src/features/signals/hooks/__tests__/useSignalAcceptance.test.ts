import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useSignalAcceptance } from "../useSignalAcceptance";

describe("useSignalAcceptance", () => {
  beforeEach(() => localStorage.clear());

  it("markAccepted persists to signals_<uid>_accepted and exposes the id", () => {
    const { result } = renderHook(() => useSignalAcceptance("u1"));

    act(() => result.current.markAccepted("sig-1"));

    expect(result.current.accepted).toContain("sig-1");
    const raw = localStorage.getItem("signals_u1_accepted");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toContain("sig-1");
  });

  it("markRejected persists to signals_<uid>_rejected and exposes the id", () => {
    const { result } = renderHook(() => useSignalAcceptance("u1"));

    act(() => result.current.markRejected("sig-2"));

    expect(result.current.rejected).toContain("sig-2");
    const raw = localStorage.getItem("signals_u1_rejected");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toContain("sig-2");
  });

  it("uses the exact literal key format for a given uid", () => {
    const { result } = renderHook(() => useSignalAcceptance("u1"));

    act(() => {
      result.current.markAccepted("a");
      result.current.markRejected("r");
    });

    expect(localStorage.getItem("signals_u1_accepted")).toBe(JSON.stringify(["a"]));
    expect(localStorage.getItem("signals_u1_rejected")).toBe(JSON.stringify(["r"]));
  });

  it("dedups repeated ids through the backing Set", () => {
    const { result } = renderHook(() => useSignalAcceptance("u1"));

    act(() => {
      result.current.markAccepted("dup");
      result.current.markAccepted("dup");
    });

    expect(result.current.accepted).toEqual(["dup"]);
    expect(JSON.parse(localStorage.getItem("signals_u1_accepted") as string)).toEqual(["dup"]);
  });

  it("reads pre-seeded localStorage on initial render", () => {
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["x"]));
    localStorage.setItem("signals_u1_rejected", JSON.stringify(["y"]));

    const { result } = renderHook(() => useSignalAcceptance("u1"));

    expect(result.current.accepted).toContain("x");
    expect(result.current.rejected).toContain("y");
  });

  it("defaults to empty arrays when nothing is stored", () => {
    const { result } = renderHook(() => useSignalAcceptance("u1"));

    expect(result.current.accepted).toEqual([]);
    expect(result.current.rejected).toEqual([]);
  });
});
