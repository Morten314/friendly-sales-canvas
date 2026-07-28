// Public surface for the `signals` feature.
// Cross-feature consumers import from "@/features/signals", never a deep path.
export { signalsRoutes } from "./routes";
export { useSignalLeadMap } from "./hooks/useSignalLeadMap";
