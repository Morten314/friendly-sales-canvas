// Spec 15 §3.3 — characterization for the shared rate limiter.
// Canonical implementation: src/shared/api/rateLimiter.ts (spec 20 §3.2).
// vi.resetModules() re-imports a fresh singleton on each test so requestHistory
// does not leak between tests.
//
// IMPORTANT: spec 15 §3.3 asserts the cap is "4 req/min." The actual default is
// RATE_LIMIT_RPM = 30 (src/shared/api/rateLimiter.ts). Tests below assert the ACTUAL
// behavior (30 default), and exercise the boundary on a custom-config instance at
// low cap for clean assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("rateLimitManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("singleton default config", () => {
    it("exports a singleton at default 30 req/min cap (NOT spec-stated 4)", async () => {
      const { rateLimiter: rateLimitManager } = await import("@/shared/api/rateLimiter");
      const status = rateLimitManager.getQueueStatus();
      expect(status.maxRequestsPerMinute).toBe(30);
    });

    it("queue starts empty", async () => {
      const { rateLimiter: rateLimitManager } = await import("@/shared/api/rateLimiter");
      expect(rateLimitManager.getQueueStatus().queueLength).toBe(0);
      expect(rateLimitManager.getQueueStatus().requestsThisMinute).toBe(0);
    });
  });

  describe("custom-config RateLimitManager (cap = 2)", () => {
    // Using a low cap makes boundary assertions clean and avoids running 30+
    // promises in tight succession.
    it("runs requests up to the cap immediately", async () => {
      vi.setSystemTime(new Date("2026-05-08T10:00:00.000Z"));
      const { RateLimitManager } = await import("@/shared/api/rateLimiter");
      const m = new RateLimitManager({
        maxRequestsPerMinute: 2,
        maxRetries: 0,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitterMs: 0,
      });

      const calls: number[] = [];
      const p1 = m.executeWithRateLimit(async () => {
        calls.push(1);
        return "a";
      });
      const p2 = m.executeWithRateLimit(async () => {
        calls.push(2);
        return "b";
      });

      await vi.runAllTimersAsync();
      expect(await p1).toBe("a");
      expect(await p2).toBe("b");
      expect(calls).toEqual([1, 2]);
      expect(m.getQueueStatus().requestsThisMinute).toBe(2);
    });

    it("queues a request beyond the cap until the rolling window slides", async () => {
      vi.setSystemTime(new Date("2026-05-08T10:00:00.000Z"));
      const { RateLimitManager } = await import("@/shared/api/rateLimiter");
      const m = new RateLimitManager({
        maxRequestsPerMinute: 2,
        maxRetries: 0,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitterMs: 0,
      });

      // Fire 2 requests to fill the window
      const calls: number[] = [];
      const p1 = m.executeWithRateLimit(async () => {
        calls.push(1);
        return 1;
      });
      const p2 = m.executeWithRateLimit(async () => {
        calls.push(2);
        return 2;
      });
      await vi.runAllTimersAsync();
      expect(await p1).toBe(1);
      expect(await p2).toBe(2);
      expect(calls).toEqual([1, 2]);

      // Third request enters the queue but cannot dispatch (cap hit). The
      // processQueue internal wait caps at 1000ms (see source line 83).
      const p3 = m.executeWithRateLimit(async () => {
        calls.push(3);
        return 3;
      });
      // Run pending timers a few times so the queue's poll-wait loop iterates
      // without advancing wall clock past the 60s window.
      await vi.advanceTimersByTimeAsync(500);
      expect(calls).toEqual([1, 2]); // 3rd has not dispatched

      // Slide past 60s — the cleanupOldRequests filter at line 36-41 drops
      // the first two history entries and the third can dispatch.
      vi.setSystemTime(new Date("2026-05-08T10:01:01.000Z"));
      await vi.advanceTimersByTimeAsync(1000);
      expect(await p3).toBe(3);
      expect(calls).toEqual([1, 2, 3]);
    });

    it("rejects non-rate-limit errors immediately (no retry path)", async () => {
      vi.setSystemTime(new Date("2026-05-08T10:00:00.000Z"));
      const { RateLimitManager } = await import("@/shared/api/rateLimiter");
      const m = new RateLimitManager({
        maxRequestsPerMinute: 5,
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitterMs: 0,
      });

      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const p = m.executeWithRateLimit(async () => {
        throw new Error("something broke");
      });
      // Attach the rejection assertion BEFORE advancing timers so the promise
      // is already observed when processQueue rejects it (avoids unhandled
      // rejection warning from the timing gap between reject() and await).
      const assertion = expect(p).rejects.toThrow("something broke");
      await vi.runAllTimersAsync();
      await assertion;
      errSpy.mockRestore();
    });

    it("retries rate-limit-classified errors up to maxRetries", async () => {
      vi.setSystemTime(new Date("2026-05-08T10:00:00.000Z"));
      const { RateLimitManager } = await import("@/shared/api/rateLimiter");
      const m = new RateLimitManager({
        maxRequestsPerMinute: 5,
        maxRetries: 2,
        baseDelayMs: 50,
        maxDelayMs: 100,
        jitterMs: 0,
      });

      // Suppress the manager's own console.error and console.log to keep the
      // test output clean.
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});

      let attempts = 0;
      const p = m.executeWithRateLimit(async () => {
        attempts++;
        if (attempts < 3) throw new Error("rate limit exceeded");
        return "ok";
      });
      await vi.runAllTimersAsync();
      expect(await p).toBe("ok");
      expect(attempts).toBe(3); // initial + 2 retries
    });

    it("classifies common rate-limit error strings (isRateLimitError fan-out)", async () => {
      vi.setSystemTime(new Date("2026-05-08T10:00:00.000Z"));
      const { RateLimitManager } = await import("@/shared/api/rateLimiter");
      const m = new RateLimitManager({
        maxRequestsPerMinute: 5,
        maxRetries: 1,
        baseDelayMs: 10,
        maxDelayMs: 50,
        jitterMs: 0,
      });
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});

      // Each string triggers the retry path → attempts === 2.
      // Covers all 12 substrings in isRateLimitError (rateLimitManager.ts:130-142)
      // so Phase 1+ refactors can't silently drop a phrase (notably the
      // DeepSeek-specific string, which would otherwise be invisible).
      const phrases = [
        "rate limit",
        "429",
        "model_rate_limit",
        "deepseek-r1-distill-llama-70b-free",
        "too many requests",
        "quota exceeded",
        "throttled",
        "rate_limit_exceeded",
        "api rate limit",
        "request limit",
        "concurrent request limit",
        "model rate limit exceeded",
      ];
      for (const phrase of phrases) {
        let attempts = 0;
        const p = m.executeWithRateLimit(async () => {
          attempts++;
          if (attempts < 2) throw new Error(phrase);
          return "ok";
        });
        await vi.runAllTimersAsync();
        await p;
        expect(attempts).toBe(2);
      }
    });
  });

  describe("clearQueue", () => {
    it('rejects every queued request with "Queue cleared"', async () => {
      vi.setSystemTime(new Date("2026-05-08T10:00:00.000Z"));
      const { RateLimitManager } = await import("@/shared/api/rateLimiter");
      const m = new RateLimitManager({
        maxRequestsPerMinute: 1,
        maxRetries: 0,
        baseDelayMs: 50,
        maxDelayMs: 100,
        jitterMs: 0,
      });

      // Saturate the cap so subsequent requests queue
      const p1 = m.executeWithRateLimit(async () => "first");
      await vi.runAllTimersAsync();
      await p1;

      const p2 = m.executeWithRateLimit(async () => "queued");
      // Don't advance enough to let it run.
      await vi.advanceTimersByTimeAsync(10);

      m.clearQueue();
      await expect(p2).rejects.toThrow("Queue cleared");
    });
  });

  describe("executeWithRateLimit helper export", () => {
    it("forwards to the singleton", async () => {
      vi.setSystemTime(new Date("2026-05-08T10:00:00.000Z"));
      const { executeWithRateLimit, rateLimiter: rateLimitManager } =
        await import("@/shared/api/rateLimiter");
      vi.spyOn(console, "log").mockImplementation(() => {});
      const p = executeWithRateLimit(async () => "via-helper", "TestCaller");
      await vi.runAllTimersAsync();
      expect(await p).toBe("via-helper");
      // The singleton's requestHistory recorded the call.
      expect(rateLimitManager.getQueueStatus().requestsThisMinute).toBeGreaterThanOrEqual(1);
    });
  });
});
