---
artifact: specs/21-frontend-phase-4-scaffolding-shell-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
---

## Context

Reviewed against the parent spec (`specs/14-frontend-refactoring-master-plan-design.md`) conventions, the Phase 0 sub-split precedent (`specs/15`), and the predecessor Phase 3 spec (`specs/20`). No token or context limitations.

## Findings

### [High] §3.1/§3.5 — §2.3 cross-reference points to shared/README.md, not routes

**Location:** §1.5 ("Routes (§2.3) and rendering stay frozen"), §3.3 ("same route URLs per §2.3"), §3.5 ("Routes frozen (§2.3)")

Three places reference "§2.3" for the route-freeze guarantee, but §2.3 is `src/shared/README.md (promotion criteria)`. There is no section describing the current route table or asserting which URLs are frozen. The route descriptions live inside the §1.2 `App.tsx` table row, which is informational context — not a normative contract. Plan authors will trip on these dangling references.

**Fix:** Add a short normative subsection (either inside §3.3 or as a new §3.3.1) that lists the frozen route paths, or redirect all three references to the correct anchor. At minimum, each "per §2.3" should read "per §1.2 (App.tsx starting state)".

---

### [High] §3.4 — `useSidebar` name collision is actively exported without mitigation

**Location:** §3.4 (`shell/index.ts` re-exports `useSidebar`), §3.6 (TD-FE for collision)

The spec correctly identifies that shadcn's `components/ui/sidebar.tsx` exports its own `useSidebar`, unrelated to the app's sidebar-collapse context. It then exports the app's hook under the **same name** from `shell/index.ts` and defers the rename to a TD-FE entry. This means every downstream consumer that imports both `@/features/shell` and `@/components/ui/sidebar` gets an immediate name collision requiring per-file aliasing — the exact confusion the TD-FE warns about, but now at the barrel-export level.

Deferring the rename is reasonable, but the barrel should export an unambiguous name now (e.g. `useAppSidebar`) so the collision never reaches consumers. The rename inside `SidebarContext.tsx` internals can remain deferred.

---

### [High] §3.7 — Disposition of `src/contexts/` directory is ambiguous

**Location:** §3.7 (files touched — deleted list), §3.8 done-when item 2

§1.2 lists exactly three files in `src/contexts/` — all three move out in 4b. §3.7 lists them as "Deleted (moved)." §3.8 item 2 says `src/contexts/` "no longer holds Auth/Tenant/Sidebar." But neither §3.7 nor §3.8 explicitly states the directory itself is deleted. The done-when should assert "src/contexts/ does not exist" (or "is empty and deleted") to prevent a zombie empty directory from lingering — and to catch any files added to `contexts/` between spec and execution that the spec didn't account for.

---

### [Medium] §2.6.1 — `import/no-internal-modules` allow-list is a latent maintenance trap

**Location:** §2.6 item 1 ("The allow list must whitelist all existing deep-import patterns")

The rule is scoped to `@/features/*`, so today it's vacuous. But the `allow` list that whitelists `@/components/ui/*`, `@/shared/api/*`, etc. will need updating as `shared/` grows new subdirs (auth, tenant, hooks, lib, types across Phases 4b–11). Each new `shared/` subdir must be added to the allow list or every feature importing from it hits a lint error. This maintenance tax isn't called out anywhere — not in the conventions README, not in the spec text, and not in any phase's responsibility.

**Fix:** Add a note to §2.6 (or §2.2) stating that the `no-internal-modules` allow list is the responsibility of whichever phase introduces a new `shared/` or `components/` subdirectory. Alternatively, consider using a negative pattern (allow everything *except* `@/features/*` internals) rather than an explicit whitelist.

---

### [Medium] §3.1 — No verification that `src/components/layout/` contains exactly four files

**Location:** §3.1 (Shell sources & destination table)

The move table lists four files from `src/components/layout/` and assumes the directory is empty afterward ("deleted once empty"). If additional files exist in that directory (utilities, index files, styles), they'd be orphaned by the delete or silently lost. The spec should direct the 21b plan to audit `src/components/layout/` contents before the move and account for any extras.

---

### [Medium] §2.8 — ADR-0002 reverses a Spec 14 decision without recording the alternative

**Location:** §2.8 (ADR-0002), §1.3 decision 3 (TenantContext promoted now, not Phase 10)

ADR-0002 records that `TenantContext` moves to `shared/` in Phase 4 instead of Phase 10 (as Spec 14 originally planned). The slim 3-part ADR template (Context/Decision/Consequences) omits "Alternatives considered." For an ADR that reverses a prior plan decision — particularly one with a 14-consumer blast-radius justification — the alternative (defer to Phase 10) and the tradeoff should be explicit. Otherwise a future reader can't tell whether this was a considered change or an oversight.

**Fix:** Either add a brief "Alternatives" section to ADR-0002 specifically (without changing the template), or add an "Alternatives" line to the slim template. The spec already considers and rejects alternatives for other decisions (e.g., `dependency-cruiser` vs `eslint-plugin-import` at §1.3 item 6); ADR-0002 should receive the same treatment.

---

### [Medium] §1.5 / §3.1 — `PWAInstallPrompt.tsx` disposition is a conditional that leaks plan-decision into spec

**Location:** §3.1 ("stays put...unless 21b's plan finds reason to move it")

