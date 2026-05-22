"""Response models for the documents domain."""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class MessageResponse(BaseModel):
    """Generic single-message response (upload_file_text, upload_prospect_list)."""
    message: str


class UploadDocumentResponse(BaseModel):
    """Response from POST /upload-document (file or URL data source)."""
    status: str
    message: str
    file_id: str
    # file upload fields
    file_key: Optional[str] = None
    file_name: Optional[str] = None
    # url data source fields
    name: Optional[str] = None
    url: Optional[str] = None
    # optional metadata
    tags: Optional[List[str]] = None
    description: Optional[str] = None


class DocumentStatusData(BaseModel):
    """Inner data object returned by GET /document-status/{file_key}."""
    model_config = {"extra": "allow"}

    file_key: Optional[str] = None
    file_id: Optional[str] = None
    user_id: Optional[str] = None
    org_id: Optional[str] = None
    file_name: Optional[str] = None
    status: Optional[str] = None
    uploaded_at: Optional[Any] = None
    s3_url: Optional[str] = None
    embedding_supported: Optional[bool] = None
    data_source_type: Optional[str] = None


class DocumentStatusResponse(BaseModel):
    """Response from GET /document-status/{file_key}."""
    status: str
    data: DocumentStatusData


class UserDocumentEntry(BaseModel):
    """Single entry in the files list returned by GET /user-documents."""
    file_id: Optional[str] = None
    file_key: Optional[str] = None
    file_name: Optional[str] = None
    status: Optional[str] = None
    uploaded_at: Optional[Any] = None
    data_source_type: Optional[str] = None
    # conditional fields
    url: Optional[str] = None
    tags: Optional[List[Any]] = None
    description: Optional[str] = None


class ListUserDocumentsResponse(BaseModel):
    """Response from GET /user-documents."""
    status: str
    count: int
    files: List[UserDocumentEntry]


class DataSourceDeleteResponse(BaseModel):
    """Response from DELETE /data-source/{file_id}."""
    status: str
    message: str
    file_id: str
    file_key: Optional[str] = None
    errors: Optional[List[str]] = None


class DataSourceUpdateResponse(BaseModel):
    """Response from PUT /data-source/{file_id}."""
    status: str
    message: str
