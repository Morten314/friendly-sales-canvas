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
