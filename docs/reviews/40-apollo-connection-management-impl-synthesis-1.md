---
synthesizes_review: docs/reviews/40-apollo-connection-management-impl-review-1-glm-5.2.md
artifact: worktree-40-apollo-connection-management
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-23
round: 1
---

## Round Recommendation

no

Reason: The sole finding is Low (verified correct) and is deferred as a faithful copy of a pre-existing repo-wide convention; no Critical/High remains and core flows are intact, so no further impl-review round is warranted.

## Agreed Findings

None fixed this round. The single finding is verified accurate but is **deferred** (see Deferred) rather than fixed in place — it reflects a repo-wide UI convention, not a defect this branch introduced, and the core disconnect flow works correctly.

## Disagreed Findings

None. The [Low] finding is technically correct, verified against the code on the branch:
- `DisconnectApolloDialog.tsx:34-40` wires `<AlertDialogAction onClick={onConfirm} disabled={isPending}>{isPending ? "Disconnecting…" : "Disconnect"}` with **no** `preventDefault`, under a controlled dialog (`open={disconnectOpen}`) whose `onOpenChange={(isOpen) => !isOpen && onCancel()}` (line 23) routes to `onCancel → setDisconnectOpen(false)`.
- Radix `AlertDialogAction` is a `Dialog.Close`, which fires `onOpenChange(false)` composed *after* the user `onClick`, so the dialog closes on confirm before the async mutation can flip `isPending`. The reviewer reproduced this empirically (throwaway probe) and the independent opus whole-branch review reached the same conclusion during execution. The finding stands.

## Deferred Findings

- **[Low] Disconnect confirm auto-closes the dialog → `isPending`/"Disconnecting…" is unreachable in the wired tile, and there is no in-place retry on failure.** Deferred, not fixed this round.
  - **Why defer, not fix:** It is a faithful copy of a **verified repo-wide convention**. `features/customers/components/icp-intelligence/SuggestedICPCards.tsx:1084-1085` uses the identical `<AlertDialogAction disabled={isSavingAccept} onClick={…}>{isSavingAccept ? "Saving…" : "Okay"}` shape, where the pending state is likewise unreachable. Diverging only `DisconnectApolloDialog` (the reviewer's `onClick={(e) => { e.preventDefault(); onConfirm(); }}` one-liner) would make it the lone confirm dialog in the codebase that behaves differently; the proper fix is a repo-wide pass on this convention, which is out of scope for this feature.
  - **Functionality is intact:** disconnect fires, status is invalidated (tile flips to `disconnected`), `runId`/`prompt` are cleared (polling stops), and both the success and destructive-failure toasts fire. Only the pending spinner and in-place failure-retry — both polish — are affected.
  - **Posture:** MVP / 0 live users / advisory-over-hard-fail gate. Spec §14 explicitly declined a new `docs/TECH_DEBT.md` entry for this work, so no TD-FE entry is filed for it. The same finding was raised by the opus whole-branch review during execution, triaged as an accepted house pattern, and surfaced to the operator, who then chose to merge.
  - **Trigger to revisit:** a deliberate repo-wide cleanup of the `AlertDialogAction`-confirm pending-state convention (fix `DisconnectApolloDialog` **and** `SuggestedICPCards` together via the `preventDefault` approach — which would also leave the dialog open on failure, giving the in-place retry that matches the "please try again" copy), **or** a user-reported friction on the disconnect-failure retry path.

## Severity Disagreements

None. Concur with the reviewer's **Low** rating: core functionality is unaffected; only the pending affordance and in-place retry (polish) are involved, and the behavior matches a pre-existing codebase convention.

## Open Questions

- **Reviewer "Observations (no action)" — evaluated, none require action:**
  1. Redundant `AlertDialogCancel onClick={onCancel}` (`DisconnectApolloDialog.tsx:33`) double-fires `onCancel` on cancel — harmless (`setDisconnectOpen(false)` is idempotent) and mirrors the `DeleteConfirmDialog` house pattern. Accepted, no change.
  2. Disconnect during a running discovery keeps spending Apollo credits (backend reads the key once at run start) — a deliberate MVP deferral already documented in spec §9/§13; the UI credit-spend warning was declined in spec review round 1. No action.
  3. Profile-completeness gate applies to key updates (update reuses `POST /connect`) — accepted per spec §13. Revisit only if it bites. No action.
- **Artifact placement (operator's call):** this impl review (`...-impl-review-1-glm-5.2.md`) and this synthesis currently live in the **main checkout's** `docs/reviews/` (untracked), whereas the branch carries the spec/plan review records (committed in `01db032`). Whether to fold these two impl-review files onto the branch before merging — for parity with the spec/plan record — is the operator's decision; no code or merge-readiness implication either way.
