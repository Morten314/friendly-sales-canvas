# Frontend Phase 13 — LOC Reduction Pass #2 (Post-Modularization Audit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Spec 32's two-workstream audit-execute pass across `frontend/src/`: (13a) a tree-wide dedup + dead-code pass that produces the authoritative scorecard, then (13b…13N) behavior-preserving decomposition of the monster files the scorecard selects. End state: every file triaged in the scorecard, all `execute` findings applied, every `investigate` finding resolved (applied or deferred-with-rationale), TD-FE-1..7 closed, the selected monster files split (or explicitly deferred), and — only if surfaced — `src/shared/ui-patterns/` populated.

**Architecture:** Audit-execute methodology mirrored from Phase 1 (plan 16) and backend Phase L. The phase is **audit-driven**: the decomposition file set is *not* fixed by this plan — it is selected from 13a's merged scorecard at a checkpoint (Stage SELECT) and each selected file becomes its own sub-phase. The variable-cardinality work (dead-code, dedup, decomposition) is expressed as **per-finding loop sub-procedures** (the plan-16 pattern), not enumerated tasks. **13a is its own branch+merge** (it lands the scorecard on `master`); each decomposition sub-phase (13b…) is a separate branch+merge cut against that scorecard. The safety net is the existing layered suite (strict tsc + ESLint + Vitest + RTL + MSW + Playwright + 2% visual regression), plus, for dedup/decomposition, an advisory local `vitest run` + visual-regression pass before each sub-phase's final commit.

**Tech Stack:** Node + TypeScript 5.5 + Vite + Vitest + Playwright + knip 5.88 + tsx. Audit tooling reuses the **`typescript` compiler API** (already a dep — same approach as the existing `scripts/scan-inline-blocks.ts`); **no `ts-morph`/`ast-grep`/`jscpd` is added** unless the raw API proves insufficient for the similarity scan, in which case `ts-morph` is added in its own commit (Spec 32 §3.1, §12 Q3 → resolved here toward raw-API-first).

**Spec:** `specs/32-frontend-phase-13-loc-reduction-pass-2-design.md` (round 2, post spec-review-1 / synthesis-1).

**Branch:** `phase-13-loc-reduction-pass-2` already exists off `master`; spec committed at `3f5c6eb`, revised at `ec2595c` (current HEAD). **This branch is the 13a branch.** Decomposition sub-phases branch off `master` *after* 13a merges (Stage SELECT).

**All commands run from `frontend/`** unless a path is prefixed with `docs/` (repo-root). Repo root: `/projects/Brewra/brewra-gtm-intelligence`.

**Baseline (to be measured at execution start — Stage 0):** post-Phase-12/11 tree. Spec-write-time anchors (re-measured in Stage 0): largest files `features/market-research/hooks/useMarketResearchData.ts` ~6,040, `features/mission-control/components/data-sources/DataSourcesManager.tsx` ~3,497, `features/mission-control/components/company-profile/ConnectorApprovals.tsx` ~3,060; then a ~2,000-LOC gap.

**Target:** No LOC-percentage floor (Spec 32 §10 — the §5 decomposition workstream is LOC-neutral, so a percentage would mismeasure). Success = audit-completeness: every file triaged, all `execute` applied, every `investigate` resolved.

**Date convention for audit artifacts:** use the execution date `<DATE>` (ISO `YYYY-MM-DD`) for every artifact produced (`docs/audits/<DATE>-frontend-loc-pass-2*.json/.txt/.md`). Determine it once in Stage 0 Step 0 (`date +%F`) and use it verbatim everywhere below in place of `<DATE>`. If 13a spans days, the final scorecard is re-dated to its write date via a single `git mv` before the 13a merge.

**Commit-message convention:** `type(scope): <description>` per CLAUDE.md. Scope `fe` for source/config, `audit` for `docs/audits/`, `docs` for `docs/TECH_DEBT.md` / spec status, `chore` for tooling. **No `[N/M]` numbering** (audit-bounded, not fixed-count). **No `Co-Authored-By` footer** (recorded user preference). Removal commits carry the 6-line check-kit block in the body.

**Per-commit gate `G` (inner loop, Spec 32 §8):** `npm run verify` (typecheck + lint + `test:changed`) **and** `npx prettier --check <touched files>` (verify omits `format:check`). Both clean before commit.
- **Dep/manifest-removal commits additionally run `npm run build`** before committing — `verify` omits `build`, and `vite build` is the dead-dep/transitive-resolution detector. Manifest edits land in their **own** commit (Spec 32 §8).
- **Dedup and decomposition commits additionally run, before the sub-phase's *final* commit:** `npm run test` (full `vitest run`) + `npm run test:e2e` (Playwright + visual regression). This is the Spec 32 §8 advisory; scorecard-only and manifest-only commits skip it.

**Merge gate (per sub-phase, controller-run, Spec 32 §8 / §5.3):** full serial `npm run preflight`. Red blocks the merge; no fix-forward.

