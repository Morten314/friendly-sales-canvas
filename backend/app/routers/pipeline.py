"""Pipeline router: HTTP wiring for sales pipeline + LLM probe."""
from fastapi import APIRouter, Query

from app.services import pipeline as pipeline_service
from app.models.pipeline import SalesPipelineResponse

router = APIRouter(tags=["pipeline"])


@router.get("/Sales_Pipeline")
def get_sales_pipeline(
    user_id: str = Query(...),
    timeframe: int = Query(...),
) -> SalesPipelineResponse:
    return pipeline_service.compute_sales_pipeline(user_id=user_id, timeframe=timeframe)


@router.get("/test-llm")
async def test_llm():
    return pipeline_service.probe_llm()
