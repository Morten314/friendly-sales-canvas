---
artifact: specs/38-signals-cta-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-19
round: 3
---

## Context

Round 3. The spec was revised after round-2 review + synthesis-2. All 7 round-2
findings are addressed in this revision (verified against source, incl. the
backend grounding the revision newly leans on). This pass re-verified the new
backend claims against `backend/app/services/signals/lead_map.py` and the router
and finds them accurate; the findings below are residual items the revision
introduces or leaves open. I am the same model that produced rounds 1–2; the
critique below is independent of those, not a restatement.

## Findings

### [Medium] "Mark TD-FE-73 resolved" contradicts its own acceptance criteria — the populated live capture it requires is explicitly deferred

**Location:** Dependencies, "In scope (this branch)" (line 214, "mark TD-FE-73
`resolved` … once reconciled") and "Live capture status" (line 215, "Re-capture a
populated response when an org with both signals and leads exists … to confirm
the sub-shapes empirically"). Cross-ref: `docs/TECH_DEBT.md` TD-FE-73 body
(`:1112-1116`) — required action is *"call it with a real `(user_id, org_id)`
that has signals + leads, capture the JSON, and reconcile."*

TD-FE-73's stated acceptance criterion is a **populated** (signals + leads) live
capture. This revision resolves the in-branch tightening by grounding the
sub-shapes on the backend's deterministic `_parse_mapping` (which I verified —
`lead_map.py:137-160` rebuilds each lead and normalizes `relevance`), plus an
**empty-map** live capture (the only account checked has 3 signals, 0 leads).
That is a sound substitute for tightening and means the branch is *not* blocked.
But it then says "mark TD-FE-73 `resolved`" while the populated empirical
re-capture — the TD's literal required action — is deferred to "when an org with
both signals and leads exists." Closing the TD on code-grounding + an empty-map
capture would leave the empirical sub-shape validation untracked and contradict
the TD's own definition.

Either (a) keep TD-FE-73 **open** (or partially-resolved) until a populated live
capture confirms the sub-shapes, or (b) revise TD-FE-73's required-action text in
`TECH_DEBT.md` to accept the envelope-capture + code-grounded reconciliation as
sufficient, and record the populated re-capture as a lightweight follow-up note.
Pick one so the TD's "resolved" state is honest.

### [Low] Tightening the top-level envelope requires adding the always-present `status` field, which the spec's tightening guidance doesn't enumerate

**Location:** Dependencies tightening guidance (line 214, "drop `.passthrough()`
on shapes that prove stable, add fields the live response actually returns");
envelope claim (line 215). Cross-ref: `contracts.ts:26-36`
(`SignalLeadMapResponseSchema = z.object({ data: … }).passthrough()` — `status`
is tolerated via outer `.passthrough()`, not modeled); `lead_map.py:70-71`
(`_build_result` always returns `{"status": "success", …}`).

The live envelope always carries a top-level `status: "success"`. Today it's
unmodeled — it survives only because the outer object is `.passthrough()`. The
spec's tightening instruction ("drop `.passthrough()` on shapes that prove
stable") would, if applied to the top-level object, make the schema **reject**
the `status` field the backend always sends. The spec says "add fields the live
response actually returns" in general but never enumerates `status`. Spell out
that dropping the top-level `.passthrough()` requires explicitly modeling
`status` (a stable, always-present field), or the reconciled contract will throw
on the real response — the exact org-wide breakage the spec elsewhere works to
avoid.

### [Low] Test list doesn't cover two behaviours the round-2 revisions added

**Location:** Testing (lines 189–193). Cross-ref: the recompute-refetch fix
(line 66) and the drain once-only/clear semantics (lines 83, 170).

The revisions added two behaviours with no corresponding test in the list: (a)
recompute now must trigger a real refetch/invalidate and transition the section
out of the error state (line 66) — the prior bug was a silent no-op, so an
assertion that error → recompute → loading → resolved is exactly the guard that
prevents regression; (b) the drain is once-only (clears the queue, no
re-delivery on remount — line 83/170), which needs a mount→unmount→remount test
asserting the item isn't re-prepended/duplicated. Add both to the test list.

## Observations (no action)

- All 7 round-2 findings resolved in the revision (queue drain now mirrors the
  live listener incl. `setActiveFolder`/`setExpandedArtefact` + once-only clear;
  retention boundary corrected to "lost on navigating away from `/artifacts`";
  barrel re-exports all four symbols; PDF escaping adds common-punctuation ASCII
  fold; TD-FE-73 tightening keeps `.default("")`/`.catch("low")`; recompute wired
  to real refetch; `resetArtefactQueue()` added). Verified, not assumed.
- The new backend grounding is accurate. `_parse_mapping`
  (`lead_map.py:137-160`) deterministically rebuilds each lead
  `{lead_id, company, relevance, why}` and each entry `{signal_id, headline,
  leads[]}`, and **server-normalizes** `relevance` (`if rel not in _RELEVANCE:
  rel = "low"`, `:151-153`) with `company`/`why` defaulting to `""`. So grounding
  the contract on backend code (vs. an unavailable populated capture) is sound,
  and the 0-leads reality does **not** block the branch.
- The envelope `_build_result` (`lead_map.py:70-71`) returns
  `{"status":"success","data":{mapping,generated_at,cached}}`, and the 0-leads
  short-circuit (`:179-180`) returns an empty mapping — both match the spec's
  live-capture notes exactly.
- The spec is commendably honest that the feature's dominant case *today* is an
  empty map for every signal (no leads ingested), and frames the empty-state as a
  calm "not yet," not an error. Good product clarity; no action needed.
- Strategist's two dispatch sites remain broken until the noted follow-up adopts
  the queue (line 218); this is documented, not a new defect.
- Scope/detail has grown across rounds, but every addition traces to a review
  finding or an unblocked TD; no gold-plating, and the work still decomposes into
  ordered, testable tasks. Plan-readiness remains high.
