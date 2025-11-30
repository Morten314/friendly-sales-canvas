# Import all modules
from config import *
from models import *
from database import *
from llm_config import *
from services import *
from api import app

# Refresh Graph Schema
graph.refresh_schema()

# Run FastAPI server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)