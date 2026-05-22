"""Document upload, status, and data-source management endpoints."""
import json
import shutil
import urllib.parse
import uuid
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Body, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from langchain_community.document_loaders import (
    CSVLoader,
    PyPDFLoader,
    TextLoader,
    UnstructuredExcelLoader,
)
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pymongo import MongoClient

from app.core import clients
from app.core.config import pinecone_api_key, s3_bucket, together_api_key
from app.core.logging import logger
from app.services import documents as documents_service

router = APIRouter(tags=["documents"])


@router.post("/upload_file/")
async def upload_document(file: UploadFile = File(...)):
    file_path = f"uploaded_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    documents_service.grapher(file_path)
    return {"message": f"File {file.filename} processed and graph updated."}

@router.post('/upload')
async def upload_prospect_list(file: UploadFile = File(...)):
    file_path = f"/tmp/{file.filename}"
    with open(file_path, 'wb') as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = documents_service.process_prospect_list(file_path)
    return result


async def process_file_to_embeddings(file_key: str, user_id: str, file_name: str, org_id: str, file_id: str):
    """Background task to convert file to embeddings and store in Pinecone with org_id namespace.
    Processes PDF, TXT, CSV, and XLSX files. Other file types are skipped gracefully."""
    try:
        # Only process PDF, TXT, CSV, and XLSX files
        supported_extensions = ('.pdf', '.txt', '.csv', '.xlsx')
        if not file_name.lower().endswith(supported_extensions):
            logger.info(f"Skipping Pinecone embedding for unsupported file type: {file_name}")
            # Update status to completed (not embedded)
            try:
                username = urllib.parse.quote_plus("techbrewra")
                password = urllib.parse.quote_plus("Brewra@Best09")
                mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
                mongo_client = MongoClient(mongo_uri)
                db = mongo_client["File_Processing"]
                collection = db["file_status"]

                collection.update_one(
                    {"file_key": file_key},
                    {"$set": {
                        "status": "completed",
                        "completed_at": datetime.utcnow(),
                        "embedding_supported": False
                    }},
                    upsert=True
                )
                mongo_client.close()
            except Exception as e:
                logger.warning(f"Failed to update status: {str(e)}")
            return

        # Download file from S3
        local_file_path = f"/tmp/{file_name}"
        clients.s3_client.download_file(s3_bucket, file_key, local_file_path)

        # Load document based on file type
        if file_name.lower().endswith('.pdf'):
            loader = PyPDFLoader(local_file_path)
            documents = loader.load()
        elif file_name.lower().endswith('.txt'):
            loader = TextLoader(local_file_path)
            documents = loader.load()
        elif file_name.lower().endswith('.csv'):
            # Load CSV using pandas and convert to text documents
            try:
                df = pd.read_csv(local_file_path)
                # Convert DataFrame to text format
                documents = []
                # Create a document for each row, combining all columns
                for idx, row in df.iterrows():
                    row_text = " | ".join([f"{col}: {str(val)}" for col, val in row.items() if pd.notna(val)])
                    documents.append(Document(page_content=row_text, metadata={"row_index": idx}))
                # Also create a summary document with column names and data types
                summary_text = f"CSV File Summary:\nColumns: {', '.join(df.columns.tolist())}\nRows: {len(df)}\n\n"
                summary_text += "Sample data:\n" + df.head(10).to_string()
                documents.insert(0, Document(page_content=summary_text, metadata={"type": "summary"}))
            except Exception as e:
                logger.error(f"Error loading CSV file {file_name}: {str(e)}")
                # Fallback to CSVLoader if pandas fails
                loader = CSVLoader(local_file_path)
                documents = loader.load()
        elif file_name.lower().endswith('.xlsx'):
            # Load XLSX using pandas and convert to text documents
            try:
                # Read all sheets
                excel_file = pd.ExcelFile(local_file_path)
                documents = []

                for sheet_name in excel_file.sheet_names:
                    df = pd.read_excel(local_file_path, sheet_name=sheet_name)
                    # Create a document for each row in the sheet
                    for idx, row in df.iterrows():
                        row_text = " | ".join([f"{col}: {str(val)}" for col, val in row.items() if pd.notna(val)])
                        documents.append(Document(
                            page_content=row_text,
                            metadata={"sheet_name": sheet_name, "row_index": idx}
                        ))
                    # Add summary for each sheet
                    summary_text = f"Sheet: {sheet_name}\nColumns: {', '.join(df.columns.tolist())}\nRows: {len(df)}\n\n"
                    summary_text += "Sample data:\n" + df.head(10).to_string()
                    documents.append(Document(
                        page_content=summary_text,
                        metadata={"type": "summary", "sheet_name": sheet_name}
                    ))
            except Exception as e:
                logger.error(f"Error loading XLSX file {file_name}: {str(e)}")
                # Fallback to UnstructuredExcelLoader if pandas fails
                try:
                    loader = UnstructuredExcelLoader(local_file_path)
                    documents = loader.load()
                except Exception as e2:
                    logger.error(f"Error with UnstructuredExcelLoader: {str(e2)}")
                    raise
        else:
            logger.warning(f"Unexpected file type in process_file_to_embeddings: {file_name}")
            return

        # Split documents into chunks
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(documents)

        # Add metadata to each chunk (file_key, file_id, org_id for filtering/deletion)
        for chunk in chunks:
            if not hasattr(chunk, 'metadata'):
                chunk.metadata = {}
            chunk.metadata['file_key'] = file_key
            chunk.metadata['file_id'] = file_id
            chunk.metadata['org_id'] = org_id
            chunk.metadata['user_id'] = user_id
            chunk.metadata['file_name'] = file_name

        # Initialize embeddings (using TogetherAI with multilingual-e5-large-instruct)
        embeddings = OpenAIEmbeddings(
            openai_api_key=together_api_key,
            openai_api_base="https://api.together.xyz/v1",
            model="intfloat/multilingual-e5-large-instruct"
        )

        # Create or get Pinecone index
        index_name = "brewra-documents"
        try:
            clients.pc.create_index(
                name=index_name,
                dimension=1024,  # multilingual-e5-large-instruct embedding dimension (1024)
                metric="cosine"
            )
        except Exception:
            # Index already exists
            pass

        # Store embeddings in Pinecone with org_id as namespace
        vectorstore = PineconeVectorStore.from_documents(
            chunks,
            embeddings,
            index_name=index_name,
            namespace=org_id,  # Use org_id as namespace for multitenancy
            pinecone_api_key=pinecone_api_key
        )

        # Update status in MongoDB (optional - for tracking)
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["File_Processing"]
        collection = db["file_status"]

        collection.update_one(
            {"file_key": file_key},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.utcnow(),
                "chunks_count": len(chunks),
                "embedding_supported": True
            }},
            upsert=True
        )
        mongo_client.close()

        # Clean up local file
        import os
        if os.path.exists(local_file_path):
            os.remove(local_file_path)

    except Exception as e:
        # Update status with error
        try:
            username = urllib.parse.quote_plus("techbrewra")
            password = urllib.parse.quote_plus("Brewra@Best09")
            mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
            mongo_client = MongoClient(mongo_uri)
            db = mongo_client["File_Processing"]
            collection = db["file_status"]

            collection.update_one(
                {"file_key": file_key},
                {"$set": {
                    "status": "failed",
                    "error": str(e),
                    "failed_at": datetime.utcnow()
                }},
                upsert=True
            )
            mongo_client.close()
        except:
            pass
        logger.error(f"Error processing file {file_key}: {str(e)}")

