import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadStreamPanel, getLeadCountForICP } from "../LeadStream";

describe("LeadStream", () => {
  it("renders the panel", () => {
    const { container } = render(<LeadStreamPanel filterByICP={null} onClearFilter={() => {}} />);
    expect(container).toBeTruthy();
  });

  it("getLeadCountForICP returns a number", () => {
    expect(typeof getLeadCountForICP("ICP 1")).toBe("number");
  });
});
