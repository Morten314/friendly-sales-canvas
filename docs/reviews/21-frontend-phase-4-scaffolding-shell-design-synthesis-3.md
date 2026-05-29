---
synthesizes_review: docs/reviews/21-frontend-phase-4-scaffolding-shell-design-spec-review-3.md
artifact: specs/21-frontend-phase-4-scaffolding-shell-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-05-29
round: 3
---

Reacts to `review-3` (glm-5.1), the round-2 re-review of the revised spec. All factual findings were re-verified against the tree before categorizing. **One finding (C1) corrects an error I introduced in round 2** — flagged explicitly below per the "correcting your pushback" discipline.

## Round Recommendation

**no**

Reason: All Critical/High findings are agreed and fixed in this round-3 revision; the only disagreed items are Low/Nit and genuinely contested. Three review rounds have converged (impact shrank: round-1 broken config → round-2 preflight-red gap → round-3 factual + one mechanical override). Remaining execution detail is caught by the plan + plan-review stages.

## Agreed Findings

- **C1 (shadcn `useSidebar` IS exported) — corrects my round-2 error.** Verified: `ui/sidebar.tsx:710-735` exports `useSidebar` (734) and `SidebarProvider` (730). My round-2 reviewer claimed it was module-private (it checked the `function useSidebar()` declaration at line 35, not the trailing `export {…}` block), and I used that to downgrade review-1's original collision finding in synthesis-2. **That was wrong.** Fixing §1.2/§2.7/§3.6: shadcn's `useSidebar` *and* `SidebarProvider` are real exported name-twins of the app's; the collision is real (currently *inactive* only because no file imports them from `ui/sidebar`). The `useAppSidebar` rename resolves a real export-name collision, not "cheap clarity." (Severity note: agree it's a real factual error; impact is accuracy/rationale since the corrective rename was already specified — so functionally High rather than plan-blocking, but I'm not minimizing it: I introduced it.)
- **H1 (react-refresh override scoped to `src/contexts/**`).** Verified: `eslint.config.js:86` disables `react-refresh/only-export-components` only for `src/contexts/**` (+ one LeadStream file); the rule is `warn` and `lint` runs `--max-warnings 0`. Moving the context files (and creating `shell/index.ts`, which co-exports `Layout`+`useAppSidebar`+`ProtectedRoute`) would warn → preflight red. Fix: **4a expands the override zone to cover `src/shared/**` + `src/features/**`** (same pattern as the existing contexts entry), so 4b's moves land in already-covered zones. Added to §2.6, §2.9, and 4b's awareness in §3.2/§3.8. Good catch — slipped all three prior reviews.
- **H2 (`useAuth` name collision).** Verified: `contexts/AuthContext.tsx:213` and `hooks/useAuth.ts:7` both export `useAuth` (different behaviors; 25 vs 4 consumers). Adding a note to §3.2 (the `shared/auth` barrel exposes the *context* `useAuth`; the composed hook stays `@/hooks/useAuth`) + a `TD-FE` recording the hazard. 4b doesn't worsen it; documenting it.
- **H3 (185 lines dead commented code in `AuthContext.tsx`).** Verified: lines 1–186 commented out; real code starts at 187. Resolution: **strip the dead comment block during the 4b move** (comment-only → zero behavior change → still parity-preserving). §3.2/§3.7 updated to carve this out of "preserve content."
- **M1 (`TD-FE-14` still hard-coded in §3.8 item 6).** Verified — my round-2 fix updated §3.6/§3.7 but missed §3.8 item 6. Changing to "next free TD-FE number."
- **M2 (index-only spike has no fallback outcome).** Adding to §2.6 item 2 + done-when: if no mechanism passes the positive test, 4a ships with zone boundaries only and logs a `TD-FE` for index-only enforcement (does not block 4a).
- **M3 (§2.6 self-referential "corrects §1.3.6" parenthetical).** Verified — §1.3.6 already states the resolver is a new dep, so the parenthetical refers to a draft that no longer exists. Removing it.
- **M4 (`SidebarProvider` twin too).** Verified (line 730). Folding into the C1 correction: both `useSidebar` and `SidebarProvider` are shadcn↔app export twins; §2.7/§3.6 acknowledge both.
- **L2 (knip starting-state incomplete).** Adding `ignoreDependencies: ["tailwindcss-animate","tsx"]` and the test/e2e/scripts entry patterns to the §1.2 knip row.
- **L3 ("~11" Layout importers).** Verified exactly 11. Dropping the "~".
- **N2 (§9 lists own review artifacts).** Relabeling them as "review-pipeline artifacts (this spec's own cycle)" to separate from substantive companions.

## Disagreed Findings

- **L1 (scaffolder should block, not warn, on off-map names).** Disagree. The naming map is **living** (§2.2 — each feature phase appends its name before scaffolding), so a hard block would force editing the map before every legitimate new-feature scaffold — friction that fights the living-map design. The warning fires, and an off-map/misspelled folder (`scuot/`) is visible in the diff and caught at review. For a pre-launch MVP optimizing velocity, warn-not-block is the right default. (The 21a plan may optionally add an interactive confirm; not mandating it.)
- **N1 ("≈" counts are exactly verifiable).** Disagree. The three reviewers produced *different* "exact" counts (review-3 says 26 AuthContext / 10 TenantContext; review-2 said 25 / 9; mine ≈25 / ≈9) — which is precisely why `≈` is honest: the number depends on whether you count `App.tsx`, the hook file itself, commented imports, and type-only imports. 21b enumerates the exact rewrite set. Pinning a single number that the next counter disputes is false precision. Keeping `≈`.

## Deferred Findings

(none — all agreed findings are actioned in this round-3 revision; H2's `useAuth`-collision and the C1/H1 follow-ons are documented in-spec + as TD-FE rather than deferred.)

## Severity Disagreements

- **C1: Critical → High.** Agree it's a real factual error, but the corrective action (the `useAppSidebar` rename) was already specified in round 2, so it doesn't block plan-readiness — the fix is correcting the *rationale/risk characterization*, not adding missing work. Stated plainly so I'm not seen to minimize an error I introduced: it's High and I'm fixing it now.
- **H2: High → Medium.** The two-`useAuth` collision is **pre-existing** and not worsened by 4b (4b relocates `AuthContext` but `hooks/useAuth` stays put; it becomes intra-directory only if a later phase moves the composed hook into `shared/`, which is deferred). Documenting it as a hazard + TD-FE is sufficient at this stage.
- **H3: High → Low/Medium.** Stripping comment-only dead code is a trivial, zero-risk cleanup, not a structural concern; agreed and done, but it's not High.

## Open Questions

- **Does `shell/index.ts`'s co-export of `Layout` (component) + `useAppSidebar` (hook) + `ProtectedRoute` (component) trip `react-refresh/only-export-components` even with the H1 override?** The H1 fix (override covering `src/features/**`) should neutralize it, but 21a/21b must confirm the override actually silences barrel co-exports rather than only single-file context co-exports. Flagged for the plan's positive-lint verification.
