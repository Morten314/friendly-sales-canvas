import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileDialog } from "../ProfileDialog";

import { PopoverTrigger } from "@/components/ui/popover";

const authState = vi.hoisted(() => ({
  currentUser: { email: "a@b.co" } as { email: string } | null,
  orgId: "org-xyz" as string | null,
}));

vi.mock("@/shared/auth", () => ({
  useAuth: () => authState,
}));

afterEach(() => {
  authState.currentUser = { email: "a@b.co" };
  authState.orgId = "org-xyz";
});

function renderDialog() {
  return render(
    <ProfileDialog open onOpenChange={vi.fn()} fullName="Ada Lovelace">
      <PopoverTrigger asChild>
        <button type="button">trigger</button>
      </PopoverTrigger>
    </ProfileDialog>,
  );
}

describe("ProfileDialog", () => {
  it("derives the managed-by domain from orgId", () => {
    renderDialog();
    expect(screen.getByText("org-xyz.com")).toBeInTheDocument();
  });

  it("shows no managed-by domain when orgId is absent (no placeholder tenant)", () => {
    authState.orgId = null;
    renderDialog();
    // No placeholder domain leaks in (spec 48 WS1b — was "brewra.com").
    expect(screen.queryByText("brewra.com")).not.toBeInTheDocument();
    // The managed-by link itself still renders, just empty (cosmetic-only fix:
    // organizationDomain is "" rather than a fallback host). PopoverContent
    // renders via a Radix Portal onto document.body, outside RTL's `container`
    // — query the document directly rather than the (portal-blind) container.
    const managedByLink = document.querySelector('a[href="https://"]');
    expect(managedByLink).toBeInTheDocument();
    expect(managedByLink?.textContent).toBe("");
  });
});
