"""Document loading, prospect-list processing, and upload route-logic.

Reusable helpers (`load_document`, `grapher`, `process_prospect_list`) plus
upload-flow functions (`upload_file_text`, `upload_prospect_list_file`,
`process_file_to_embeddings`, `upload_document_file`). The 4 Mongo CRUD
functions (`get_document_status`, `list_user_documents`, `delete_data_source`,
`update_data_source`) live in `persistence.py` as of Phase H commit 6/20.

`score_prospect` (LLM-bound scoring helper) lives in `app.services.graph_chat`
and is imported lazily inside `process_prospect_list` to break a load-time
cycle.
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

from app.services._neo4j_helpers import query  # function — local binding ok
from app.core.config import pinecone_api_key, s3_bucket, together_api_key
from app.core.exceptions import BrewraError
from app.core.logging import logger


# ---------------------------------------------------------------------------
# Helpers (pre-existing)
# ---------------------------------------------------------------------------

# Function to load documents
def load_document(file_path):
    if file_path.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    elif file_path.endswith(".txt"):
        loader = TextLoader(file_path)
    return loader.load()

# Function to process documents and update Neo4j graph
def grapher(graph, llm_transformer, file_path):
    text = load_document(file_path)
    graph_documents = llm_transformer.convert_to_graph_documents(text)
    graph.add_graph_documents(graph_documents)

def process_prospect_list(driver, llm, file_path):
    """Process the prospect list and add data to Neo4j."""
    from app.services.graph_chat import score_prospect  # lazy: avoid load-time dep

    # Read file based on extension
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    elif file_path.endswith('.xlsx'):
        df = pd.read_excel(file_path)
    else:
        return {'error': 'Unsupported file format'}

    required_columns = ['Prospect Name', 'Prospect Company']
    question_columns = [
        "Is there a budget planned for the next four quarters?",
        "Would this be categorized as Opex or Capex?",
        "Do you have a general idea of the expected spend range?",
        "What factors are considered when determining this spend range?",
        "What level of access or visibility might be available to us?",
        "Who would typically be involved in making the final decision?",
        "What's their role or designation?",
        "Would it be convenient to meet in the office for a one-on-one discussion?",
        "Would you be open to meeting in a different location if that works better?",
        "Could this project contribute to career growth for the buyer?"
    ]

    all_columns = required_columns + question_columns
    added_count = 0

    for _, row in df.iterrows():
        data = {col: row[col] if col in df.columns and pd.notna(row[col]) else '' for col in all_columns}

        # Check if prospect already exists
        check_query = f"""
            MATCH (p:Prospect {{name: '{data['Prospect Name']}', company: '{data['Prospect Company']}'}}) RETURN p
        """
        existing_prospect = query(driver, check_query)

        if existing_prospect:
            continue  # Skip if already exists

        # First create a query to get a score
        temp_cypher = f"""
        CREATE (p:Prospect {{
            Name: '{data["Prospect Name"]}',
            Company: '{data["Prospect Company"]}',
            `Is there a budget planned for the next four quarters?`: '{data[question_columns[0]]}',
            `Would this be categorized as Opex or Capex?`: '{data[question_columns[1]]}',
            `Do you have a general idea of the expected spend range?`: '{data[question_columns[2]]}',
            `What factors are considered when determining this spend range?`: '{data[question_columns[3]]}',
            `What level of access or visibility might be available to us?`: '{data[question_columns[4]]}',
            `Who would typically be involved in making the final decision?`: '{data[question_columns[5]]}',
            `What's their role or designation?`: '{data[question_columns[6]]}',
            `Would it be convenient to meet in the office for a one-on-one discussion?`: '{data[question_columns[7]]}',
            `Would you be open to meeting in a different location if that works better?`: '{data[question_columns[8]]}',
            `Could this project contribute to career growth for the buyer?`: '{data[question_columns[9]]}'
        }})
        """
        score = score_prospect(llm, temp_cypher)

        # Final query with score
        cypher_query = f"""
        CREATE (p:Prospect {{
            Name: '{data["Prospect Name"]}',
            Company: '{data["Prospect Company"]}',
            `Is there a budget planned for the next four quarters?`: '{data[question_columns[0]]}',
            `Would this be categorized as Opex or Capex?`: '{data[question_columns[1]]}',
            `Do you have a general idea of the expected spend range?`: '{data[question_columns[2]]}',
            `What factors are considered when determining this spend range?`: '{data[question_columns[3]]}',
            `What level of access or visibility might be available to us?`: '{data[question_columns[4]]}',
            `Who would typically be involved in making the final decision?`: '{data[question_columns[5]]}',
            `What's their role or designation?`: '{data[question_columns[6]]}',
            `Would it be convenient to meet in the office for a one-on-one discussion?`: '{data[question_columns[7]]}',
            `Would you be open to meeting in a different location if that works better?`: '{data[question_columns[8]]}',
            `Could this project contribute to career growth for the buyer?`: '{data[question_columns[9]]}',
            `Prospect_Score`: '{score}'
        }})
        """
        query(driver, cypher_query)
        added_count += 1

    return {"message": f"{added_count} new prospects added."}


# ---------------------------------------------------------------------------
# Route-logic functions
# ---------------------------------------------------------------------------

def upload_file_text(graph, llm_transformer, file_path: str, filename: str) -> dict:
    """Process a file (already written to disk) into the Neo4j graph."""
    grapher(graph, llm_transformer, file_path)
    return {"message": f"File {filename} processed and graph updated."}


def upload_prospect_list_file(driver, llm, file_path: str) -> dict:
    """Process an uploaded prospect list file."""
    return process_prospect_list(driver, llm, file_path)


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

