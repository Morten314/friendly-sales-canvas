"""Transitional backend entrypoint.

After Task 2 the core files live under app/core/. The FastAPI() instance
and routers still live in api.py until Task 3 moves them to app/main.py.
This file's job during Tasks 2-15 is just to import api.py so its
@app.X decorators register on the shared FastAPI instance.
"""
from app.core import database
from api import app  # registers @app.X routes by import side-effect

if database.graph is not None:
    database.graph.refresh_schema()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