**Greenness invariant:** every commit ends with `G` clean (plus `build` for manifest commits). A "green sub-phase" (the §5.2 revert anchor) = `npm run verify` passes.

**Abort criterion (Spec 32 §11 / Spec 14 §5.7):** if any single commit's gate cannot be made green within 3 distinct fix attempts, halt and surface to the operator. For decomposition: if a safe structural split is impossible without touching behavior, **defer the file** (log TD-FE) rather than force it — do not abort the phase.

**TD-FE numbering:** sequential from the current max. As of plan-write the max is `TD-FE-63`, so new deferrals start at `TD-FE-64`. Read the live max immediately before each deferral: `grep -oE 'TD-FE-[0-9]+' docs/TECH_DEBT.md | sort -t- -k3 -n | tail -1`. **`docs/TECH_DEBT.md` is never Prettier-formatted** — edit it surgically.

---

## File Structure

**Created (13a):**
- `frontend/scripts/scan-similar-symbols.ts` — similarity scan (typescript-compiler-API; groups near-identical exported components/hooks by normalized structural fingerprint)
- `frontend/scripts/scan-inline-blocks.ts` — **extended** with an `--enumerate` flag that lists (rather than filters) outer-scope-referencing near-identical blocks (Spec 32 §3.1; Phase 1 handoff)
- `docs/audits/<DATE>-frontend-loc-pass-2-knip.txt` + `.json` — standard knip re-run
- `docs/audits/<DATE>-frontend-loc-pass-2-knip-ui-sweep.txt` — knip with the `components/ui/**` ignore removed (shadcn prune input)
- `docs/audits/<DATE>-frontend-loc-pass-2-similar.json` — similarity-scan output
- `docs/audits/<DATE>-frontend-loc-pass-2-inline-blocks.json` — enumerate-scan output
- `docs/audits/<DATE>-frontend-loc-pass-2.md` — the scorecard (Stage 13a-vii)
- `docs/adr/0006-*.md` — only if 13a-v extracts a `ui-patterns/` member (else not created)
- `frontend/scripts/codemods/<name>.ts` + `__tests__/<name>/{input,expected}.ts` — only if a codemod is earned (Spec 32 §6; else not created)

**Created (SELECT):**
- `docs/audits/<DATE>-frontend-loc-pass-2-decomposition-selection.md` — the ranked decomposition file set + cut rationale (resolves Spec 32 §12 Q1)

**Modified:**
- `frontend/package.json` / `package-lock.json` — only if dead deps are found (13a-i) or `ts-morph` is added (13a-0 fallback)
- `frontend/knip.json` — only if a config hint regresses (not expected)
- Variable source files — dead-code removal (13a-i), conservative-defer trims (13a-ii), dedup (13a-iv), decomposition (13b…13N)
- `docs/TECH_DEBT.md` — close TD-FE-1..7; append TD-FE-64+ deferrals
- `specs/14-frontend-refactoring-master-plan-design.md` — flip §4 Phase 13 status row to `done` at the **final** merge (last decomposition sub-phase), and add the Spec-32 frozen-record delta block

**Deleted (variable):**
- Dead files (13a-i), confirmed-dead conservative-defer symbols' files (13a-ii), unused shadcn primitives (13a-iii)

---

## Stage 0 — Pre-flight (no commit)

### Task 0 — Confirm branch, baseline green, record measurements

**Files:** none (verification only).

- [ ] **Step 0: Fix the artifact date.** From repo root: `date +%F`. Record the result; use it as `<DATE>` in every artifact path below.

