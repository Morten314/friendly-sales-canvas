"""pipeline service — public API.

Service for sales-pipeline stage-count aggregation from Neo4j. The
service is intentionally narrow: probe_llm lives in services/health.py
(extracted in Phase K commit 11/13) because LLM-availability probing
is not a pipeline concern.

Submodules:
  - neo4j.py: compute_sales_pipeline
"""

from app.services.pipeline.neo4j import compute_sales_pipeline
