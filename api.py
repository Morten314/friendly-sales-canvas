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
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings

from config import origins, STAGE_ORDER, STAGE_MAPPING, s3_bucket, aws_region, aws_access_key, aws_secret_key, pinecone_api_key, together_api_key
from models import (
    ProspectData, Lead, Contact, SalesPipelineResponse, TimeframeResponse, StageStats,
    CompanyProfile, UserProfile, ScoutProfile, MarketRequest, EditRequest,
    CustomerProfileRequest, CustomerProfileICP, LeadCreateRequest, LeadUpdateRequest
)
from database import driver, graph, client, upsert_node
from llm_config import chain, chain2
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

@app.get("/leads", response_model=List[Lead])
def get_all_leads(user_id: str = Query(...), org_id: str = Query(...)):
    """
    Get all leads filtered by user_id and org_id (multitenant).
    Returns leads with company, contact, and tech stack information.
    Uses parameterized queries for security.
    """
    # Use parameterized query for security with multitenancy
    query_string = """
    MATCH (l:Lead)
    WHERE l.user_id = $user_id AND l.org_id = $org_id
    OPTIONAL MATCH (c:Company)-[:Has_Lead]->(l)
    OPTIONAL MATCH (c)-[:Uses_Tech]->(t:Tech)
    OPTIONAL MATCH (c)-[:Has_Contact]->(contact:Contact)-[:Is_POC_For]->(l)
    RETURN 
        COALESCE(l.lead_id, toString(id(l))) AS lead_id,
        COALESCE(c.name, '') AS company,
        COALESCE(c.industry, '') AS industry,
        COALESCE(toString(c.size), '') AS size,
        COALESCE(c.region, '') AS region,
        COALESCE(c.location, '') AS location,
        collect(DISTINCT t.name) AS techStack,
        COALESCE(contact.first_name, '') + ' ' + COALESCE(contact.last_name, '') AS contact_name,
        contact.designation AS title,
        contact.department AS department,
        contact.email AS email,
        COALESCE(l.stage, '') AS status,
        l.user_id AS user_id,
        l.org_id AS org_id
    """
    
    # Execute query with parameters
    with driver.session() as session:
        results = session.run(query_string, user_id=user_id, org_id=org_id)
        leads = []
        for record in results:
            lead = Lead(
                lead_id=str(record["lead_id"]),
                company=record.get("company", ""),
                industry=record.get("industry", ""),
                size=record.get("size", ""),
                region=record.get("region", ""),
                location=record.get("location", ""),
                techStack=record.get("techStack", []),
                contact=Contact(
                    name=record.get("contact_name"),
                    title=record.get("title"),
                    department=record.get("department"),
                    email=record.get("email")
                ),
                status=record.get("status", ""),
                user_id=record.get("user_id"),
                org_id=record.get("org_id")
            )
            leads.append(lead)

    return leads

