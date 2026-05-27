---
artifact: phase-0a-inventory
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-26
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Branch `phase-0a-inventory` has 8 commits implementing Spec 15 §2 Phase 0a against plan `plans/15a-frontend-phase-0a-inventory.md`. Commit order matches plan task order (Tasks 1–8). Spec §2.9 done-when checklist is fully satisfied at the file-existence level. The `ScoutChatWithHistory`/`ProfilerChatWithHistory` duplicate components are at `src/components/signals/`, not `src/components/strategist/` as stated in the plan — the implementation correctly found and annotated them at their actual location.

## Findings

### [Medium] Missing LeadStream duplicate annotation in scorecard

**Location:** `docs/audits/2026-05-26-frontend-baseline.md` — rows for `src/components/customers/LeadStream.tsx` (line 49) and `src/components/market-research/LeadStream.tsx` (line 74)

Spec §1.5 calls out "the duplicate `LeadStream`" as a known frontend duplicate. Plan Task 7 Step 5's augmentation table says: "`LeadStream` if duplicated under market-research/ — flag the duplicate." Both Tier-2 rows exist in the scorecard (`customers/LeadStream.tsx` at 433 LOC, `market-research/LeadStream.tsx` at 1 LOC and dead) but neither carries a "duplicate of ..." note. The manual augmentation pass (Task 7 Step 5) missed this entry.

Fix: append `duplicate of src/components/customers/LeadStream.tsx` to the `market-research/LeadStream.tsx` row's notes column, or add a note to both rows.

### [Low] NFR baseline cpu_model metadata is a numeric code instead of human-readable name

**Location:** `docs/audits/2026-05-26-frontend-nfr-baseline.json:6` — `"cpu_model": "06/97"`

The `measure-baselines.sh` fallback for non-Darwin Linux runs:
```bash
CPU_MODEL="$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | sed 's/.*: //' || uname -m)"
```
On this environment, the output is `"06/97"` (a CPU family/model number) rather than a brand string like "Intel(R) Core(TM) i7-...". This likely means `/proc/cpuinfo` has no `model name` field (common in containers/VMs), and the `|| uname -m` fallback returned the architecture string in an unexpected format, or a different `model` line matched. The metadata is cosmetic — Phase 2c uses the `hardware` block for environment comparison, not for display — but the `cpu_model` field is misleading as-is.

### [Nit] Total LOC 76,052 vs spec §1.3's 75,894

**Location:** `docs/audits/2026-05-26-frontend-baseline.md:8`

The scorecard reports 76,052 LOC across 158 files. Spec §1.3 says 75,894. The 158-file difference is likely due to trailing-newline counting methodology or minor tree drift between the spec's measurement and the plan's execution. Not actionable — the scorecard's machine-generated count is the authoritative baseline for Phase 1.

### [Nit] `build-audit-scorecard.ts` uses `any` type cast for knip JSON parsing

**Location:** `frontend/scripts/build-audit-scorecard.ts:143`

```ts
Object.entries(issuesField as Record<string, any>)
```

Acceptable for a one-off tooling script parsing external tool output with version-dependent JSON shape. The `loadKnip()` function's defensive handling (array-or-object) is well-structured. No change needed.
