# Spec 33 — Frontend Phase 14: Agent Affordances + Documentation Reconciliation

**Status:** Design — round 1
**Date:** 2026-06-07
**Type:** Phase design (implements Phase 14 of the master plan, Spec 14 §4)
**Master plan:** `specs/14-frontend-refactoring-master-plan-design.md` §4 "Phase 14 — Agent affordances", §6 "Definition of done"
**Paired plan:** _none yet — written next, `plans/33-frontend-phase-14-agent-affordances.md`_

---

## §1 Goal and context

### 1.1 Goal

Finalize the agent-readiness layer and close the master plan. Phase 14 is the capstone of the 17-phase frontend refactor (Spec 14): Phases 0–13 have shipped the structural work (features extracted, strict TS, tests, data layer, two LOC passes). Phase 14 does the finishing work that makes the codebase pleasant for agents to read and navigate, reconciles the project's critical documents into one well-organized set, and flips the master plan to done.

### 1.2 Reframe from the master-plan text

The master plan's Phase 14 block (Spec 14 §4) was written in round 4 on 2026-05-26, before Phases 5–13 ran. Measuring its nominal deliverables against `master` as of 2026-06-07 shows most are already satisfied, moot, or in tension with the project's established posture. This spec records that reconciliation explicitly (master-plan §5.5 "out-of-scope discoveries / amendments at merge" — the Phase 14 frozen-record delta in W8 carries these back into Spec 14):

| Master-plan §4 deliverable | State on `master` (2026-06-07) | Phase 14 disposition |
| --- | --- | --- |
| Backfill missing per-feature `README.md` | All 14 features + `features/README.md` + `shared/README.md` exist; 6 are thin stubs | **W3** — enrich stubs + verify accuracy (not backfill-from-scratch) |
| Dead-code watcher (`knip --strict`) | Already in the `preflight` chain (`npm run knip`) | Verify only — no work |
| `codemod-runner.sh` (runs `scripts/codemods/`) | Phase 13 produced **zero** codemods ("none — manual", Spec 32 delta); no `codemods/` dir | **Moot** — not built (§2.2) |
| Bundle delta watcher (warn +5%, fail +10%) | `bundle:check` exists, advisory (always exit 0) | **Stays advisory** (§2.2) — no post-launch data; master-plan §8 Q3 stays deferred |
| Consolidate ADRs (one per non-trivial decision) | 5 ADRs (0001–0005), no index; most decisions recorded as frozen-record deltas | **W6** — index + targeted backfill, not one-ADR-per-decision |
| `scaffold-feature` hardened | `scaffold-feature.ts` exists; `NAMING_MAP` stale; no test | **W5** — sync map (resolves TD-FE-32), test, flags |
| Stale-doc grep watcher | None exists | **W1** — reframed to a one-time cleanup, **no gate** (§1.3) |
| Amend root `CLAUDE.md`/`AGENTS.md` where stale | Both exist; drifted duplicates; stale "temp week" branch model | **W2 + W7** |
| Master-plan close (flip status, verify §6) | Phase 13 done, master synced to origin | **W8** |

The net new work is small and low-risk: a documentation reconciliation pass, a one-time phase-reference cleanup, one hardened script, and the master-plan close. **Phase 14 adds no new preflight gate.**

### 1.3 The stale-doc watcher decision (master-plan §8 Q-open, resolved here)

The master-plan Phase 14 block proposed a stale-doc grep gate (fail on any `Phase N` reference outside an allowlist). Measurement found **146 phase-references in `src/`**, which split into two kinds:

- **Provenance notes (the majority)** — intentional institutional memory, especially in `src/**/README.md` and explanatory comments (e.g. `shared/README.md` "promoted Phase 11; ≥6 feature consumers"; `queryClient.ts` "Memory-only (no persister) for Phase 3"). This is the same frozen-record discipline used in the specs.
- **Stale forward-promises (the real rot)** — true while a phase was pending, misleading now that all 14 have shipped (e.g. `escape-hatches.ts` `TODO(phase-13)` ×7+; `contracts/signals.ts` "Phase 10 tightens this"; `contracts/tenant.ts` "Phase 10 re-validates").

