"""Pipeline service: sales-pipeline aggregator."""
from datetime import datetime, timedelta, timezone
from typing import Dict

from app.core.config import STAGE_ORDER, STAGE_MAPPING
from app.models.pipeline import SalesPipelineResponse, TimeframeResponse, StageStats


def compute_sales_pipeline(driver, user_id: str, timeframe: int) -> SalesPipelineResponse:
    """Aggregate lead stage counts from Neo4j for the given user/timeframe."""
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

            stages.append(StageStats(
                name=stage,
                count=count,
                conversionRate=conversion,
            ))

        return SalesPipelineResponse(
            timeframes=[
                TimeframeResponse(
                    days=timeframe,
                    stages=stages,
                )
            ]
        )
