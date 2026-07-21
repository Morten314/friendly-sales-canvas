/** Strip markdown and special characters from recommendation/agent answers for plain display */
export function sanitizeAnswerText(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\*\*\*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\*$/gm, "")
    .replace(/^#+\s*/gm, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, ""))
    .replace(/^---+$/gm, "")
    .replace(/\|/g, " ")
    .replace(/—/g, " - ")
    .replace(/[\u2013\u2014\u2015]/g, " - ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2026]/g, "...")
    .replace(/[\u2705\u2713\u2714\u274C\u274E]/g, "") // checkmarks, X
    .replace(/[\u2600-\u27BF]/g, "") // misc symbols (stars, arrows, etc.)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "") // emoji surrogate pairs (📌, ✅ in some fonts, etc.)
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
