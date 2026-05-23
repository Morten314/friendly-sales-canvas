"""External service clients: Neo4j driver, Mongo client(s), S3 client, Pinecone client.

Renamed from `app/core/database.py` in Phase B (Task 2) — the file holds
multiple external clients (not just "the database"). After Task 5 (B1),
all 26 inline MongoClient constructions in routers/services are replaced by
importing `client` from this module.

Phase F (commit 1/17) introduces `ClientBundle` + `build_clients()`. The
module-level globals below are routed through the factory to keep a single
construction path. Services not yet converted to dependency injection still
read `clients.driver`, `clients.client`, etc. via these globals; they're
deleted in commit 17 after all services are converted.
"""
import logging
import os
from dataclasses import dataclass
from typing import Any, Optional

import boto3
from neo4j import GraphDatabase
from langchain_community.graphs.neo4j_graph import Neo4jGraph
from pymongo import MongoClient
from pinecone import Pinecone

from app.core.config import (
    neo4j_uri, neo4j_username, neo4j_password, mongo_uri,
    aws_access_key, aws_secret_key, aws_region, pinecone_api_key,
)

# Local logger — uses logging.getLogger(__name__) rather than `app.core.logging.logger`
# to avoid an import-order coupling between this module and the project logger setup.
logger = logging.getLogger(__name__)


@dataclass
class ClientBundle:
    driver: Optional[Any]          # neo4j.GraphDatabase driver — None when BREWRA_SKIP_DB_INIT or connect fails
    graph: Optional[Any]           # Neo4jGraph — None when BREWRA_SKIP_DB_INIT or init fails
    client: Optional[Any]          # MongoClient — None when BREWRA_SKIP_DB_INIT or connect fails
    s3_client: Any                 # boto3 client — always constructed (lazy)
    pc: Any                        # Pinecone — always constructed (lazy)


def build_clients(skip_db_init: Optional[bool] = None) -> ClientBundle:
    """Construct all external clients. Call once at app startup.

    Preserves current code semantics exactly:
    - Neo4j driver / graph / Mongo are gated by `skip_db_init` AND wrapped in
      try/except — matches today's module-level `_SKIP_DB_INIT` + try/except.
    - S3 and Pinecone are constructed UNCONDITIONALLY and NOT wrapped in
      try/except — matches today. Construction is lazy for both (no network
      call), so this is safe in test environments.
    """
    if skip_db_init is None:
        skip_db_init = bool(os.getenv("BREWRA_SKIP_DB_INIT"))

    driver, graph, client = None, None, None

    if not skip_db_init:
        try:
            driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_username, neo4j_password))
            driver.verify_connectivity()
            logger.info("Connected to Neo4j successfully!")
        except Exception as e:
            logger.error("Neo4j Connection failed: %s", e)

        try:
            graph = Neo4jGraph(url=neo4j_uri, username=neo4j_username, password=neo4j_password)
        except Exception as e:
            logger.error("Neo4jGraph init failed: %s", e)

        try:
            client = MongoClient(mongo_uri)
        except Exception as e:
            logger.error("MongoDB Connection failed: %s", e)

    s3_client = boto3.client(
        "s3",
        aws_access_key_id=aws_access_key,
        aws_secret_access_key=aws_secret_key,
        region_name=aws_region,
    )
    pc = Pinecone(api_key=pinecone_api_key)

    return ClientBundle(driver=driver, graph=graph, client=client, s3_client=s3_client, pc=pc)


# Function to execute a Cypher query
#
# Phase F (commit 11/17): `driver` is now an explicit positional argument.
# `params` is a new optional third argument — backwards-compatible because
# `session.run(query_string, params or {})` is semantically identical to
# `session.run(query_string)` when no params are supplied. Phase G will
# parameterize the Cypher-injection-prone callers (spec §2.2 / §8 Phase G #1).
# Commit 17 relocates this function to `app/services/_neo4j_helpers.py`.
def query(driver, query_string, params=None):
    with driver.session() as session:
        results = session.run(query_string, params or {}).data()
        return results_to_string(results)

