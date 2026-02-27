import json
import shutil
import asyncio
import datetime
import urllib.parse
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException, Body, APIRouter, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo import MongoClient
import boto3
from pinecone import Pinecone
from langchain_pinecone import PineconeVectorStore
from langchain_community.document_loaders import PyPDFLoader, TextLoader, CSVLoader, UnstructuredExcelLoader
from langchain_core.documents import Document
import pandas as pd
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings

from config import origins, STAGE_ORDER, STAGE_MAPPING, s3_bucket, aws_region, aws_access_key, aws_secret_key, pinecone_api_key, together_api_key
from models import (
    ProspectData, Lead, Contact, SalesPipelineResponse, TimeframeResponse, StageStats,
    CompanyProfile, UserProfile, ScoutProfile, MarketRequest, EditRequest,
    CustomerProfileRequest, CustomerProfileICP, LeadCreateRequest, LeadUpdateRequest,
    SignalActionRequest
)
from database import driver, graph, client, upsert_node
from llm_config import chain, chain2, llm2
from langchain_core.messages import HumanMessage
from services import (
    grapher, create_prospect_node, convert_audio_to_text, process_prospect_list,
    ICP_FUNCTIONS, COMPONENT_FUNCTIONS, ICP_generator, SIGNALS_FUNCTIONS,
    search_signals_scout, search_signals_profiler
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload_file/")
async def upload_document(file: UploadFile = File(...)):
    file_path = f"uploaded_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    grapher(file_path)
    return {"message": f"File {file.filename} processed and graph updated."}

@app.post("/create-company/")
async def create_prospect(data: ProspectData):
    if not data.Name or not data.Company or not data.answers:
        raise HTTPException(status_code=400, detail="Missing name, company, or answers")

    try:
        node = create_prospect_node(data.Name, data.Company, data.answers)
        return {"message": "Prospect node created", "node": node}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
@app.get("/ask/")
async def ask_question(question: str):
    response = chain.run(question)
    return {response}

@app.get("/chat/")
async def ask_question(question: str):
    response = chain2.run(question)
    return {"response": response}

@app.get("/query/")
async def run_query(cypher_query: str):
    from database import query
    result = query(cypher_query)
    return {"result": result}

@app.post("/voice_graph/")
async def add_engagement_voice(
    prospect_name: str = Form(...), 
    update_type: str = Form(...),  # Can be note, offline meeting, email, online meeting
    voice_file: UploadFile = File(...)
):
    audio_path = f"temp_{voice_file.filename}"
    
    with open(audio_path, "wb") as buffer:
        shutil.copyfileobj(voice_file.file, buffer)
    
    text = convert_audio_to_text(audio_path)
    
    now_utc = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc)
    import pytz
    ist = pytz.timezone("Asia/Kolkata")
    now_ist = now_utc.astimezone(ist)
    
    newId = int(now_ist.timestamp())
    current_time_str = now_ist.strftime("%Y-%m-%d %H:%M:%S")
    
    # Ensure the prospect node exists
    from database import query
    query(f"MERGE (p:Prospect {{Name: '{prospect_name}'}})")
    
    # Create a generic Engagement node and link it to the prospect
    query(f"""
    CREATE (e:Engagement {{
        text: '{text}', 
        id: {newId}, 
        created_at: '{current_time_str}',
        type: '{update_type}'
    }})
    WITH e
    MATCH (p:Prospect {{Name: '{prospect_name}'}})
    CREATE (p)-[:HAS_ENGAGEMENT]->(e)""")
    
    return {"message": f"Engagement of type '{update_type}' added for {prospect_name}"}

@app.post("/text_graph/")
async def add_engagement_text(
    prospect_name: str = Form(...), 
    update_type: str = Form(...),  # note, offline meeting, email, online meeting
    text: str = Form(...)
):
    now_utc = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc)
    import pytz
    ist = pytz.timezone("Asia/Kolkata")
    now_ist = now_utc.astimezone(ist)

    newId = int(now_ist.timestamp())
    current_time_str = now_ist.strftime("%Y-%m-%d %H:%M:%S")

    # Ensure the prospect node exists
    from database import query
    query(f"MERGE (p:Prospect {{Name: '{prospect_name}'}})")

    # Create Engagement node and link to Prospect
    query(f"""
    CREATE (e:Engagement {{
        text: '{text}', 
        id: {newId}, 
        created_at: '{current_time_str}',
        type: '{update_type}'
    }})
    WITH e
    MATCH (p:Prospect {{Name: '{prospect_name}'}})
    CREATE (p)-[:HAS_ENGAGEMENT]->(e)
    """)

    return {"message": f"Engagement of type '{update_type}' added for {prospect_name}"}
    
@app.post('/upload')
async def upload_prospect_list(file: UploadFile = File(...)):
    file_path = f"/tmp/{file.filename}"
    with open(file_path, 'wb') as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    result = process_prospect_list(file_path)
    return result

@app.get("/leads", response_model=List[Dict[str, Any]])
def get_all_leads(user_id: str = Query(...), org_id: str = Query(...)):
    """
    Get all leads filtered by user_id and org_id (multitenant).
    Returns all lead properties directly - completely flexible like company profile.
    Uses parameterized queries for security.
    """
    try:
        # Use parameterized query for security with multitenancy
        query_string = """
        MATCH (l:Lead)
        WHERE l.user_id = $user_id AND l.org_id = $org_id
        RETURN l
        """
        
        # Execute query with parameters
        with driver.session() as session:
            results = session.run(query_string, user_id=user_id, org_id=org_id)
            leads = []
            for record in results:
                # Get all properties from the Lead node
                lead_node = record["l"]
                lead_dict = dict(lead_node.items())
                
                # Convert all values to JSON-compatible types
                processed_lead = {}
                for key, value in lead_dict.items():
                    # Try to parse JSON strings back to objects
                    if isinstance(value, str) and value.strip().startswith(('{', '[')):
                        try:
                            processed_lead[key] = json.loads(value)
                        except json.JSONDecodeError:
                            processed_lead[key] = value
                    else:
                        processed_lead[key] = value
                
                leads.append(processed_lead)
        
        return leads
        
    except Exception as e:
        logger.error(f"Error fetching leads: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch leads: {str(e)}")

