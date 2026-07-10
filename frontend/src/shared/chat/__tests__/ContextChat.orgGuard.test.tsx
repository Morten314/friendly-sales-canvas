import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ContextChat, type ChatContext } from "@/shared/chat";
import { server } from "@/test/msw/server";

// Spec 48 WS1b: a Firebase-created, unmapped-org user has currentUser but
// orgId: null (see AuthContext.orgResolution.test.tsx). ContextChat must not
// paper over that with a placeholder tenant on the ask write path.
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: null }),
}));

function renderChat(context: ChatContext) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ContextChat context={context} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ContextChat scrolls the latest message into view on mount/update via
// Element.scrollIntoView, which jsdom does not implement (same polyfill as
// the sibling ContextChat.test.tsx).
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

describe("ContextChat org guard", () => {
  it("does not POST /api/signal_ask_claude when orgId is null, and answers the stuck turn instead of leaving it hanging", async () => {
    const asked = vi.fn();
    // Register a real handler (not left unhandled) so the assertion is "the
    // spy was never invoked" rather than an opaque MSW onUnhandledRequest:
    // 'error' failure — a cleaner, more specific RED/GREEN signal.
    server.use(
      http.post("/api/signal_ask_claude", () => {
        asked();
        return HttpResponse.json({ answer: "" });
      }),
    );

    // Empty prompt keeps the mount-time answer-prefetch effect a no-op (its
    // own bail condition already includes `|| !orgId`), isolating this test
    // to the handleSend call site, which had no orgId check at all pre-fix.
    renderChat({ agent: "scout", prompt: "" });

    // Real submit affordance: the textbox's onKeyDown wires Enter -> handleSend
    // (the same trigger the icon-only Send button uses). The Send button
    // itself has no title/aria-label and lucide-react icons carry no default
    // accessible name, so `getByRole("button", { name: /send|ask/i })` would
    // silently match nothing — that's the vacuous-pass trap this test avoids.
    const textbox = screen.getByRole("textbox");
    expect(textbox).toBeInTheDocument();
    fireEvent.change(textbox, { target: { value: "hi" } });
    fireEvent.keyDown(textbox, { key: "Enter" });

    // Let a (wrongly) fire-and-forget POST's promise chain settle before asserting.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(asked).not.toHaveBeenCalled();

    // Task 4 review fix: the guard used to `return` silently — after the user's
    // message was already appended to the transcript — leaving that turn stuck
    // with no answer and no explanation. It must now surface feedback in the
    // transcript so the optimistically-added user turn isn't left hanging.
    expect(await screen.findByText(/workspace is still loading/i)).toBeInTheDocument();
  });
});
