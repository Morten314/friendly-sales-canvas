---
synthesizes_review: docs/reviews/21-frontend-phase-4-scaffolding-shell-design-spec-review-1.md, docs/reviews/21-frontend-phase-4-scaffolding-shell-design-spec-review-2.md
artifact: specs/21-frontend-phase-4-scaffolding-shell-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-05-29
round: 2
---

This synthesis reacts to **both** parallel round-1 reviews: `review-1` (glm-5.1) and `review-2` (claude-opus-4-8, fresh-context). Findings are referenced as `R1:<topic>` and `R2:<label>`. As the spec's author I did the reacting; the reviews were fresh-eyes. Several findings overlap across the two reviews and are merged. Two resolutions (`R2:H2` route-table location, `R2:C3` useAuth home) actually *shrink* 4b's scope.

## Round Recommendation

**yes**

Reason: The lint-enforcement section (§2.6) — the phase's only non-trivial machinery — is being rewritten (correct plugin, required resolver, mechanism deferred), and the route-table relocation (§3.3/§3.4) is a structural change; both warrant one focused re-review of the revised sections.

## Agreed Findings

- **R2:C1 (wrong plugin name).** Verified: repo has `eslint-plugin-import-x`; config uses `import-x`. Revising §1.2/§1.3.6/§2.6/§4/§8.1: `eslint-plugin-import`→`eslint-plugin-import-x`, `import/*`→`import-x/*`.
- **R2:C2 (no resolver).** Verified: no `import-x/resolver` in `eslint.config.js`. The `@/`-alias zone/cycle rules can't resolve without one. §2.6 now requires `settings['import-x/resolver']` + a real new dep `eslint-import-resolver-typescript`, and §1.3.6 drops the "no new tool" claim. 4a done-when (§2.10) gains a **positive enforcement test** (a deliberate cross-feature deep import must be flagged) so a silently-no-op rule can't pass as "green."
- **R2:C3 (useAuth mischaracterized).** Verified: `useAuth.ts` composes `useFirebaseAuth` + `useTenant` + `jwtManager`. Revising §1.2/§3.2 to describe it accurately. Resolution: **`useAuth.ts` stays in `src/hooks/` for Phase 4** (it depends on both contexts; importing them from `shared/` transitionally is allowed) — only `AuthContext`→`shared/auth/` and `TenantContext`→`shared/tenant/` move. This corrects the round-1 error, avoids a `shared/auth → shared/tenant` coupling, and shrinks 4b. Its final home is deferred (see Deferred).
- **R2:C4 (knip RED).** Verified: `knip.json` production `!` mode, ignores only `ui/**`. `FeatureErrorBoundary` (unused until Phase 5) would fail `knip --strict`. §2.5/§2.9/§2.10 now add `src/shared/components/**` to `knip.json` `ignore` in 4a, with a `TD-FE` to un-ignore when Phase 5 consumes it.
- **R2:H2 (route-table-in-shell inverts dependency direction).** Verified: `Layout` used by 11 pages; `App.tsx` `<Routes>` references all pages. Resolution: **the `<Routes>` table stays in `App.tsx`** (the app root, the one place allowed to know all features); `shell/` owns only the page-agnostic frame primitives + `ProtectedRoute` guard. §3.3/§3.4 rewritten; `AppRoutes` dropped from the shell public surface. This also moots R1's "verbatim JSX move" Low.
- **R2:H3 (Layout-hub vs §1.3.2 anti-hub rationale).** Agree the rationale is inconsistent. Rewriting §1.3.2 to justify auth/tenant→shared by **cross-cutting state / infrastructure vs. presentation** (consistent with `shared/api`), not raw consumer count. The decision stands; the justification is corrected.
- **R2:H4 / R1:§2.8 (Spec 14 freeze-vs-amend + ADR alternative).** Agree. §4 now amends only the living sections (status table, §8 Q-list) on 4a; the Phase 10/11 blocks get a **dated annotation note** pointing to ADR-0002 rather than a rewrite of frozen prose. ADR-0002 becomes the canonical record and gains an "Alternatives considered (defer to Phase 10)" line.
- **R1:§2.3 (dangling cross-references).** Verified: this spec's §2.3 is the shared-README section, not Frozen Interfaces. Fixing §1.5/§3.3/§3.5 to reference **Spec 14 §2.3** (the master plan's frozen interfaces) and adding an explicit one-line frozen-routes statement in §3.3.
- **R1:§3.7/§3.8 (contexts/ dir disposition) + R1:§3.1 (verify layout/ contents).** Agree. §3.8 now asserts both `src/components/layout/` and `src/contexts/` are **empty and deleted** after 4b; §3.1 adds a pre-move audit step (verified today: layout/ = 4 files, contexts/ = 3 files — both fully vacated).
- **R2:M1 / R1:§2.6.1 (no-internal-modules is global-with-exceptions).** Agree. §2.6 now uses `import-x/no-restricted-paths` as the primary zone enforcer and explicitly defers the index-only mechanism + allow-list to 21a's plan (with the positive-test gate from C2).
- **R2:M4 (guard parity via VR).** Agree — a wrong `requireTenant` redirect won't show in pixels. §3.5/R2 now attribute guard parity to the Playwright journeys (login→tenant→mission), with a plan check that the redirect is asserted.
- **R2:M5 / R1:§1.4-§2.1 (scaffolder subfolder contradiction).** Agree. Deciding once: **lazy, always-present files only, no `.gitkeep`.** Removing the hedges from §2.1/§2.4/§8.2.
- **R2:M6 (App.tsx nesting imprecise).** Agree. §3.3 now pins the exact current tree (providers → BrowserRouter/Routes → `</BrowserRouter>` → Toaster/Sonner/PWAInstallPrompt, all inside TooltipProvider).
- **R1:§1.5/§3.1 (PWAInstallPrompt conditional).** Agree. §3.1 takes a firm "stays put" position; a deliberate deviation is the plan's to log.
- **R2:H1 (inflated counts).** Agree the numbers are off (verified ~25 auth / ~12 useTenant / ~9 tenant-import; ~30 union, not ~40) and that several "consumers" are files 4b *moves*. Replacing hard counts with "~25 / ~12, overlapping; plan enumerates exact sites" and adding the move-vs-external-rewrite distinction. (Severity downgraded — see below.)
- **R1:§2.4 / R2:L5 (naming-map living + Phase 12 names).** Agree. §2.2/§2.4 note the map is living/authoritative, covers Phases 5–10, is extended by each later phase, and the scaffolder warns (doesn't block) on off-map names.
- **R2:L1 ("All green" unverified).** Agree. Softening §1.2 to "chain wired per §1.2"; 21a re-runs preflight as step 0.
- **R2:L3 (shadcn useSidebar unexported) + R1:§3.4 (collision).** Agree with R2's verified characterization; taking the cheap hygiene win — `shell/index.ts` exports the app hook as `useAppSidebar`. (Disagree with R1's *severity/premise* — see below.)
- **R1 Lows (§2.9 adr dir, §2.10 "source file").** Agree (trivial): §2.9 notes `docs/adr/` creation; §2.10 reworded to "no existing source module moved."

