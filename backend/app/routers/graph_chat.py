"""Graph chat endpoints: company creation, NL chat, voice/text engagement."""
import datetime
import shutil

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.dependencies import get_chain, get_chain2, get_neo4j_driver
from app.models.graph_chat import (
    CreateProspectResponse,
    GraphChatResponse,
    GraphMessageResponse,
    ProspectData,
)
from app.services import graph_chat as graph_chat_service

router = APIRouter(tags=["graph-chat"])


@router.post("/create-company/", response_model=CreateProspectResponse)
async def create_prospect(data: ProspectData, driver=Depends(get_neo4j_driver)):
    if not data.Name or not data.Company or not data.answers:
        raise HTTPException(status_code=400, detail="Missing name, company, or answers")

    try:
        node = graph_chat_service.create_prospect_node(driver, data.Name, data.Company, data.answers)
        return {"message": "Prospect node created", "node": node}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# /ask/ returns a set literal `{response}` (pre-existing quirk); response shape
# is unstable — annotation deferred until the handler is normalized.
@router.get("/ask/")
async def ask_chain(question: str, chain=Depends(get_chain)):
    response = chain.run(question)
    return {response}

@router.get("/chat/", response_model=GraphChatResponse)
async def ask_chain2(question: str, chain2=Depends(get_chain2)):
    response = chain2.run(question)
    return {"response": response}

# /query/ is a raw Cypher debug endpoint; result shape varies per query.
@router.get("/query/")
async def run_query(cypher_query: str, driver=Depends(get_neo4j_driver)):
    result = graph_chat_service.run_cypher_query(driver, cypher_query)
    return {"result": result}

@router.post("/voice_graph/", response_model=GraphMessageResponse)
async def add_engagement_voice(
    prospect_name: str = Form(...),
    update_type: str = Form(...),  # Can be note, offline meeting, email, online meeting
    voice_file: UploadFile = File(...),
    driver=Depends(get_neo4j_driver),
):
    audio_path = f"temp_{voice_file.filename}"

    with open(audio_path, "wb") as buffer:
        shutil.copyfileobj(voice_file.file, buffer)

    text = graph_chat_service.convert_audio_to_text(audio_path)

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    import pytz
    ist = pytz.timezone("Asia/Kolkata")
    now_ist = now_utc.astimezone(ist)

    newId = int(now_ist.timestamp())
    current_time_str = now_ist.strftime("%Y-%m-%d %H:%M:%S")

    graph_chat_service.add_engagement(driver, prospect_name, text, update_type, newId, current_time_str)

    return {"message": f"Engagement of type '{update_type}' added for {prospect_name}"}

@router.post("/text_graph/", response_model=GraphMessageResponse)
async def add_engagement_text(
    prospect_name: str = Form(...),
    update_type: str = Form(...),  # note, offline meeting, email, online meeting
    text: str = Form(...),
    driver=Depends(get_neo4j_driver),
):
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    import pytz
    ist = pytz.timezone("Asia/Kolkata")
    now_ist = now_utc.astimezone(ist)

    newId = int(now_ist.timestamp())
    current_time_str = now_ist.strftime("%Y-%m-%d %H:%M:%S")

    graph_chat_service.add_engagement(driver, prospect_name, text, update_type, newId, current_time_str)

    return {"message": f"Engagement of type '{update_type}' added for {prospect_name}"}
