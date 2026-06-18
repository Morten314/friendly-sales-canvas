/**
 * Suggested industry values for the Company Profile forms (Settings +
 * Mission Control). The `industry` field is a free string end-to-end (zod
 * `z.string().nullish()`, backend `industry: str`), so these are surfaced only
 * as combobox suggestions — any custom value the user types is accepted and
 * persisted. Kept here in the shared company-profile module so both forms share
 * one canonical list instead of drifting apart with separate hardcoded option
 * sets (the prior `<SelectItem>` lists had already diverged).
 *
 * Alphabetized for predictable ordering in the dropdown.
 */
export const INDUSTRY_OPTIONS: readonly string[] = [
  "Aerospace & Defense",
  "Agriculture & AgTech",
  "Artificial Intelligence & Machine Learning",
  "Automotive",
  "B2B Software",
  "Banking",
  "Biotechnology",
  "Clean Energy & Renewables",
  "Cloud Infrastructure",
  "Construction",
  "Consulting",
  "Consumer Goods (CPG)",
  "Cybersecurity",
  "Data & Analytics",
  "Developer Tools",
  "E-commerce",
  "Education & EdTech",
  "Energy & Utilities",
  "Financial Services",
  "Fintech",
  "Food & Beverage",
  "Gaming",
  "Government & Public Sector",
  "Hardware & Electronics",
  "Healthcare",
  "HealthTech",
  "Hospitality & Travel",
  "Human Resources & HR Tech",
  "Information Technology & Services",
  "Insurance",
  "Investment & Asset Management",
  "Legal Services",
  "Logistics & Supply Chain",
  "Manufacturing",
  "Marketing & Advertising",
  "Media & Entertainment",
  "Medical Devices",
  "Nonprofit",
  "Pharmaceuticals",
  "Professional Services",
  "Real Estate & PropTech",
  "Retail",
  "SaaS",
  "Telecommunications",
];
