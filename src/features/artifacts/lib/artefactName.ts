import type { ArtefactItem } from "../types";

/** Display name for a stored artefact (falls back to the delegated action). */
export const artefactName = (artefact: ArtefactItem) =>
  artefact.fullReport.title || artefact.actionDelegated;
