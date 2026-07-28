import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeAll, describe, expect, it, vi } from "vitest";

import ScoutChatPanel from "../ScoutChatPanel";

import { server } from "@/test/msw/server";

// Spec 48 WS1b: a Firebase-created, unmapped-org user has currentUser but
// orgId: null (see AuthContext.orgResolution.test.tsx). ScoutChatPanel must not
// paper over that with a placeholder tenant on the ask write path — mirrors
// the sibling frontend/src/shared/chat/__tests__/ContextChat.orgGuard.test.tsx.
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: null }),
}));

// ScoutChatPanel scrolls the transcript into view on update via
// Element.scrollIntoView, which jsdom does not implement (same polyfill as
// ContextChat's org-guard test).
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

// Minimal required props to mount ScoutChatPanel standalone — no Router or
// QueryClientProvider needed: unlike ContextChat, this component reads auth
// via useAuth() only and calls the browser fetch API directly (no TanStack
// Query, no useNavigate), so it renders in isolation with just the auth mock.
const requiredProps = {
  showScoutChat: true,
  isSplitView: false,
  hasEdits: false,
  showEditHistory: false,
  editHistory: [],
  lastEditedField: "",
  onClose: () => {},
};

describe("ScoutChatPanel org guard", () => {
  it("does not POST /api/signal_ask_claude when orgId is null, and answers the stuck turn instead of leaving it hanging", async () => {
    const asked = vi.fn();
    // Register a real handler (not left unhandled) so the assertion is "the
    // spy was never invoked" rather than an opaque MSW onUnhandledRequest:
    // 'error' failure — a cleaner, more specific RED/GREEN signal (same
    // rationale as the ContextChat org-guard test).
    server.use(
      http.post("/api/signal_ask_claude", () => {
        asked();
        return HttpResponse.json({ answer: "" });
      }),
    );

    render(<ScoutChatPanel {...requiredProps} />);

    // context defaults to "market-size" -> useExpandedChatInput is false -> a
    // single real <Input> (role "textbox") renders, wired via onKeyDown ->
    // handleSendMessage on Enter (same real-submit-affordance discipline as
    // the ContextChat org-guard test).
    const textbox = screen.getByRole("textbox");
    fireEvent.change(textbox, { target: { value: "hi" } });
    fireEvent.keyDown(textbox, { key: "Enter" });

    // Let a (wrongly) fire-and-forget POST's promise chain settle before asserting.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(asked).not.toHaveBeenCalled();

    // Task 4 review fix: the guard used to `return` silently — after the
    // user's message was already appended to the transcript — leaving that
    // turn stuck with no answer and no explanation. It must now surface
    // feedback in the transcript so the turn isn't left hanging.
    expect(await screen.findByText(/workspace is still loading/i)).toBeInTheDocument();
  });
});
