"""Centralized logger.

Moved from `app/main.py` in Phase B (Task 1) to eliminate the
`from app.main import logger` partial-import path that three routers
relied on. New convention: any module needing the logger imports it
from here.
"""
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger("brewra")
