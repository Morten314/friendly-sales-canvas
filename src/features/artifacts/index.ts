// Public surface for the `artifacts` feature. Composed by src/app/routes.tsx.
export { artifactsRoutes } from "./routes";

// Delivery + export surface consumed by the signals feature (Spec/Plan 38).
export { enqueueArtefact, resetArtefactQueue } from "./lib/artefactQueue";
export {
  saveArtefact,
  loadStoredArtefacts,
  deleteStoredArtefact,
  getStoredArtefact,
  downloadArtefactCsv,
  downloadArtefactSheet,
  updateStoredArtefactSheet,
  updateStoredArtefactSheetData,
  updateStoredArtefactSequence,
  sheetToCsv,
} from "./lib/artefactStore";
export { generateAndDownloadPDF, buildArtefactPdfBlob } from "./lib/artefactPdf";
export type { ArtefactItem } from "./types";
