import { describe, expect, it } from "vitest";

import { deriveApolloTileState } from "../tileState";

const base = { connected: true, credentialError: false };

describe("deriveApolloTileState", () => {
  it("disconnected when not connected", () => {
    expect(deriveApolloTileState({ ...base, connected: false }, undefined, undefined)).toBe(
      "disconnected",
    );
  });
  it("locked when connected but warmup not unlocked", () => {
    expect(deriveApolloTileState(base, { unlocked: false }, undefined)).toBe("locked");
  });
  it("locked when warmup not yet loaded (undefined)", () => {
    expect(deriveApolloTileState(base, undefined, undefined)).toBe("locked");
  });
  it("error when credential status is error (UC9), regardless of warmup", () => {
    expect(
      deriveApolloTileState({ ...base, credentialError: true }, { unlocked: true }, undefined),
    ).toBe("error");
  });
  it("error on credential error even when warmup is locked (UC9 precedence)", () => {
    expect(
      deriveApolloTileState({ ...base, credentialError: true }, { unlocked: false }, undefined),
    ).toBe("error");
  });
  it("running when latest run is queued/processing", () => {
    expect(deriveApolloTileState(base, { unlocked: true }, { status: "processing" })).toBe(
      "running",
    );
  });
  it("unlocked when ready and no active/finished run", () => {
    expect(deriveApolloTileState(base, { unlocked: true }, undefined)).toBe("unlocked");
  });
  it("complete on a successful run", () => {
    expect(deriveApolloTileState(base, { unlocked: true }, { status: "completed" })).toBe(
      "complete",
    );
  });
  it("complete_empty on completed_empty", () => {
    expect(deriveApolloTileState(base, { unlocked: true }, { status: "completed_empty" })).toBe(
      "complete_empty",
    );
  });
  it("complete_partial on partial", () => {
    expect(deriveApolloTileState(base, { unlocked: true }, { status: "partial" })).toBe(
      "complete_partial",
    );
  });
  it("error on a failed run", () => {
    expect(deriveApolloTileState(base, { unlocked: true }, { status: "failed" })).toBe("error");
  });
});
