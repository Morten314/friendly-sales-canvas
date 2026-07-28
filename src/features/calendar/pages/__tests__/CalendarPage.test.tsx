import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import CalendarPage from "../CalendarPage";

// Layout pulls in router/sidebar/auth; stub it to render children directly.
vi.mock("@/features/shell", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("CalendarPage", () => {
  it("mounts and sets the Activator page title", () => {
    const { container } = render(<CalendarPage />);
    expect(container).not.toBeEmptyDOMElement();
    expect(document.title).toBe("⚡ Activator - Brewra");
  });
});
