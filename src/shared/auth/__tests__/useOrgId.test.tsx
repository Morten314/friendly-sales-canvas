import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../AuthContext", () => ({ useAuth: vi.fn() }));
import { useAuth } from "../AuthContext";
import { useOrgId } from "../useOrgId";

describe("useOrgId", () => {
  it("returns the auth org id", () => {
    vi.mocked(useAuth).mockReturnValue({ orgId: "org-123" } as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => useOrgId());
    expect(result.current).toBe("org-123");
  });

  it("returns null before auth resolves", () => {
    vi.mocked(useAuth).mockReturnValue({ orgId: null } as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => useOrgId());
    expect(result.current).toBeNull();
  });
});