The spec takes a firm position on every other file but leaves `PWAInstallPrompt.tsx` conditional. This delegates an architectural decision (what's in scope for the shell) to the plan. If the plan moves it, the spec's §3.1 file table and §6 combined done-when are stale. If the plan doesn't move it, the conditional was noise. The spec should take a firm "stays put" position and let the plan document a deliberate deviation if one arises — the same pattern used for per-page Layout composition (§1.5).

---

### [Medium] §2.4 — Scaffolder naming-map validation may create friction for new features

**Location:** §2.4 ("validates the name is kebab-case and is on the naming map (or warns if not)")

The naming map (§2.2) lists 10 features + `profiler` reserved. Each new feature phase (5–12) scaffolds one folder. If the naming map isn't updated in this spec or Spec 14 before that phase runs, the scaffolder emits a warning on every invocation. The spec doesn't specify when or how the naming map is updated — does each phase's spec add its name? Does the plan? Is it the scaffolder user's responsibility?

**Fix:** Add a sentence stating that the naming map in `features/README.md` is authoritative and is updated by each feature phase's spec (or plan) before scaffolding. Or relax the scaffolder to "warn if not on map" without blocking (which it already does — just clarify that the map is living, not locked).

---

### [Medium] §2.2 transitional exception — no tracking mechanism for legacy import cleanup

**Location:** §2.2 ("Transitional exception (Phases 4b–12): importing from not-yet-migrated legacy dirs is permitted")

The transitional exception is necessary, but there's no mechanism to verify that all legacy imports are cleaned up by Phase 12. Each phase is expected to clean its own, but there's no "final sweep" step in Phase 12 (or Phase 14) to catch stragglers. The lint rules explicitly do not forbid legacy imports (§2.6), so there's no automated enforcement.

**Fix:** Add a note that Phase 12's done-when (or Phase 14's cleanup) includes a verification that `features/` contains no imports from `src/contexts/`, `src/hooks/`, `src/lib/`, `src/utils/`, `src/pages/`. Or add a tracking item to `TECH_DEBT.md` now.

---

### [Low] §2.9 files table omits `docs/adr/` directory creation

**Location:** §2.9 (files touched — 4a)

The table lists `docs/adr/0001-adr-template.md` and `docs/adr/0002-...` as new files but doesn't mention creating the `docs/adr/` directory itself. Trivial in practice (the plan creates it), but the table is positioned as a complete inventory.

---

### [Low] §2.10 done-when item 9 — "source file" is ambiguous

**Location:** §2.10 item 9 ("No existing source file moved — git diff --stat shows only additions plus the eslint.config.js/package.json/spec-14 edits")

"Source file" could be read as excluding test files, config files, or markdown. The git diff phrasing is precise enough to disambiguate, but the "source file" label in the prose doesn't match.

---

### [Low] §1.4 / §2.1 — Scaffolder subfolder strategy has two contradictory defaults

**Location:** §2.1 ("pages/, components/, hooks/, services/ are created on demand by the owning phase"), §2.4 ("created with a .gitkeep only if 21a's plan prefers — plan author's call, §8.2")

§2.1 says subfolders are "created on demand" (i.e., not by the scaffolder). §2.4 says the scaffolder might create them with `.gitkeep`. §8.2 item 1 defers the decision and says "Default: lazy." The three are consistent if read carefully (the scaffolder creates the feature root; subfolders are lazy), but a plan author scanning §2.4 could reasonably conclude the scaffolder might emit `.gitkeep` files, contradicting §2.1's "on demand."

---

### [Low] §3.3 — "verbatim JSX move" is an aspiration, not a guarantee

**Location:** §3.3 ("verbatim JSX move — same component tree, same route URLs")

Moving `<Routes>` from `App.tsx` to `shell/AppRoutes.tsx` changes the component tree by introducing a new intermediate component (`AppRoutes`). React's reconciliation sees a different fiber. In practice this is safe (same JSX children, no state at this level), but it's not literally "verbatim" — the wrapper component is new. A plan author should understand that the *render output* is identical, not the *component tree*. The visual regression tests will catch any real drift, so the risk is contained.

---

### [Nit] §3.1 — "unless 21b's plan finds reason to move it (then log the decision)"

The parenthetical "then log the decision" doesn't specify where (ADR? plan doc? commit message?). Minor, but consistent logging conventions would help.

---

### [Nit] §5 step 6 — "Controller runs npm run preflight"

Uses Spec 14's "Controller" terminology for the human operator. Consistent with the parent spec, but could confuse readers reviewing this spec in isolation.

---

### [Nit] §1.3 — 10 decisions in a flat numbered list is dense

Scanning for a specific decision requires reading the full list. Not a content issue — the decisions themselves are well-reasoned — but grouping by topic (scaffolding, naming, lint, placement) would improve navigation.

---

## Summary

The spec is thorough, well-structured, and plan-ready with targeted fixes. The three High findings (dangling §2.3 cross-references, `useSidebar` collision exported at barrel level, `src/contexts/` directory deletion) should be resolved before plan writing — they're the kind of ambiguity that creates plan-author confusion or downstream consumer pain. The Medium findings are quality improvements that reduce maintenance risk during the Phase 5–12 extraction sequence. Nothing is fundamentally wrong with the architecture or the sub-split strategy; the findings are about precision and completeness.