A blanket gate fires on both → poor signal-to-noise. Making it pass requires either mass-rephrasing useful provenance or an allowlist large enough to gut the gate. Because the refactor is **ending**, no new phase-references will be generated, so a perpetual gate guards a vanishing threat — its value is front-loaded into a one-time cleanup. Combined with the project's advisory-over-hard-fail posture, the decision is: **do the cleanup (W1), do not build the gate.**

### 1.4 Current-state anchor (verified 2026-06-07)

- **`master` is in sync with `origin/master`** (Phase 13 pushed); Phase 14 starts clean.
- **Feature READMEs:** all 14 present; stubs needing enrichment — `auth`, `settings`, `tenant` (5 lines each), `calendar`, `insights`, `reports` (15 lines each).
- **ADRs:** `docs/adr/0001-adr-template.md` + `0002`–`0005`; no index file.
- **Scripts:** `frontend/scripts/scaffold-feature.ts` (111 LOC; `NAMING_MAP` missing the four Phase-12 features `artifacts`/`calendar`/`insights`/`reports`; no test). No `codemods/` directory.
- **Preflight chain:** `typecheck → lint → format:check → test → build → bundle:check → test:e2e → knip`. `knip` is the dead-code watcher; `bundle:check` is advisory.
- **`CLAUDE.md` (177 LOC) vs `AGENTS.md` (187 LOC):** drifted copies. `AGENTS.md` H1 wrongly reads `# CLAUDE.md`; `AGENTS.md` carries a stripped-down "AI-Native Development" section vs `CLAUDE.md`'s richer one, plus a deliberate AGENTS-only "Tool Usage Pitfalls / Glob patterns are NOT regex" section. Both carry the stale "Monorepo Branch Model (during temp week ending ~2026-05-22)" content; `README.md` and `BRANCHES.md` likewise.
- **`docs/TECH_DEBT.md`:** 1,935 LOC, shared backend + frontend, 66 `TD-FE-*` entries (out of numeric order from renumbering history) + retained backend entries; ~a third resolved inline. Lives under `docs/`, **outside the frontend prettier root** — and prettier corrupts its unfenced `*`/`_` markdown, so it must be edited surgically (never reformatted).

---

## §2 Scope

### 2.1 In scope

- **Phase-reference cleanup** across `frontend/src/` and the in-scope doc set (W1).
- **`CLAUDE.md` / `AGENTS.md`** reconciliation (W2).
- **Feature + shared READMEs** enrichment/verification and cross-linking (W3).
- **`docs/TECH_DEBT.md`** archive split + numeric index, FE entries only (W4).
- **`frontend/scripts/scaffold-feature.ts`** hardening + Vitest test (W5).
- **`docs/adr/`** index + targeted ADR backfill (W6).
- **Root docs** `CLAUDE.md`, `AGENTS.md`, `README.md`, `BRANCHES.md` branch-model rewrite (W7).
- **Master-plan close**: verify Spec 14 §6, flip the status row, append the Phase 14 delta (W8).

**Doc-org blast radius:** the agent-affordance + FE-refactor doc set only — `CLAUDE.md`, `AGENTS.md`, `README.md`, `BRANCHES.md`, `src/features/**/README.md`, `src/shared/**/README.md`, `src/components/ui/README.md`, `docs/adr/*`, and the FE portion of `docs/TECH_DEBT.md`. Backend-owned and monorepo-era docs are **out** (§2.2).

### 2.2 Out of scope (non-goals)