## Disagreed Findings

- **R1:§3.4 (useSidebar collision is High, "every consumer importing both gets a collision requiring aliasing").** The premise is factually wrong: verified (R2:L3) that shadcn's `useSidebar` in `components/ui/sidebar.tsx` is **module-private (no `export`)**, so it cannot be imported and cannot collide at any consumer site. The only real risk is editing within `ui/sidebar.tsx` itself. I'm still adopting the `useAppSidebar` export name (cheap clarity), but the finding as stated (High, import-collision) does not hold.
- **R2:M2 ("no-cycle will flag the auth/tenant coupling").** Partial disagree on mechanism: with `useAuth.ts` left in `src/hooks/` (C3 resolution), no `shared/auth → shared/tenant` import is created at all. Even in the rejected placement, the chain `useAuth → TenantContext → AuthContext` is acyclic at the **file** level (`AuthContext.tsx` imports neither), and `import-x/no-cycle` operates per-module, not per-folder — so it would not have flagged a "cycle." Agree the resolver (C2) is a prerequisite for `no-cycle` to mean anything; that part stands.
- **R1:§5 ("Controller" terminology may confuse).** Disagree. "Controller" is Spec 14 §5.6's established term; this spec references Spec 14 throughout and consistency with the parent is correct. Nit anyway.
- **R1:§1.3 (10-decision flat list is dense).** Disagree. The bolded lead-ins make it scannable; restructuring is cosmetic churn for no real gain. Leaving as is.

## Deferred Findings

- **`useAuth.ts` final home (from R2:C3).** Stays in `src/hooks/` for Phase 4. Trigger: Phase 10 (auth/tenant feature UIs) or Phase 11 (shared-utility extraction), whichever first needs to decide where a cross-context JWT/session hook lives. Added to §8.2.
- **R1:§2.2 (no enforcement that legacy imports are cleaned up).** Agree the gap is real, but the cleanup verification belongs to the phases where the legacy dirs actually empty, not Phase 4. Deferred to Phase 11/12 done-when (verify `features/` hold no `src/contexts|hooks|lib|utils|pages` imports; consider flipping the lint zone to forbid them once empty). §2.2 gains a one-line forward-pointer. Trigger: Phases 11–12.

## Severity Disagreements

- **R2:H1 (inflated counts): High → Medium.** The exact count isn't load-bearing — 21b's plan enumerates real files regardless; an off-by-3 estimate breaks nothing downstream. The *move-vs-rewrite* distinction inside it is the valuable part. Correcting the numbers anyway.
- **R2:H3 (Layout-hub): High → Medium.** The placement *decision* (auth/tenant→shared) is sound and unchanged; only the §1.3.2 *rationale* needs tightening. A rationale inconsistency is a Medium, not a structural High.
- **R2:H4 / R1:§2.8 (Spec 14 freeze-vs-amend): High → Medium.** A documentation-process/consistency issue affecting which Spec 14 commits get made; it doesn't block implementation. Fixing it regardless.
- **R1:§3.7 (contexts/ dir disposition): High → Low.** It's a precision gap in a done-when, not a structural defect; the fix is one clause.
- **R1:§3.4 (useSidebar): High → (finding rejected; would be Low/Nit).** See Disagreed — no import collision exists.

## Open Questions

- **Exact `import-x` index-only enforcement mechanism.** `no-restricted-paths` cleanly handles zone boundaries (`shared ↛ features`, `ui ↛ features|shared`), but expressing "feature A may import feature B only via B/index" generically per-feature-pair is awkward in both `no-restricted-paths` and `no-internal-modules`. Deferred to 21a's plan with a mandatory positive-enforcement test as the acceptance gate — but if neither rule can express index-only cleanly with the configured resolver, 21a may need to fall back to `dependency-cruiser` (Spec 14's documented fallback) for that one constraint. Flagging now so the plan author treats it as a spike, not a given.
- **Whether `eslint-import-resolver-typescript` interacts cleanly with the existing flat-config + `import-x/order`** (no resolver is configured today, yet `import-x/order` passes). 21a validates before relying on the zone/cycle rules.
