"""Backend entrypoint shim — preserves `uvicorn main:app` for Render and local dev."""
from app.main import app
import api  # noqa: F401 — registers routes by import side-effect (interim; routers replace this in Tasks 4-15)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
