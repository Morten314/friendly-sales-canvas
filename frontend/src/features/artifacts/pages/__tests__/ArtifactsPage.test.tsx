import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ArtifactsPage from "../ArtifactsPage";

vi.mock("@/features/shell", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("ArtifactsPage", () => {
  it("mounts and sets the Artefacts page title", () => {
    const { container } = render(<ArtifactsPage />);
    expect(container).not.toBeEmptyDOMElement();
    expect(document.title).toBe("Artefacts - Brewra");
  });
});
