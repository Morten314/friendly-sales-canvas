import type { CompanyProfileFields } from "../components/company-profile/companyProfileMapping";

export type CompletenessSection = "profile" | "customer-profile" | "sources";

export interface CompletenessItem {
  key: string;
  label: string;
  section: CompletenessSection;
  weight: number;
  done: boolean;
}

/** Per-field weights. Sum = 100. Edit here to rebalance the score. */
export const COMPANY_WEIGHTS: Array<[keyof CompanyProfileFields, string, number]> = [
  ["companyName", "Company name", 5],
  ["companyUrl", "Company website", 4],
  ["industry", "Industry", 5],
  ["headquarters", "Headquarters", 2],
  ["employeeSize", "Employee size", 3],
  ["revenue", "Revenue band", 3],
  ["gtmModel", "GTM model", 3],
  ["regionFocus", "Region focus", 3],
  ["dealSize", "Typical deal size", 2],
  ["keyBuyerPersona", "Key buyer persona", 4],
  ["goals", "Goals", 3],
  ["painPoints", "Pain points", 3],
  ["targetSegments", "Target segments", 2],
  ["excludeSegments", "Excluded segments", 1],
  ["compliance", "Compliance", 1],
  ["constraints", "Constraints", 1],
]; // 45

export const ICP_WEIGHTS: Array<[string, string, number]> = [
  ["industry", "ICP industry", 8],
  ["buyerRole", "ICP buyer role", 8],
  ["companySize", "ICP company size", 6],
  ["primaryRegion", "ICP primary region", 5],
  ["location", "ICP locations", 4],
  ["accountsOnWatchlist", "Accounts on watchlist", 3],
  ["accountsToAvoid", "Accounts to avoid", 2],
  ["additionalContext", "ICP additional context", 4],
]; // 40

export const SOURCE_WEIGHTS: Array<[string, string, number]> = [
  ["anySource", "At least one data source", 10],
  ["multiSource", "Two or more data sources", 5],
]; // 15

type Row = Record<string, unknown>;
const ICP_ALIASES: Record<string, string[]> = {
  industry: ["industry"],
  buyerRole: ["buyer_role", "buyerRole"],
  companySize: ["company_size", "companySize"],
  primaryRegion: ["primary_region", "primaryRegion"],
  location: ["location"],
  accountsOnWatchlist: ["accounts_on_watchlist", "accountsOnWatchlist"],
  accountsToAvoid: ["accounts_to_avoid", "accountsToAvoid"],
  additionalContext: ["additional_context", "additionalContext"],
};

const filled = (v: unknown) =>
  Array.isArray(v) ? v.some((x) => String(x ?? "").trim()) : String(v ?? "").trim().length > 0;

export function computeCompleteness(input: {
  company: CompanyProfileFields | null;
  icpRows: Row[];
  sourceCount: number;
}) {
  const items: CompletenessItem[] = [];
  for (const [k, label, weight] of COMPANY_WEIGHTS) {
    items.push({ key: k, label, section: "profile", weight, done: filled(input.company?.[k]) });
  }
  for (const [k, label, weight] of ICP_WEIGHTS) {
    const done = input.icpRows.some((r) => ICP_ALIASES[k].some((a) => filled(r?.[a])));
    items.push({ key: `icp.${k}`, label, section: "customer-profile", weight, done });
  }
  items.push({ key: "src.any", label: SOURCE_WEIGHTS[0][1], section: "sources", weight: SOURCE_WEIGHTS[0][2], done: input.sourceCount >= 1 });
  items.push({ key: "src.multi", label: SOURCE_WEIGHTS[1][1], section: "sources", weight: SOURCE_WEIGHTS[1][2], done: input.sourceCount >= 2 });
  const score = items.reduce((s, i) => s + (i.done ? i.weight : 0), 0);
  return { score: Math.min(100, score), items };
}
