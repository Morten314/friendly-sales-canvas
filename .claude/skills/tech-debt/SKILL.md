---
name: tech-debt
description: Manage the Brewra tech-debt register (docs/TECH_DEBT.md) and archive (docs/TECH_DEBT_ARCHIVE.md). Use when accepting a quality compromise during development (log a new TD/TD-FE entry), when a tracked item gets fixed or obviated (mark resolved), when moving fully-resolved entries to the archive, or when auditing the register for stale/already-resolved items.
---

# Managing the Tech Debt Register

Two files, one contract:

- **`docs/TECH_DEBT.md`** — the living register. Debt the team has *consciously accepted*: what was done, what should be done, why deferred, and the trigger that pulls it forward. Open, partial, and recently-resolved-retained entries live here.
- **`docs/TECH_DEBT_ARCHIVE.md`** — fully-resolved entries, moved out of the register to keep it focused. Entry text and numbering preserved verbatim.

**Invariants (never break these):**
1. **IDs are never reused or renumbered after landing on master.** Hundreds of markdown files (specs, plans, reviews, audits) and ~40 source files reference TD IDs; the register's job is to keep every ID ever allocated resolvable forever.
2. **Archived entry text is preserved verbatim** — the resolution marker is *added*; the original fields are never edited or trimmed.
3. **Entry headings never change** (`## TD-NNN — <title>`), even on archival — the GitHub anchor slug must stay stable because the index table links to it.
4. **Specs, plans, reviews, and audits are frozen records** — never update their TD references when resolving/archiving (per CLAUDE.md: they are snapshots of intent, not current truth).

## The two ID sequences

| Sequence | Form | Index? | Lifecycle narration |
|---|---|---|---|
| Backend | `TD-NNN` (zero-padded: TD-004, TD-015) | No table | Prose paragraph in the register preamble — one sentence per resolved entry (see Ops 2/3) |
| Frontend | `TD-FE-NN` (no padding: TD-FE-8, TD-FE-79) | `## Index — TD-FE entries` table at the top of the register | Index row status: `open` / `partial` / `resolved`; Location: `[below](#slug)` or `[archive](TECH_DEBT_ARCHIVE.md#slug)` |

**Finding the next ID:** take max+1 over *everything ever allocated*, not just entries currently in the register — removed/archived IDs still count (early backend IDs exist only in the preamble). These commands scan every mention in both files (headings, preamble, index, entry bodies), which covers all of that; over-matching is safe because the register and archive only ever mention allocated IDs:

```bash
grep -hoE 'TD-[0-9]+' docs/TECH_DEBT.md docs/TECH_DEBT_ARCHIVE.md | sort -Vu | tail -1     # backend max
grep -hoE 'TD-FE-[0-9]+' docs/TECH_DEBT.md docs/TECH_DEBT_ARCHIVE.md | sort -Vu | tail -1  # frontend max
```

(`TD-[0-9]+` cannot match `TD-FE-` lines — the `F` fails the character class. `sort -V` is required so `TD-FE-9` sorts below `TD-FE-79`.) Do not trust the index table alone — it is hand-maintained and has drifted from the entry headings before.

**Concurrent-branch collisions:** IDs allocated on a feature branch are provisional until merge. If another branch lands the same integers on master first, renumber yours at merge/reconciliation and document it in-place (HTML comment or italic note next to the entries — precedent: the Phase 9/12 renumbering notes in the register).

## Anchor slugs

Index-table links use the GitHub anchor of the entry heading. The algorithm (get it exactly right — a wrong slug is a dead link):

1. Lowercase the heading text (everything after `## `).
2. Delete every character that is **not** a letter, digit, space, hyphen, or underscore (backticks, `/`, `:`, `*`, parens, `;`, `.`, quotes, `+`, `→`, and the em-dash all vanish; underscores stay).
3. Convert **each space to a hyphen — do not collapse consecutive hyphens.** A stripped token that sat between spaces leaves two adjacent spaces → `--`. This is why ` — ` becomes `--`.

