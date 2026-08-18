import { describe, it, expect } from "vitest";
import { buildCohortOutreachArtefact } from "@/features/signals/lib/signalBriefing";
import { saveArtefact, loadStoredArtefacts } from "@/features/artifacts";

describe("cohort artefact", () => {
  it("persists", () => {
    const a = buildCohortOutreachArtefact(
      { id: "sig1", agent: "Scout", headline: "H", snippet: "S", timestamp: new Date().toISOString() },
      "Tier 1 · decision makers",
      [{ day: 0, channel: "Email", action: "Intro", subject: "hi", body: "body" }],
      [{ lead_id: "l1", name: "A", company: "C", title: "T", email: "a@c.com", relevance: "high", why: "w" } as any],
    );
    console.log(JSON.stringify({ id: a.id, folder: a.folder }));
    saveArtefact(a);
    const all = loadStoredArtefacts();
    console.log(all.map((x) => `${x.id}|${x.folder}`));
    expect(all.some((x) => x.id === a.id)).toBe(true);
  });
});