@router.post("/upload-document")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(None),
    user_id: str = Form(...),
    org_id: str = Form(...),
    url: str = Form(None),
    name: str = Form(None),
    tags: str = Form(None),  # Comma-separated string or JSON array string
    description: str = Form(None)
):
    """
    Upload a file (any format) to S3 OR save a URL as data source.
    PDF, TXT, CSV, and XLSX files are embedded into Pinecone.
    Other formats are uploaded to S3 but not vectorized.
    Returns immediately with upload status.

    Parameters:
    - file: File to upload (required if url not provided)
    - url: URL to save as data source (required if file not provided)
    - name: Name for the URL data source (required if url provided)
    - tags: Optional comma-separated string or JSON array string (e.g., "tag1,tag2" or '["tag1","tag2"]')
    - description: Optional description of the document
    """
    try:
        # Validate that either file or url is provided
        if not file and not url:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "error": "validation_failed",
                    "message": "Either 'file' or 'url' must be provided"
                }
            )

        # If URL is provided, handle URL data source
        if url:
            if not name:
                return JSONResponse(
                    status_code=400,
                    content={
                        "status": "error",
                        "error": "validation_failed",
                        "message": "name is required when url is provided"
                    }
                )

            # Generate unique ID for URL data source
            file_id = str(uuid.uuid4())

            # Parse tags
            tags_list = None
            if tags:
                try:
                    tags_list = json.loads(tags)
                    if not isinstance(tags_list, list):
                        tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
                except (json.JSONDecodeError, AttributeError):
                    tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()]

            # Save URL data source to MongoDB
            try:
                username = urllib.parse.quote_plus("techbrewra")
                password = urllib.parse.quote_plus("Brewra@Best09")
                mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
                mongo_client = MongoClient(mongo_uri)
                db = mongo_client["File_Processing"]
                collection = db["file_status"]

                doc = {
                    "file_id": file_id,
                    "user_id": user_id,
                    "org_id": org_id,
                    "file_name": name,
                    "url": url,
                    "status": "completed",
                    "uploaded_at": datetime.utcnow(),
                    "embedding_supported": False,
                    "data_source_type": "url"
                }

                if tags_list:
                    doc["tags"] = tags_list
                if description:
                    doc["description"] = description

                collection.insert_one(doc)
                mongo_client.close()
            except Exception as e:
                logger.error(f"Failed to save URL data source to MongoDB: {str(e)}")
                return JSONResponse(
                    status_code=500,
                    content={
                        "status": "error",
                        "error": "save_failed",
                        "message": f"Failed to save URL data source: {str(e)}"
                    }
                )

            response = {
                "status": "success",
                "message": "URL data source saved successfully",
                "file_id": file_id,
                "name": name,
                "url": url
            }

            if tags_list:
                response["tags"] = tags_list
            if description:
                response["description"] = description

            return response

        # Handle file upload - accept ALL file formats for AWS upload
        # Check if file will be embedded (PDF, TXT, CSV, XLSX)
        will_be_embedded = file.filename.lower().endswith(('.pdf', '.txt', '.csv', '.xlsx'))

        # Generate unique file key for S3 (organized by org_id)
        file_id = str(uuid.uuid4())
        file_key = f"{org_id}/{file_id}_{file.filename}"

        # Upload to S3
        try:
            file_content = await file.read()
            clients.s3_client.put_object(
                Bucket=s3_bucket,
                Key=file_key,
                Body=file_content,
                ContentType=file.content_type or 'application/octet-stream'
            )
        except Exception as e:
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "error": "upload_failed",
                    "message": f"Failed to upload file to S3: {str(e)}"
                }
            )

        # Parse tags - handle both comma-separated string and JSON array string
        tags_list = None
        if tags:
            try:
                # Try to parse as JSON array first
                tags_list = json.loads(tags)
                if not isinstance(tags_list, list):
                    # If not a list, treat as comma-separated string
                    tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
            except (json.JSONDecodeError, AttributeError):
                # If JSON parsing fails, treat as comma-separated string
                tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()]

        # Store initial status in MongoDB
        try:
            username = urllib.parse.quote_plus("techbrewra")
            password = urllib.parse.quote_plus("Brewra@Best09")
            mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
            mongo_client = MongoClient(mongo_uri)
            db = mongo_client["File_Processing"]
            collection = db["file_status"]

            doc = {
                "file_key": file_key,
                "file_id": file_id,
                "user_id": user_id,
                "org_id": org_id,
                "file_name": file.filename,
                "status": "processing" if will_be_embedded else "completed",
                "uploaded_at": datetime.utcnow(),
                "s3_url": f"s3://{s3_bucket}/{file_key}",
                "embedding_supported": will_be_embedded
            }

            # Add tags and description if provided
            if tags_list:
                doc["tags"] = tags_list
            if description:
                doc["description"] = description

            collection.insert_one(doc)
            mongo_client.close()
        except Exception as e:
            logger.warning(f"Failed to store status in MongoDB: {str(e)}")

        # Start background task for PDF, TXT, CSV, and XLSX files (vectorization)
        if will_be_embedded:
            background_tasks.add_task(process_file_to_embeddings, file_key, user_id, file.filename, org_id, file_id)
        else:
            # For non-embeddable files, mark as completed immediately
            try:
                username = urllib.parse.quote_plus("techbrewra")
                password = urllib.parse.quote_plus("Brewra@Best09")
                mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
                mongo_client = MongoClient(mongo_uri)
                db = mongo_client["File_Processing"]
                collection = db["file_status"]

                collection.update_one(
                    {"file_key": file_key},
                    {"$set": {
                        "status": "completed",
                        "completed_at": datetime.utcnow(),
                        "embedding_supported": False
                    }},
                    upsert=True
                )
                mongo_client.close()
            except Exception as e:
                logger.warning(f"Failed to update status for non-embeddable file: {str(e)}")

        response = {
            "status": "success",
            "message": f"File uploaded successfully. {'Processing embeddings in background.' if will_be_embedded else 'File uploaded to S3 (not vectorized).'}",
            "file_key": file_key,
            "file_id": file_id,
            "file_name": file.filename
        }

        # Include tags and description in response if provided
        if tags_list:
            response["tags"] = tags_list
        if description:
            response["description"] = description

        return response

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "error": "upload_failed",
                "message": f"Unexpected error: {str(e)}"
            }
        )

