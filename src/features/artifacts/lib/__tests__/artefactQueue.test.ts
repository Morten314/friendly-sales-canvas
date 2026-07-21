import { beforeEach, describe, expect, it } from "vitest";

import type { ArtefactItem } from "../../types";
import { drainArtefactQueue, enqueueArtefact, resetArtefactQueue } from "../artefactQueue";

const item = (id: string): ArtefactItem =>
  ({ id, fullReport: { title: id } }) as unknown as ArtefactItem;

describe("artefactQueue", () => {
  beforeEach(() => resetArtefactQueue());

  it("drains queued items in enqueue order, then is empty (once-only)", () => {
    enqueueArtefact(item("a"));
    enqueueArtefact(item("b"));
    expect(drainArtefactQueue().map((i) => i.id)).toEqual(["a", "b"]);
    expect(drainArtefactQueue()).toEqual([]);
  });

  it("resetArtefactQueue clears pending items", () => {
    enqueueArtefact(item("a"));
    resetArtefactQueue();
    expect(drainArtefactQueue()).toEqual([]);
  });
});
