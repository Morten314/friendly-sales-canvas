# Brewra Backend

FastAPI service for the Brewra GTM/sales-intelligence product. Layered app under `app/` (core, models, routers + v2, services); prompts under `prompts/`; tests under `tests/`.

## Run locally
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload        # serves on http://127.0.0.1:8000 ; docs at /docs
```
Configuration is read by `app/core/config.py` (env vars with fallbacks). See `docs/Deployment Infrastructure and Notes.md` for the shared-prod-data warning before running against live credentials.

## Test
```bash
pip install -r requirements-test.txt
pytest                 # unit + integration; see TESTING.md
pytest tests/unit      # unit suite only
```

## Architecture
See [`docs/architecture/BACKEND.md`](../docs/architecture/BACKEND.md) for the current backend map.
