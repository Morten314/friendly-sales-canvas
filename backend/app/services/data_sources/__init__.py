"""data_sources service — package skeleton (Phase H commit 5/20+).

Renamed from documents/ to disambiguate from project documentation.
After commit 6/20: 4 Mongo CRUD functions live in persistence.py; the
remaining 7 (upload + loaders) still live in orchestrator.py until
commit 7/20 extracts loaders.py + pipeline.py.

Re-exports the 8 public-surface symbols listed in spec §3.5, plus 3
internal helpers (load_document, grapher, process_prospect_list) that
tests/unit/test_data_sources.py imports directly. These are a §3.7-style
exception — they don't have an underscore prefix but they're not
imported anywhere in app/ outside this package, so the public/internal
distinction is real. They're re-exported solely to keep the unit-test
direct-import statements working through the package's __init__.py.
"""

from app.services.data_sources.orchestrator import (
    upload_file_text,
    upload_prospect_list_file,
    upload_document_file,
    process_file_to_embeddings,
    load_document,
    grapher,
    process_prospect_list,
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
    "load_document",
    "grapher",
    "process_prospect_list",
]
