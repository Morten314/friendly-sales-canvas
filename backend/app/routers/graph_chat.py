"""Graph chat endpoints: company creation, NL chat, voice/text engagement."""
import datetime
import shutil

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core import llm_config
from app.models.graph_chat import (
    CreateProspectResponse,
    GraphChatResponse,
    GraphMessageResponse,
    ProspectData,
)
from app.services import graph_chat as graph_chat_service

router = APIRouter(tags=["graph-chat"])


@router.post("/create-company/", response_model=CreateProspectResponse)
async def create_prospect(data: ProspectData):
    if not data.Name or not data.Company or not data.answers:
        raise HTTPException(status_code=400, detail="Missing name, company, or answers")

    try:
        node = graph_chat_service.create_prospect_node(data.Name, data.Company, data.answers)
        return {"message": "Prospect node created", "node": node}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# /ask/ returns a set literal `{response}` (pre-existing quirk); response shape
# is unstable — annotation deferred until the handler is normalized.
@router.get("/ask/")
async def ask_question(question: str):
    response = llm_config.chain.run(question)
    return {response}

@router.get("/chat/", response_model=GraphChatResponse)
async def ask_question(question: str):
    response = llm_config.chain2.run(question)
    return {"response": response}

# /query/ is a raw Cypher debug endpoint; result shape varies per query.
@router.get("/query/")
async def run_query(cypher_query: str):
    from app.core.clients import query
    result = query(cypher_query)
    return {"result": result}

@router.post("/voice_graph/", response_model=GraphMessageResponse)
async def add_engagement_voice(
    prospect_name: str = Form(...),
    update_type: str = Form(...),  # Can be note, offline meeting, email, online meeting
    voice_file: UploadFile = File(...)
):
    audio_path = f"temp_{voice_file.filename}"

    with open(audio_path, "wb") as buffer:
        shutil.copyfileobj(voice_file.file, buffer)

    text = graph_chat_service.convert_audio_to_text(audio_path)

    now_utc = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc)
    import pytz
    ist = pytz.timezone("Asia/Kolkata")
    now_ist = now_utc.astimezone(ist)

    newId = int(now_ist.timestamp())
    current_time_str = now_ist.strftime("%Y-%m-%d %H:%M:%S")

    # Ensure the prospect node exists
    from app.core.clients import query
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

@router.post("/text_graph/", response_model=GraphMessageResponse)
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
    from app.core.clients import query
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
