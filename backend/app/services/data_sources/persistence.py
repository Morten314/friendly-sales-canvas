"""Persistence layer for data_sources/ — Mongo + S3 + Pinecone reads/writes
for user-uploaded data sources.

Functions (per spec §3.5 persistence.py row):
  - get_document_status: read file_status by file_key
  - list_user_documents: paginated list of an org's data sources
  - delete_data_source: coordinated S3 + Pinecone + Mongo delete
  - update_data_source: tags/description CRUD
"""
import json
from typing import Any, Dict, List, Tuple

from app.core.config import s3_bucket
from app.core.exceptions import DocumentNotFoundError, DocumentValidationError
from app.core.logging import logger


async def get_document_status(mongo, file_key: str) -> dict:
    """
    Get the processing status of a document.
    Returns status: processing, completed, or failed
    """
    db = mongo["File_Processing"]
    collection = db["file_status"]

    status_doc = collection.find_one({"file_key": file_key})

    if not status_doc:
        raise DocumentNotFoundError("File not found")

    status_doc.pop("_id", None)
    return {
        "status": "success",
        "data": status_doc
    }


async def list_user_documents(
    mongo,
    org_id: str,
    limit: int = 500,
    offset: int = 0,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Get all data sources (files and URLs) for an organization.
    Returns (file_list, total) where total is the unfiltered count.
    Filtered by org_id for multi-org support.
    """
    db = mongo["File_Processing"]
    collection = db["file_status"]
    flt = {"org_id": org_id}

    files = collection.find(flt).sort("uploaded_at", -1).skip(offset).limit(limit)

    file_list = []
    for file_doc in files:
        file_item = {
            "file_id": file_doc.get("file_id") or file_doc.get("file_key"),
            "file_key": file_doc.get("file_key"),
            "file_name": file_doc.get("file_name"),
            "status": file_doc.get("status", "unknown"),
            "uploaded_at": file_doc.get("uploaded_at"),
            "data_source_type": file_doc.get("data_source_type", "file"),  # "file" or "url"
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

    total = collection.count_documents(flt)
    return file_list, total


async def delete_data_source(mongo, s3, pinecone, file_id: str) -> dict:
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

        db = mongo["File_Processing"]
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
                raise DocumentNotFoundError(f"File with id '{file_id}' not found")

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
                s3.delete_object(Bucket=s3_bucket, Key=file_key)
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
                index = pinecone.Index(index_name)

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

    except Exception as e:
        logger.error(f"Error deleting file {file_id}: {str(e)}")
        raise


async def update_data_source(mongo, file_id: str, request: dict) -> dict:
    """
    Update tags and description for a data source file.
    """
    file_id = file_id.rstrip('/')

    tags = request.get("tags")
    description = request.get("description")

    if tags is None and description is None:
        raise DocumentValidationError("At least one of 'tags' or 'description' must be provided")

    db = mongo["File_Processing"]
    collection = db["file_status"]

    file_doc = collection.find_one({"file_id": file_id})
    if not file_doc:
        file_doc = collection.find_one({"file_key": file_id})
        if not file_doc:
            raise DocumentNotFoundError(f"File with id '{file_id}' not found")

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
            raise DocumentValidationError("tags must be a list or comma-separated string")
        update_doc["tags"] = tags_list

    if description is not None:
        if not isinstance(description, str):
            raise DocumentValidationError("description must be a string")
        update_doc["description"] = description

    collection.update_one(
        {"file_id": file_doc.get("file_id") or file_doc.get("file_key")},
        {"$set": update_doc}
    )

    return {
        "status": "success",
        "message": "Data source updated successfully"
    }
