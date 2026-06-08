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
- `/BRANCHES.md` — branch model

## Branches

Monorepo cutover is complete. `master` is the trunk; work happens on short-lived `phase-N-*`/feature branches merged back via `--no-ff`. Legacy branches (`develop`/`production`/`refactor`/`pwa-*`) are retained dormant for a few months for rollback/triage, then pruned. See `BRANCHES.md`.

## Common commands

```bash
# frontend
cd frontend && npm install && npm run dev

# backend
cd backend && pip install -r requirements.txt && python main.py
```

See `CLAUDE.md` for full agent guidance.
