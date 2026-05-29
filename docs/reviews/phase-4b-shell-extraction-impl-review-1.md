---
artifact: phase-4b-shell-extraction
artifact_type: impl
verdict: clean
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Spec: `specs/21-frontend-phase-4-scaffolding-shell-design.md` §3 (Phase 4b — Shell extraction). Plan: `plans/21b-frontend-phase-4b-shell-extraction.md`. Eight commits reviewed as an aggregate net change (51 files, +296 −398 lines).

## Findings

### [Nit] `useAppSidebar` barrel alias has no 4b consumer

**Location:** `frontend/src/features/shell/index.ts:3`

The barrel re-exports `useSidebar as useAppSidebar`, but nothing in the tree imports `useAppSidebar`. The only reference is the barrel itself. `knip --strict` may flag this as an unused export (the plan's Task 6 Step 2 contingency covers this exact scenario — either defer the alias to Phase 5 or resolve at that time). The underlying `useSidebar` symbol *is* consumed internally by `Header.tsx` and `Sidebar.tsx` via relative import, so the re-export origin is not dead — only the alias name lacks a consumer.

This is documented in TD-FE-16 and the plan's self-review notes. No action needed now; if knip flags it, the plan's preferred contingency (drop the alias, re-add at Phase 5) is the right call.