Example: `## TD-FE-79 — internal `/admin/*` endpoints: Firebase-verified (resolved); reused endpoints remain open` → `#td-fe-79--internal-admin-endpoints-firebase-verified-resolved-reused-endpoints-remain-open`.

After writing a slug, verify it against an existing index row with similar punctuation (e.g. the TD-FE-27 or TD-FE-55 rows exercise `/`, backticks, `.ts`, quotes).

## Operation 1 — Log a new entry

When you accept a quality compromise future agents/devs need to know about (deferred fix, known limitation, stub, risky pattern kept deliberately):

1. Assign the next ID in the right sequence (backend code → `TD-NNN`, frontend code → `TD-FE-NN`).
2. Append the entry at the end of the register (after the last entry of any kind), preceded by a `---` separator:

```markdown
## TD-NNN — <Short factual title>

**Date logged:** YYYY-MM-DD
**Origin:** <spec/plan/phase/review that surfaced it, with doc path>

**Current state:**
<What the code does today and why that's a compromise. Code paths, numbers, measurements.>

**What it should be:**
<The proper fix, concretely — commands, design, rough cost if known.>

**Why we deferred:**
- <reason — MVP posture, blocked-on, cost/benefit>

**What we lose by staying as-is:**
- <concrete failure mode or cost of carrying the debt>

**Pull-forward triggers:**
- <observable condition that should force the fix>

**Owner:** TBD.
```

   Formatting rules: em-dash `—` (not hyphen) between ID and title; fields are `**Bold-label:**` paragraphs (no `###` sub-headings); ISO dates. FE entries are typically lighter — `Origin` / `What it should be` / `What we lose` may be omitted, and singular `**Pull-forward trigger:**` is fine. Field-label drift (`**Why deferred:**`, `**Trigger:**`) exists historically; prefer the canonical labels above for new entries.
3. **FE only:** add an index row in ID order (normally the end of the table): `| TD-FE-NN | open | [below](#<slug>) |` (e.g. the real row `| TD-FE-8 | open | [below](#td-fe-8--knip-ignoredependencies-for-two-untraceable-packages) |` for the heading `## TD-FE-8 — knip ignoreDependencies for two untraceable packages`). If you notice a heading with no index row while there, backfill it in the same commit and note it in the commit body.
4. Commit — a separate docs-only commit *after* the compromising code lands (not inside it), or bundled with the review docs that surfaced the debt:
   - `docs(tech-debt): TD-016 — <title>`
   - `docs(tech-debt): log TD-FE-80 for <what was deferred>`

## Operation 2 — Mark an entry resolved

When the tracked debt is fixed, retired, or obviated (e.g. by an ADR that removed the underlying design):

1. **Verify the resolution is real before writing anything.** Read the code / cite the fixing commit SHA or ADR. Then:
   ```bash
   grep -rn "TD-NNN\|TD-FE-NN" frontend/src backend/app backend/tests
   ```
   Two kinds of code comments exist: *live-behavior markers* ("driven by the imperative loader below until TD-FE-43 collapses it cache-native") and *historical provenance* ("Defaults tuned from live profiling (see docs/TECH_DEBT.md TD-014)"). A live-behavior comment still in force means the debt is **not** resolved — stop. Provenance comments are intentional history — leave them alone.
2. Add the resolution marker, style by sequence:
   - **Backend** — insert a `**Status:**` banner directly under the `##` heading, original text untouched below:
     ```markdown
     **Status:** ✅ RESOLVED YYYY-MM-DD (<phase/plan>) — <one-paragraph resolution: what changed, where>. Commit `<sha>`. Original context retained below.
     ```
     (Banner ornamentation has drifted historically — TD-010/011/014 omit the ✅, the commit SHA, or the signpost; use the full form above for new resolutions.) Also append a sentence to the running preamble paragraph ("Numbering is preserved across resolutions — …"): `TD-NNN (<short parenthetical>) was resolved YYYY-MM-DD by <phase/plan> (commit `sha`); the resolved entry is retained below with original context preserved.`
   - **Frontend** — append a bold field at the *end* of the entry:
     ```markdown
     **Resolved (YYYY-MM-DD):** <what resolved it, commit/spec/ADR refs>.
     ```
     and flip the index row status `open` → `resolved` (Location stays `[below](#slug)` until archived).
   - **Partial resolution** — entry stays in the register. Add `**Resolved (<context>, partial):**` or `**Partial resolution (<spec/plan>, date):**` describing the closed half and reclassifying the remainder; FE index status becomes `partial`.
3. Commit. Either style is established:
   - Dedicated: `docs(tech-debt): mark TD-014 resolved (<short reason>)`
   - Riding the fixing code commit, with the ID in the subject: `feat(fe): enforce index-only cross-feature imports (resolve TD-FE-15)` / `refactor(fe): delete tenant module … (retires TD-FE-55)`. Backend items more often use the two-commit form.

## Operation 3 — Archive a resolved entry

Fully-resolved entries move to the archive to keep the register focused. This can be combined with Operation 2 in one commit (precedent: TD-013), or done later as a batch sweep of already-resolved-retained entries (precedent: the Phase 37 sweep). Open and partial entries never move.

Coordinated edits — all in one commit:

1. **Append the entry to the END of `docs/TECH_DEBT_ARCHIVE.md`** (newest archivals go last), separated by `---`. Heading verbatim (stable anchor). Layout depends on what the entry already carries:
   - **Not yet marked resolved** (resolve+archive in one step): put the resolution marker at the **top**, immediately under the heading, ending with the signpost sentence; original fields verbatim below:
     ```markdown
     **Resolved (YYYY-MM-DD):** <what resolved it — fixing/obviating commit `sha`, ADR path, and any residual non-issue worth naming>. Original entry preserved below.
     ```
   - **Already carries a backend `**Status:**` banner** (from Op 2): the banner IS the resolution marker — it travels verbatim at the top. Do **not** add a second `**Resolved:**` line and do not reformat it. If it lacks a signpost sentence, append `Original entry preserved below.` to it — the one permitted edit.
   - **Already carries a bottom-placed FE `**Resolved (…):**` marker** (from Op 2): it travels as-is at the bottom; don't rewrite history, don't add a top marker.
2. **Delete the full entry from `docs/TECH_DEBT.md`**, leaving a clean `---` join between its neighbors.
3. **Traceability, by sequence:**
   - **Backend:** if the preamble paragraph already narrates this ID (the "retained below" sentence from Op 2), **edit that sentence in place** — replace its "the resolved entry is retained below…" tail with `; its entry was moved to `docs/TECH_DEBT_ARCHIVE.md`.` Do not append a duplicate sentence. If the ID isn't narrated yet, append a fresh one:
     ```
     TD-NNN (<short parenthetical>) was resolved YYYY-MM-DD by <phase/plan/ADR> (commit `sha`); its entry was moved to `docs/TECH_DEBT_ARCHIVE.md`.
     ```
   - **Frontend:** flip the index row Location to `[archive](TECH_DEBT_ARCHIVE.md#<slug>)` (status already `resolved`).
4. **Cross-reference check (verify, don't churn):**
   - `grep -n "TD-NNN" CLAUDE.md AGENTS.md` — if either cites the entry inline, make sure the ID stays findable post-move; if a pointer needs updating, **edit both files identically** (they mirror each other).
   - `grep -n "TD-NNN" docs/TECH_DEBT.md` after the move — plain-text mentions in other entries are fine (IDs stay resolvable via the archive); a same-file `(#td-…)` anchor link in an entry body would break and must be repointed to the archive.
   - Do **not** touch specs/plans/reviews/audits (frozen) or provenance code comments.
   - If an ADR says "Tracked as TD-FE-NN", the register-side resolution note citing that ADR is sufficient — don't edit the ADR (precedent: TD-FE-60's archival left ADR-0006's "Tracked as TD-FE-60" line untouched; likewise TD-013's marker cited ADR-0009 without editing it).
5. Commit (`docs(tech-debt):` is the house scope; historical `docs(debt):`/`docs:` variants exist but don't add new ones):
   - Combined resolve+archive: `docs(tech-debt): mark TD-NNN resolved (<reason>) and move it to the archive`
   - Archive-only move of an already-resolved entry: `docs(tech-debt): move TD-NNN to the archive (resolved YYYY-MM-DD)`
   - Batch sweep: `docs(tech-debt): mark <batch> resolved entries and move them to the archive`
   Docs-only — note "no code change" in the body if bundling several operations.

## Operation 4 — Audit the register

Periodically (or on request), check open-looking entries against reality:

- For each open/partial entry, verify **Current state** still describes the code — entries go stale when fixes land without the register being updated, or when figures drift (LOC counts, call-site counts).
- Outcomes per entry: still open (leave), stale figures (correct in place, itemize per-ID in the commit body), resolved (→ Operation 2/3 — closure reasons include "superseded by TD-X", "accepted decision per ADR/spec", "obviated", not just "fixed"), partial (split the marker per Operation 2).
- Also check **register integrity**: every `## TD-FE-` heading has an index row and vice versa; anchors resolve; `---` separators between entries; preamble narration consistent with entry status.
- Commit: `docs(tech-debt): close N resolved FE entries and correct stale figures` — itemize every ID and its disposition in the body.

## Quick reference — what goes where

| Situation | Register entry | Archive | Preamble/Index |
|---|---|---|---|
| New debt accepted (Op 1) | Full entry appended, `open` | — | FE: add `open`/`[below]` row |
| Resolved, keep visible for now (Op 2) | Entry + Status/Resolved marker | — | FE: flip to `resolved`, still `[below]`; BE: preamble sentence ("retained below" form) |
| Fully resolved, archive (Op 3) | **Deleted** | Entry verbatim + resolution marker, appended at end | FE: `resolved` + `[archive](…#slug)`; BE: preamble sentence edited/added ("moved to archive" form) |
| Partially resolved (Op 2) | Entry stays, partial marker | — | FE: status `partial` |
