import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { LeadStreamPanel } from "../LeadStream";

beforeAll(() => {
  if (!window.HTMLElement.prototype.scrollIntoView)
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("LeadStreamPanel source filter (G6)", () => {
  it("renders the source-filter trigger defaulting to 'All leads'", () => {
    render(<LeadStreamPanel />);
    const trigger = screen.getByRole("combobox", { name: /filter by lead source/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent(/all leads/i);
  });
});
