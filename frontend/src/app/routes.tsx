/**
 * Append-only per-feature route registry (Spec 14 §4 "First enabling task").
 * Each feature contributes its `<Route>` array via its index barrel — never a
 * deep path — so feature phases append one line here and own their routes in
 * `<feature>/routes.tsx`, instead of editing App.tsx's shared `<Routes>` table.
 */
import { customersRoutes } from "@/features/customers";
import { marketResearchRoutes } from "@/features/market-research";
import { missionControlRoutes } from "@/features/mission-control";

export const featureRoutes = [...marketResearchRoutes, ...missionControlRoutes, ...customersRoutes];