- [ ] **Step 1: Confirm branch + HEAD.**
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git branch --show-current      # expected: phase-13-loc-reduction-pass-2
git log --oneline -1           # expected: ec2595c (or later Phase-13 commits)
```
If the branch is not `phase-13-loc-reduction-pass-2`, STOP — re-read this plan's Branch note.

- [ ] **Step 2: Confirm the baseline is green (this is the gate-validity check).**
```bash
cd frontend
npm run verify
```
Expected: typecheck + lint + `test:changed` clean. (On a freshly-checked-out branch `test:changed` may run zero tests — that is fine.) If red on the untouched branch, STOP and report — the gates can't validate the phase until the baseline is green.

- [ ] **Step 3: Record the knip baseline (pre-existing dead code is not Phase-13-introduced).**
```bash
cd frontend
npm run knip 2>&1 | tee /tmp/phase13-knip-baseline.txt | tail -30
```
Any findings here are the starting candidate surface for 13a-i. Save the output.

- [ ] **Step 4: Record the LOC + file-count baseline.**
```bash
cd frontend
find src -type f \( -name '*.ts' -o -name '*.tsx' \) | wc -l
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec cat {} + | wc -l
```
Record both numbers — they are the scorecard's "before" (Stage 13a-vii).

- [ ] **Step 5: Capture the per-file LOC ranking (the decomposition-candidate anchor).**
```bash
cd frontend
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -not -path 'src/components/ui/*' -exec wc -l {} + | sort -rn | head -30
```
Record the top 30. Confirm the spec-write anchors (useMarketResearchData / DataSourcesManager / ConnectorApprovals) and the ~2,000-LOC cliff below the top three still hold; if the ranking has shifted materially, note it — Stage SELECT uses the *post-dedup* ranking, not this one, but this is the sanity check.

- [ ] **Step 6: Confirm the bundle baseline + scripts exist.**
```bash
cd /projects/Brewra/brewra-gtm-intelligence
ls docs/audits/2026-05-26-frontend-bundle-baseline.json
cd frontend && npm run | grep -E 'verify|preflight|knip|bundle:check|build|test:e2e'
```
Expected: baseline JSON present; all scripts listed. The scorecard's bundle delta (13a-vii) reads this baseline via `bundle:check`.

---

## Stage 13a — Tree-wide dedup + dead-code audit & execute

13a runs on the current branch and ends with the scorecard + a full-preflight merge gate. It **may sub-split internally** (13a-0 tooling, 13a-i dead code, 13a-ii conservative defers, 13a-iii shadcn prune, 13a-iv dedup, 13a-v ui-patterns, 13a-vi orphan routes, 13a-vii scorecard) per Spec 32 §7 — execute the sub-stages in order; commits within them are individually green.

### Stage 13a-0 — Audit tooling + candidate generation

#### Task A1 — Extend `scan-inline-blocks.ts` with `--enumerate`

**Files:** Modify `frontend/scripts/scan-inline-blocks.ts`.

- [ ] **Step 1: Read the existing script and locate the gate filter.**
```bash
cd frontend
grep -n "outer-scope\|outerScope\|filter\|return\b" scripts/scan-inline-blocks.ts | head -40
sed -n '1,40p' scripts/scan-inline-blocks.ts
```
Phase 1 (Spec 16 §3 Step 6a; scorecard §3 handoff) noted the script *filters out* outer-scope-referencing near-identical blocks at the gate (~line 174). The enumerate variant must *emit* them instead.

- [ ] **Step 2: Add an `--enumerate` flag.** When `process.argv.includes('--enumerate')` is set, do not drop blocks that reference outer-scope identifiers; instead include them in the output JSON with an added field `"outerScopeRefs": [<identifier names>]` so the reviewer can judge whether the reference set is unifiable. Default (no flag) behavior is unchanged. Keep the existing output JSON shape (`{ "groups": [ { "hash", "occurrences": [{file,line}], ... } ] }`) and add the new field only under `--enumerate`.

- [ ] **Step 3: Run both modes; confirm the flag widens (or equals) the result set.**
```bash
cd frontend
npx tsx scripts/scan-inline-blocks.ts > /tmp/blocks-default.json 2>&1 || true
npx tsx scripts/scan-inline-blocks.ts --enumerate > ../docs/audits/<DATE>-frontend-loc-pass-2-inline-blocks.json 2>&1 || true
node -e "const a=require('/tmp/blocks-default.json').groups?.length||0; const b=require('../docs/audits/<DATE>-frontend-loc-pass-2-inline-blocks.json').groups?.length||0; console.log('default groups:',a,' enumerate groups:',b); if(b<a) throw new Error('enumerate should be a superset')"
```
Expected: enumerate groups ≥ default groups.

- [ ] **Step 4: Gate `G`** (`npm run verify` + `npx prettier --check scripts/scan-inline-blocks.ts`), then **commit** (script only; the artifact is committed in Task A2):
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/scan-inline-blocks.ts
git commit -m "chore(fe): add --enumerate to scan-inline-blocks (Phase 13 13a-0; Spec 32 §3.1)"
```

#### Task A2 — Build `scan-similar-symbols.ts` (near-identical component/hook scan)

**Files:** Create `frontend/scripts/scan-similar-symbols.ts`.

- [ ] **Step 1: Implement the scan using the `typescript` compiler API** (no new dep; mirror the `scan-inline-blocks.ts` pattern). Algorithm:
  1. Build a `ts.Program` over `tsconfig.app.json`'s file set, excluding `src/components/ui/**`, tests, and files < 40 LOC.
  2. For each top-level exported function/const-arrow component (`*.tsx`) and each exported hook (`use*` in `*.ts`/`*.tsx`), compute a **normalized structural fingerprint**: walk the AST, emit a token stream of `SyntaxKind`s (identifiers and literals replaced by placeholders `ID`/`LIT`, JSX tag names kept), then take the multiset of 5-token shingles.
  3. Group any pair whose shingle **Jaccard similarity ≥ 0.85** into a candidate group.
  4. Emit `{ "groups": [ { "members": [{file, symbol, loc}], "similarity": <min pairwise>, "kind": "component"|"hook" } ] }`.
