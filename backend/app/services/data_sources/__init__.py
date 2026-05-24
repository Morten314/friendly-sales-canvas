"""data_sources service — public API (Phase H commit 7/20 final form).

Renamed from documents/ in Phase H to disambiguate from project documentation.
No LLM in this service; submodules are:
  - loaders.py: file loading + Neo4j-graph entry points
  - pipeline.py: S3 + Pinecone + Mongo coordinated upload
  - persistence.py: Mongo CRUD (list/get/delete/update)

orchestrator.py was deleted in commit 7/20 — there is no multi-step
compositional logic to compose across submodules; each public function
does its own thing in its defining submodule.

Re-exports the 8 public-surface symbols listed in spec §3.5. Internal
helpers (load_document, grapher, process_prospect_list) live in
loaders.py and tests import them from that submodule directly.
"""

from app.services.data_sources.loaders import (
    upload_file_text,
    upload_prospect_list_file,
)
from app.services.data_sources.pipeline import (
    process_file_to_embeddings,
    upload_document_file,
)
from app.services.data_sources.persistence import (
    list_user_documents,
    get_document_status,
    delete_data_source,
    update_data_source,
)

__all__ = [
    "upload_file_text",
    "upload_prospect_list_file",
    "upload_document_file",
    "process_file_to_embeddings",
    "list_user_documents",
    "get_document_status",
    "delete_data_source",
    "update_data_source",
]
