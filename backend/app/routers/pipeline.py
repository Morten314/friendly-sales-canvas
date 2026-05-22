"""Pipeline router: HTTP wiring for sales pipeline + LLM probe."""
from fastapi import APIRouter, Query

from app.services import pipeline as pipeline_service
from app.models.pipeline import SalesPipelineResponse

router = APIRouter(tags=["pipeline"])


@router.get("/Sales_Pipeline", response_model=SalesPipelineResponse)
def get_sales_pipeline(
    user_id: str = Query(...),
    timeframe: int = Query(...),
) -> SalesPipelineResponse:
    return pipeline_service.compute_sales_pipeline(user_id=user_id, timeframe=timeframe)


# /test-llm is a diagnostic; response shape is informal (status + raw model output).
@router.get("/test-llm")
async def test_llm():
    """LLM-availability diagnostic. Response shape is informal."""
    return pipeline_service.probe_llm()
