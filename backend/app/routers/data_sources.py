"""Document upload, status, and data-source management endpoints."""
import shutil

from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, Form, HTTPException, Query, Response, UploadFile

from app.core.dependencies import (
    get_llm,
    get_llm_transformer,
    get_mongo,
    get_neo4j_driver,
    get_neo4j_graph,
    get_pinecone,
    get_s3,
)
from app.core.logging import logger
from app.models.documents import (
    DataSourceDeleteResponse,
    DataSourceUpdateResponse,
    DocumentStatusResponse,
    ListUserDocumentsResponse,
    MessageResponse,
)
from app.services import data_sources as data_sources_service

router = APIRouter(tags=["data_sources"])


@router.post("/upload_file/", response_model=MessageResponse)
async def upload_document(
    file: UploadFile = File(...),
    graph=Depends(get_neo4j_graph),
    llm_transformer=Depends(get_llm_transformer),
):
    file_path = f"uploaded_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    return data_sources_service.upload_file_text(graph, llm_transformer, file_path, file.filename)


@router.post('/upload', response_model=MessageResponse)
async def upload_prospect_list(
    file: UploadFile = File(...),
    driver=Depends(get_neo4j_driver),
    llm=Depends(get_llm),
):
    file_path = f"/tmp/{file.filename}"
    with open(file_path, 'wb') as buffer:
        shutil.copyfileobj(file.file, buffer)
    return data_sources_service.upload_prospect_list_file(driver, llm, file_path)


# Response shape varies by code path (plain dict vs JSONResponse); annotation deferred.
@router.post("/upload-document")
async def upload_document_route(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(None),
    user_id: str = Form(...),
    org_id: str = Form(...),
    url: str = Form(None),
    name: str = Form(None),
    tags: str = Form(None),
    description: str = Form(None),
    mongo=Depends(get_mongo),
    s3=Depends(get_s3),
    pinecone=Depends(get_pinecone),
):
    file_content = None
    file_filename = None
    file_content_type = None
    if file:
        file_content = await file.read()
        file_filename = file.filename
        file_content_type = file.content_type
    return await data_sources_service.upload_document_file(
        mongo,
        s3,
        pinecone,
        background_tasks=background_tasks,
        file_content=file_content,
        file_filename=file_filename,
        file_content_type=file_content_type,
        user_id=user_id,
        org_id=org_id,
        url=url,
        name=name,
        tags=tags,
        description=description,
    )


@router.get("/document-status/{file_key:path}", response_model=DocumentStatusResponse)
async def get_document_status(file_key: str, mongo=Depends(get_mongo)):
    return await data_sources_service.get_document_status(mongo, file_key)


@router.get("/user-documents", response_model=ListUserDocumentsResponse)
async def get_user_documents(
    response: Response,
    org_id: str = Query(...),
    mongo=Depends(get_mongo),
):
    """**Deprecated:** use `GET /api/v2/user-documents` for the paginated envelope.

    Returns up to 500 documents (silent cap; previously unbounded).
    """
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v2/user-documents>; rel="successor-version"'
    items, _ = await data_sources_service.list_user_documents(mongo, org_id)
    return {"status": "success", "count": len(items), "files": items}


@router.delete("/data-source/{file_id}", response_model=DataSourceDeleteResponse)
async def delete_data_source(
    file_id: str,
    mongo=Depends(get_mongo),
    s3=Depends(get_s3),
    pinecone=Depends(get_pinecone),
):
    return await data_sources_service.delete_data_source(mongo, s3, pinecone, file_id)


@router.put("/data-source/{file_id}", response_model=DataSourceUpdateResponse)
async def update_data_source(
    file_id: str,
    request: dict = Body(...),
    mongo=Depends(get_mongo),
):
    return await data_sources_service.update_data_source(mongo, file_id, request)