@app.post("/leads", response_model=Dict[str, Any])
async def add_lead(request: LeadCreateRequest):
    """
    Add a single lead manually with flexible key-value pairs.
    NO REQUIRED FIELDS - all fields are optional.
    Stores all data directly on Lead node - no mapping or extraction.
    Works exactly like company profile endpoint - completely flexible.
    """
    try:
        import uuid
        from datetime import datetime
        
        # Generate unique lead ID
        lead_id = str(uuid.uuid4())
        
        # Prepare lead data - store everything as-is, just add multitenancy fields
        lead_data = request.data.copy()
        lead_data["user_id"] = request.user_id
        lead_data["org_id"] = request.org_id
        lead_data["lead_id"] = lead_id
        lead_data["created_at"] = datetime.utcnow().isoformat()
        
        # Set default stage if not provided
        if "stage" not in lead_data and "status" not in lead_data and "Status" not in lead_data:
            lead_data["stage"] = "Initial Outreach"
        
        # Create Lead node with all data as-is (no extraction, no mapping)
        with driver.session() as session:
            session.execute_write(
                upsert_node,
                "Lead",
                "lead_id",
                lead_id,
                lead_data
            )
        
        return {
            "status": "success",
            "message": "Lead created successfully",
            "lead_id": lead_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating lead: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create lead: {str(e)}")

@app.put("/leads/{lead_id}", response_model=Dict[str, Any])
async def update_lead(lead_id: str, request: LeadUpdateRequest):
    """
    Modify a single lead with flexible key-value pairs.
    Updates lead properties while maintaining multitenancy (user_id and org_id).
    Stores all data directly on Lead node - no mapping or extraction.
    Works exactly like company profile endpoint - completely flexible.
    """
    try:
        from datetime import datetime
        
        with driver.session() as session:
            # Verify lead exists and belongs to user/org
            verify_query = """
                MATCH (l:Lead {lead_id: $lead_id})
                WHERE l.user_id = $user_id AND l.org_id = $org_id
                RETURN l
            """
            result = session.run(verify_query, lead_id=lead_id, user_id=request.user_id, org_id=request.org_id)
            if not result.single():
                raise HTTPException(status_code=404, detail="Lead not found or access denied")
            
            # Prepare update data - store everything as-is
            update_data = request.data.copy()
            update_data["updated_at"] = datetime.utcnow().isoformat()
            
            # Update Lead node with all data directly (no extraction, no mapping)
            session.execute_write(
                upsert_node,
                "Lead",
                "lead_id",
                lead_id,
                update_data
            )
        
        return {
            "status": "success",
            "message": "Lead updated successfully",
            "lead_id": lead_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating lead: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update lead: {str(e)}")

@app.delete("/leads/{lead_id}", response_model=Dict[str, Any])
async def delete_lead(lead_id: str, user_id: str = Query(...), org_id: str = Query(...)):
    """
    Delete a single lead.
    Verifies multitenancy (user_id and org_id) before deletion.
    """
    try:
        with driver.session() as session:
            # Verify lead exists and belongs to user/org
            verify_query = """
                MATCH (l:Lead {lead_id: $lead_id})
                WHERE l.user_id = $user_id AND l.org_id = $org_id
                RETURN l
            """
            result = session.run(verify_query, lead_id=lead_id, user_id=user_id, org_id=org_id)
            if not result.single():
                raise HTTPException(status_code=404, detail="Lead not found or access denied")
            
            # Delete lead and its relationships
            # Note: We keep Company, Contact, and Tech nodes but remove relationships
            delete_query = """
                MATCH (l:Lead {lead_id: $lead_id})
                OPTIONAL MATCH (c:Company)-[r1:Has_Lead]->(l)
                OPTIONAL MATCH (contact:Contact)-[r2:Is_POC_For]->(l)
                OPTIONAL MATCH (l)-[r3]->()
                DELETE r1, r2, r3, l
            """
            session.run(delete_query, lead_id=lead_id)
        
        return {
            "status": "success",
            "message": "Lead deleted successfully",
            "lead_id": lead_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting lead: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete lead: {str(e)}")

@app.post("/leads/batch-upload", response_model=Dict[str, Any])
async def batch_upload_leads(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    org_id: str = Form(...)
):
    """
    Batch upload leads from CSV file.
    Column headings become keys and row values become values.
    NO REQUIRED FIELDS - all fields are optional.
    Stores all data directly on Lead node - no mapping or extraction.
    Works exactly like company profile endpoint - completely flexible.
    """
    try:
        import pandas as pd
        import uuid
        from datetime import datetime
        import tempfile
        import os
        
        # Validate file type
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only CSV files are supported")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)
            tmp_path = tmp_file.name
        
        try:
            # Read CSV file
            df = pd.read_csv(tmp_path)
            
            if df.empty:
                raise HTTPException(status_code=400, detail="CSV file is empty")
            
            # Convert column names to lowercase for consistency (optional)
            df.columns = df.columns.str.strip()
            
            # Process each row
            created_count = 0
            error_count = 0
            errors = []
            
            for index, row in df.iterrows():
                try:
                    # Convert row to dictionary (column headings become keys)
                    lead_data = row.to_dict()
                    
                    # Remove NaN values
                    lead_data = {k: v for k, v in lead_data.items() if pd.notna(v)}
                    
                    # Generate unique lead ID
                    lead_id = str(uuid.uuid4())
                    
                    # Add multitenancy fields
                    lead_data["user_id"] = user_id
                    lead_data["org_id"] = org_id
                    lead_data["lead_id"] = lead_id
                    lead_data["created_at"] = datetime.utcnow().isoformat()
                    
                    # Set default stage if not provided
                    if "stage" not in lead_data and "status" not in lead_data and "Status" not in lead_data:
                        lead_data["stage"] = "Initial Outreach"
                    
                    # Convert all values to strings for Neo4j compatibility (except dict/list)
                    lead_data = {k: str(v) if not isinstance(v, (dict, list)) else v for k, v in lead_data.items()}
                    
                    # Create Lead node with all data as-is (no extraction, no mapping)
                    with driver.session() as session:
                        session.execute_write(
                            upsert_node,
                            "Lead",
                            "lead_id",
                            lead_id,
                            lead_data
                        )
                    
                    created_count += 1
                    
                except Exception as e:
                    error_count += 1
                    errors.append(f"Row {index + 1}: {str(e)}")
                    logger.error(f"Error processing row {index + 1}: {str(e)}")
                    continue
            
            return {
                "status": "success",
                "message": f"Batch upload completed. {created_count} leads created, {error_count} errors.",
                "created_count": created_count,
                "error_count": error_count,
                "errors": errors[:10] if errors else []  # Limit errors to first 10
            }
            
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process CSV file: {str(e)}")

@app.get("/Sales_Pipeline")
def get_sales_pipeline(user_id: str = Query(...), timeframe: int = Query(...)):
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=timeframe)

    query_string = """
    MATCH (l:Lead)
    WHERE l.last_stage_update_date >= $start_date AND l.last_stage_update_date <= $end_date
    RETURN l.stage AS stage, count(*) AS count
    """

    with driver.session() as session:
        results = session.run(query_string, {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        })

        # Count occurrences per mapped UI stage
        ui_stage_counts: Dict[str, int] = {stage: 0 for stage in STAGE_ORDER}

        for record in results:
            neo4j_stage = record["stage"]
            count = record["count"]
            mapped_stage = STAGE_MAPPING.get(neo4j_stage)
            if mapped_stage in ui_stage_counts:
                ui_stage_counts[mapped_stage] += count

        # Build ordered stage data and calculate conversion rates
        ordered_counts = [ui_stage_counts[stage] for stage in STAGE_ORDER]

        stages = []
        for i, stage in enumerate(STAGE_ORDER):
            count = ordered_counts[i]
            if i == 0:
                conversion = 1.0
            else:
                prev = ordered_counts[i - 1]
                conversion = round(count / prev, 2) if prev > 0 else 0.0

            stages.append({
                "name": stage,
                "count": count,
                "conversionRate": conversion
            })

        return {
            "timeframes": [
                {
                    "days": timeframe,
                    "stages": stages
                }
            ]
        }

@app.post("/profile/{profile_type}")
async def create_or_update_profile(
    profile_type: str,
    payload: dict = Body(...)
):
    """
    Flexible profile endpoint that accepts any JSON structure.
    Only checks for 'profile_type' key to determine node type.
    All other fields are stored as-is in Neo4j.
    """
    try:
        # Check if profile_type is provided in payload (optional, can use path param)
        if "profile_type" in payload:
            profile_type = payload["profile_type"]
        
        # Extract user_id if present (for multitenancy)
        # user_id is optional for company profiles (shared profile)
        user_id = payload.get("user_id")
        if profile_type != "company" and not user_id:
            raise HTTPException(status_code=400, detail="user_id is required in payload")
        
        # Extract org_id for company profiles (required for multi-org support)
        org_id = payload.get("org_id")
        if profile_type == "company" and not org_id:
            raise HTTPException(status_code=400, detail="org_id is required for company profiles")
        
        # Prepare data - convert all values to Neo4j-compatible types
        data = {}
        for key, value in payload.items():
            # Skip profile_type as it's used for node label
            if key == "profile_type":
                continue
            # Skip user_id for company profiles (shared profile, no multitenancy)
            if key == "user_id" and profile_type == "company":
                continue
            
            # Handle different value types
            if isinstance(value, (dict, list)):
                # Convert complex types to JSON string
                data[key] = json.dumps(value)
            elif isinstance(value, (str, int, float, bool)):
                # Direct assignment for primitive types
                data[key] = value
            elif value is None:
                # Skip None values
                continue
            else:
                # Convert everything else to string
                data[key] = str(value)
        
        with driver.session() as session:
            # Map profile_type to Neo4j label (handle case differences)
            neo4j_label = profile_type
            if profile_type == "company":
                neo4j_label = "CompanyProfile"
            
            # Determine unique identifier field based on profile_type
            if profile_type == "company":
                # For company profile, use org_id for multi-org support
                match_field = "org_id"
                match_value = org_id
                # Delete existing company profile for this org_id only
                session.run(
                    "MATCH (p:CompanyProfile {org_id: $org_id}) DELETE p",
                    org_id=org_id
                )
            elif profile_type == "user":
                match_field = "name"
                match_value = payload.get("name") or payload.get("user_id")
                # Delete existing profile for this user_id (multitenancy)
                session.run(
                    f"MATCH (p:{neo4j_label} {{user_id: $user_id}}) DELETE p",
                    user_id=user_id
                )
            elif profile_type == "agent_name":
                match_field = "agentName"
                match_value = payload.get("agentName") or "Scout"
                # Delete existing profile for this user_id (multitenancy)
                session.run(
                    f"MATCH (p:{neo4j_label} {{user_id: $user_id}}) DELETE p",
                    user_id=user_id
                )
            else:
                # For any other profile_type, use user_id as match field
                match_field = "user_id"
                match_value = user_id
                # Delete existing profile for this user_id (multitenancy)
                session.run(
                    f"MATCH (p:{neo4j_label} {{user_id: $user_id}}) DELETE p",
                    user_id=user_id
                )
            
            # Insert/update the profile (Neo4j v5+)
            session.execute_write(
                upsert_node,
                neo4j_label,
                match_field,
                match_value,
                data
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": f"{profile_type} profile processed successfully"}

@app.get("/profile/{profile_type}")
async def get_single_profile(
    profile_type: str,
    user_id: str = Query(None),
    org_id: str = Query(None)
):
    """
    Flexible profile fetch endpoint that returns any JSON structure.
    Filters by user_id for multitenancy (except for company profiles which are filtered by org_id).
    For company profiles, also includes customer profiles from MongoDB.
    """
    try:
        with driver.session() as session:
            # For company profiles, filter by org_id (required for multi-org support)
            if profile_type == "company":
                if not org_id:
                    raise HTTPException(
                        status_code=400,
                        detail="org_id is required for company profiles"
                    )
                neo4j_label = "CompanyProfile"
                query_string = f"MATCH (p:{neo4j_label} {{org_id: $org_id}}) RETURN p LIMIT 1"
                result = session.run(query_string, org_id=org_id)
            else:
                # For other profiles, user_id is required
                if not user_id:
                    raise HTTPException(
                        status_code=400,
                        detail="user_id is required for non-company profiles"
                    )
                # Query by profile_type and user_id (multitenancy)
                query_string = f"MATCH (p:{profile_type} {{user_id: $user_id}}) RETURN p LIMIT 1"
                result = session.run(query_string, user_id=user_id)
            
            record = result.single()

            if not record:
                if profile_type == "company":
                    raise HTTPException(
                        status_code=404,
                        detail="No company profile found"
                    )
                else:
                    raise HTTPException(
                        status_code=404, 
                        detail=f"No {profile_type} profile found for user_id: {user_id}"
                    )

            profile_data = dict(record.values()[0])

            # Try to parse JSON strings back to objects (flexible handling)
            for key, value in profile_data.items():
                if isinstance(value, str):
                    # Try to parse as JSON if it looks like JSON
                    if value.strip().startswith(('{', '[')):
                        try:
                            profile_data[key] = json.loads(value)
                        except json.JSONDecodeError:
                            pass  # Keep as string if not valid JSON

            # For company profiles, also fetch customer profiles from MongoDB
            if profile_type == "company":
                try:
                    # MongoDB connection
                    username = urllib.parse.quote_plus("techbrewra")
                    password = urllib.parse.quote_plus("Brewra@Best09")
                    mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
                    mongo_client = MongoClient(mongo_uri)
                    db = mongo_client["Profiler"]
                    collection = db["Company_Profile"]
                    
                    # Find the company profile document with customer profiles (filter by org_id)
                    filter_query = {"profile_type": "company", "org_id": org_id}
                    document = collection.find_one(filter_query)
                    
                    mongo_client.close()
                    
                    if document:
                        customer_profiles = document.get("customer_profiles", {})
                        icps = customer_profiles.get("icps", [])
                        # Remove MongoDB _id if present in ICPs
                        for icp in icps:
                            if "_id" in icp:
                                del icp["_id"]
                        profile_data["customer_profiles"] = {"icps": icps}
                    else:
                        profile_data["customer_profiles"] = {"icps": []}
                except Exception as e:
                    # If MongoDB fetch fails, just add empty customer profiles
                    profile_data["customer_profiles"] = {"icps": []}

            return profile_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cleanup-company-profiles")
async def cleanup_company_profiles():
    """
    Ensure only one CompanyProfile exists in Neo4j.
    Keeps the first one found and deletes all others.
    """
    try:
        with driver.session() as session:
            # Get all company profiles
            result = session.run("MATCH (c:CompanyProfile) RETURN c, id(c) as node_id ORDER BY id(c)")
            records = list(result)
            
            if len(records) == 0:
                return {"message": "No company profiles found", "deleted": 0, "remaining": 0}
            
            if len(records) == 1:
                return {"message": "Only one company profile exists", "deleted": 0, "remaining": 1}
            
            # Keep the first one (oldest by node ID)
            first_node_id = records[0]["node_id"]
            
            # Delete all others
            delete_result = session.run(
                "MATCH (c:CompanyProfile) WHERE id(c) <> $keep_id DELETE c RETURN count(c) as deleted",
                keep_id=first_node_id
            )
            deleted_count = delete_result.single()["deleted"]
            
            return {
                "message": f"Cleanup completed. Kept 1 profile, deleted {deleted_count} duplicate(s).",
                "deleted": deleted_count,
                "remaining": 1
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/market-research")
async def market_research(request: MarketRequest):
    component_name = request.component_name.strip().lower()

    # Lookup function
    research_function = COMPONENT_FUNCTIONS.get(component_name)
    if not research_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported component_name: {request.component_name}"
        )

    # MongoDB (pymongo client)
    db = client["Scout_Agent"]
    collection = db["Market_Intelligence"]

    # Filter by user_id only for multitenancy
    query = {
        "user_id": request.user_id,
        "component_name": component_name
    }

    # If refresh is False, fetch the latest report
    if not request.refresh:
        latest_report = await asyncio.to_thread(
            collection.find_one, query, sort=[("timestamp", -1)]
        )
        if latest_report:
            latest_report.pop("_id", None)
            return {"status": "success", "data": latest_report}

    # --- Neo4j query inside a thread - get company profile by org_id ---
    def fetch_company_profile():
        with driver.session() as session:
            # Get the company profile filtered by org_id (if provided)
            if request.org_id:
                result = session.run(
                    "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                    org_id=request.org_id
                )
            else:
                # Fallback: get any company profile (backward compatibility)
                result = session.run(
                    "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
                )
            record = result.single()
            return record

    record = await asyncio.to_thread(fetch_company_profile)
    if not record:
        org_msg = f" for org_id: {request.org_id}" if request.org_id else ""
        raise HTTPException(status_code=404, detail=f"No company profile found in Neo4j{org_msg}")

    company_profile = dict(record.values()[0])
    if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
        try:
            company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
        except json.JSONDecodeError:
            pass

    # --- Run research with retries (max 2 attempts) ---
    max_retries = 2
    for attempt in range(1, max_retries + 1):
        try:
            research_result = await asyncio.to_thread(research_function, company_profile)
            break
        except Exception as e:
            if attempt == max_retries:
                raise HTTPException(
                    status_code=500,
                    detail=f"Research function failed after {max_retries} attempts: {str(e)}"
                )
            await asyncio.sleep(1)  # retry delay

    # Ensure research_result is a dict and add user_id and metadata
    if not isinstance(research_result, dict):
        research_result = {"data": research_result}
    
    # Explicitly set user_id, component_name, and timestamp (multitenancy)
    research_result["user_id"] = request.user_id
    if request.org_id:
        research_result["org_id"] = request.org_id
    research_result["component_name"] = component_name
    research_result["timestamp"] = datetime.utcnow()

    # Save to DB (pymongo → wrap in to_thread)
    await asyncio.to_thread(collection.insert_one, research_result)

    research_result.pop("_id", None)
    return {"status": "success", "data": research_result}

@app.get("/icp")
async def get_or_create_icp_config(user_id: str = Query(...), refresh: bool = Query(False)):
    print(f"[ICP] Request - user_id: {user_id}, refresh: {refresh}")
    try:
        # MongoDB connection setup
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        client = MongoClient(mongo_uri)

        db = client["Profiler"]
        collection = db["ICP_config"]

        # Filter by user_id only for multitenancy
        existing_icp = collection.find_one({"user_id": user_id})
        
        if existing_icp:
            print(f"[ICP] Found existing ICP for user_id: {user_id}")
            if existing_icp.get("icps"):
                icps_data = existing_icp.get("icps")
                if isinstance(icps_data, dict) and "suggestedICPs" in icps_data:
                    print(f"[ICP] Existing ICP count: {len(icps_data.get('suggestedICPs', []))}")
                elif isinstance(icps_data, list):
                    print(f"[ICP] Existing ICP count (list): {len(icps_data)}")
        else:
            print(f"[ICP] No existing ICP found for user_id: {user_id}")

        if existing_icp and not refresh:
            print(f"[ICP] Returning cached ICP for user_id: {user_id}")
            client.close()
            return existing_icp.get("icps", {"icps": []})

        print(f"[ICP] Generating new ICPs for user_id: {user_id}")

        # Generate new ICPs from Neo4j company profile - get shared company profile
        with driver.session() as session:
            result = session.run(
                "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
            )
            record = result.single()
            
            if not record:
                print(f"[ICP] ERROR: No company profile in Neo4j")
                client.close()
                raise HTTPException(status_code=404, detail="No company profile found in Neo4j")

            company_profile = dict(record.values()[0])
            print(f"[ICP] Company profile retrieved from Neo4j")

            # Convert JSON string if needed
            if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
                try:
                    company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
                except json.JSONDecodeError:
                    pass

            # Generate ICPs
            print(f"[ICP] Calling ICP_generator() for user_id: {user_id}")
            try:
                icp_result = ICP_generator(company_profile)
                if isinstance(icp_result, dict) and "suggestedICPs" in icp_result:
                    print(f"[ICP] Generated {len(icp_result.get('suggestedICPs', []))} ICPs for user_id: {user_id}")
                else:
                    print(f"[ICP] ICP_generator returned: {type(icp_result)}")
            except Exception as gen_error:
                print(f"[ICP] ERROR in ICP_generator: {str(gen_error)}")
                client.close()
                raise HTTPException(status_code=500, detail=f"ICP generation failed: {str(gen_error)}")

            # Upsert the result in MongoDB - filter by user_id only
            print(f"[ICP] Saving to MongoDB for user_id: {user_id}")
            try:
                update_result = collection.update_one(
                    {"user_id": user_id},
                    {"$set": {"user_id": user_id, "icps": icp_result}},
                    upsert=True
                )
                print(f"[ICP] Saved to MongoDB - matched: {update_result.matched_count}, modified: {update_result.modified_count}")
            except Exception as save_error:
                print(f"[ICP] ERROR saving to MongoDB: {str(save_error)}")
                client.close()
                raise HTTPException(status_code=500, detail=f"Failed to save ICP: {str(save_error)}")

            client.close()
            print(f"[ICP] Successfully returned ICPs for user_id: {user_id}")
            return icp_result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ICP] ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.post("/icp-research")
async def icp_research(request: MarketRequest):
    component_name = request.component_name.strip().lower()

    # Lookup the function for the given component
    research_function = ICP_FUNCTIONS.get(component_name)
    if not research_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported component_name: {request.component_name}"
        )

    # MongoDB connection
    username = urllib.parse.quote_plus("techbrewra")
    password = urllib.parse.quote_plus("Brewra@Best09")
    mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
    client = MongoClient(mongo_uri)
    db = client["Profiler"]
    collection = db["ICPs"]

    try:
        # Filter by user_id only for multitenancy
        query = {
            "user_id": request.user_id,
            "component_name": component_name
        }

        # If refresh is False, fetch the latest report
        if not request.refresh:
            latest_report = await asyncio.to_thread(
                collection.find_one, query, sort=[("timestamp", -1)]
            )
            if latest_report:
                latest_report.pop("_id", None)
                return {"status": "success", "data": latest_report}

        # --- Neo4j query inside a thread - get company profile by org_id ---
        def fetch_company_profile():
            with driver.session() as session:
                # Get the company profile filtered by org_id (if provided)
                if request.org_id:
                    result = session.run(
                        "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                        org_id=request.org_id
                    )
                else:
                    # Fallback: get any company profile (backward compatibility)
                    result = session.run(
                        "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
                    )
                record = result.single()
                return record

        record = await asyncio.to_thread(fetch_company_profile)
        if not record:
            org_msg = f" for org_id: {request.org_id}" if request.org_id else ""
            raise HTTPException(status_code=404, detail=f"No company profile found in Neo4j{org_msg}")

        company_profile = dict(record.values()[0])
        if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
            try:
                company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
            except json.JSONDecodeError:
                pass

        # --- Get ICP card/data from request body (flexible data field) ---
        # Prepare combined context data with company profile and ICP card from request
        context_data = {
            "company_profile": company_profile
        }
        
        # Add ICP card data from request body if available
        if request.data:
            # The request.data is flexible and should contain ICP card data
            context_data["icp_card"] = request.data
        
        # Convert to JSON string for the research function
        context_json = json.dumps(context_data)

        # --- Run research with retries (max 2 attempts) ---
        max_retries = 2
        for attempt in range(1, max_retries + 1):
            try:
                research_result = await asyncio.to_thread(research_function, context_json)
                break
            except Exception as e:
                if attempt == max_retries:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Research function failed after {max_retries} attempts: {str(e)}"
                    )
                await asyncio.sleep(1)  # retry delay

        # Add metadata - filter by user_id only
        research_result.update({
            "user_id": request.user_id,
            "component_name": component_name,
            "timestamp": datetime.utcnow()
        })
        if request.org_id:
            research_result["org_id"] = request.org_id

        # Save to DB
        await asyncio.to_thread(collection.insert_one, research_result)

        research_result.pop("_id", None)
        return {"status": "success", "data": research_result}

    finally:
        client.close()