- [ ] **Step 2: Run it; sanity-check against a known near-duplicate.**
```bash
cd frontend
npx tsx scripts/scan-similar-symbols.ts > ../docs/audits/<DATE>-frontend-loc-pass-2-similar.json 2>&1 || true
node -e "const g=require('../docs/audits/<DATE>-frontend-loc-pass-2-similar.json').groups||[]; console.log('candidate groups:',g.length); g.slice(0,10).forEach(x=>console.log(x.kind,x.similarity.toFixed(2),x.members.map(m=>m.symbol).join(' ~ ')))"
```
Expected: a small list. (If the customers ICP-card family — `SuggestedICPCards` / `SuggestedICPCard` — or any chat wrappers surface, the scan is working; they are *candidates*, judged in 13a-iv.) If the raw-API fingerprint proves too noisy/slow to be useful, **stop, add `ts-morph` in its own commit** (`chore(fe): add ts-morph devDep for similarity scan`) and reimplement using its AST helpers — record the switch in the scorecard (§12 Q3 resolution).
- [ ] **Step 3: Gate `G`** (verify + `prettier --check scripts/scan-similar-symbols.ts`). The artifact JSON is committed with the other audit outputs in Task A3.
- [ ] **Step 4: Commit** (script only):
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/scan-similar-symbols.ts
git commit -m "chore(fe): add scan-similar-symbols (Phase 13 13a-0; Spec 32 §3.1)"
```

#### Task A3 — Run the audit; commit the candidate artifacts

**Files:** Create the four `docs/audits/<DATE>-frontend-loc-pass-2-*` audit files (knip, knip-ui-sweep, similar, inline-blocks).

- [ ] **Step 1: Standard knip.**
```bash
cd frontend
npx knip --no-progress > ../docs/audits/<DATE>-frontend-loc-pass-2-knip.txt 2>&1 || true
npx knip --reporter json --no-progress > ../docs/audits/<DATE>-frontend-loc-pass-2-knip.json 2>/dev/null || true
grep -c "Configuration hint" ../docs/audits/<DATE>-frontend-loc-pass-2-knip.txt || echo "0 hints"
```
Expected: `0 hints` (config is stable from Phase 1/11). If hints appear, fix `knip.json` and note it.

- [ ] **Step 2: Knip UI-sweep variant (shadcn prune input — Spec 32 §4.3).** Create a throwaway config without the `components/ui/**` ignore, run it, then delete the config (do **not** commit it):
```bash
cd frontend
node -e "const c=require('./knip.json'); delete c.ignore; require('fs').writeFileSync('knip.ui-sweep.json', JSON.stringify(c,null,2))"
npx knip -c knip.ui-sweep.json --no-progress > ../docs/audits/<DATE>-frontend-loc-pass-2-knip-ui-sweep.txt 2>&1 || true
rm knip.ui-sweep.json
grep -A40 "Unused files" ../docs/audits/<DATE>-frontend-loc-pass-2-knip-ui-sweep.txt | grep "components/ui/" || echo "no ui/ files flagged"
```
The flagged `components/ui/*` files are the shadcn-prune candidates (each re-verified per-file in 13a-iii — knip is **not** the backstop here).

- [ ] **Step 3: (similar + inline-blocks artifacts already produced in A1/A2 Step 3 / A2 Step 2.)** Confirm all four artifacts exist and parse:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
for f in knip.json knip.txt knip-ui-sweep.txt similar.json inline-blocks.json; do ls -la docs/audits/<DATE>-frontend-loc-pass-2-$f 2>&1; done
```

- [ ] **Step 4: Commit the candidate list** (audit artifacts; no source change):
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/audits/<DATE>-frontend-loc-pass-2-knip.txt docs/audits/<DATE>-frontend-loc-pass-2-knip.json docs/audits/<DATE>-frontend-loc-pass-2-knip-ui-sweep.txt docs/audits/<DATE>-frontend-loc-pass-2-similar.json docs/audits/<DATE>-frontend-loc-pass-2-inline-blocks.json
git commit -m "chore(audit): Phase 13 13a candidate list (knip + ui-sweep + similarity + inline-blocks)"
```

### Stage 13a-i — Dead code (per-finding loop)

#### Task B — Process every knip dead-file / dead-export / dead-dep finding

**Files:** variable. This is a **loop sub-procedure** (plan-16 Step 4 pattern), not a fixed step count.

- [ ] **Step prep: Build the work queue** from the standard knip JSON (dead files, then dead exports, then dead deps). Order dead files in topological removal order (a file no other dead file imports goes first). Reuse the Phase-1 topo-sort script verbatim if helpful: `git show 5099110:plans/16-frontend-phase-1-loc-reduction.md` contains it (Task 4 Step 4-prep) — or order by hand for a small list.

- [ ] **Step loop (dead files): apply the 6-check kit per file.** For each candidate `<PATH_REL>` (frontend-relative), with `BASE=$(basename "$PATH_REL" | sed 's/\.tsx\?$//')`:
```bash
cd frontend
echo "C1 static";   rg -n "from ['\"][^'\"]*${BASE}['\"]" src/ e2e/
echo "C2 dynamic";  rg -n "import\([^)]*${BASE}" src/ e2e/
echo "C3 reexport"; rg -n "export.*from.*['\"][^'\"]*${BASE}['\"]" src/ e2e/
echo "C4 plain";    rg -n "\b${BASE}\b" src/ e2e/
echo "C5 route";    rg -n "${BASE}" src/app/routes.tsx src/App.tsx
echo "C6 tests";    rg -n "${BASE}" src/ e2e/ | grep -E "(__tests__|\.test\.|\.spec\.|^e2e/)"
```
  **Verdict rules (Spec 32 §4.1, §3.2; posture from Spec 14 §2.3):**
  - All zero / none → **remove**.
  - `shared/*`, `*/services/`, `*/lib/`, `*/hooks/` (cross-cutting infra) → conservative posture → on any uncertainty, **defer** (`TD-FE-<n>`).
  - `features/*/components|pages` → aggressive posture → **remove** unless a true inbound exists (a comment-only `C4` match is not an inbound).
  - Test-only inbound → **keep — test-only** (no TD-FE).
  For **remove**: `git rm frontend/<PATH_REL>`, run `npm run verify` (typecheck catches broken imports); if green, commit with the 6-line check-kit body:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git commit -m "$(cat <<'EOF'
chore(fe): remove dead file <PATH_REL> (Phase 13 13a-i)

Checks: C1=0 C2=0 C3=0 C4=0 C5=none C6=none
Spec 32 §4.1.
EOF
)"
```
  If verify fails on removal → `git checkout -- frontend/<PATH_REL>`, switch verdict to **keep** (record the failing inbound), continue to next file.

- [ ] **Step loop (dead exports):** for each unused export, confirm zero inbound (C1–C4 above on the symbol), then delete the `export` keyword (or the whole declaration if otherwise unused). Gate `G`, commit `refactor(fe): drop unused export <symbol> from <file> (13a-i)`.

- [ ] **Step (dead deps):** if knip flags unused deps, remove them from `package.json` in one commit, `npm install`, then **`npm run build`** (the dep-resolution detector) before committing. A build failure ⇒ false-positive ⇒ add the dep back, record as `keep`. Commit `chore(fe): remove N unused deps (13a-i)` listing each in the body.

### Stage 13a-ii — Re-evaluate Phase 1's conservative defers (TD-FE-3,4,5,6)

#### Task C — Re-trace TD-FE-3..6 at current (post-Phase-11) locations

**Files:** `docs/TECH_DEBT.md` (close entries) + variable source.

- [ ] **Step 1: Read the four entries and resolve current paths** (Phase 11 relocated several — `lib/api`→`shared/api/transport`, `lib/jwt`→`shared/auth`, `apiUtils`→`features/market-research`, `profilerAcceptedIcpDisplay`→`shared/profiler`):
```bash
cd /projects/Brewra/brewra-gtm-intelligence
sed -n '/## TD-FE-3 /,/## TD-FE-7 /p' docs/TECH_DEBT.md
```
Build the symbol list (the ~22 symbols across TD-FE-3/4/5/6).

- [ ] **Step 2: Per symbol, re-trace under strict TS.** For each symbol at its current path, run the C1–C4 inbound checks. **Remove** the symbol only if zero inbound AND `npm run verify` stays green after removal (strict tsc + tests are the new safety Phase 1 lacked). Otherwise **keep** with the reason. One commit per file touched: `refactor(fe): drop confirmed-dead <symbol> (13a-ii; TD-FE-<n>)`.

- [ ] **Step 3: Close each TD entry** surgically in `docs/TECH_DEBT.md` (no Prettier) — append a resolution line to TD-FE-3/4/5/6: `**Resolved (Phase 13 13a-ii, <DATE>):** removed <symbols> / kept <symbols> because <reason>.` Commit `docs: close TD-FE-3..6 (Phase 13 13a-ii conservative-defer re-eval)`.

### Stage 13a-iii — Prune unused shadcn primitives (TD-FE-7)

#### Task D — Per-primitive verify-and-remove sweep

**Files:** delete confirmed-unused `frontend/src/components/ui/*`; `docs/TECH_DEBT.md`.

- [ ] **Step 1: List the UI-sweep candidates** from `…-knip-ui-sweep.txt` (Task A3 Step 2). Cross-check against TD-FE-7's enumerated list.

- [ ] **Step 2: Per primitive, re-verify zero imports** (knip ignores this folder, so this manual check is the only backstop — Spec 32 §4.3, R-13.3):
```bash
cd frontend
NAME="aspect-ratio"   # example; iterate over each candidate
rg -n "components/ui/${NAME}\b|from ['\"][^'\"]*ui/${NAME}['\"]" src/ e2e/
```
Zero matches → **remove** (`git rm frontend/src/components/ui/${NAME}.tsx`); any match → **keep**. Group removals into one commit (UI primitives are leaf inventory; a single `chore(fe): prune N unused shadcn primitives (13a-iii; TD-FE-7)` commit listing each is fine), then `npm run build` (catches any indirect consumer) before committing.

- [ ] **Step 3: Close TD-FE-7** in `docs/TECH_DEBT.md`: `**Resolved (Phase 13 13a-iii, <DATE>):** pruned <list>; kept <list> (re-addable via npx shadcn add).` Commit `docs: close TD-FE-7 (shadcn prune)`.

### Stage 13a-iv — Dedup & inline (per-candidate loop)

#### Task E — Process similarity-scan + inline-block candidates

**Files:** variable. **Loop sub-procedure.** Every commit here gets the §8 advisory (`npm run test` + `npm run test:e2e`) before it lands, since dedup is behavior-touching.

- [ ] **Step loop (near-identical components):** for each group in `…-similar.json` with `kind: component`:
  - Read all members. Decide **mergeable** only if the behavioral delta is confined to **configurable props/literals** (Spec 32 §4.4 — *not* a tautological "identical"). If the delta is structural/logic (the Phase 9 `ScoutChatWithHistory`↔`ProfilerChatWithHistory` situation needed a shared substrate + design judgment), and unifying would change behavior, **defer** (`TD-FE-64+`) — do not force.
  - If mergeable and both members live in the **same feature**: extract a base component + thin overlays in place. If they span **two features**: this is a shared extraction → it goes to `src/shared/` only under the ≥2-feature rule, with an ADR if non-trivial (handled in 13a-v's ADR slot).
  - After the edit: `npm run test` + `npm run test:e2e` (visual regression must stay green at 2% — **a visually-ambiguous merge is deferred, not shipped**, per synthesis-1 open question). Gate `G`. Commit `refactor(fe): dedup <names> to base+overlay (13a-iv)`.

- [ ] **Step loop (near-duplicate hooks):** same procedure; extract the shared core, parameterize the one difference. Commit `refactor(fe): extract shared core of <hooks> (13a-iv)`.

- [ ] **Step loop (inline triplets / trivial wrappers):** from `…-inline-blocks.json` (enumerate) — for a `useState`+`useEffect` triplet repeated ≥3× with a unifiable outer-scope-ref set, extract a hook; for a single-use one-line wrapper component, inline it unless it adds semantic clarity (keep + note). Gate `G` + advisory, commit `refactor(fe): extract <hook> from repeated inline block (13a-iv)` / `refactor(fe): inline trivial wrapper <name> (13a-iv)`.

- [ ] **Step (codemod decision, Spec 32 §6):** if any pattern above recurs AND is mechanically transformable, stand up `frontend/scripts/codemods/<name>.ts` (typescript-API or ts-morph) with `__tests__/<name>/{input,expected}.ts` (read-apply-compare Vitest), one codemod per commit. Otherwise record "none — manual" for the scorecard. Do not build a codemod for a one-off.

### Stage 13a-v — Repeated UI patterns → `shared/ui-patterns/` (conditional)

#### Task F — Extract only if a ≥2-feature pattern surfaced

**Files:** conditional — `frontend/src/shared/ui-patterns/*` + `docs/adr/0006-*.md`, or none.

- [ ] **Step 1: Decide.** From 13a-iv's cross-feature findings: is there a non-shadcn UI pattern (form-row, dialog-shell, table-wrapper) demonstrably used by **≥2 features**? If **no** → record "ui-patterns not surfaced; folder not created" in the scorecard and **skip this task** (Spec 32 §4.5; Spec 14 §3.1 "omitted otherwise").
- [ ] **Step 2 (only if yes): Extract** to `src/shared/ui-patterns/<pattern>.tsx`, repoint the ≥2 consumers, run `npm run test` + `npm run test:e2e` (pixel-neutral). Write `docs/adr/0006-shared-ui-patterns.md` (slim Context/Decision/Consequences). Gate `G`, commit `refactor(fe): extract <pattern> to shared/ui-patterns (13a-v; ADR-0006)`.

### Stage 13a-vi — Orphan routes (TD-FE-1, TD-FE-2) — formal close

#### Task G — Re-confirm and close

**Files:** `docs/TECH_DEBT.md` (and route files only if confirmed-dead).

- [ ] **Step 1: Re-run the reachability check** (expected: same as Phase 1's 6-check kit — this is a formal close, Spec 32 §4.6):
```bash
cd frontend
for R in tenant-selection scout-deployment; do echo "== /$R =="; rg -n "$R" src/app/routes.tsx src/App.tsx src/features/shell/components/Sidebar.tsx; done
```
- [ ] **Step 2: Default keep.** Unless the orchestrator confirms a route is truly dead, keep it. Close TD-FE-1/2 in `docs/TECH_DEBT.md`: `**Resolved (Phase 13 13a-vi, <DATE>):** kept — direct-URL/programmatic reachability intentional (re-confirmed, same as Phase 1 6-check kit).` Commit `docs: close TD-FE-1/2 orphan routes (13a-vi, kept)`. (If confirmed dead: remove the route + its page in a `refactor(fe):` commit first, then close as removed.)

### Stage 13a-vii — Scorecard + 13a merge gate

#### Task H — Write the scorecard, run full preflight, merge 13a

**Files:** Create `docs/audits/<DATE>-frontend-loc-pass-2.md`; modify nothing else (except the bundle artifact via `bundle:check`).

- [ ] **Step 1: Capture the LOC + bundle deltas.**
```bash
cd frontend
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec cat {} + | wc -l   # "after" LOC
npm run bundle:check                                                          # prints raw+gzip delta vs the 2026-05-26 baseline
```
- [ ] **Step 2: Write the scorecard** following the Phase 1 format (Spec 32 §3.3 / §10 DoD #1): §LOC delta (overall + per-area, before from Stage 0 Step 4/5), **§bundle delta (raw + gzip)**, §per-category execution log (13a-i…13a-vi), §per-file verdict (`remove <SHA>` / `keep — <reason>` / `defer-TD-FE-<n>`) covering **every** file, §handoff list (anything deferred), §supplementary (preflight result, **codemod inventory** incl. "none — manual" + reasoning, similarity-tool note for §12 Q3). **Every file must have a verdict** — that is the completeness bar (Spec 32 §10).
- [ ] **Step 3: Full preflight (the 13a merge gate).**
```bash
cd frontend && npm run preflight
```
Expected: green. Red → diagnose, fix on-branch, re-run; do not merge red, no fix-forward.
- [ ] **Step 4: Commit the scorecard.**
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/audits/<DATE>-frontend-loc-pass-2.md
git commit -m "audit(fe): Phase 13 13a scorecard — tree-wide dedup + dead-code pass"
```
- [ ] **Step 5: Merge 13a to `master`** (controller-run, after operator approval — Spec 14 §5.6). Standard ceremony: `git checkout master && git merge --no-ff phase-13-loc-reduction-pass-2` with a `Merge Phase 13 (13a): …` message, then push. (Cross-sandbox merge caveats per the repo's merge convention if a sibling is in flight — none expected, Phase 13 is solo.)

---

## Stage SELECT — Choose the decomposition set (resolves Spec 32 §12 Q1)

> Run **after 13a merges**. The scorecard now reflects post-dedup sizes; the monster-file ranking is final.

### Task I — Produce the decomposition selection doc

**Files:** Create `docs/audits/<DATE>-frontend-loc-pass-2-decomposition-selection.md` (committed on a short `phase-13-select` note branch or folded into the first decomposition sub-phase branch).

- [ ] **Step 1: Re-rank post-dedup.**
```bash
cd frontend
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -not -path 'src/components/ui/*' -exec wc -l {} + | sort -rn | head -20
```
- [ ] **Step 2: Apply the §5.1 ranking** — **LOC primary** (the cliff), similarity-hit count secondary, complexity a qualitative flag. Select the set at the natural cliff (expected core: the files still >3,000 LOC post-dedup; the plan may extend/contract per measurement). For each selected file, note: path, post-dedup LOC, why it's worth splitting, and risk (the 6,040-LOC `useMarketResearchData.ts` is the most delicate — sequence it **last**; flag it may be **deferred** rather than split if no behavior-safe seam exists — Spec 32 §5.3).
- [ ] **Step 3: Write the selection doc** = the ordered list `13b, 13c, …, 13N` (one file each) + the cut rationale. This is the authority the decomposition sub-phases consume. Commit `audit(fe): Phase 13 decomposition selection (13b..13N from 13a scorecard)`.
- [ ] **Step 4: Operator checkpoint.** Surface the selection to the operator for spec→impl-style approval before cutting decomposition branches.

---

## Stage 13b…13N — Monster-file decomposition (one file per sub-phase)

> Each selected file from Stage SELECT is its own branch (`phase-13<letter>-<file-slug>` off `master`), its own merge. Apply the procedure below per file. This is **behavior-preserving structural splitting only** (Spec 32 §5.2): move cohesive chunks into sibling sub-modules/sub-components/sub-hooks; **no logic changes, no fetch rewrites**; the public surface (`index.ts`, route entry) is unchanged.

### Task J (template, instantiated per selected file) — Decompose `<FILE>`

**Files:** Modify `<FILE>`; Create sibling extracted modules under the same feature folder.

- [ ] **Step 1: Branch + baseline.** `git checkout master && git pull && git checkout -b phase-13<letter>-<slug>`; `cd frontend && npm run verify` (green baseline).
- [ ] **Step 2: Map the seams.** Read `<FILE>` and identify cohesive, independently-nameable chunks (a sub-component subtree, a group of pure helpers, a self-contained `useX` slice). For each chunk, confirm its inputs/outputs are a clean interface (props in, JSX/value out; or args in, value out) with no shared mutable closure that would break on extraction.
- [ ] **Step 3: Extract one chunk per commit.** Move the chunk to a sibling file (`<feature>/components/<Chunk>.tsx` or `<feature>/hooks/<useChunk>.ts`), re-import it into `<FILE>`, keep the rendered/returned output identical. After each extraction: `npm run verify` (typecheck proves the interface holds). Commit `refactor(fe): extract <Chunk> from <FILE> (13<letter>)`. Repeat until `<FILE>` is a thin orchestrator.

  **Worked example (shape only — the actual file comes from Stage SELECT).** For `DataSourcesManager.tsx` (~3,497): likely seams are (a) the connector-list table → `components/data-sources/ConnectorTable.tsx`, (b) the upload dialog → `components/data-sources/UploadDialog.tsx`, (c) the per-source status reducer/helpers → `components/data-sources/dataSourceStatus.ts`. Each is one extraction commit; the parent keeps composing them with unchanged props, so visual regression stays pixel-identical.

- [ ] **Step 4: Add seam tests where coverage is thin** (Spec 32 §5.2). If an extracted unit had no direct test, add a focused RTL/Vitest test asserting its behavior at the new boundary before the final commit. Commit `test(fe): cover extracted <Chunk> (13<letter>)`.
- [ ] **Step 5: Advisory + merge gate.** Before declaring the sub-phase done: `npm run test` + `npm run test:e2e` (visual regression pixel-neutral). Then the controller runs full `npm run preflight` and, on green + operator approval, merges `--no-ff` to `master`.
- [ ] **Step 6 (the 6,040-LOC hook only):** if `useMarketResearchData.ts` is the selected file, attempt only **structural** splits (cohesive sub-hooks/modules) that leave the editable-state ↔ `useQuery` coupling (TD-FE-19/21) untouched. If no behavior-safe seam exists, **defer**: log `TD-FE-<n>` ("useMarketResearchData decomposition deferred — no behavior-safe structural seam; data-layer coupling must be resolved first"), revert the branch, and record the deferral in the final scorecard handoff. Do not force.

---

## Stage Z — Phase close

### Task K — Flip Spec 14 status + record the Spec 32 delta

**Files:** `specs/14-frontend-refactoring-master-plan-design.md`; `docs/TECH_DEBT.md` (final deferrals).

- [ ] **Step 1:** On the final decomposition sub-phase's branch (or a short close branch off `master`), flip the Spec 14 §4 status row `13 — LOC reduction pass #2` to `done` with the merge date, and append a frozen-record delta block under the Phase 13 master-plan block summarizing outcomes (LOC delta, files decomposed vs deferred, ui-patterns created-or-not, codemods shipped-or-none, TD-FE-1..7 closed, new TD-FE-64+). Per the frozen-record convention, **do not rewrite** the original Phase 13 intent prose.
- [ ] **Step 2:** Ensure every new deferral is in `docs/TECH_DEBT.md` (TD-FE-64+), surgically (no Prettier).
- [ ] **Step 3:** Gate `G` + full preflight, commit `docs(fe): close Phase 13 — flip Spec 14 status, record deltas`, merge.

**Phase 13 is done when:** Spec 32 §10 DoD all hold — scorecard covers every file (with bundle delta), all `execute` applied + every `investigate` resolved, TD-FE-1..7 closed, selected monster files decomposed or explicitly deferred, ui-patterns created iff surfaced, codemods (if any) tested, preflight green at every merge.

---

## Self-Review (plan author)

**Spec coverage (Spec 32 → task):** §3 methodology → Tasks A1–A3, B; §4.1 dead code → B; §4.2 conservative defers → C; §4.3 shadcn → D; §4.4 dedup/inline → E; §4.5 ui-patterns → F; §4.6 orphan routes → G; §5 decomposition → SELECT + J (+ §5.3 hook → J Step 6); §6 codemods → E codemod step; §7 sub-phase structure → stage layout; §8 preflight cadence → gate `G` + advisory + merge gate; §9 TD-FE → C/D/G close + Z deferrals; §10 DoD → Task H scorecard + Stage Z. Every spec section maps to a task.

**Placeholder scan:** `<DATE>`, `<FILE>`, `<letter>`, `<slug>`, `<PATH_REL>`, `<symbol>`, `<name>`, `<n>` are **parameters of loop/template procedures** (the audit-driven cardinality the spec mandates — Spec 32 §1.2 decision 2, §5.1), each with an explicit binding step (Stage 0 Step 0 fixes `<DATE>`; Stage SELECT fixes the decomposition set/`<FILE>`/`<letter>`; loop heads bind `<PATH_REL>`/`<symbol>`). They are not unfilled TODOs.

**Type/name consistency:** gate `G`, the artifact paths (`docs/audits/<DATE>-frontend-loc-pass-2*`), the knip UI-sweep config name (`knip.ui-sweep.json`, created-and-deleted), and the script names (`scan-inline-blocks.ts --enumerate`, `scan-similar-symbols.ts`) are used consistently across tasks.