@app.post("/leads", response_model=Dict[str, Any])
async def add_lead(request: LeadCreateRequest):
    """
    Add a single lead manually with flexible key-value pairs.
    Automatically maps and stores in Neo4j with user_id and org_id for multitenancy.
    Creates Company, Contact, and Tech nodes as needed.
    """
    try:
        import uuid
        from datetime import datetime
        
        # Generate unique lead ID
        lead_id = str(uuid.uuid4())
        
        # Prepare lead data with multitenancy fields
        lead_data = request.data.copy()
        lead_data["user_id"] = request.user_id
        lead_data["org_id"] = request.org_id
        lead_data["lead_id"] = lead_id
        lead_data["created_at"] = datetime.utcnow().isoformat()
        
        # Extract company information (flexible mapping)
        company_name = lead_data.pop("company", lead_data.pop("company_name", lead_data.pop("Company", "")))
        if not company_name:
            raise HTTPException(status_code=400, detail="Company name is required")
        
        # Extract contact information (flexible mapping)
        contact_data = {}
        contact_fields = {
            "first_name": ["first_name", "firstName", "firstname", "contact_first_name"],
            "last_name": ["last_name", "lastName", "lastname", "contact_last_name"],
            "designation": ["designation", "title", "job_title", "role"],
            "department": ["department", "dept"],
            "email": ["email", "contact_email", "email_address"]
        }
        
        for neo4j_field, possible_keys in contact_fields.items():
            for key in possible_keys:
                if key in lead_data:
                    contact_data[neo4j_field] = lead_data.pop(key)
                    break
        
        # Extract tech stack (flexible mapping)
        tech_stack = []
        tech_keys = ["techStack", "tech_stack", "technologies", "tech", "tools"]
        for key in tech_keys:
            if key in lead_data:
                tech_value = lead_data.pop(key)
                if isinstance(tech_value, list):
                    tech_stack = tech_value
                elif isinstance(tech_value, str):
                    tech_stack = [t.strip() for t in tech_value.split(",")]
                break
        
        # Extract stage/status
        stage = lead_data.pop("stage", lead_data.pop("status", lead_data.pop("Status", "Initial Outreach")))
        lead_data["stage"] = stage
        
        with driver.session() as session:
            # Create or update Company node
            company_data = {
                "name": company_name,
                "industry": lead_data.pop("industry", lead_data.pop("Industry", "")),
                "size": lead_data.pop("size", lead_data.pop("Size", "")),
                "region": lead_data.pop("region", lead_data.pop("Region", "")),
                "location": lead_data.pop("location", lead_data.pop("Location", "")),
                "org_id": request.org_id
            }
            session.execute_write(
                upsert_node,
                "Company",
                "name",
                company_name,
                company_data
            )
            
            # Create Lead node with all remaining flexible fields
            session.execute_write(
                upsert_node,
                "Lead",
                "lead_id",
                lead_id,
                lead_data
            )
            
            # Create relationship: Company -> Lead
            session.run("""
                MATCH (c:Company {name: $company_name})
                MATCH (l:Lead {lead_id: $lead_id})
                MERGE (c)-[:Has_Lead]->(l)
            """, company_name=company_name, lead_id=lead_id)
            
            # Create Contact node if contact data exists
            if contact_data and (contact_data.get("first_name") or contact_data.get("last_name") or contact_data.get("email")):
                contact_id = str(uuid.uuid4())
                contact_data["contact_id"] = contact_id
                contact_data["org_id"] = request.org_id
                
                session.execute_write(
                    upsert_node,
                    "Contact",
                    "contact_id",
                    contact_id,
                    contact_data
                )
                
                # Create relationships: Company -> Contact, Contact -> Lead
                session.run("""
                    MATCH (c:Company {name: $company_name})
                    MATCH (contact:Contact {contact_id: $contact_id})
                    MATCH (l:Lead {lead_id: $lead_id})
                    MERGE (c)-[:Has_Contact]->(contact)
                    MERGE (contact)-[:Is_POC_For]->(l)
                """, company_name=company_name, contact_id=contact_id, lead_id=lead_id)
            
            # Create Tech nodes and relationships
            for tech_name in tech_stack:
                if tech_name:
                    session.run("""
                        MATCH (c:Company {name: $company_name})
                        MERGE (t:Tech {name: $tech_name})
                        MERGE (c)-[:Uses_Tech]->(t)
                    """, company_name=company_name, tech_name=tech_name)
        
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
            
            # Prepare update data
            update_data = request.data.copy()
            update_data["updated_at"] = datetime.utcnow().isoformat()
            
            # Handle company updates
            company_name = update_data.pop("company", update_data.pop("company_name", None))
            if company_name:
                company_data = {}
                if "industry" in update_data:
                    company_data["industry"] = update_data.pop("industry")
                if "size" in update_data:
                    company_data["size"] = update_data.pop("size")
                if "region" in update_data:
                    company_data["region"] = update_data.pop("region")
                if "location" in update_data:
                    company_data["location"] = update_data.pop("location")
                
                if company_data:
                    session.execute_write(
                        upsert_node,
                        "Company",
                        "name",
                        company_name,
                        company_data
                    )
            
            # Handle contact updates
            contact_updates = {}
            contact_mapping = {
                "first_name": ["first_name", "firstName", "firstname"],
                "last_name": ["last_name", "lastName", "lastname"],
                "designation": ["designation", "title", "job_title"],
                "department": ["department", "dept"],
                "email": ["email", "contact_email"]
            }
            
            for neo4j_field, possible_keys in contact_mapping.items():
                for key in possible_keys:
                    if key in update_data:
                        contact_updates[neo4j_field] = update_data.pop(key)
                        break
            
            # Handle tech stack updates
            tech_stack = None
            for key in ["techStack", "tech_stack", "technologies", "tech"]:
                if key in update_data:
                    tech_value = update_data.pop(key)
                    if isinstance(tech_value, list):
                        tech_stack = tech_value
                    elif isinstance(tech_value, str):
                        tech_stack = [t.strip() for t in tech_value.split(",")]
                    break
            
            # Update lead node with remaining fields
            if update_data:
                session.execute_write(
                    upsert_node,
                    "Lead",
                    "lead_id",
                    lead_id,
                    update_data
                )
            
            # Update contact if provided
            if contact_updates:
                # Find existing contact for this lead
                contact_query = """
                    MATCH (contact:Contact)-[:Is_POC_For]->(l:Lead {lead_id: $lead_id})
                    RETURN contact.contact_id AS contact_id
                    LIMIT 1
                """
                contact_result = session.run(contact_query, lead_id=lead_id)
                contact_record = contact_result.single()
                
                if contact_record:
                    contact_id = contact_record["contact_id"]
                    session.execute_write(
                        upsert_node,
                        "Contact",
                        "contact_id",
                        contact_id,
                        contact_updates
                    )
            
            # Update tech stack if provided
            if tech_stack is not None:
                # Get company name from lead
                company_query = """
                    MATCH (c:Company)-[:Has_Lead]->(l:Lead {lead_id: $lead_id})
                    RETURN c.name AS company_name
                    LIMIT 1
                """
                company_result = session.run(company_query, lead_id=lead_id)
                company_record = company_result.single()
                
                if company_record:
                    company_name = company_record["company_name"]
                    # Remove old tech relationships
                    session.run("""
                        MATCH (c:Company {name: $company_name})-[r:Uses_Tech]->(t:Tech)
                        DELETE r
                    """, company_name=company_name)
                    
                    # Add new tech relationships
                    for tech_name in tech_stack:
                        if tech_name:
                            session.run("""
                                MATCH (c:Company {name: $company_name})
                                MERGE (t:Tech {name: $tech_name})
                                MERGE (c)-[:Uses_Tech]->(t)
                            """, company_name=company_name, tech_name=tech_name)
        
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
    Each row creates a new lead with multitenancy (user_id and org_id).
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
                    
                    # Extract company information (flexible mapping)
                    company_name = lead_data.pop("company", lead_data.pop("company_name", lead_data.pop("Company", "")))
                    if not company_name:
                        error_count += 1
                        errors.append(f"Row {index + 1}: Missing company name")
                        continue
                    
                    # Extract contact information (flexible mapping)
                    contact_data = {}
                    contact_fields = {
                        "first_name": ["first_name", "firstName", "firstname", "contact_first_name", "First Name"],
                        "last_name": ["last_name", "lastName", "lastname", "contact_last_name", "Last Name"],
                        "designation": ["designation", "title", "job_title", "role", "Title", "Job Title"],
                        "department": ["department", "dept", "Department"],
                        "email": ["email", "contact_email", "email_address", "Email"]
                    }
                    
                    for neo4j_field, possible_keys in contact_fields.items():
                        for key in possible_keys:
                            if key in lead_data:
                                contact_data[neo4j_field] = str(lead_data.pop(key))
                                break
                    
                    # Extract tech stack (flexible mapping)
                    tech_stack = []
                    tech_keys = ["techStack", "tech_stack", "technologies", "tech", "tools", "Tech Stack"]
                    for key in tech_keys:
                        if key in lead_data:
                            tech_value = lead_data.pop(key)
                            if isinstance(tech_value, list):
                                tech_stack = [str(t) for t in tech_value]
                            elif isinstance(tech_value, str):
                                tech_stack = [t.strip() for t in str(tech_value).split(",") if t.strip()]
                            break
                    
                    # Extract stage/status
                    stage = lead_data.pop("stage", lead_data.pop("status", lead_data.pop("Status", "Initial Outreach")))
                    lead_data["stage"] = str(stage)
                    
                    # Convert all values to strings for Neo4j compatibility
                    lead_data = {k: str(v) if not isinstance(v, (dict, list)) else v for k, v in lead_data.items()}
                    
                    with driver.session() as session:
                        # Create or update Company node
                        company_data = {
                            "name": str(company_name),
                            "industry": str(lead_data.pop("industry", lead_data.pop("Industry", ""))),
                            "size": str(lead_data.pop("size", lead_data.pop("Size", ""))),
                            "region": str(lead_data.pop("region", lead_data.pop("Region", ""))),
                            "location": str(lead_data.pop("location", lead_data.pop("Location", ""))),
                            "org_id": org_id
                        }
                        session.execute_write(
                            upsert_node,
                            "Company",
                            "name",
                            str(company_name),
                            company_data
                        )
                        
                        # Create Lead node with all remaining flexible fields
                        session.execute_write(
                            upsert_node,
                            "Lead",
                            "lead_id",
                            lead_id,
                            lead_data
                        )
                        
                        # Create relationship: Company -> Lead
                        session.run("""
                            MATCH (c:Company {name: $company_name})
                            MATCH (l:Lead {lead_id: $lead_id})
                            MERGE (c)-[:Has_Lead]->(l)
                        """, company_name=str(company_name), lead_id=lead_id)
                        
                        # Create Contact node if contact data exists
                        if contact_data and (contact_data.get("first_name") or contact_data.get("last_name") or contact_data.get("email")):
                            contact_id = str(uuid.uuid4())
                            contact_data["contact_id"] = contact_id
                            contact_data["org_id"] = org_id
                            
                            session.execute_write(
                                upsert_node,
                                "Contact",
                                "contact_id",
                                contact_id,
                                contact_data
                            )
                            
                            # Create relationships: Company -> Contact, Contact -> Lead
                            session.run("""
                                MATCH (c:Company {name: $company_name})
                                MATCH (contact:Contact {contact_id: $contact_id})
                                MATCH (l:Lead {lead_id: $lead_id})
                                MERGE (c)-[:Has_Contact]->(contact)
                                MERGE (contact)-[:Is_POC_For]->(l)
                            """, company_name=str(company_name), contact_id=contact_id, lead_id=lead_id)
                        
                        # Create Tech nodes and relationships
                        for tech_name in tech_stack:
                            if tech_name:
                                session.run("""
                                    MATCH (c:Company {name: $company_name})
                                    MERGE (t:Tech {name: $tech_name})
                                    MERGE (c)-[:Uses_Tech]->(t)
                                """, company_name=str(company_name), tech_name=str(tech_name))
                    
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
                # For shared company profile, use a fixed identifier
                match_field = "companyUrl"
                match_value = payload.get("companyUrl") or "shared"
                # Delete ALL existing company profiles (since there's only one shared profile)
                session.run("MATCH (p:CompanyProfile) DELETE p")
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
    user_id: str = Query(None)
):
    """
    Flexible profile fetch endpoint that returns any JSON structure.
    Filters by user_id for multitenancy (except for company profiles which are shared).
    For company profiles, also includes customer profiles from MongoDB.
    """
    try:
        with driver.session() as session:
            # For company profiles, don't filter by user_id (shared profile)
            if profile_type == "company":
                neo4j_label = "CompanyProfile"
                query_string = f"MATCH (p:{neo4j_label}) RETURN p LIMIT 1"
                result = session.run(query_string)
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
                    
                    # Find the company profile document with customer profiles
                    filter_query = {"profile_type": "company"}
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

    # --- Neo4j query inside a thread - get shared company profile ---
    def fetch_company_profile():
        with driver.session() as session:
            # Get the shared company profile (no user_id filter)
            result = session.run(
                "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
            )
            record = result.single()
            return record

    record = await asyncio.to_thread(fetch_company_profile)
    if not record:
        raise HTTPException(status_code=404, detail="No company profile found in Neo4j")

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

        # --- Neo4j query inside a thread - get shared company profile ---
        def fetch_company_profile():
            with driver.session() as session:
                # Get the shared company profile (no user_id filter)
                result = session.run(
                    "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
                )
                record = result.single()
                return record

        record = await asyncio.to_thread(fetch_company_profile)
        if not record:
            raise HTTPException(status_code=404, detail="No company profile found in Neo4j")

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

        # Add metadata - filter by user_id only
        signals_result.update({
            "user_id": request.user_id,
            "agent": agent_name,
            "timestamp": datetime.utcnow()
        })
        if request.org_id:
            signals_result["org_id"] = request.org_id

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
                signals_result.update({
                    "user_id": request.user_id,
                    "agent": "scout",
                    "timestamp": datetime.utcnow(),
                    "batch_id": batch_id
                })
                if request.org_id:
                    signals_result["org_id"] = request.org_id
                
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
                signals_result.update({
                    "user_id": request.user_id,
                    "agent": "profiler",
                    "timestamp": datetime.utcnow(),
                    "batch_id": batch_id
                })
                if request.org_id:
                    signals_result["org_id"] = request.org_id
                
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
            signals_list.append(signal)

        return {
            "status": "success",
            "count": len(signals_list),
            "signals": signals_list
        }

    finally:
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
        
        # Get company profile from Neo4j to include in MongoDB document
        company_profile_data = {}
        with driver.session() as session:
            result = session.run("MATCH (c:CompanyProfile) RETURN c LIMIT 1")
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
        
        # Upsert the document - store company profile + customer profiles together
        # Use a fixed identifier since there's only one company profile
        filter_query = {"profile_type": "company"}
        
        update_doc = {
            "$set": {
                "profile_type": "company",
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
async def get_customer_profile():
    """
    Get customer profiles (ICPs) from MongoDB.
    Returns both company profile and associated customer profiles from the same document.
    """
    try:
        # MongoDB connection
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["Profiler"]
        collection = db["Company_Profile"]
        
        # Find the company profile document
        filter_query = {"profile_type": "company"}
        document = collection.find_one(filter_query)
        
        mongo_client.close()
        
        if not document:
            # If no MongoDB document exists, try to get from Neo4j and return empty customer profiles
            with driver.session() as session:
                result = session.run("MATCH (c:CompanyProfile) RETURN c LIMIT 1")
                record = result.single()
                if not record:
                    raise HTTPException(
                        status_code=404,
                        detail="No company profile found"
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

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=aws_access_key,
    aws_secret_access_key=aws_secret_key,
    region_name=aws_region
)

# Initialize Pinecone
pc = Pinecone(api_key=pinecone_api_key)

async def process_file_to_embeddings(file_key: str, user_id: str, file_name: str):
    """Background task to convert file to embeddings and store in Pinecone"""
    try:
        # Download file from S3
        local_file_path = f"/tmp/{file_name}"
        s3_client.download_file(s3_bucket, file_key, local_file_path)
        
        # Load document based on file type
        if file_name.endswith('.pdf'):
            loader = PyPDFLoader(local_file_path)
        elif file_name.endswith('.txt'):
            loader = TextLoader(local_file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_name}")
        
        documents = loader.load()
        
        # Split documents into chunks
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(documents)
        
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
        
        # Store embeddings in Pinecone
        vectorstore = PineconeVectorStore.from_documents(
            chunks,
            embeddings,
            index_name=index_name,
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
                "chunks_count": len(chunks)
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
    file: UploadFile = File(...),
    user_id: str = Form(...)
):
    """
    Upload a PDF or TXT file to S3 and start background task to convert to embeddings.
    Returns immediately with upload status.
    """
    try:
        # Validate file type
        if not (file.filename.endswith('.pdf') or file.filename.endswith('.txt')):
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "error": "upload_failed",
                    "message": "Only PDF and TXT files are supported"
                }
            )
        
        # Generate unique file key for S3
        file_id = str(uuid.uuid4())
        file_key = f"{user_id}/{file_id}_{file.filename}"
        
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
        
        # Store initial status in MongoDB
        try:
            username = urllib.parse.quote_plus("techbrewra")
            password = urllib.parse.quote_plus("Brewra@Best09")
            mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
            mongo_client = MongoClient(mongo_uri)
            db = mongo_client["File_Processing"]
            collection = db["file_status"]
            
            collection.insert_one({
                "file_key": file_key,
                "user_id": user_id,
                "file_name": file.filename,
                "status": "processing",
                "uploaded_at": datetime.utcnow(),
                "s3_url": f"s3://{s3_bucket}/{file_key}"
            })
            mongo_client.close()
        except Exception as e:
            logger.warning(f"Failed to store status in MongoDB: {str(e)}")
        
        # Start background task
        background_tasks.add_task(process_file_to_embeddings, file_key, user_id, file.filename)
        
        return {
            "status": "success",
            "message": "File uploaded successfully. Processing embeddings in background.",
            "file_key": file_key,
            "file_name": file.filename
        }
        
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
async def get_user_documents(user_id: str = Query(...)):
    """
    Get all files uploaded by a user.
    Returns list of files with file_name and file_id (file_key)
    """
    try:
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["File_Processing"]
        collection = db["file_status"]
        
        # Find all files for this user
        files = collection.find({"user_id": user_id}).sort("uploaded_at", -1)
        
        file_list = []
        for file_doc in files:
            file_list.append({
                "file_id": file_doc.get("file_key"),
                "file_name": file_doc.get("file_name"),
                "status": file_doc.get("status", "unknown"),
                "uploaded_at": file_doc.get("uploaded_at")
            })
        
        mongo_client.close()
        
        return {
            "status": "success",
            "count": len(file_list),
            "files": file_list
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
