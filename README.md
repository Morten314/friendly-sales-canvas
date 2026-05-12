# Brewra GTM Intelligence

B2B GTM/sales-intelligence PWA. Frontend (React/Vite/TypeScript) + backend (FastAPI/Python) in one repo.

## Layout

- `/frontend/` — React PWA (subtree imported from PWA-multi-tenancy)
- `/backend/` — FastAPI service (subtree imported from backend repo)
- `/specs/` — design specs (output of brainstorming)
- `/plans/` — implementation plans (output of plan-writing)
- `/docs/` — analyses and reference docs
- `/scripts/` — automation (`sync.sh`, `safety_net/`)
- `/CLAUDE.md`, `/AGENTS.md` — agent context
- `/BRANCHES.md` — branch model + sync workflow

## Branches

This repo is in a **temporary parallel-branch state** during fork transition. Forked from old repos on 2026-05-08; cutover scheduled when Plan 05 reconciliation is complete (~1–2 weeks from 2026-05-08). See `BRANCHES.md` for the temp model and `scripts/sync.sh` for syncing Brewra-dev work from old repos.

## Common commands

```bash
# frontend
cd frontend && npm install && npm run dev

# backend
cd backend && pip install -r requirements.txt && python main.py

# sync Brewra-dev work from old repos (temp week only)
bash scripts/sync.sh
```

See `CLAUDE.md` for full agent guidance.