async def check_headline_duplicate(new_headline: str, existing_headlines: list) -> bool:
    """
    Use AI to check if new headline is similar to any existing headlines.
    Returns True if duplicate/similar, False if unique.
    """
    if not existing_headlines or not new_headline:
        return False
    
    # Create prompt for AI comparison
    headlines_list = "\n".join([f"- {h}" for h in existing_headlines[:20]])  # Limit to 20 for prompt size
    prompt = f"""Compare this new headline with the existing headlines below. Determine if the new headline is about the same news/story/signal as any of the existing ones.

Existing headlines:
{headlines_list}

New headline: "{new_headline}"

Are they about the same news/story/signal? Consider:
- Same event, company, or development
- Same market trend or opportunity
- Same industry development
- Even if worded differently, if it's the same underlying story, it's a duplicate

Respond with ONLY "YES" if it's a duplicate/similar, or "NO" if it's unique and different. No other text."""

    try:
        message = HumanMessage(content=prompt)
        response = await asyncio.to_thread(llm2.invoke, [message])
        result = response.content.strip().upper()
        return result.startswith("YES")
    except Exception as e:
        logger.error(f"Error checking headline duplicate: {e}")
        # If AI check fails, fall back to basic string similarity
        new_lower = new_headline.lower()
        for existing in existing_headlines:
            if existing and new_lower in existing.lower() or existing.lower() in new_lower:
                return True
        return False

