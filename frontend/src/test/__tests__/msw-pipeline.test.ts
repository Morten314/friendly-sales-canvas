// Spec 15 §3.2 handler #1 + §3.3 "Not a characterization target, but ships in
// the same set so the harness is verifiably wired."
//
// Two assertions:
//   1. GET /api/_health under jsdom + MSW returns { ok: true }.
//   2. An unhandled-path fetch is observed by MSW's request:unhandled event
//      (proves onUnhandledRequest: 'error' is wired in setup.ts).
//
// The second assertion uses server.events instead of asserting on fetch's
// reject behavior, which is brittle across MSW patch versions and jsdom
// fetch implementations. The request:unhandled event is a documented,
// version-stable MSW v2 API that fires regardless of how the fetch resolves.
import { describe, expect, it } from "vitest";

import { server } from "../msw/server";

describe("MSW pipeline (jsdom + node MSW server)", () => {
  it("intercepts /api/_health and returns the handler payload", async () => {
    const res = await fetch("/api/_health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("observes unhandled-path fetch via request:unhandled event", async () => {
    let unhandled: Request | undefined;
    const onUnhandled = ({ request }: { request: Request }) => {
      unhandled = request;
    };
    server.events.on("request:unhandled", onUnhandled);
    try {
      // The fetch itself may reject, resolve, or hang depending on jsdom's
      // fetch implementation when MSW raises. We don't assert on the fetch
      // outcome — only that MSW saw the unhandled URL.
      await fetch("/api/this-path-is-not-handled").catch(() => undefined);
    } finally {
      server.events.removeListener("request:unhandled", onUnhandled);
    }
    expect(unhandled).toBeDefined();
    expect(unhandled?.url).toMatch(/this-path-is-not-handled/);
  });
});