# Function to convert query results into a readable string
def results_to_string(results):
    result_strings = [
        ", ".join(f"{key}: {value}" for key, value in result.items())
        for result in results
    ]
    return "\n".join(result_strings)

# Helper function to escape Neo4j property names
def escape_property_name(key: str) -> str:
    """
    Escape Neo4j property names that contain spaces or special characters.
    Wraps property names in backticks if they contain spaces, dots, or other special chars.
    """
    # Check if property name needs escaping (contains spaces, dots, or special chars)
    if any(char in key for char in [' ', '.', '-', ':', '/', '\\', '@', '#', '$', '%', '^', '&', '*', '(', ')', '+', '=', '[', ']', '{', '}', '|', ';', "'", '"', '<', '>', ',', '?', '!']):
        return f"`{key}`"
    return key

# Helper function for upsert operations - handles flexible data types
def upsert_node(tx, label, match_field, match_value, data: dict):
    """
    Upsert a node with flexible data types.
    Handles strings, numbers, booleans, lists, and dicts.
    Converts complex types to JSON strings for Neo4j compatibility.
    Escapes property names with spaces or special characters.
    """
    import json

    # Prepare data with type conversion for Neo4j compatibility
    neo4j_data = {}
    for key, value in data.items():
        if isinstance(value, (dict, list)):
            # Convert complex types to JSON string
            neo4j_data[key] = json.dumps(value)
        elif isinstance(value, (str, int, float, bool)):
            # Direct assignment for primitive types
            neo4j_data[key] = value
        elif value is None:
            # Skip None values (Neo4j doesn't handle None well in SET)
            continue
        else:
            # Convert everything else to string
            neo4j_data[key] = str(value)

    # Build dynamic SET clause to handle all properties
    set_clauses = []
    params = {"match_value": match_value}

    for key, value in neo4j_data.items():
        # Escape property name for Neo4j (handles spaces and special chars)
        escaped_key = escape_property_name(key)
        # Create safe parameter name (replace spaces and special chars with underscores)
        # Extract replacement logic outside f-string to avoid backslash issues
        safe_key = key.replace(' ', '_').replace('.', '_').replace('-', '_').replace(':', '_').replace('/', '_').replace('\\', '_').replace('@', '_').replace('#', '_').replace('$', '_').replace('%', '_').replace('^', '_').replace('&', '_').replace('*', '_').replace('(', '_').replace(')', '_').replace('+', '_').replace('=', '_').replace('[', '_').replace(']', '_').replace('{', '_').replace('}', '_').replace('|', '_').replace(';', '_').replace("'", '_').replace('"', '_').replace('<', '_').replace('>', '_').replace(',', '_').replace('?', '_').replace('!', '_')
        param_name = f"param_{safe_key}"
        set_clauses.append(f"n.{escaped_key} = ${param_name}")
        params[param_name] = value

    if set_clauses:
        set_clause = ", ".join(set_clauses)
        # Also escape match_field if needed
        escaped_match_field = escape_property_name(match_field)
        query = f"""
        MERGE (n:{label} {{ {escaped_match_field}: $match_value }})
        SET {set_clause}
        """
        tx.run(query, **params)
    else:
        # If no data to set, just merge the node
        escaped_match_field = escape_property_name(match_field)
        query = f"""
        MERGE (n:{label} {{ {escaped_match_field}: $match_value }})
        """
        tx.run(query, match_value=match_value)


# Module-level globals — routed through the factory. Kept alive through commit
# 15 for backward compatibility with services that haven't been converted to
# dependency injection yet. Commit 17 deletes these along with the `query`,
# `results_to_string`, `escape_property_name`, `upsert_node` helpers above
# (which move to `app/services/_neo4j_helpers.py`).
_bundle = build_clients()
driver = _bundle.driver
graph = _bundle.graph
client = _bundle.client
s3_client = _bundle.s3_client
pc = _bundle.pc