@app.post("/signals-research")
async def signals_research(request: MarketRequest):
    """Research web signals for specific agents (scout/profiler)"""
    agent_name = request.component_name.strip().lower()

    # Lookup the function for the given agent
    signals_function = SIGNALS_FUNCTIONS.get(agent_name)
    if not signals_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported agent: {request.component_name}. Supported agents: scout, profiler"
        )

    # MongoDB connection for Signals DB
    username = urllib.parse.quote_plus("techbrewra")
    password = urllib.parse.quote_plus("Brewra@Best09")
    mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
    client = MongoClient(mongo_uri)
    db = client["Signals"]
    collection = db["signals"]

    try:
        # Filter by user_id only for multitenancy
        query = {
            "user_id": request.user_id,
            "agent": agent_name
        }

        # If refresh is False, fetch the latest signal
        if not request.refresh:
            latest_signal = await asyncio.to_thread(
                collection.find_one, query, sort=[("timestamp", -1)]
            )
            if latest_signal:
                latest_signal.pop("_id", None)
                return {"status": "success", "data": latest_signal}

        # Prepare data for the signals function
        pre_data = request.data
        
        # For profiler agent, also include ICP data if available - filter by user_id
        if agent_name == "profiler":
            # Try to get ICP data from Profiler database
            try:
                profiler_client = MongoClient(mongo_uri)
                profiler_db = profiler_client["Profiler"]
                icp_collection = profiler_db["ICP_config"]
                icp_data = icp_collection.find_one({"user_id": request.user_id})
                if icp_data:
                    pre_data = {
                        "company_profile": request.data,
                        "icp_data": icp_data.get("icps", {})
                    }
                profiler_client.close()
            except Exception as e:
                print(f"Warning: Could not fetch ICP data: {e}")

        # Run signals research with retries (max 2 attempts)
        max_retries = 2
        for attempt in range(1, max_retries + 1):
            try:
                signals_result = await asyncio.to_thread(signals_function, pre_data)
                break
            except Exception as e:
                if attempt == max_retries:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Signals research failed after {max_retries} attempts: {str(e)}"
                    )
                await asyncio.sleep(1)  # retry delay

        # Generate unique ID for signal
        signal_id = str(uuid.uuid4())
        
        # Add metadata - filter by user_id only
        signals_result.update({
            "id": signal_id,
            "signal_id": signal_id,  # Ensure signal_id is also present
            "user_id": request.user_id,
            "agent": agent_name,
            "timestamp": datetime.utcnow()
        })
        if request.org_id:
            signals_result["org_id"] = request.org_id

        # Check for duplicate signal by headline similarity (if org_id and headline exist)
        if request.org_id and signals_result.get("headline"):
            # Fetch existing headlines for this org_id and agent
            def fetch_existing_headlines():
                cursor = collection.find(
                    {
                        "org_id": request.org_id,
                        "agent": agent_name,
                        "headline": {"$exists": True, "$ne": ""}
                    },
                    {"headline": 1}
                ).limit(50)  # Limit to last 50 signals for performance
                return [s.get("headline", "") for s in cursor if s.get("headline")]
            
            existing_headlines = await asyncio.to_thread(fetch_existing_headlines)
            
            if existing_headlines:
                is_duplicate = await check_headline_duplicate(
                    signals_result.get("headline", ""),
                    existing_headlines
                )
                if is_duplicate:
                    # Signal already exists, skip saving
                    signals_result.pop("_id", None)
                    return {
                        "status": "duplicate",
                        "message": "Signal with similar headline already exists",
                        "data": signals_result
                    }

        # Save to Signals DB
        await asyncio.to_thread(collection.insert_one, signals_result)

        signals_result.pop("_id", None)
        return {"status": "success", "data": signals_result}

    finally:
        client.close()

