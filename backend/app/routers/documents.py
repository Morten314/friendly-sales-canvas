"""Document upload, status, and data-source management endpoints."""
import shutil

from fastapi import APIRouter, BackgroundTasks, Body, File, Form, HTTPException, Query, UploadFile

from app.core.logging import logger
from app.services import documents as documents_service

router = APIRouter(tags=["documents"])


@router.post("/upload_file/")
async def upload_document(file: UploadFile = File(...)):
    file_path = f"uploaded_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    return documents_service.upload_file_text(file_path, file.filename)


@router.post('/upload')
async def upload_prospect_list(file: UploadFile = File(...)):
    file_path = f"/tmp/{file.filename}"
    with open(file_path, 'wb') as buffer:
        shutil.copyfileobj(file.file, buffer)
    return documents_service.upload_prospect_list_file(file_path)


@router.post("/upload-document")
async def upload_document_route(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(None),
    user_id: str = Form(...),
    org_id: str = Form(...),
    url: str = Form(None),
    name: str = Form(None),
    tags: str = Form(None),
    description: str = Form(None)
):
    file_content = None
    file_filename = None
    file_content_type = None
    if file:
        file_content = await file.read()
        file_filename = file.filename
        file_content_type = file.content_type
    return await documents_service.upload_document_file(
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


@router.get("/document-status/{file_key:path}")
async def get_document_status(file_key: str):
    return await documents_service.get_document_status(file_key)


@router.get("/user-documents")
async def get_user_documents(org_id: str = Query(...)):
    return await documents_service.list_user_documents(org_id)


@router.delete("/data-source/{file_id}")
async def delete_data_source(file_id: str):
    return await documents_service.delete_data_source(file_id)


@router.put("/data-source/{file_id}")
async def update_data_source(file_id: str, request: dict = Body(...)):
    return await documents_service.update_data_source(file_id, request)