- **No new preflight gate.** The stale-doc gate is replaced by the W1 cleanup; bundle stays advisory; NFR wall-time gating stays dropped (master-plan §8 Q3 — no post-launch data exists, 0 users). Reconsider post-launch.
- **No `codemod-runner.sh` / `scripts/codemods/`.** Phase 13 produced zero codemods; there is nothing to run. If a future change introduces a codemod, the runner can be added then.
- **No backend-doc or backend-TD changes.** Backend `TD-*` entries in `TECH_DEBT.md` are not archived, reordered, or reflowed. `docs/` backend/monorepo-era files (`PROMPTS.md`, `plan-05`/`plan-06`, `Deployment Infrastructure and Notes.md`, `dry-run-merge/`, `architecture/`, `analysis/`) are left untouched; any stale one discovered is logged as `TD-FE-<n>`, not edited.
- **No `frontend/CLAUDE.md` or `frontend/AGENTS.md`.** Root files cover the frontend topology (master-plan §2.2). No duplicates.
- **No prettier run on `docs/TECH_DEBT.md`** (or the new archive). Surgical edits only.
- **No legacy-branch deletion.** The monorepo cutover is complete, but the legacy branches (PWA `develop`/`production`/`refactor`, `pwa-*`, etc.) are intentionally **retained dormant for a few months** for rollback and business reasons (W7). The docs describe this retention; they do not prune branches.
- **No code behavior changes.** W1's cleanup touches comments and markdown only. No renames of exported symbols, no logic edits. (Where a phase-reference lives inside a string literal that is actually rendered or compared, it is left as-is and noted.)
- **No security/auth/hardening work** (pre-launch MVP posture).

### 2.3 Frozen interfaces

Unchanged by this phase (master-plan §2.3 still holds): HTTP API contract, routes, auth flow, rate-limit boundary (30 req/min), existing Playwright/VR behavior, bundle output format. Phase 14 is documentation + tooling + cleanup; it does not move feature code.

---

## §3 Workstreams

Eight workstreams, executed as logically-grouped commits on one branch (§4). Each leaves the tree green.

### W1 — Phase-reference cleanup (no gate)

**Goal:** remove transient phase references from durable code/docs **wherever it can be done without reducing the quality of the statement**, and fix the stale forward-promises outright.

**Method:**

1. Enumerate candidates: `grep -rInE "\b[Pp]hase[- ]?[0-9]" frontend/src/` plus the in-scope doc set. The 2026-06-07 baseline is 146 hits in `src/`.
2. Classify each hit:
   - **Stale forward-promise** (e.g. `TODO(phase-13)`, "Phase N tightens/re-validates/will…", "deferred to Phase N" where N ≤ 14): **verify against reality, then fix.** If the promised work happened, rephrase to neutral/past ("validated against the real endpoint"); if it did not, rephrase to describe the accepted current state and cross-reference the governing `TD-FE-<n>`. The `TODO(phase-13)` markers become plain `TODO:` with the actionable remainder preserved.
   - **Provenance worth keeping the substance of** (e.g. "Memory-only for Phase 3", "promoted Phase 11; ≥2-feature rule"): rephrase to keep the *why*, drop the phase number — "Memory-only by design", "shared — ≥2 features consume it". The rule/rationale is the durable part.
   - **Real traceability** (e.g. `(TD-FE-63)` citations, an ADR naming its triggering phase): **keep.** A phase number that is a genuine cross-reference index is not rot.
3. Apply edits surgically; run `npm run preflight` (these are comments/markdown — typecheck/lint/test/build/e2e stay green by construction).

**Quality bar:** an edit that would make a sentence vaguer or lose a real "why" is not made — the phase reference stays. "Without reducing quality" is the governing constraint; completeness of removal is secondary.

**Done when:** the stale forward-promises are all resolved; remaining phase-references in `src/` are either genuine traceability citations or provenance whose phase number could not be dropped without quality loss (the plan records the residual count + rationale).

### W2 — `CLAUDE.md` / `AGENTS.md` reconciliation

**Model:** shared base + per-tool delta. The two files cannot be symlinked (they legitimately differ), so:

- **Shared base** (byte-identical in both): all project guidance, **including** the "AI-Native Development" slash-command flow — the slash commands are used in both Claude Code and the operator's other IDE (Kilo Code), so this content belongs in both. Reconcile the current drift by bringing `AGENTS.md`'s shared sections up to `CLAUDE.md`'s richer, current content.
- **`AGENTS.md` delta only:** the "Tool Usage Pitfalls / Glob patterns are NOT regex" section (a non-Claude-IDE concern). Stays AGENTS-only.
- **Fix** the `AGENTS.md` H1 (`# CLAUDE.md` → `# AGENTS.md`).
- **Cross-reference:** a one-line note in each pointing to the other for its tool-specific delta.

The stale "temp week" branch-model section in both is handled by W7 (same edit lands the steady-state model in both).

**Done when:** the shared sections are identical across both files; `AGENTS.md` keeps exactly its one delta section with the correct H1; each file cross-references the other.

### W3 — README enrichment + verification

- Enrich the 6 stub feature READMEs (`auth`, `settings`, `tenant`, `calendar`, `insights`, `reports`) to the `src/features/README.md` template (Purpose / Public surface / Key files / Dependency notes).
- Verify the substantive feature READMEs (e.g. `mission-control` 91 LOC, `customers` 56) are still accurate after Phases 8–13 moved/renamed things; correct drift.
- Confirm the `src/features/README.md` naming map matches the actual 14 feature folders (coordinates with W5's `NAMING_MAP` sync and TD-FE-32).
- Add sensible cross-links: `features/README.md` ↔ `shared/README.md` ↔ the new ADR index (W6).
- Apply W1's cleanup to README provenance as part of the same per-file edit.

**Done when:** no feature README is a bare stub; the substantive ones are accurate; naming map matches reality; cross-links resolve.

### W4 — `docs/TECH_DEBT.md` archive + numeric index

- Create `docs/TECH_DEBT_ARCHIVE.md` with a short preamble pointing back to the main register.
- Classify each `TD-FE-<n>`: **fully resolved** vs **open / carried-forward**. Carried-forward entries (e.g. TD-FE-21/27/30/31 "NOT retired, carried forward"; TD-FE-45 "resolved for the relocation part only") stay in the main file — only *fully* resolved entries move.
- Move fully-resolved entries verbatim to the archive (preserve their original text and numbering — IDs are never reused, per the register's existing convention).
- Add a **numeric index table** at the top of `TECH_DEBT.md`: every `TD-FE-<n>` → status (open / resolved-archived) → link to its section (main file) or to the archive. This is the single lookup point that keeps inter-entry cross-references (e.g. "mirror TD-FE-19/21") resolvable after the move.
- **Backend `TD-*` entries: untouched.** Only the FE half is reorganized.
- **No prettier**; all edits surgical.

**Done when:** resolved FE entries live in the archive; the main file's open FE entries + all backend entries remain; the index table covers every `TD-FE-<n>` and every link resolves; `git diff` shows no prettier-style reflow.

### W5 — `scaffold-feature` hardening

- Sync `NAMING_MAP` in `scaffold-feature.ts` with the actual 14 features (add `artifacts`, `calendar`, `insights`, `reports`; reconcile `profiler` reservation note). Resolves **TD-FE-32** (naming-map disagreement).
- Add a Vitest test: scaffold into a temp dir, assert the three canonical files (`types.ts`, `index.ts`, `README.md`) exist with expected stub content, and that subfolders are *not* created. Add a duplicate-name / invalid-kebab rejection case.
- Add `--help` output and a `--dry-run` flag (print what would be created, write nothing).
- Keep the existing kebab regex + `existsSync` duplicate guard.

**Done when:** `NAMING_MAP` matches reality; the scaffolder has a passing test in the Vitest suite; `--help`/`--dry-run` work; TD-FE-32 resolved.

### W6 — ADR consolidation

- Add `docs/adr/README.md`: an index of ADRs 0001–0005 with one-line summaries and status, plus the slim-template convention and numbering rule.
- **Targeted backfill** — write ADRs only for genuinely-architectural, cross-phase decisions not already captured as an ADR. Working shortlist (refinable during spec review):
  1. **Scout/Profiler kept distributed, no `features/profiler/`** (the §3.1 join-point resolution; TD-FE-60).
  2. **Advisory-over-hard-fail gate posture** (bundle advisory, NFR gating dropped, stale-doc gate not built — the standing posture across Phases 2c–14).
  3. **Data-layer migration deferred for editable-state features** (the TD-FE-19/21/53/65 family — why several features kept imperative fetch + local cache rather than going TanStack-native).
- Cross-link the new ADRs from the relevant feature READMEs and from `CLAUDE.md`'s "Technical Debt Register" / architecture sections where sensible.

**Done when:** the ADR index exists and is accurate; the shortlist decisions have ADRs (or are explicitly judged already-captured during review); cross-links resolve.

### W7 — Root-doc branch-model rewrite

- Replace the "Monorepo Branch Model (during temp week ending ~2026-05-22)" sections and the "sync Brewra-dev work from old repos (temp week only)" commands in `CLAUDE.md`, `AGENTS.md`, `README.md`, and `BRANCHES.md` with the **steady-state model**:
  - `master` is trunk; phase/feature work on short-lived `phase-N-*` / feature branches off `master`, merged `--no-ff` after a green local `preflight` (master-plan §5.1/§5.3).
  - The monorepo cutover is **complete**. The legacy branches (PWA `develop`/`production`/`refactor`, `pwa-*`, and equivalents) are **retained dormant for a few months** for possible issue triage / rollback and other business reasons, then pruned. They are not active development targets.
- Exact wording confirmed with the operator at impl time (branch-model docs are sensitive).

**Done when:** no root doc describes the cutover as in-progress or references the temp week as current; the steady-state model + the dormant-legacy-branch retention note are present and consistent across all four files.

### W8 — Master-plan close

- Walk Spec 14 §6's ten done-criteria against `master`; for each, confirm it holds or log the gap as `TD-FE-<n>` (do not silently pass).
- Flip the Spec 14 §4 status table row: Phase 14 → `done` with the merge date.
- Append the Phase 14 frozen-record delta to Spec 14 (per the frozen-record convention — intent prose preserved; the delta records the reframe in §1.2, the W1 no-gate decision, and the moot-deliverable dispositions). Update master-plan §8 Q3 to note the bundle/NFR reconsideration remains deferred (still pre-launch).
- This is the final act: the master plan is "done" when Phase 14 merges (Spec 14 §6 closing sentence).

**Done when:** §6 verified (gaps logged); status row flipped; delta appended; Spec 14 reads as closed.

---

## §4 Phase structure and sequencing

**Single phase**, branch `phase-14-agent-affordances` off `master`, logically-grouped commits, one serial `npm run preflight`, one `--no-ff` merge. No sub-split — the work is low-risk doc/tooling/cleanup and does not warrant 14a/14b ceremony.

**Suggested commit grouping** (each green; finalized in the plan):

1. W5 scaffold-feature hardening + test (tooling; independent).
2. W1 phase-reference cleanup in `src/` code comments.
3. W3 README enrichment + verification (+ W1 cleanup of README provenance).
4. W2 CLAUDE/AGENTS reconciliation + W7 branch-model rewrite (root docs together — they touch the same files).
5. W6 ADR index + backfill + cross-links.
6. W4 TECH_DEBT archive + index (surgical, no prettier).
7. W8 master-plan close (Spec 14 status + delta) — last.

**Dependencies:** W3's naming-map check coordinates with W5's `NAMING_MAP` sync. W2 and W7 edit the same root files → land together. W8 is last (it asserts everything else is done). Otherwise the groups are independent.

---

## §5 Preflight / gates

- **No new gate.** The existing `preflight` chain (typecheck → lint → format:check → test → build → bundle:check → test:e2e → knip) is unchanged. W5 adds a test *to the existing Vitest suite*, not a new chain step.
- **`docs/TECH_DEBT.md` and `docs/TECH_DEBT_ARCHIVE.md` are exempt from prettier** (outside the frontend prettier root; prettier corrupts the unfenced markdown). The plan verifies via `git diff` that W4 introduced no reflow.
- **Merge gate:** serial `npm run preflight` green immediately before the user-approved `--no-ff` merge (master-plan §5.3/§5.6). W1/W2/W3/W4/W6/W7/W8 are comments/markdown and do not affect typecheck/lint/build/test/e2e; W5 must keep Vitest green.

---

## §6 Definition of done

**Phase 14 is done when** all eight workstreams' done-conditions hold on the branch, `npm run preflight` is green, and the branch is merged `--no-ff` to `master` after ≥1 review round of spec/plan/impl each (master-plan §5).

**The master plan is done when Phase 14 merges** — W8 verifies Spec 14 §6's ten criteria and flips its status. Any §6 criterion that does not hold is logged as `TD-FE-<n>` rather than blocking (pre-launch posture), and noted in the W8 delta.

---

## §7 Risks

- **R1 — W1 over-strips provenance.** Mitigation: the explicit quality bar (§W1) — drop the phase number only when the sentence keeps its meaning; keep it otherwise. Reviewer checks a sample of W1 edits for lost "why".
- **R2 — W4 corrupts `TECH_DEBT.md` via prettier or a botched surgical move.** Mitigation: no-prettier rule enforced; `git diff` reviewed for reflow; the numeric index keeps cross-references resolvable; only fully-resolved entries move (carried-forward stay).
- **R3 — W2/W7 lose content during the CLAUDE/AGENTS reconciliation.** Mitigation: the shared base is the union of both files' current substance; reviewer diffs old-vs-new to confirm nothing real was dropped (only the wrong H1 and stale temp-week content change; the AGENTS-only section is preserved).
- **R4 — W8 declares the plan done while a §6 criterion silently fails.** Mitigation: W8 walks all ten criteria explicitly and logs gaps as TD-FE; "done" is allowed to coexist with logged, accepted debt (pre-launch posture), but never with an *unexamined* gap.
- **R5 — Scope creep into backend docs / monorepo-era files.** Mitigation: §2.1 blast radius is explicit; stale backend/monorepo docs are logged as TD-FE, not edited.

---

## §8 Open questions for the plan stage

1. **W1 residual policy** — the plan sets the exact regex variants to sweep (e.g. include `TODO\(phase-` and "deferred to Phase N" explicitly) and records the expected residual count (genuine citations + unavoidable provenance) so the reviewer can audit completeness.
2. **W4 index format** — table at the top of `TECH_DEBT.md` vs a separate `TECH_DEBT_INDEX.md`. Default: table at top of the main file (single lookup point). Plan finalizes.
3. **W6 backfill list** — the three-ADR shortlist is confirmed for round 1; the plan or spec-review may add/trim (e.g. whether the kebab-case naming canonicalization warrants its own ADR or is adequately captured in `features/README.md`).
4. **W7 wording** — the exact steady-state branch-model prose + the dormant-legacy-branch retention note are drafted in the plan and confirmed with the operator before the impl commit.

---

## §9 Companion documents

- `specs/14-frontend-refactoring-master-plan-design.md` — the master plan (Phase 14 block §4; definition of done §6; §8 Q3 / Q-open).
- `specs/32-frontend-phase-13-loc-reduction-pass-2-design.md` — Phase 13 (records "codemods: none — manual", the reason Phase 14's codemod-runner deliverable is moot).
- `docs/TECH_DEBT.md` — the register being reorganized (W4); existing FE entries TD-FE-1..66.
- `docs/adr/0001-adr-template.md` — the slim ADR form W6 indexes and backfills against.
- `BRANCHES.md` — branch model (W7).