@app.post("/generate-signals-batch")
async def generate_signals_batch(request: MarketRequest):
    """Generate 2 signals for scout and 2 signals for profiler"""
    try:
        # MongoDB connection for Signals DB
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        client = MongoClient(mongo_uri)
        db = client["Signals"]
        collection = db["signals"]

        # Prepare data for the signals functions
        pre_data = request.data
        
        # For profiler agent, also include ICP data if available - filter by user_id
        profiler_pre_data = pre_data
        try:
            profiler_client = MongoClient(mongo_uri)
            profiler_db = profiler_client["Profiler"]
            icp_collection = profiler_db["ICP_config"]
            icp_data = icp_collection.find_one({"user_id": request.user_id})
            if icp_data:
                profiler_pre_data = {
                    "company_profile": request.data,
                    "icp_data": icp_data.get("icps", {})
                }
            profiler_client.close()
        except Exception as e:
            print(f"Warning: Could not fetch ICP data: {e}")

        generated_signals = []
        batch_id = f"batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        # Generate 2 signals for scout
        for i in range(2):
            try:
                print(f"Generating scout signal {i+1}...")
                signals_result = await asyncio.to_thread(search_signals_scout, pre_data)
                signal_id = str(uuid.uuid4())
                signals_result.update({
                    "id": signal_id,
                    "signal_id": signal_id,  # Ensure signal_id is also present
                    "user_id": request.user_id,
                    "agent": "scout",
                    "timestamp": datetime.utcnow(),
                    "batch_id": batch_id
                })
                if request.org_id:
                    signals_result["org_id"] = request.org_id
                
                # Check for duplicate signal by headline similarity (if org_id and headline exist)
                if request.org_id and signals_result.get("headline"):
                    # Fetch existing headlines for this org_id and agent
                    def fetch_existing_headlines():
                        cursor = collection.find(
                            {
                                "org_id": request.org_id,
                                "agent": "scout",
                                "headline": {"$exists": True, "$ne": ""}
                            },
                            {"headline": 1}
                        ).limit(50)  # Limit to last 50 signals for performance
                        return [s.get("headline", "") for s in cursor if s.get("headline")]
                    
                    existing_headlines = await asyncio.to_thread(fetch_existing_headlines)
                    
                    if existing_headlines:
                        is_duplicate = await check_headline_duplicate(
                            signals_result.get("headline", ""),
                            existing_headlines
                        )
                        if is_duplicate:
                            print(f"Skipping duplicate scout signal {i+1} (similar headline already exists)")
                            continue  # Skip this signal and continue to next
                
                # Save to Signals DB
                await asyncio.to_thread(collection.insert_one, signals_result)
                signals_result.pop("_id", None)
                generated_signals.append(signals_result)
                print(f"Successfully generated scout signal {i+1}")
                
            except Exception as e:
                print(f"Error generating scout signal {i+1}: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate scout signal {i+1}: {str(e)}"
                )
        
        # Generate 2 signals for profiler
        for i in range(2):
            try:
                print(f"Generating profiler signal {i+1}...")
                signals_result = await asyncio.to_thread(search_signals_profiler, profiler_pre_data)
                signal_id = str(uuid.uuid4())
                signals_result.update({
                    "id": signal_id,
                    "signal_id": signal_id,  # Ensure signal_id is also present
                    "user_id": request.user_id,
                    "agent": "profiler",
                    "timestamp": datetime.utcnow(),
                    "batch_id": batch_id
                })
                if request.org_id:
                    signals_result["org_id"] = request.org_id
                
                # Check for duplicate signal by headline similarity (if org_id and headline exist)
                if request.org_id and signals_result.get("headline"):
                    # Fetch existing headlines for this org_id and agent
                    def fetch_existing_headlines():
                        cursor = collection.find(
                            {
                                "org_id": request.org_id,
                                "agent": "profiler",
                                "headline": {"$exists": True, "$ne": ""}
                            },
                            {"headline": 1}
                        ).limit(50)  # Limit to last 50 signals for performance
                        return [s.get("headline", "") for s in cursor if s.get("headline")]
                    
                    existing_headlines = await asyncio.to_thread(fetch_existing_headlines)
                    
                    if existing_headlines:
                        is_duplicate = await check_headline_duplicate(
                            signals_result.get("headline", ""),
                            existing_headlines
                        )
                        if is_duplicate:
                            print(f"Skipping duplicate profiler signal {i+1} (similar headline already exists)")
                            continue  # Skip this signal and continue to next
                
                # Save to Signals DB
                await asyncio.to_thread(collection.insert_one, signals_result)
                signals_result.pop("_id", None)
                generated_signals.append(signals_result)
                print(f"Successfully generated profiler signal {i+1}")
                
            except Exception as e:
                print(f"Error generating profiler signal {i+1}: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate profiler signal {i+1}: {str(e)}"
                )

        return {
            "status": "success", 
            "message": f"Generated {len(generated_signals)} signals",
            "data": generated_signals
        }

    finally:
        client.close()

