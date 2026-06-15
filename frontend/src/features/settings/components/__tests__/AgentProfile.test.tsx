import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgentProfile } from "../AgentProfile";

describe("AgentProfile", () => {
  it("renders the agent profile form heading", () => {
    render(<AgentProfile isEditMode={false} onProfileUpdate={vi.fn()} />);
    expect(screen.getByText("Agent Profile Settings")).toBeInTheDocument();
  });
});
