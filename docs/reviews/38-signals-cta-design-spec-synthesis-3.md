---
synthesizes_review: docs/reviews/38-signals-cta-design-spec-review-3-glm-5.2.md
artifact: specs/38-signals-cta-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-19
round: 3
---

## Round Recommendation

no

Reason: All 3 findings agreed (1 Medium + 2 Low), each fixed by a contained wording/coverage edit; no Critical/High remains and no new design surface — the spec is ready after these revisions.

## Agreed Findings

- **[Medium] "Mark TD-FE-73 resolved" contradicts the TD's own acceptance criterion.** TD-FE-73 (`TECH_DEBT.md`) requires a *populated* `(user_id, org_id)` capture; the spec grounds the sub-shapes on the backend's deterministic `_parse_mapping` + an empty-map live capture (sound, and the branch is not blocked), but then says "mark resolved" while deferring the populated re-capture — leaving the empirical sub-shape validation untracked. **Revision:** the spec instructs to **keep TD-FE-73 open**, record the in-branch progress (envelope confirmed live + contract tightened against the server-normalized `_parse_mapping` shape), and **narrow its remaining required-action** to the populated empirical re-capture (do it when an org has both signals and leads). Do **not** close the TD in this branch.

- **[Low] Tightening guidance omits the always-present top-level `status` field.** `_build_result` always returns `status:"success"`; the FE schema currently tolerates it only via the outer `.passthrough()` and does not consume it. **Revision:** the tightening guidance now enumerates `status` explicitly — when dropping `.passthrough()`, either model `status` (and the other FE-ignored extras `generated_at`/`cached`) or rely on zod's default key-strip, and **do not** apply `.strict()` to shapes where the backend sends fields the FE ignores. (Precision note recorded: a plain `z.object` *strips* unknown keys rather than throwing; only `.strict()` would reject — so this is a correctness-of-modeling fix, not an avoid-a-throw fix, except under `.strict()`.)

- **[Low] Test list misses two round-2-added behaviours.** **Revision:** add (a) a recompute test — error state → recompute triggers a real refetch/invalidate → section transitions loading → resolved (guards against the prior silent no-op); and (b) a drain once-only test — mount → unmount → remount asserts the queued item is not re-prepended/duplicated (guards the clear-on-drain semantics).

## Disagreed Findings

None.

## Deferred Findings

None. (The populated TD-FE-73 re-capture is not a deferred *finding* — it is the TD's own remaining scope, now correctly left open per finding 1.)

## Severity Disagreements

None. Medium for finding 1 is fair (TD-honesty/traceability, not a functional defect); findings 2–3 are correctly Low. The one precision caveat on finding 2 ("reject" vs zod default-strip) does not change its severity.

## Open Questions

None.
