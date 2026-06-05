import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { SignalsContextChat, type SignalsChatContext } from "@/shared/chat";
import { server } from "@/test/msw/server";

// SignalsContextChat reads currentUser/orgId from useAuth and calls useNavigate.
// The real AuthProvider depends on Firebase (onAuthStateChanged) and only renders
// children once loading resolves, so it never mounts children under jsdom. The
// established pattern in the sibling ProfilerChatWithHistory test is to stub
// useAuth directly; useNavigate is satisfied by a MemoryRouter wrapper.
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

// Behavioural harness: render via the real public surface (props + providers),
// not the fetch internals. A LATER task migrates the fetch calls to TanStack
// hooks; MSW intercepts at the network boundary, so this test survives that.
function renderChat(context: SignalsChatContext) {
  return render(
    <MemoryRouter>
      <SignalsContextChat context={context} />
    </MemoryRouter>,
  );
}

// The component scrolls the latest message into view on mount via
// Element.scrollIntoView, which jsdom does not implement. Polyfill it locally
// (scoped to this file, not shared setup) — same convention as IcpWizard.test.
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

describe("SignalsContextChat (substrate)", () => {
  it("renders the provided context and a message input", () => {
    // A context with a prompt but no answer triggers the answer-prefetch effect
    // (POST /api/signal_Ask). setup.ts runs MSW with onUnhandledRequest: "error",
    // and this task ships no global handler, so scope one locally. We assert on
    // signalHeading, which the collapsed context summary renders verbatim (the
    // bare prompt is only shown once the summary is expanded).
    server.use(http.post("/api/signal_Ask", () => HttpResponse.json({ answer: "" })));

    const context: SignalsChatContext = {
      agent: "scout",
      signalHeading: "ACME expanding into EU market",
      prompt: "Why this signal?",
    };

    renderChat(context);

    expect(screen.getByText(/ACME expanding into EU market/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});
