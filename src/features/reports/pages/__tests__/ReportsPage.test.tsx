import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ReportsPage from "../ReportsPage";

vi.mock("@/features/shell", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("ReportsPage", () => {
  it("mounts and sets the Presenter page title", () => {
    const { container } = render(<ReportsPage />);
    expect(container).not.toBeEmptyDOMElement();
    expect(document.title).toBe("📊 Presenter - Brewra");
  });
});
