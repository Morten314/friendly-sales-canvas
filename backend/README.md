# Brewra Backend

FastAPI service for the Brewra GTM/sales-intelligence product. Layered app under `app/` (core, models, routers + v2, services); prompts under `prompts/`; tests under `tests/`.

## Run locally
```bash
cd backend
python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1   |   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill every value — no hardcoded fallbacks (spec 42)
python main.py         # serves on http://127.0.0.1:8000 ; docs at /docs
# or: uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Configuration is read from `backend/.env` by `app/core/config.py` (fail-hard if any required var is missing). See `docs/Deployment Infrastructure and Notes.md` for the shared-prod-data warning before running against live credentials.

> **Not Node.** There is no `package.json` here — do not run `npm run dev` in `backend/`. Use `npm run dev` only in `frontend/` (port 5175), which proxies `/api` to this server.

## Test
```bash
pip install -r requirements-test.txt
pytest                 # unit + integration; see TESTING.md
pytest tests/unit      # unit suite only
```

## Architecture
See [`docs/architecture/BACKEND.md`](../docs/architecture/BACKEND.md) for the current backend map.
