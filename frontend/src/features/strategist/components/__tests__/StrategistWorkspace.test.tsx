/**
 * StrategistWorkspace — empty-leads mount test.
 *
 * Phase 8 stage 8d safety net (no Playwright journey for strategist).
 *
 * The workspace renders a two-panel dashboard from props only; the `/chat/`
 * fetch fires solely on user send, never on mount. We still register an MSW
 * handler for the direct backend URL defensively (the global setup uses
 * onUnhandledRequest:"error") so the empty-leads mount stays green even if a
 * future change adds a mount-time fetch.
 *
 * Network note: StrategistWorkspace fetches `${BACKEND_BASE_URL}/chat/` directly
 * — that bypasses the `/api` vite proxy, so the handler mocks the FULL backend
 * URL (https://brewra-gtm-intelligence.onrender.com/chat/), not `/api/...`.
 */

import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it } from "vitest";

import StrategistWorkspace from "../StrategistWorkspace";

import { BACKEND_BASE_URL } from "@/shared/api/transport";
import { server } from "@/test/msw/server";

// The chat panel scrolls the latest message into view on mount via
// Element.scrollIntoView, which jsdom does not implement. Polyfill it locally
// (scoped to this file, not shared setup) — same convention as IcpWizard.test
// and ContextChat.test.
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

function renderWorkspace() {
  return render(
    <MemoryRouter>
      <StrategistWorkspace leads={[]} triggerPrompt="" onBack={() => {}} />
    </MemoryRouter>,
  );
}

describe("StrategistWorkspace — empty leads", () => {
  it("mounts the dashboard and chat panels without crashing", () => {
    // Defensive: the chat endpoint returns the empty shape `handleSendChat`
    // expects (`data.response`). Not hit on mount, but keeps the direct-URL
    // contract documented and green under onUnhandledRequest:"error".
    server.use(http.get(`${BACKEND_BASE_URL}/chat/`, () => HttpResponse.json({ response: "" })));

    renderWorkspace();

    // Dashboard quick-actions block + chat panel header are stable mount signals.
    expect(screen.getByText("Quick Actions")).toBeInTheDocument();
    expect(screen.getByText("Chat with Strategist")).toBeInTheDocument();
    // Empty chat shows its idle prompt rather than any message bubbles.
    expect(screen.getByText(/Ask Strategist to refine angles/i)).toBeInTheDocument();
  });
});
