---
artifact: specs/17-frontend-phase-2a-strict-ts-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-27
round: 4
---

## Context

This is the fourth review round. Three prior reviews and three synthesis rounds exist. The spec has been substantially revised to address round-3 findings: `strict` sub-flag enumeration, `skipLibCheck`/`compilerOptions.types` rows in §1.3, Wave B batching threshold, symmetric wave-end checkpoints, test-file posture rules, corrected §3 opening, and probe-config lifecycle documentation. This review focuses on newly introduced issues and unresolved contradictions.

## Findings

### [Critical] Escape-hatch TD-FE registration cadence contradicts across sections

**Location:** §1.1 line 20, §2.1 line 70, §3 Step 3 lines 258–260, §4 item 5 line 323, §5 R2 line 338

The spec contains an unreconciled internal contradiction about what happens after the 5th escape-hatch entry:

- **§1.1 line 20:** "Beyond 5, each additional batch of 5 entries triggers another TD-FE."
- **§2.1 line 70:** "Each additional batch of 5 (entries 10, 15, 20…) triggers another TD-FE."
- **§5 R2 line 338:** "the 5th entry triggers a TD-FE capturing the pattern; every additional batch of 5 triggers another."
- **§3 Step 3 line 259:** "Entries past the 5th are logged in the file with their mandatory comment + prefix + justification, but they do not trigger additional TD-FE-<n> registrations — the 5th-entry TD-FE already captured the pattern."
- **§4 item 5 line 323:** "If the count reached 5 during the phase, a TD-FE-<n> registration exists capturing the pattern." (implies only one, at entry 5)

Three sections (§1.1, §2.1, §5 R2) commit to batch-of-5 TD-FE triggers. Two sections (§3 Step 3, §4) say only the 5th triggers one and no more follow. The implementer follows §3 (methodology), so the §1.1/§2.1/R2 language would be dead-letter — but a reviewer cross-referencing §4 against §1.1 would see a mismatch.

This appears to be an artifact of partially adopting round 3's suggestion to simplify the mechanism (finding 5: "Remove the batch-of-5 TD-FE cadence") without updating all sections consistently.

**Resolution required:** Pick one policy and make all five locations consistent. If simplifying (recommended — the batch-of-5 cadence is process overhead for an expected-to-be-empty file): remove "each additional batch of 5" from §1.1, §2.1, and §5 R2. If keeping batches: update §3 Step 3 and §4 to match.

### [High] `rg -nE` verification commands are syntactically invalid for ripgrep

**Location:** §1.3 line 39, §3 Step 5 line 296, §4 items 6–7 lines 324–325

All inline-any and suppression-count verification commands use `rg -nE ':\s*any\b\|as\s+any\b\|<any>' --include='*.ts' --include='*.tsx'`. This command fails under ripgrep (`rg`) for three independent reasons:

1. **`-E` flag does not exist in ripgrep.** ripgrep has no `-E`/`--extended-regexp` flag. `rg -nE` is parsed as `-n` (line numbers) + `-E` (unknown flag → error).
2. **`\|` is not alternation in ripgrep.** ripgrep uses Rust regex syntax where `|` is alternation and `\|` matches a literal pipe character. The regex as written would try to match `:\s*any\b` followed by literal `|` followed by `as\s+any\b` etc. — never matching the intended alternation.
3. **`--include` is not a ripgrep flag.** ripgrep uses `-g '*.ts'` or `--glob '*.ts'` for file filtering, not `--include`.

The command also doesn't work as `grep -nE` because in ERE mode (`-E`), `\|` is a literal `|`, not alternation. GNU grep in BRE mode (no `-E`) does treat `\|` as alternation, so `grep -n ':\s*any\b\|as\s+any\b\|<any>' --include='*.ts' --include='*.tsx' -r src/` would work. But the spec says `rg`.

Since the spec claims this regex produced 238 results (§1.3 line 39), the actual command used during Phase 1 must have been different from what's documented. The verification gates in §3 Step 5 and §4 items 6–7 are binding done-when checks — they must work as written.

**Correct ripgrep equivalent:** `rg -n ':\s*any\b|as\s+any\b|<any>' -g '*.ts' -g '*.tsx' src/`
**Correct grep equivalent:** `grep -rnE ':\s*any\b|as\s+any\b|<any>' --include='*.ts' --include='*.tsx' src/`

Replace all occurrences consistently.

### [Medium] "Seven sub-flags" count is factually wrong — `strict: true` enables eight

**Location:** §1.1 line 16, §2.1 line 67, §3 Step 1b line 194, §4 line 319