@router.get("/document-status/{file_key:path}")
async def get_document_status(file_key: str):
    """
    Get the processing status of a document.
    Returns status: processing, completed, or failed
    """
    try:
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["File_Processing"]
        collection = db["file_status"]

        status_doc = collection.find_one({"file_key": file_key})
        mongo_client.close()

        if not status_doc:
            raise HTTPException(status_code=404, detail="File not found")

        status_doc.pop("_id", None)
        return {
            "status": "success",
            "data": status_doc
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user-documents")
async def get_user_documents(org_id: str = Query(...)):
    """
    Get all data sources (files and URLs) for an organization.
    Returns list of files and URLs with file_name, file_id, and other metadata.
    Filtered by org_id for multi-org support.
    """
    try:
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["File_Processing"]
        collection = db["file_status"]

        # Find all data sources (files and URLs) for this org
        files = collection.find({"org_id": org_id}).sort("uploaded_at", -1)

        file_list = []
        for file_doc in files:
            file_item = {
                "file_id": file_doc.get("file_id") or file_doc.get("file_key"),
                "file_key": file_doc.get("file_key"),
                "file_name": file_doc.get("file_name"),
                "status": file_doc.get("status", "unknown"),
                "uploaded_at": file_doc.get("uploaded_at"),
                "data_source_type": file_doc.get("data_source_type", "file")  # "file" or "url"
            }

            # Include URL if it's a URL data source
            if file_doc.get("url"):
                file_item["url"] = file_doc.get("url")

            # Include tags and description if they exist
            if "tags" in file_doc:
                file_item["tags"] = file_doc.get("tags")
            if "description" in file_doc:
                file_item["description"] = file_doc.get("description")

            file_list.append(file_item)

        mongo_client.close()

        return {
            "status": "success",
            "count": len(file_list),
            "files": file_list
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/data-source/{file_id}")
async def delete_data_source(file_id: str):
    """
    Delete a data source file from AWS S3, Pinecone, and MongoDB.
    Deletes based on file_id.
    """
    try:
        # Log the received file_id for debugging
        logger.info(f"DELETE /data-source received file_id: '{file_id}' (length: {len(file_id)}, repr: {repr(file_id)})")

        # Strip any trailing slashes that might be added by the router or client
        original_file_id = file_id
        file_id = file_id.rstrip('/')

        if original_file_id != file_id:
            logger.warning(f"Stripped trailing slash from file_id: '{original_file_id}' -> '{file_id}'")

        # MongoDB connection
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["File_Processing"]
        collection = db["file_status"]

        # Log what we're searching for
        logger.info(f"Searching MongoDB for file_id: '{file_id}'")

        # If file_id contains a slash, it might be a file_key from old documents
        # Extract just the UUID part if it looks like a file_key path
        search_file_id = file_id
        if "/" in file_id:
            # Format: {org_id}/{file_id}_{filename} - extract the file_id part
            parts = file_id.split("/")
            if len(parts) > 1:
                # Get the part after the slash
                file_part = parts[-1]
                # Extract UUID (before underscore if present)
                if "_" in file_part:
                    search_file_id = file_part.split("_")[0]
                    logger.info(f"Extracted file_id from path: '{file_id}' -> '{search_file_id}'")
                else:
                    search_file_id = file_part

        # Find file document by file_id
        file_doc = collection.find_one({"file_id": search_file_id})
        logger.info(f"Search by file_id field '{search_file_id}' result: {file_doc is not None}")

        if not file_doc:
            # Try to find by file_key if file_id not found (for backward compatibility)
            logger.info(f"Trying to find by file_key: '{file_id}'")
            file_doc = collection.find_one({"file_key": file_id})
            logger.info(f"Search by file_key result: {file_doc is not None}")

            if not file_doc:
                # Log some sample documents to help debug
                sample_docs = list(collection.find({}, {"file_id": 1, "file_key": 1, "_id": 0}).limit(3))
                logger.error(f"File not found. Searched for file_id='{search_file_id}' and file_key='{file_id}'. Sample documents: {sample_docs}")
                mongo_client.close()
                raise HTTPException(status_code=404, detail=f"File with id '{file_id}' not found")

        file_key = file_doc.get("file_key")
        url = file_doc.get("url")
        data_source_type = file_doc.get("data_source_type")
        org_id = file_doc.get("org_id")
        actual_file_id = file_doc.get("file_id")  # Get the actual file_id from document

        # Check if this is a URL data source (not a file)
        is_url_data_source = url is not None or data_source_type == "url"

        # For backward compatibility: extract org_id from file_key if not in document
        if not org_id and file_key:
            # Try to extract org_id from file_key pattern: {org_id}/{file_id}_{filename}
            parts = file_key.split("/")
            if len(parts) > 1:
                org_id = parts[0]

        # Use actual_file_id for Pinecone deletion, fallback to search_file_id if not available
        if not actual_file_id:
            actual_file_id = search_file_id

        deletion_errors = []

        # 1. Delete from AWS S3 (only for file data sources, not URLs)
        if not is_url_data_source and file_key:
            try:
                clients.s3_client.delete_object(Bucket=s3_bucket, Key=file_key)
                logger.info(f"Deleted file from S3: {file_key}")
            except Exception as e:
                error_msg = str(e)
                # Check if it's a permissions error
                if "AccessDenied" in error_msg or "not authorized" in error_msg:
                    deletion_errors.append(f"S3 deletion failed: AWS IAM user does not have s3:DeleteObject permission. Please update IAM policy for user 'brewra-ai'.")
                else:
                    deletion_errors.append(f"S3 deletion failed: {error_msg}")
                logger.error(f"Failed to delete from S3: {error_msg}")
        elif is_url_data_source:
            logger.info(f"Skipping S3 deletion for URL data source: {url}")
        else:
            logger.warning(f"No file_key found, skipping S3 deletion")

        # 2. Delete from Pinecone (only for file data sources that were embedded, not URLs)
        if not is_url_data_source and org_id and file_key:
            try:
                index_name = "brewra-documents"
                index = clients.pc.Index(index_name)

                # Check if namespace exists first and log what we're searching for
                logger.info(f"Attempting Pinecone deletion: namespace='{org_id}', file_id='{actual_file_id}', file_key='{file_key}'")

                try:
                    stats = index.describe_index_stats()
                    namespaces = stats.get('namespaces', {})
                    logger.info(f"Available namespaces in Pinecone: {list(namespaces.keys())}")

                    if org_id not in namespaces:
                        logger.warning(f"Namespace '{org_id}' does not exist in Pinecone. Available namespaces: {list(namespaces.keys())}")
                        deletion_errors.append(f"Pinecone deletion skipped: Namespace '{org_id}' not found. Available namespaces: {list(namespaces.keys())}")
                    else:
                        # Namespace exists, try to delete
                        # First, try to query vectors with our file_id to see if they exist
                        try:
                            # Query with a dummy vector to see if we can access the namespace and find our vectors
                            from pinecone import QueryResponse
                            sample_query = index.query(
                                vector=[0.0] * 1024,  # Dummy vector
                                top_k=10,
                                namespace=org_id,
                                filter={"file_id": {"$eq": actual_file_id}},
                                include_metadata=True
                            )
                            if sample_query.matches:
                                logger.info(f"Found {len(sample_query.matches)} vectors with file_id='{actual_file_id}' in namespace '{org_id}'. Sample metadata: {sample_query.matches[0].metadata}")
                            else:
                                logger.warning(f"No vectors found with file_id='{actual_file_id}' in namespace '{org_id}'. Trying with file_key...")
                                # Try querying with file_key
                                sample_query2 = index.query(
                                    vector=[0.0] * 1024,
                                    top_k=10,
                                    namespace=org_id,
                                    filter={"file_key": {"$eq": file_key}},
                                    include_metadata=True
                                )
                                if sample_query2.matches:
                                    logger.info(f"Found {len(sample_query2.matches)} vectors with file_key='{file_key}' in namespace '{org_id}'. Sample metadata: {sample_query2.matches[0].metadata}")
                                else:
                                    logger.warning(f"No vectors found with either file_id='{actual_file_id}' or file_key='{file_key}' in namespace '{org_id}'")
                        except Exception as query_error:
                            error_str = str(query_error)
                            if "Namespace not found" in error_str or "code\":5" in error_str:
                                logger.error(f"Namespace '{org_id}' not accessible during query. This suggests the namespace name might not match exactly. Error: {error_str}")
                                deletion_errors.append(f"Pinecone deletion failed: Namespace '{org_id}' not accessible. Check if namespace name matches exactly (case-sensitive). Error: {error_str}")
                                # Don't raise, continue to try deletion anyway
                            else:
                                logger.warning(f"Query failed but continuing with deletion attempt: {error_str}")

                        # Delete vectors by metadata filter (file_id in the specific namespace)
                        # Pinecone delete by metadata filter - try both file_id and file_key for compatibility
                        try:
                            logger.info(f"Attempting delete with filter: file_id='{actual_file_id}' in namespace='{org_id}'")
                            index.delete(
                                filter={"file_id": {"$eq": actual_file_id}},
                                namespace=org_id
                            )
                            logger.info(f"Successfully deleted vectors from Pinecone for file_id: {actual_file_id} in namespace: {org_id}")
                        except Exception as delete_error:
                            error_str = str(delete_error)
                            logger.warning(f"Delete with file_id failed: {error_str}. Trying with file_key...")

                            # Try with file_key if file_id filter doesn't work
                            try:
                                logger.info(f"Attempting delete with filter: file_key='{file_key}' in namespace='{org_id}'")
                                index.delete(
                                    filter={"file_key": {"$eq": file_key}},
                                    namespace=org_id
                                )
                                logger.info(f"Successfully deleted vectors from Pinecone for file_key: {file_key} in namespace: {org_id}")
                            except Exception as e2:
                                error_str = str(e2)
                                # If both fail, check if it's a namespace not found error
                                if "Namespace not found" in error_str or "code\":5" in error_str:
                                    logger.error(f"Namespace '{org_id}' not found during deletion. This is unexpected since it exists in stats. Error: {error_str}")
                                    deletion_errors.append(f"Pinecone deletion failed: Namespace '{org_id}' not accessible during deletion. Error: {error_str}")
                                else:
                                    logger.error(f"Pinecone deletion failed with both file_id and file_key filters. Last error: {error_str}")
                                    deletion_errors.append(f"Pinecone deletion failed: No vectors found matching file_id='{actual_file_id}' or file_key='{file_key}'. Error: {error_str}")
                                    raise e2
                except Exception as stats_error:
                    # If we can't get stats, try deletion anyway
                    logger.warning(f"Could not check namespace stats: {str(stats_error)}. Attempting deletion anyway.")
                    try:
                        index.delete(
                            filter={"file_id": {"$eq": actual_file_id}},
                            namespace=org_id
                        )
                        logger.info(f"Deleted vectors from Pinecone for file_id: {actual_file_id} in namespace: {org_id}")
                    except Exception as delete_error:
                        error_str = str(delete_error)
                        if "Namespace not found" in error_str or "code\":5" in error_str:
                            logger.warning(f"Namespace '{org_id}' not found. Vectors may not exist.")
                            deletion_errors.append(f"Pinecone deletion skipped: Namespace '{org_id}' not found. Vectors may not have been stored.")
                        else:
                            raise delete_error
            except Exception as e:
                error_str = str(e)
                if "Namespace not found" in error_str or "code\":5" in error_str:
                    logger.warning(f"Namespace '{org_id}' not found. Vectors may not exist.")
                    deletion_errors.append(f"Pinecone deletion skipped: Namespace '{org_id}' not found. Vectors may not have been stored.")
                else:
                    deletion_errors.append(f"Pinecone deletion failed: {error_str}")
                    logger.error(f"Failed to delete from Pinecone: {error_str}")
        elif is_url_data_source:
            logger.info(f"Skipping Pinecone deletion for URL data source: {url}")
        elif not org_id:
            deletion_errors.append("Pinecone deletion skipped: Organization ID not found")
            logger.warning(f"Pinecone deletion skipped for file_id {file_id}: org_id not found")
        elif not file_key:
            logger.info(f"Skipping Pinecone deletion: No file_key found (may be URL data source or incomplete record)")

        # 3. Delete from MongoDB
        try:
            # Use actual_file_id from document, fallback to search_file_id
            delete_result = collection.delete_one({"file_id": actual_file_id})
            if delete_result.deleted_count == 0:
                # Fallback: try with the original file_id parameter
                collection.delete_one({"file_id": file_id})
            logger.info(f"Deleted data source record from MongoDB: file_id={actual_file_id}")
        except Exception as e:
            deletion_errors.append(f"MongoDB deletion failed: {str(e)}")
            logger.error(f"Failed to delete from MongoDB: {str(e)}")

        mongo_client.close()

        # Return success even if some deletions failed (partial success)
        if deletion_errors:
            return {
                "status": "partial_success",
                "message": "File deletion completed with some errors",
                "file_id": file_id,
                "file_key": file_key,
                "errors": deletion_errors
            }

        return {
            "status": "success",
            "message": "File deleted successfully from all storage systems",
            "file_id": file_id,
            "file_key": file_key
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting file {file_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

@router.put("/data-source/{file_id}")
async def update_data_source(file_id: str, request: dict = Body(...)):
    """
    Update tags and description for a data source file.
    """
    try:
        file_id = file_id.rstrip('/')

        tags = request.get("tags")
        description = request.get("description")

        if tags is None and description is None:
            raise HTTPException(status_code=400, detail="At least one of 'tags' or 'description' must be provided")

        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["File_Processing"]
        collection = db["file_status"]

        file_doc = collection.find_one({"file_id": file_id})
        if not file_doc:
            file_doc = collection.find_one({"file_key": file_id})
            if not file_doc:
                mongo_client.close()
                raise HTTPException(status_code=404, detail=f"File with id '{file_id}' not found")

        update_doc = {}

        if tags is not None:
            if isinstance(tags, str):
                try:
                    tags_list = json.loads(tags)
                    if not isinstance(tags_list, list):
                        tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
                except (json.JSONDecodeError, AttributeError):
                    tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
            elif isinstance(tags, list):
                tags_list = tags
            else:
                raise HTTPException(status_code=400, detail="tags must be a list or comma-separated string")
            update_doc["tags"] = tags_list

        if description is not None:
            if not isinstance(description, str):
                raise HTTPException(status_code=400, detail="description must be a string")
            update_doc["description"] = description

        collection.update_one(
            {"file_id": file_doc.get("file_id") or file_doc.get("file_key")},
            {"$set": update_doc}
        )

        mongo_client.close()

        return {
            "status": "success",
            "message": "Data source updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update file: {str(e)}")
