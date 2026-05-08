# Plan 01 — PWA Folder→Branch Refactor

**Status:** Ready for execution (all decisions resolved). Awaiting your go-signal.
**Date:** 2026-05-05
**Author:** Claude (drafted in collaboration with @jag)
**Repo affected:** `tech-brewra/PWA-multi-tenancy` only — `tech-brewra/backend` is **not** touched in this plan
**Safety net:** `/projects/Brewra/safety_net_1/`
**Predecessor work:** `pre-refactor-2026-05-05` tag exists on both repos; analysis edits committed; `master` and `main` (backend) untouched.

---

## 1. Decisions made (resolved before execution)

| # | Decision | Implication |
|---|---|---|
| 1 | **Option C** — keep dev and prod as two parallel long-lived branches; **no reconciliation merge**. The frontend dev who'd do the triage isn't available. | Drift between branches grows over time. Shared-code bug fixes must be applied on both branches. Plan §10 documents the maintenance model. |
| 2 | **Root-level PWA files** (above the canvas folders — 7 files: 4 deploy docs + 3 analysis docs) **stay only on `master`**. Not copied into the new branches. | `master` becomes the historical/reference branch. The new branches are clean canvas-only repos. |
| 3 | **Git history must be preserved.** Each branch's history shows the relevant commits with paths rewritten to root. | Use `git subtree split` (verified working on this machine, `git --version` 2.34.1). `git-filter-repo` is not installed and not needed. |
| 4 | **Vercel topology not yet known.** Plan proceeds without that info; cutover is a separate phase that requires dashboard access. | §6 (the refactor proper) does not touch Vercel. §8 (cutover) is gated on access **and** on the deferred push step (§6.8). |
| 5 | **Structural only** — no code cleanup (console.logs, dead files, MarketResearch.tsx splitting) in this plan. | Refactor scope is mechanical: extract subtrees, set up branches, verify content unchanged. Cleanup is a future plan. |
| 6 | **Backend out of scope.** `backend_refactor` branch sits idle until the repo-merge plan. | Zero risk to backend. Render unaffected. |
| 7 | **Branch names:** new branches are **`develop`** (dev canvas content at root) and **`production`** (prod canvas content at root). | Naming collision with existing `master` resolved by using `production` rather than another `master`. |
| 8 | **Local only — DO NOT PUSH to origin** as part of this plan. The new branches stay local until a separate, deliberate push decision later. | Lower risk during evaluation. The team won't see the new branches yet. Recovery from a destroyed local repo would require re-running the plan from a fresh clone. |
| 9 | **Keep the `refactor` branch — DO NOT DELETE** as part of this plan. | Acts as a fallback/reference; can be deleted later in a separate step once `develop` and `production` have soaked. |

---

## 2. End state — what the PWA repo looks like after this plan

```
tech-brewra/PWA-multi-tenancy (LOCAL ONLY — nothing pushed to origin yet)
├── master            ← untouched. Has both canvas folders nested. Historical reference + the 7 root-level files.
├── refactor          ← untouched. Kept as fallback/reference per decision #9.
├── develop           ← NEW (local only). Created via subtree-split of `development/friendly-sales-canvas/` from `refactor`. Canvas content at root. Gitflow-style integration branch.
└── production        ← NEW (local only). Created via subtree-split of `production/friendly-sales-canvas/` from `refactor`. Canvas content at root. Gitflow-style production branch.
```

Tags after this plan (local only, also not pushed):
- `pre-refactor-2026-05-05` — unchanged, still points at master/refactor tips. Pushed to origin earlier.
- `develop-initial-2026-05-05` — new, points at first commit of `develop` branch (post-split). Local only.
- `production-initial-2026-05-05` — new, equivalent for `production`. Local only.

Origin/GitHub state: **unchanged** — nothing new pushed. `master`, `refactor`, and the `pre-refactor-2026-05-05` tag are what's visible to the team.

Backend repo: unchanged (`backend_refactor` still parked, `main` untouched).

---

## 3. Decisions resolved during planning

For history. All these were settled before execution:

- **Branch name for the prod-content branch.** Earlier draft proposed `production` because `master` was already taken by the historical trunk. Confirmed: **`production`**.
- **Push to origin?** No, not as part of this plan. Local only.
- **Delete `refactor` branch?** No, not as part of this plan. Keep it as a fallback.

These three were the only blocking questions in the prior draft.

---

## 4. Scope — explicit in/out

**In scope (what §6 actually does):**
- Create `develop` (subtree of dev folder, history preserved, paths rewritten to root) — **local only**
- Create `production` (subtree of prod folder, history preserved, paths rewritten to root) — **local only**
- Tag both new branches at their initial commit — **local only**
- Set up worktrees so each branch has a stable on-disk path
- Verify with safety_net_1's `verify.sh` that file content is byte-identical to the snapshot
- Verify that `npm ci && npm run build` produces byte-identical `dist/` outputs
- Document the new structure in CLAUDE.md and on the new branches (`BRANCHES.md`)

**Out of scope (deferred to future, deliberate decisions):**
- **Pushing to origin** (decision #8 — deferred)
- **Deleting the `refactor` branch** (decision #9 — deferred)
- Reconciling drift between dev and prod (Option C — confirmed)
- Any code cleanup (console.logs, dead files, big-file splits, commented-out code)
- Touching the backend repo
- Vercel deploy reconfiguration (separate phase, §8)
- Setting up branch protection on GitHub (recommended follow-up; needs dashboard access; only relevant after push)
- Deleting the original `master` branch or any other rename
- Updating the safety_net_1 snapshot itself (it remains the pre-refactor baseline; **do not refresh** until after a full successful cutover)

---

## 5. Pre-conditions

Before executing this plan, all of the following must be true. I've marked which are already satisfied.

- [x] `safety_net_1` exists and `./verify.sh all` exits 0 (verified earlier today)
- [x] `pre-refactor-2026-05-05` tag exists on both repos and is pushed
- [x] No uncommitted changes on the `refactor` branch (verified — clean tree)
- [x] No tracked `.env` files in the PWA repo (confirmed)
- [x] No files >1MB tracked in the PWA repo (confirmed — no LFS concerns)
- [x] `git subtree split` smoke-tested on this machine (works)
- [x] Branch naming for the prod-content branch confirmed: `production`
- [ ] No other developer has unpushed local work on `master` or `refactor` that would be invalidated. **Coordinate before executing.** If anyone has an in-flight feature branch off master, they should rebase onto `develop` after this plan completes (their work isn't lost — master is untouched — but `develop` is the new integration target). *(Note: since we're not pushing anything in this plan, this concern is mostly forward-looking — relevant when push happens later.)*
- [ ] Disk space check: each worktree needs ~600MB for node_modules. With master + develop + production worktrees side-by-side, expect ~1.8GB of node_modules total.

---

## 6. Step-by-step procedure

All commands assume `/projects/Brewra/PWA-multi-tenancy/` as the source repo. **Everything in §6.1–6.7 is local; nothing is pushed to origin.** §6.8 lists the deferred steps that are intentionally NOT executed.

### 6.1 Pre-flight (5 minutes)

```bash
# Confirm starting state
cd /projects/Brewra/PWA-multi-tenancy
git status                                  # expect: clean tree, on `refactor`
git tag --list pre-refactor-2026-05-05      # expect: present
git log --oneline -3 refactor               # expect: 507e55b at top
git log --oneline -3 master                 # expect: 2a2c2e5 at top

# Confirm safety_net_1 still passes
/projects/Brewra/safety_net_1/verify.sh all
# expect: "RESULT: all checked categories match snapshot"
```

If any check fails, **stop**. Investigate before proceeding.

### 6.2 Create the `develop` branch via subtree split (2–10 minutes)

```bash
cd /projects/Brewra/PWA-multi-tenancy
git checkout refactor

# This walks all commits reachable from refactor's tip and rewrites those
# that touched files under `development/friendly-sales-canvas/`, with the
# prefix stripped from paths. Creates a new local branch `develop`.
git subtree split --prefix=development/friendly-sales-canvas/ -b develop

# Sanity checks
git log develop --oneline | head -5
# expect: commits with sensible messages, NEW SHAs (different from refactor)
git ls-tree --name-only develop | head -10
# expect: src/, public/, package.json, vercel.json, vite.config.ts, etc. AT ROOT
git ls-tree --name-only develop | grep -E '^development/' && echo "LEAK — prefix not stripped" || echo "prefix stripped OK"
```

### 6.3 Create the `production` branch via subtree split (2–10 minutes)

```bash
# Same source branch (refactor); different prefix.
git subtree split --prefix=production/friendly-sales-canvas/ -b production

git log production --oneline | head -5
git ls-tree --name-only production | head -10
git ls-tree --name-only production | grep -E '^production/' && echo "LEAK" || echo "OK"
```

**Note on history shape:** because `master` and `refactor` differ only by the analysis-docs commit (which touched only root-level `analysis/` files, not canvas content), sourcing the prod split from `refactor` vs. `master` produces equivalent results. We use `refactor` for both for consistency.

### 6.4 Verify content matches the snapshot (5 minutes)

This is the critical "did the conversion preserve every byte of source?" check. Use worktrees so we don't have to keep checking out branches in the main working tree.

```bash
# Create worktrees alongside the main repo
git worktree add /projects/Brewra/pwa-develop develop
git worktree add /projects/Brewra/pwa-production production

# Run verify.sh against the new layouts
FRONTEND_DEV_DIR=/projects/Brewra/pwa-develop \
FRONTEND_PROD_DIR=/projects/Brewra/pwa-production \
  /projects/Brewra/safety_net_1/verify.sh source
# expect: backend-source OK, frontend-dev-source OK, frontend-prod-source OK
```

**If the source manifests fail at this step**, do not proceed. The subtree split has not preserved content as expected. Likely causes: (a) a file was renamed across the prefix boundary in history and split confused itself; (b) line-ending normalization on some platform. Investigate before continuing.

### 6.5 Build verification — the strongest signal (10–15 minutes)

```bash
cd /projects/Brewra/pwa-develop
npm ci
npm run build
cd /projects/Brewra/pwa-production
npm ci
npm run build

FRONTEND_DEV_DIR=/projects/Brewra/pwa-develop \
FRONTEND_PROD_DIR=/projects/Brewra/pwa-production \
  /projects/Brewra/safety_net_1/verify.sh build
# expect: frontend-dev-build OK, frontend-prod-build OK
```

If `dist/` hashes match the snapshot, the deployable artifact is **byte-identical** to what would deploy today. Strongest possible signal short of an actual deploy.

### 6.6 Tag the new branches (1 minute)

```bash
cd /projects/Brewra/PWA-multi-tenancy
git tag develop-initial-2026-05-05 develop
git tag production-initial-2026-05-05 production
git tag --list | grep 2026-05-05
```

These tags are **local only**. They go to origin if/when the deferred push step in §6.8 is executed.

### 6.7 Documentation update (15 minutes)

Update `master`'s `README.md` (and CLAUDE.md at `/projects/Brewra/CLAUDE.md`) to reflect the new branch model. Specifically note:
- `master` is now historical — do not commit to it
- `develop` is the integration branch (gitflow-style)
- `production` is what Vercel will deploy from after cutover (currently still deploys from `master`'s nested folder)
- Bug fixes that affect both must be applied separately to each branch (Option C maintenance reality)
- The `analysis/` folder lives only on master
- **The new branches are local only at this point** — they are not on origin yet

Add a new file `BRANCHES.md` (or section in README) on each of `develop` and `production` documenting their role, so a fresh clone (when push eventually happens) is self-explanatory.

### 6.8 Deferred steps — DO NOT execute as part of this plan

These are intentionally excluded. They become their own small follow-up actions when you decide to commit the new structure to the team.

#### 6.8.a Push to origin (deferred — decision #8)

When ready (separate, deliberate decision):

```bash
cd /projects/Brewra/PWA-multi-tenancy
git push origin develop
git push origin production
git push origin develop-initial-2026-05-05 production-initial-2026-05-05
```

**Vercel side note for when this happens:** if a Vercel project is configured to auto-deploy any new branch (rare but possible), pushing here may trigger a deploy. **Check Vercel before pushing if not sure.** If auto-deploy is on, either disable it temporarily or be ready for the new-branch deploy to land somewhere harmless (a preview URL, not production).

#### 6.8.b Delete the `refactor` branch (deferred — decision #9)

When `develop` and `production` have soaked and no one needs `refactor` as a fallback:

```bash
# Local
git branch -D refactor
# Remote (only relevant if §6.8.a was executed and refactor was on origin)
git push origin --delete refactor 2>&1 || echo "refactor not on origin (fine)"
```

---

## 7. Deep impact analysis

### 7.1 Git history & SHA changes
- `git subtree split` **rewrites SHAs** for every commit on the new branches because paths change. Old SHAs are not reachable from the new branches.
- `master`'s SHAs are unchanged. The `pre-refactor-2026-05-05` tag still resolves.
- Anyone with an old commit SHA bookmarked (e.g., in a PR comment, a Slack link, or a build artifact label) needs `master` to resolve it. Communicate this to the team **once push happens** — meanwhile, they don't even know the new branches exist.
- `git blame src/components/MarketRankings.tsx` on `production` will show the file's history with paths relocated to root. Works as expected.
- Edge case: if a file ever moved BETWEEN the dev and prod folders in history, only the segment within the splitting prefix appears in that branch's history. We have not seen evidence of cross-folder moves, but worth keeping in mind.

### 7.2 Working tree paths
- `/projects/Brewra/PWA-multi-tenancy/development/friendly-sales-canvas/` is a **valid path only when `master` (or `refactor`) is checked out** in the main working tree. Switch to `develop` and the path disappears.
- IDE bookmarks, terminal aliases, shell history that hardcode this path **will break** when on `develop` or `production`.
- **Mitigation:** worktrees (§6.4). Each branch gets its own stable on-disk path. Recommended layout:
  ```
  /projects/Brewra/PWA-multi-tenancy/   → master/refactor (default; both folders visible on master, refactor is identical structure)
  /projects/Brewra/pwa-develop/         → develop branch worktree
  /projects/Brewra/pwa-production/      → production branch worktree
  ```
- Worktrees count against disk: ~600MB node_modules each. Three of them ≈ 1.8GB.
- The dev who normally works in `development/friendly-sales-canvas/` should switch to working in `/projects/Brewra/pwa-develop/` once the new structure is adopted. Old shell history will keep auto-completing the old path — flag this in team comms when push happens.

### 7.3 Vercel deployment configuration
**Current state (best guess, since dashboard access is pending):** there is at least one Vercel project pointed at this repo with:
- Root Directory: `production/friendly-sales-canvas/`
- Production Branch: `master` (or whatever default)
- Build Command: `npm run build`
- Output Directory: `dist`
- (`vercel.json` content matches both subfolders — confirmed byte-identical)

**During this plan (§6):** No Vercel changes. `master` still has both canvas folders nested. **And `develop`/`production` branches don't even exist on origin yet** (decision #8). Vercel cannot see them. Existing deploys keep working unchanged.

**At cutover (§8, separate phase, requires §6.8.a push to be done first):** for each Vercel project pointed at a canvas folder:
- Change "Production Branch" from `master` (or current) to `production` (or `develop` for the dev project, if there is one)
- **Remove** the "Root Directory" setting, or set to `.`
- Trigger a redeploy
- Compare the hashed asset names of the new deploy against what's in the snapshot — they should match

**Rollback (if cutover misbehaves):** revert the Vercel project to its previous Production Branch + Root Directory settings. The old canvas folder still exists on `master`.

### 7.4 Render (backend) — no impact
Backend repo is not touched. `render.yaml` is in the backend repo. Render config doesn't reference the PWA repo at all. Zero impact.

### 7.5 PWA service worker behavior
- The dev/prod canvas builds register a service worker (`sw.js`) with auto-update, generated by `vite-plugin-pwa` with content hashes.
- After Vercel cutover (when that day comes), the next user visit triggers SW update via standard PWA flow. Some users may need a refresh; some may see stale UI for a few seconds.
- This is **not** a refactor concern — it's a deploy concern, and identical to any other deploy. Mention to support so they're not surprised by a (temporary) bump in "I see the wrong UI" reports right after cutover.

### 7.6 vite.config.ts and the hardcoded backend URL
- `vite.config.ts` content is among the 199 byte-identical files between dev and prod folders. After the refactor, it lives at the root of each new branch. **No content change needed.**
- The hardcoded proxy target (`backend-11kr.onrender.com`) is unchanged. The backend Render URL is unchanged. The contract is unchanged.
- `vercel.json` is also byte-identical between folders and needs no edits — its `rewrites` point `/api/*` at the same backend URL.

### 7.7 Local node_modules and dev workflow
- Each worktree needs `npm ci` to populate its own `node_modules/` (npm doesn't share across worktrees by default).
- Disk: ~1.8GB across three worktrees. Trivial on dev machines, worth noting for any constrained CI runner.
- `npm run dev`, `npm run build`, `npm run lint` work identically inside each worktree.

### 7.8 GitHub branch protections / open PRs
- Until §6.8.a is executed, **none of this matters yet** — the new branches don't exist on GitHub.
- Once push happens: branch protections on `master` are unknown (we don't have admin access info). They don't affect the push of new branches.
- Open PRs (if any) target `master`. They remain valid indefinitely. Whoever owns each PR should decide whether to retarget to `develop` (for new features) or to keep targeting master and then cherry-pick into the right branch later.
- **Recommendation post-push:** add branch protection to `develop` and `production` to make them the new "real" main branches.

### 7.9 Effect on team's in-progress work
- **No effect during this plan**, because nothing is pushed and nothing on master changes.
- When push eventually happens: anyone with unpushed feature branches off master continues to work fine (master untouched), but should rebase onto `develop` to get the new integration target. Coordinate the push timing.

### 7.10 safety_net_1 verify.sh — post-refactor usage
- `verify.sh` is already designed for this: env var overrides for paths, project-root-relative manifests.
- The exact invocation post-refactor is in §6.4 and §6.5 above. No changes to `verify.sh` itself are needed.
- **Don't refresh the snapshot itself** until after a full successful cutover — the snapshot's value is being a frozen pre-refactor baseline.

### 7.11 The 28 dev-only files include some known cruft
For visibility (not for action in this plan): the dev-only file list includes some items CLAUDE.md flagged as cruft:
- `src/components/market-research/SafeChatWithScout copy.tsx` — duplicate file, candidate for deletion in a future cleanup plan
- `src/pages/_restore_test.txt` — a stray text file
- `dev-dist/registerSW.js` — looks like a build artifact that ended up tracked by accident

These do **not** need attention here. Bring them up in the future code-cleanup plan.

### 7.12 The 19 prod-only files — confirmed customer-facing
The market-research components only in prod (`MarketRankings*`, `MarketSegments*`, `SwotAnalysis*`, `TechnologyDrivers*` — 8 files plus `profilerCache.ts`) **stay only on `production`** under Option C. They are not propagated to `develop`. This is the explicit decision per §1.

If a stakeholder asks for one of these features in dev, the answer is: "We chose not to reconcile dev/prod drift; this feature lives only on the production branch. Backporting requires a (currently unscheduled) reconciliation effort."

---

## 8. Cutover phase (separate, requires both Vercel access AND the deferred push step)

This is **not** part of the plan above. It happens after §6 completes, after §6.8.a push happens, and once dashboard access is granted. Outline only — final plan when ready.

1. Capture current Vercel project settings as a screenshot (rollback reference)
2. For each Vercel project pointing at a canvas folder:
   - Switch "Production Branch" → new branch (`production` or `develop`)
   - Clear "Root Directory" (set to `.` or remove)
   - Trigger redeploy
3. Compare deployed bundle hashes against `safety_net_1/snapshots/frontend-{dev,prod}-build.sha256`
4. Run through `safety_net_1/SMOKE_CHECKLIST.md`
5. Monitor for ~24–48h before considering cutover complete
6. Rollback (if needed): restore previous Production Branch + Root Directory in Vercel; redeploy

---

## 9. Rollback procedures (during the plan itself)

Because nothing is pushed and nothing on master changes, rollback is uniformly trivial. The safety net is the local-only nature of all changes plus the `pre-refactor-2026-05-05` tag on origin.

| Stage | What's at risk | Rollback |
|---|---|---|
| §6.1 (pre-flight) | nothing | n/a |
| §6.2–6.3 (subtree splits) | local branches `develop`, `production` exist | `git branch -D develop production` and start over |
| §6.4 (worktree creation) | `/projects/Brewra/pwa-develop/` and `/projects/Brewra/pwa-production/` exist on disk | `git worktree remove /projects/Brewra/pwa-develop /projects/Brewra/pwa-production` then delete branches as above |
| §6.5 (build verification) | local `node_modules/` and `dist/` populated in worktrees | already cleaned up by removing the worktree |
| §6.6 (tags) | local-only tags | `git tag -d develop-initial-2026-05-05 production-initial-2026-05-05` |
| §6.7 (docs) | committed-to-master doc edits | normal `git revert`, or simply discard if not yet committed |

**Master and refactor are untouched throughout.** Origin is untouched throughout (because we don't push). The `pre-refactor-2026-05-05` tag is the recovery anchor for the entire repo state. As long as that tag exists on origin, full recovery from a destroyed local clone is `git clone` + `git checkout pre-refactor-2026-05-05`.

---

## 10. Post-refactor maintenance model (Option C reality)

Becomes relevant **after** §6.8.a push happens and the team starts working on the new branches. Until then this is forward-looking documentation.

1. **Bug fixes in shared code** (the 199 files that are byte-identical today): apply on whichever branch you started, then cherry-pick to the other. Document the fix's existence on both branches in the PR description.
2. **Features in dev only, prod only, or both**: track which branch each feature lives on. The drift will grow.
3. **Future reconciliation** is intended ("Option C" implies "B later"). Estimated effort today: ~1 day of focused triage on the 28 differing files. Effort grows with continued drift. Schedule it before drift becomes too painful — quarterly check-ins are reasonable.
4. **Don't merge `develop` → `production` directly.** That would delete prod-only features. Releases must be done by cherry-picking specific commits.
5. **Don't merge `production` → `develop` directly** for the same reason in reverse.
6. CLAUDE.md should be updated to capture rules 1–5 so future Claude sessions don't naively suggest a merge.

---

## 11. Post-refactor follow-ups (separate plans, not in scope here)

- **Push to origin** (§6.8.a) — small standalone action when ready.
- **Plan 02 — Vercel cutover** (gated on dashboard access AND on push having happened)
- **Plan 03 — Frontend code cleanup** (1,566 console.logs, splitting MarketResearch.tsx, removing duplicate `Safe*` components and `_restore_test.txt`, ~150 lines of commented code in ICPManager). Now safe to do on `develop` without affecting prod.
- **Plan 04 — Backend → monorepo merge** (the second of the two original problems). Brings `backend/` and PWA into one repo.
- **Plan 05 — Reconciliation triage** (the deferred Option B work). Bring `develop` to be a true superset of `production` so gitflow becomes real. Best done after Plan 03 (so dev is clean before reconciling).
- **Delete `refactor`** (§6.8.b) — small standalone action once `develop` and `production` have soaked.

---

## 12. Open questions / things to confirm before execution

1. Anyone else in the team have unpushed feature branches off `master` or `refactor`? Less critical than before since we're not pushing — relevant only when push happens later.
2. Worktree paths in §6.4 — `/projects/Brewra/pwa-develop/` and `/projects/Brewra/pwa-production/` are my suggestion. Override if you prefer different locations.

---

## 13. Estimated time

| Phase | Time |
|---|---|
| §6.1 pre-flight | 5 min |
| §6.2–6.3 subtree splits | 5–20 min total (depends on history walk speed; this repo is small) |
| §6.4 source verify | 5 min |
| §6.5 build verify | 10–15 min |
| §6.6 tags | 1 min |
| §6.7 docs update | 15 min |
| **Total focused work** | **~40–60 minutes** |
| §6.8.a push (deferred) | 2 min when triggered |
| §6.8.b delete refactor (deferred) | 1 min when triggered |
| Cutover (§8, separate) | 30–60 min once Vercel access is in hand |

This plan is intentionally narrow. Most of the "deep impact" sections are about understanding rather than executing — the actual change is small, the verification is what gives confidence.