The spec says `strict: true` "enables seven sub-flags" but then lists eight: `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`, `useUnknownInCatchVariables`. TypeScript 4.4+ adds `useUnknownInCatchVariables` to the `strict` umbrella, bringing the total to eight.

§4 line 319 partially works around this by omitting `noImplicitAny` from the sub-flag list (since it's already listed as one of the "five explicit flags" in the same sentence) and counting seven remaining sub-flags. But §1.1, §2.1, and §3 Step 1b all list all eight while saying "seven."

**Fix:** Change "seven sub-flags" to "eight sub-flags" everywhere. Alternatively, if §4's approach of excluding `noImplicitAny` (because it's listed separately) is preferred, adopt that consistently and add a note explaining the omission.

### [Medium] New `@ts-*` suppressions not explicitly prohibited as a fix mechanism

**Location:** §2.4 posture rules, §4 item 7

The posture rules (§2.4) list four fix strategies: add proper type, acceptable narrowing refactor, escape-hatch/TD-FE, or abort. Adding `@ts-expect-error` or `@ts-ignore` is never mentioned — neither as an option nor as an explicit prohibition. Meanwhile, §4 item 7 gates on `@ts-*` suppression count ≤5, meaning any new suppression would violate the done-when.

An implementer encountering a case where escape-hatching feels heavier than a targeted `@ts-expect-error` has no explicit guidance that suppressions are Phase 2b's domain. The gap is small (the posture rules' omission is effectively a prohibition), but a single clarifying sentence would prevent ambiguity.

**Suggestion:** Add to §2.4: "Adding new `@ts-expect-error` or `@ts-ignore` suppressions is out of scope for Phase 2a — use escape-hatches instead. The ≤5 regression gate in §4 item 7 enforces this."

### [Low] Probe config redundantly sets `strict: true` plus sub-flags it already implies

**Location:** §3 Step 0, probe config JSON (lines 130–143)

The throwaway probe config sets both `strict: true` and `noImplicitAny: true`, `strictNullChecks: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`. The first five are subsumed by `strict: true`; only `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` are independent additions beyond what `strict` enables. The redundancy is harmless but slightly misleading — it implies these flags are separate from `strict` when three of them are sub-flags.

If the redundancy is intentional (for explicitness), add a note. Otherwise, simplify to `strict: true` plus the three flags not covered by the umbrella.

### [Low] Interim escape-hatch path has no hard relocation commitment from Phase 4

**Location:** §2.1 line 70 — "Phase 4 relocates the file to the master-plan-specified path when it creates `src/shared/`"

The spec deviates from Spec 14's canonical path (`src/shared/types/escape-hatches.ts`) and relies on Phase 4 to relocate. But Phase 4's spec hasn't been written yet, and its scope could change. If Phase 4 is deferred, restructured, or never creates `src/shared/`, the escape-hatch file stays at the interim path permanently. A TD-FE entry or a cross-reference in Spec 14's Phase 4 description would make this visible as a deferred action item rather than an implicit assumption.

**Suggestion:** Add a TD-FE entry at phase end if the file exists: "Escape-hatch file at interim path `src/lib/types/` — relocate to `src/shared/types/` when Phase 4 creates the directory."

### [Low] `Untyped*` prefix convention is defeated by import aliasing

**Location:** §3 Step 3 line 257 — "visible at import sites (where the comment is not), it signals temporariness"

The spec claims the `Untyped*` prefix is visible at import sites as a signal. But `import { UntypedLeadFilter as LeadFilter } from '...'` strips the prefix at the usage site with no warning. This is a weak signal mechanism — it depends on import-site discipline. For a file expected to be empty or nearly empty, this is acceptable, but the claim of visibility should be qualified.

**Suggestion:** Add: "Callers should not alias away the `Untyped*` prefix. ESLint's `no-rename-imports` or a custom rule in Phase 2b could enforce this if the file grows."

### [Nit] "leaves before monsters" is informal

**Location:** §3 Step 2 line 214, §3 Step 3 line 262

This colloquialism means "low-error-count files before high-error-count files." It appears in the commit-grain ordering guidance. Replace with "low-error files before high-error files" for consistency with the spec's otherwise formal register.

### [Nit] `strict: true` sub-flag enumeration is copy-pasted four times

**Location:** §1.1 line 16, §2.1 line 67, §3 Step 1b line 194, §4 line 319

The full list of eight sub-flags appears verbatim (or near-verbatim) four times. Each repetition must be kept in sync. Define the list once (e.g., in §1.3 or a glossary) and reference it elsewhere.
