"""External service clients: Neo4j driver, Mongo client(s), S3 client, Pinecone client.

Phase F (commit 17/17): module-level singletons removed. Construction is now
owned by `app.main.lifespan` via `build_clients()`. Routers/services receive
the bundle via FastAPI `Depends()` providers in `app.core.dependencies`.
The 4 Neo4j query helpers (`query`, `results_to_string`, `escape_property_name`,
`upsert_node`) moved to `app.services._neo4j_helpers`.
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

logger = logging.getLogger(__name__)


@dataclass
class ClientBundle:
    driver: Optional[Any]          # neo4j.GraphDatabase driver — None when BREWRA_SKIP_DB_INIT or connect fails
    graph: Optional[Any]           # Neo4jGraph — None when BREWRA_SKIP_DB_INIT or init fails
    client: Optional[Any]          # MongoClient — None when BREWRA_SKIP_DB_INIT or connect fails
    s3_client: Any                 # boto3 client — always constructed (lazy)
    pc: Any                        # Pinecone — always constructed (lazy)


def build_clients(skip_db_init: Optional[bool] = None) -> ClientBundle:
    """Construct all external clients. Called once at app startup by `lifespan`."""
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
