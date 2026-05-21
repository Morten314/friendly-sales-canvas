"""Backend entrypoint shim — preserves `uvicorn main:app` for Render and local dev."""
from app.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
