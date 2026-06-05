/**
 * Append-only per-feature route registry (Spec 14 §4 "First enabling task").
 * Each feature contributes its `<Route>` array via its index barrel — never a
 * deep path — so feature phases append one line here and own their routes in
 * `<feature>/routes.tsx`, instead of editing App.tsx's shared `<Routes>` table.
 */
import { artifactsRoutes } from "@/features/artifacts";
import { authRoutes } from "@/features/auth";
import { calendarRoutes } from "@/features/calendar";
import { customersRoutes } from "@/features/customers";
import { insightsRoutes } from "@/features/insights";
import { marketResearchRoutes } from "@/features/market-research";
import { missionControlRoutes } from "@/features/mission-control";
import { reportsRoutes } from "@/features/reports";
import { scoutRoutes } from "@/features/scout";
import { settingsRoutes } from "@/features/settings";
import { signalsRoutes } from "@/features/signals";
import { strategistRoutes } from "@/features/strategist";
import { tenantRoutes } from "@/features/tenant";

export const featureRoutes = [
  ...marketResearchRoutes,
  ...missionControlRoutes,
  ...customersRoutes,
  ...scoutRoutes,
  ...signalsRoutes,
  ...strategistRoutes,
  ...authRoutes,
  ...tenantRoutes,
  ...settingsRoutes,
  ...calendarRoutes,
  ...insightsRoutes,
  ...reportsRoutes,
  ...artifactsRoutes,
];
