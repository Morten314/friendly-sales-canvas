import type { ArtefactItem } from "../types";

// Module-level hand-off so a dispatcher mounted on one page (e.g. SignalsPage on
// /signals) can deliver an ArtefactItem to ArtifactsPage, which mounts later on
// /artifacts and drains this queue once on mount. Unlike a window CustomEvent,
// this survives the dispatcher and listener not being co-mounted.
let pending: ArtefactItem[] = [];

export function enqueueArtefact(item: ArtefactItem): void {
  pending.push(item);
}

/** Returns queued items in enqueue order and clears the queue (once-only). */
export function drainArtefactQueue(): ArtefactItem[] {
  const items = pending;
  pending = [];
  return items;
}

/** Test-only: clear the module-singleton between tests. */
export function resetArtefactQueue(): void {
  pending = [];
}