@app.get("/test-llm")
async def test_llm():
    """Test if LLM is working"""
    try:
        from llm_config import llm2
        from langchain_core.messages import HumanMessage
        
        test_prompt = "Generate a simple JSON: {\"test\": \"hello\"}"
        messages = [HumanMessage(content=test_prompt)]
        response = llm2.invoke(messages)
        return {"status": "success", "response": str(response.content)}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/fetch-signals")
async def fetch_signals(user_id: str = Query(...), limit: int = Query(10)):
    """Fetch signals and return them in a simple list format - filtered by user_id only"""
    try:
        # MongoDB connection for Signals DB
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        client = MongoClient(mongo_uri)
        db = client["Signals"]
        collection = db["signals"]

        # Fetch signals for the user only (multitenancy), ordered by timestamp (newest first)
        signals_cursor = collection.find(
            {"user_id": user_id}
        ).sort("timestamp", -1).limit(limit)
        
        signals_list = []
        for signal in signals_cursor:
            # Remove MongoDB _id and format for simple list
            signal.pop("_id", None)
            # Ensure signal_id is present (use "id" if signal_id doesn't exist)
            if "signal_id" not in signal and "id" in signal:
                signal["signal_id"] = signal["id"]
            elif "id" not in signal and "signal_id" in signal:
                signal["id"] = signal["signal_id"]
            signals_list.append(signal)

        return {
            "status": "success",
            "count": len(signals_list),
            "signals": signals_list
        }

    finally:
        client.close()

