from neo4j import GraphDatabase
from langchain_community.graphs.neo4j_graph import Neo4jGraph
from pymongo import MongoClient
from config import neo4j_uri, neo4j_username, neo4j_password, mongo_uri

# Connect to Neo4j Database
try:
    driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_username, neo4j_password))
    driver.verify_connectivity()
    print("Connected to Neo4j successfully!")
except Exception as e:
    print("Neo4j Connection failed:", e)

# Initialize Neo4j Graph
graph = Neo4jGraph(url=neo4j_uri, username=neo4j_username, password=neo4j_password)

# MongoDB connection
client = MongoClient(mongo_uri)

# Function to execute a Cypher query
def query(query_string):
    with driver.session() as session:
        results = session.run(query_string).data()
        return results_to_string(results)

# Function to convert query results into a readable string
def results_to_string(results):
    result_strings = [
        ", ".join(f"{key}: {value}" for key, value in result.items())
        for result in results
    ]
    return "\n".join(result_strings)

# Helper function for upsert operations
def upsert_node(tx, label, match_field, match_value, data: dict):
    tx.run(
        f"""
        MERGE (n:{label} {{ {match_field}: $match_value }})
        SET n += $data
        """,
        match_value=match_value,
        data=data
    )
