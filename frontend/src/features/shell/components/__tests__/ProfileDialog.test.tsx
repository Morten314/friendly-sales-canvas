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

  it("falls back to brewra.com when orgId is absent", () => {
    authState.orgId = null;
    renderDialog();
    expect(screen.getByText("brewra.com")).toBeInTheDocument();
  });
});