@app.post("/signal_action")
async def signal_action(request: SignalActionRequest):
    """
    Accept or reject a signal.
    - If action is "accept": Keep the signal under the org_id (ensure org_id is set)
    - If action is "reject": Delete the signal
    """
    try:
        # MongoDB connection for Signals DB
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        client = MongoClient(mongo_uri)
        db = client["Signals"]
        collection = db["signals"]

        # Find the signal by signal_id (check both "id" and "signal_id" fields)
        signal = collection.find_one({
            "$or": [
                {"id": request.signal_id},
                {"signal_id": request.signal_id}
            ]
        })

        if not signal:
            raise HTTPException(
                status_code=404,
                detail=f"Signal with signal_id {request.signal_id} not found"
            )

        if request.action == "accept":
            # Update the signal to ensure it has the org_id
            update_result = collection.update_one(
                {"_id": signal["_id"]},
                {
                    "$set": {
                        "org_id": request.org_id,
                        "status": "accepted",
                        "actioned_at": datetime.utcnow()
                    }
                }
            )

            if update_result.modified_count > 0:
                return {
                    "status": "success",
                    "message": f"Signal {request.signal_id} accepted and assigned to org {request.org_id}",
                    "signal_id": request.signal_id,
                    "org_id": request.org_id,
                    "action": "accept"
                }
            else:
                return {
                    "status": "success",
                    "message": f"Signal {request.signal_id} already has org_id {request.org_id}",
                    "signal_id": request.signal_id,
                    "org_id": request.org_id,
                    "action": "accept"
                }

        elif request.action == "reject":
            # Delete the signal
            delete_result = collection.delete_one({"_id": signal["_id"]})

            if delete_result.deleted_count > 0:
                return {
                    "status": "success",
                    "message": f"Signal {request.signal_id} rejected and deleted",
                    "signal_id": request.signal_id,
                    "action": "reject"
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to delete signal"
                )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid action: {request.action}. Must be 'accept' or 'reject'"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing signal action: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process signal action: {str(e)}")
    finally:
        if 'client' in locals():
            client.close()

@app.post("/edit")
def process_edit(request: EditRequest):
    username = urllib.parse.quote_plus("techbrewra")
    password = urllib.parse.quote_plus("Brewra@Best09")
    mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
    client = MongoClient(mongo_uri)
    db = client["Scout_Agent"]
    collection = db["Market_Intelligence"]
    
    try:
        if request.edit_type == "modification":
            # Ensure user_id is in the modified_json before inserting (multitenancy)
            modified_doc = request.modified_json.copy()
            modified_doc["user_id"] = request.user_id
            # Add timestamp to ensure edited components are fetched as most recent
            modified_doc["timestamp"] = datetime.utcnow()
            
            # Insert modified JSON into MongoDB
            insert_result = collection.insert_one(modified_doc)
            return {
                "status": "success",
                "inserted_id": str(insert_result.inserted_id)
            }
        elif request.edit_type == "comment":
            # Placeholder for comment feature
            return {"status": "feature coming soon"}
        else:
            return {"error": "Invalid edit_type. Must be 'comment' or 'modification'."}
    finally:
        client.close()

