// Cosmetic internal-access guardrail, NOT a security boundary (spec 44 §3).
// Roster changes require a commit + frontend redeploy (a VITE_* var would not
// avoid this — Vite inlines env vars at build time). Emails compared lowercase.
export const ADMIN_EMAILS = new Set<string>([
  "gaurav@brewra.com",
  "shilpa@brewra.com",
  "ishani@brewra.com",
  "mortenevensen@brewra.com",
]);

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase());
}
