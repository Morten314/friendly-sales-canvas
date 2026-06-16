import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  ContextChat,
  readSessionChatContext,
  writeSessionChatContext,
  type ChatContext,
} from "@/shared/chat";
import { server } from "@/test/msw/server";

// ContextChat reads currentUser/orgId from useAuth and calls useNavigate.
// The real AuthProvider depends on Firebase (onAuthStateChanged) and only renders
// children once loading resolves, so it never mounts children under jsdom. The
// established pattern in the sibling ProfilerChatWithHistory test is to stub
// useAuth directly; useNavigate is satisfied by a MemoryRouter wrapper.
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

// Behavioural harness: render via the real public surface (props + providers),
// not the fetch internals. The signal_Ask/signal_action calls now flow through
// shared TanStack mutation hooks, so a QueryClientProvider is required; MSW still
// intercepts at the network boundary, so the public-surface assertions are stable.
function renderChat(context: ChatContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ContextChat context={context} />
      </MemoryRouter>
    </QueryClientProvider>,
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

describe("ContextChat (substrate)", () => {
  it("renders the provided context and a message input", () => {
    // A context with a prompt but no answer triggers the answer-prefetch effect
    // (POST /api/signal_ask_claude). setup.ts runs MSW with onUnhandledRequest: "error",
    // and this task ships no global handler, so scope one locally. We assert on
    // signalHeading, which the collapsed context summary renders verbatim (the
    // bare prompt is only shown once the summary is expanded).
    server.use(http.post("/api/signal_ask_claude", () => HttpResponse.json({ answer: "" })));

    const context: ChatContext = {
      agent: "scout",
      signalHeading: "ACME expanding into EU market",
      prompt: "Why this signal?",
    };

    renderChat(context);

    expect(screen.getByText(/ACME expanding into EU market/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("round-trips a chat context through sessionStorage", () => {
    const ctx = { agent: "scout", prompt: "hi" } as const;
    writeSessionChatContext(ctx);
    expect(readSessionChatContext()).toEqual(ctx);
  });
});