@app.post("/customer_profile")
async def create_or_update_customer_profile(request: CustomerProfileRequest):
    """
    Create or update customer profiles (ICPs) in MongoDB.
    Customer profiles are stored within the company profile document.
    """
    try:
        # MongoDB connection
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["Profiler"]
        collection = db["Company_Profile"]
        
        # Get company profile from Neo4j to include in MongoDB document (filter by org_id)
        company_profile_data = {}
        with driver.session() as session:
            result = session.run(
                "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                org_id=request.org_id
            )
            record = result.single()
            if record:
                company_profile_data = dict(record.values()[0])
                # Parse JSON strings back to objects
                for key, value in company_profile_data.items():
                    if isinstance(value, str) and value.strip().startswith(('{', '[')):
                        try:
                            company_profile_data[key] = json.loads(value)
                        except json.JSONDecodeError:
                            pass
        
        # Prepare ICPs with IDs and timestamps
        current_time = datetime.now(timezone.utc).isoformat()
        processed_icps = []
        
        for icp in request.icps:
            icp_dict = icp.model_dump(exclude_none=True)
            
            # Generate ID if not provided
            if not icp_dict.get("id"):
                icp_dict["id"] = str(uuid.uuid4())
            
            # Set created_at if not provided
            if not icp_dict.get("created_at"):
                icp_dict["created_at"] = current_time
            
            # Ensure status has default value
            if not icp_dict.get("status"):
                icp_dict["status"] = "saved"
            
            processed_icps.append(icp_dict)
        
        # Upsert the document - store company profile + customer profiles together (filter by org_id)
        filter_query = {"profile_type": "company", "org_id": request.org_id}
        
        update_doc = {
            "$set": {
                "profile_type": "company",
                "org_id": request.org_id,
                "company_profile": company_profile_data,
                "customer_profiles": {
                    "icps": processed_icps
                },
                "updated_at": current_time
            }
        }
        
        collection.update_one(filter_query, update_doc, upsert=True)
        
        mongo_client.close()
        
        return {
            "success": True,
            "message": "Customer profiles saved successfully",
            "data": {
                "icps": processed_icps
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/customer_profile")
async def get_customer_profile(org_id: str = Query(...)):
    """
    Get customer profiles (ICPs) from MongoDB.
    Returns both company profile and associated customer profiles from the same document.
    Filtered by org_id for multi-org support.
    """
    try:
        # MongoDB connection
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["Profiler"]
        collection = db["Company_Profile"]
        
        # Find the company profile document (filter by org_id)
        filter_query = {"profile_type": "company", "org_id": org_id}
        document = collection.find_one(filter_query)
        
        mongo_client.close()
        
        if not document:
            # If no MongoDB document exists, try to get from Neo4j and return empty customer profiles
            with driver.session() as session:
                result = session.run(
                    "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                    org_id=org_id
                )
                record = result.single()
                if not record:
                    raise HTTPException(
                        status_code=404,
                        detail=f"No company profile found for org_id: {org_id}"
                    )
            
            return {
                "success": True,
                "data": {
                    "icps": []
                }
            }
        
        # Extract customer profiles
        customer_profiles = document.get("customer_profiles", {})
        icps = customer_profiles.get("icps", [])
        
        # Remove MongoDB _id if present in ICPs
        for icp in icps:
            if "_id" in icp:
                del icp["_id"]
        
        return {
            "success": True,
            "data": {
                "icps": icps
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ORG MANAGEMENT APIs
# ============================================================================

@app.get("/org")
async def get_org_by_user(user_id: str = Query(...)):
    """
    Get org_id and org_name for a given user_id.
    Fetches from MongoDB users collection (single document) and orgs collection for org_name.
    """
    try:
        # MongoDB connection
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["Org_Management"]
        users_collection = db["users"]
        orgs_collection = db["orgs"]
        
        # Get the single users document
        users_doc = users_collection.find_one({"_id": "users"})
        
        if not users_doc:
            mongo_client.close()
            raise HTTPException(status_code=404, detail="Users document not found")
        
        # Get user_id to org_id mapping
        user_mappings = users_doc.get("user_mappings", {})
        org_id = user_mappings.get(user_id)
        
        if not org_id:
            mongo_client.close()
            raise HTTPException(
                status_code=404,
                detail=f"No org_id found for user_id: {user_id}"
            )
        
        # Get org_name from orgs collection
        org_name = None
        orgs_doc = orgs_collection.find_one({"_id": "orgs"})
        if orgs_doc:
            org_names = orgs_doc.get("org_names", {})
            org_name = org_names.get(org_id)
        
        mongo_client.close()
        
        response = {
            "status": "success",
            "user_id": user_id,
            "org_id": org_id
        }
        if org_name:
            response["org_name"] = org_name
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching org for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch org: {str(e)}")

@app.post("/org")
async def create_org(request: dict = Body(None)):
    """
    Generate a new org_id and save it to MongoDB orgs collection (single document).
    Optionally accepts org_name to link with the org_id.
    Returns the newly created org_id and org_name (if provided).
    """
    try:
        # Extract org_name from request body (optional)
        org_name = None
        if request and "org_name" in request:
            org_name = request.get("org_name")
        
        # Generate new org_id
        new_org_id = str(uuid.uuid4())
        
        # MongoDB connection
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["Org_Management"]
        collection = db["orgs"]
        
        # Get or create the single orgs document
        orgs_doc = collection.find_one({"_id": "orgs"})
        
        if orgs_doc:
            # Add new org_id to existing list
            org_list = orgs_doc.get("org_list", [])
            if new_org_id not in org_list:
                org_list.append(new_org_id)
            
            # Update org_names mapping if org_name is provided
            org_names = orgs_doc.get("org_names", {})
            if org_name:
                org_names[new_org_id] = org_name
            
            collection.update_one(
                {"_id": "orgs"},
                {
                    "$set": {
                        "org_list": org_list,
                        "org_names": org_names,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
        else:
            # Create new document with the org_id
            org_data = {
                "_id": "orgs",
                "org_list": [new_org_id],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            if org_name:
                org_data["org_names"] = {new_org_id: org_name}
            collection.insert_one(org_data)
        
        mongo_client.close()
        
        response = {
            "status": "success",
            "message": "Org created successfully",
            "org_id": new_org_id
        }
        if org_name:
            response["org_name"] = org_name
        
        return response
        
    except Exception as e:
        logger.error(f"Error creating org: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create org: {str(e)}")

@app.post("/connect_org")
async def connect_user_to_org(user_id: str = Body(...), org_id: str = Body(...)):
    """
    Connect a user_id to an org_id.
    Saves the mapping in MongoDB users collection (single document).
    """
    try:
        # MongoDB connection
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["Org_Management"]
        collection = db["users"]
        
        # Get or create the single users document
        users_doc = collection.find_one({"_id": "users"})
        
        if users_doc:
            # Update existing user_mappings
            user_mappings = users_doc.get("user_mappings", {})
            user_mappings[user_id] = org_id
            
            collection.update_one(
                {"_id": "users"},
                {
                    "$set": {
                        "user_mappings": user_mappings,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
        else:
            # Create new document with the mapping
            collection.insert_one({
                "_id": "users",
                "user_mappings": {user_id: org_id},
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
        
        mongo_client.close()
        
        return {
            "status": "success",
            "message": f"User {user_id} connected to org {org_id}",
            "user_id": user_id,
            "org_id": org_id
        }
        
    except Exception as e:
        logger.error(f"Error connecting user to org: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to connect user to org: {str(e)}")

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=aws_access_key,
    aws_secret_access_key=aws_secret_key,
    region_name=aws_region
)

# Initialize Pinecone
pc = Pinecone(api_key=pinecone_api_key)

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
        s3_client.download_file(s3_bucket, file_key, local_file_path)
        
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
            pc.create_index(
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

@app.post("/upload-document")
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
            s3_client.put_object(
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

@app.get("/document-status/{file_key:path}")
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

@app.get("/user-documents")
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

@app.delete("/data-source/{file_id}")
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
                s3_client.delete_object(Bucket=s3_bucket, Key=file_key)
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
                index = pc.Index(index_name)
                
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

@app.put("/data-source/{file_id}")
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
