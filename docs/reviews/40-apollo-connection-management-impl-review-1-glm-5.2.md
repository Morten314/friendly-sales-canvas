---
artifact: worktree-40-apollo-connection-management
artifact_type: impl
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-23
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

- **Change-context source:** `git log -p master..worktree-40-apollo-connection-management` (two-dot,
  per-commit patches with messages). Combined patch ≈ 133 KB — under the ~200 KB budget, so **no
  commit bodies were dropped** (all 9 commit messages retained). Orientation: `git diff --stat
  master...worktree-40-apollo-connection-management` = 19 files, +2210/−22; the code surface is
  frontend-only, +468/−22 across `frontend/src/features/connectors/` (the rest is the spec/plan/
  review-record docs committed in `01db032`).
- **Slug:** derived as `40-apollo-connection-management`. The literal "strip prefixes ending in `/`"
  rule leaves the branch name untouched (`worktree-40-…` has no `/`), but `worktree-` is the Agent
  Manager worktree-naming scaffolding (analogous to `feature/`), and this branch's own
  design-spec-review / plan-review / synthesis artifacts already use `40-apollo-connection-management`
  as the slug — so that convention is matched for traceability.
- **Spec + plan:** auto-discovered and loaded — `specs/40-apollo-connection-management-design.md`
  and `plans/40-apollo-connection-management.md` (both added in this branch's `01db032`). Adherence
  checking is therefore in scope.
- **Config loaded:** `frontend/package.json` (`engines.node >= 21.2.0`; `verify` = typecheck + lint
  + `test:changed`; `preflight` appends `format:check`, full `vitest`, build, `bundle:check`,
  Playwright, `knip --strict`). No repo-root `package.json` exists (polyglot monorepo); no root
  `pyproject.toml`/`Makefile` is relevant since no backend files were touched.
- **Verification performed in the worktree** (`.claude/worktrees/40-apollo-connection-management/`):
  `npm run typecheck` clean; `eslint --max-warnings 0` on the 7 changed source files clean;
  connectors vitest suite **17 files / 88 tests pass**; `DataSourcesManager.apollo.test.tsx`
  mount-point test passes. The Radix auto-close behavior in the finding below was additionally
  confirmed empirically with a throwaway probe test (since removed) plus inspection of the installed
  Radix source — not by code-reading alone.

The implementation is a faithful, near-verbatim execution of plan 40: the component split, exact
copy strings, transport choice (`apiRequest`, no `apiDelete`), gear-visibility rule (`connected`,
absent in `disconnected`), mode-aware toast, credential-error fix, and `runId`/`prompt` clear on
disconnect all match the spec/plan. Commit granularity is clean (one logical step per commit,
`type(fe):` subjects, no footers). All new exports are consumed, so `knip --strict` is not at risk.
Coverage is behavior-oriented and broad (service DELETE+parse+invalidation, modal update copy +
reused `/connect` post, menu items, dialog verbatim copy + confirm/cancel + `isPending`, tile
gear-visible/absent, update-mode routing, mode-aware toast both ways, disconnect success **and**
failure, credential-error fix). The one finding is a Radix-interaction gap masked by the test
structure; it does not block the core flows.

## Findings

### Low: Disconnect confirm auto-closes the dialog — `isPending`/"Disconnecting…" is unreachable in the wired tile, and there's no in-place retry on failure

**Location:** `frontend/src/features/connectors/components/DisconnectApolloDialog.tsx:34-40`
(`AlertDialogAction` confirm), wired via `ApolloTile.tsx:126-143` (`onConfirmDisconnect`) and the
`onOpenChange={(isOpen) => !isOpen && onCancel()}` handler at `DisconnectApolloDialog.tsx:25`.

**Evidence.** In the installed `@radix-ui/react-alert-dialog`, `AlertDialogAction` and
`AlertDialogCancel` are both defined as `DialogPrimitive.Close` (dist `index.mjs:104-119`). Radix
`Dialog.Close` fires `context.onOpenChange(false)` on click, composed after the user `onClick`
(`@radix-ui/react-dialog` dist `index.mjs:269`). Because the dialog is controlled
(`open={disconnectOpen}`) and `onOpenChange(false)` routes to `onCancel()` → `setDisconnectOpen(false)`,
clicking **Disconnect closes the dialog immediately**, before the async mutation can flip `isPending`.

This was reproduced against the real tile (not just reasoned from source): a throwaway probe rendered
`ApolloTile`, opened the disconnect dialog, supplied a `useDisconnectApollo` mock whose `mutate`
never resolves (stays pending), clicked the `^disconnect$` button, and asserted the
"leads will remain in your pool" body — it was **gone** (`DIALOG_STILL_OPEN_AFTER_CONFIRM: false`).

**Consequences.**
1. The plan's specified pending affordance — confirm label `Disconnecting…` + `disabled={isPending}`
   (plan Global Constraints; AC4) — is effectively dead UI in the real wiring: the dialog vanishes
   on click, so `isPending`/`Disconnecting…` is never shown to a user. The dedicated
   `isPending` test (`DisconnectApolloDialog.test.tsx:46-49`) passes only because it renders the
   dialog standalone with `isPending` forced `true`; the tile test
   (`ApolloTile.test.tsx` "confirming disconnect…") masks it because its `mutate` mock fires
   `onSuccess` synchronously and only asserts `mutate` was called + the toast fired — not that the
   dialog stayed open or that `Disconnecting…` appeared. So a specified-and-"tested" affordance is
   silently non-functional.
2. On the failure path, the dialog is already closed when the destructive
   "Couldn't disconnect Apollo — please try again." toast appears, so there is no in-place retry
   (the user must re-open gear → Disconnect → confirm). The `setDisconnectOpen(false)` calls inside
   `onSuccess`/`onError` (`ApolloTile.tsx:58,66`) are therefore redundant no-ops in practice.

**Severity note / why Low, not higher.** The core flows are fully intact — disconnect fires, status
is invalidated (tile flips to `disconnected`), `runId`/`prompt` are cleared (polling stops),
toasts fire on both outcomes. This is also not a novel defect: the exact same
`open={truthy} + onOpenChange={(o)=>!o&&reset()} + AlertDialogAction disabled={pending} +
pending ? "…" : "label"` shape already exists at
`features/customers/components/icp-intelligence/SuggestedICPCards.tsx:1083-1088` (`isSavingAccept`/
`Saving…`), where the pending state is likewise unreachable. So this is a pre-existing repo-wide
convention this branch copied faithfully. Given 0 live users (MVP) and intact functionality, this is
polish, not a blocker.

**Recommended fix (pick one).**
- Make the pending state actually work: prevent the Radix close on confirm. `Dialog.Close` honors
  `defaultPrevented` (`composeEventHandlers` defaults `checkForDefaultPrevented: true`), so change
  the confirm wiring to consume the event — e.g.
  `onClick={(e) => { e.preventDefault(); onConfirm(); }}` on the `AlertDialogAction`
  (or widen `onConfirm` to take the event). The dialog then stays open: real `isPending` shows
  `Disconnecting…` + disables the button, success closes it, and **failure leaves it open for
  in-place retry** (which also better matches the "please try again" copy). The same one-liner would
  fix the latent `SuggestedICPCards` case if desired.
- Or accept the convention and file a `docs/TECH_DEBT.md` (TD-FE) entry noting the pending-state on
  these `AlertDialogAction`-driven confirms is cosmetic/unreachable, so future readers don't trust
  it. (The repo's `DeleteConfirmDialog.tsx:39` uses the same `onClick={onConfirm}` pattern but has no
  pending state, so it is unaffected.)

## Observations (no action)

- **Redundant `AlertDialogCancel onClick`.** `DisconnectApolloDialog.tsx:32`
  (`<AlertDialogCancel onClick={onCancel}>`) — `AlertDialogCancel` is itself a `Dialog.Close`, so it
  already triggers `onOpenChange(false) → onCancel()`; the explicit `onClick` makes `onCancel` fire
  twice on cancel. Harmless here (`setDisconnectOpen(false)` is idempotent), and it mirrors the
  identical line in `DeleteConfirmDialog.tsx:38`. Flagged for awareness; no change required.
- **Disconnect during a running discovery keeps spending Apollo credits.** The backend reads the key
  once at run start and holds it in memory, so deleting the credential doc does not stop an in-flight
  run (spec §9). The credit-spend UI warning was deliberately **declined** (spec §13, review round 1)
  and the consequence is documented in the spec, not surfaced in the UI. Accepted MVP deferral; no
  action.
- **Profile-completeness gate applies to key updates.** Update reuses `POST /connect`, so the
  backend's profile gate also runs on key replacement (spec §13, "accepted"). Revisit only if it
  bites; no action.
