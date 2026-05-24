"""S3 + Pinecone + Mongo coordinated upload pipeline for data_sources/.

process_file_to_embeddings: async S3 -> Pinecone embedding flow, run as a
    BackgroundTask after upload.
upload_document_file: the main upload handler that coordinates S3 upload,
    Mongo status tracking, and async embedding via BackgroundTasks. Also
    supports URL data sources (no S3 / no embedding).
"""
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
from fastapi import BackgroundTasks
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

from app.core.config import pinecone_api_key, s3_bucket, together_api_key
from app.core.exceptions import BrewraError
from app.core.logging import logger


async def process_file_to_embeddings(mongo, s3, pinecone, file_key: str, user_id: str, file_name: str, org_id: str, file_id: str):
    """Background task to convert file to embeddings and store in Pinecone with org_id namespace.
    Processes PDF, TXT, CSV, and XLSX files. Other file types are skipped gracefully."""
    try:
        # Only process PDF, TXT, CSV, and XLSX files
        supported_extensions = ('.pdf', '.txt', '.csv', '.xlsx')
        if not file_name.lower().endswith(supported_extensions):
            logger.info(f"Skipping Pinecone embedding for unsupported file type: {file_name}")
            # Update status to completed (not embedded)
            try:
                db = mongo["File_Processing"]
                collection = db["file_status"]

                collection.update_one(
                    {"file_key": file_key},
                    {"$set": {
                        "status": "completed",
                        "completed_at": datetime.now(timezone.utc),
                        "embedding_supported": False
                    }},
                    upsert=True
                )
            except Exception as e:
                logger.warning(f"Failed to update status: {str(e)}")
            return

        # Download file from S3
        local_file_path = f"/tmp/{file_name}"
        s3.download_file(s3_bucket, file_key, local_file_path)

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
            pinecone.create_index(
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
        db = mongo["File_Processing"]
        collection = db["file_status"]

        collection.update_one(
            {"file_key": file_key},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc),
                "chunks_count": len(chunks),
                "embedding_supported": True
            }},
            upsert=True
        )

        # Clean up local file
        if os.path.exists(local_file_path):
            os.remove(local_file_path)

    except BrewraError as e:
        # Typed domain failure — expected category, log at warning.
        logger.warning(
            "File processing failed for file_id=%s file_key=%s: %s",
            file_id, file_key, e,
        )
        try:
            db = mongo["File_Processing"]
            collection = db["file_status"]
            collection.update_one(
                {"file_key": file_key},
                {"$set": {
                    "status": "failed",
                    "error": str(e),
                    "failed_at": datetime.now(timezone.utc)
                }},
                upsert=True
            )
        except Exception:
            pass
    except Exception as e:
        # Unexpected failure — log at error then mark status failed so
        # the BackgroundTasks runner doesn't swallow it silently.
        try:
            db = mongo["File_Processing"]
            collection = db["file_status"]

            collection.update_one(
                {"file_key": file_key},
                {"$set": {
                    "status": "failed",
                    "error": str(e),
                    "failed_at": datetime.now(timezone.utc)
                }},
                upsert=True
            )
        except Exception:
            pass
        logger.error(f"Error processing file {file_key}: {str(e)}")


async def upload_document_file(
    mongo,
    s3,
    pinecone,
    background_tasks: BackgroundTasks,
    file_content: Optional[bytes],
    file_filename: Optional[str],
    file_content_type: Optional[str],
    user_id: str,
    org_id: str,
    url: Optional[str],
    name: Optional[str],
    tags: Optional[str],
    description: Optional[str],
) -> dict:
    """
    Upload a file (any format) to S3 OR save a URL as data source.
    PDF, TXT, CSV, and XLSX files are embedded into Pinecone.
    Other formats are uploaded to S3 but not vectorized.
    Returns immediately with upload status.
    """
    try:
        # Validate that either file or url is provided
        if not file_content and not url:
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
                db = mongo["File_Processing"]
                collection = db["file_status"]

                doc = {
                    "file_id": file_id,
                    "user_id": user_id,
                    "org_id": org_id,
                    "file_name": name,
                    "url": url,
                    "status": "completed",
                    "uploaded_at": datetime.now(timezone.utc),
                    "embedding_supported": False,
                    "data_source_type": "url"
                }

                if tags_list:
                    doc["tags"] = tags_list
                if description:
                    doc["description"] = description

                collection.insert_one(doc)
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
        will_be_embedded = file_filename.lower().endswith(('.pdf', '.txt', '.csv', '.xlsx'))

        # Generate unique file key for S3 (organized by org_id)
        file_id = str(uuid.uuid4())
        file_key = f"{org_id}/{file_id}_{file_filename}"

        # Upload to S3
        try:
            s3.put_object(
                Bucket=s3_bucket,
                Key=file_key,
                Body=file_content,
                ContentType=file_content_type or 'application/octet-stream'
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
            db = mongo["File_Processing"]
            collection = db["file_status"]

            doc = {
                "file_key": file_key,
                "file_id": file_id,
                "user_id": user_id,
                "org_id": org_id,
                "file_name": file_filename,
                "status": "processing" if will_be_embedded else "completed",
                "uploaded_at": datetime.now(timezone.utc),
                "s3_url": f"s3://{s3_bucket}/{file_key}",
                "embedding_supported": will_be_embedded
            }

            # Add tags and description if provided
            if tags_list:
                doc["tags"] = tags_list
            if description:
                doc["description"] = description

            collection.insert_one(doc)
        except Exception as e:
            logger.warning(f"Failed to store status in MongoDB: {str(e)}")

        # Start background task for PDF, TXT, CSV, and XLSX files (vectorization)
        if will_be_embedded:
            background_tasks.add_task(process_file_to_embeddings, mongo, s3, pinecone, file_key, user_id, file_filename, org_id, file_id)
        else:
            # For non-embeddable files, mark as completed immediately
            try:
                db = mongo["File_Processing"]
                collection = db["file_status"]

                collection.update_one(
                    {"file_key": file_key},
                    {"$set": {
                        "status": "completed",
                        "completed_at": datetime.now(timezone.utc),
                        "embedding_supported": False
                    }},
                    upsert=True
                )
            except Exception as e:
                logger.warning(f"Failed to update status for non-embeddable file: {str(e)}")

        response = {
            "status": "success",
            "message": f"File uploaded successfully. {'Processing embeddings in background.' if will_be_embedded else 'File uploaded to S3 (not vectorized).'}",
            "file_key": file_key,
            "file_id": file_id,
            "file_name": file_filename
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
