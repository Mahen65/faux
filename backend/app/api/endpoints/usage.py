"""Usage tracking endpoint."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Query
from sqlalchemy import select, func

from app.db.session import async_session
from app.db.models import UsageRecord
from app.models.schemas import UsageSummary, ProviderUsage

router = APIRouter()


@router.get("/usage/summary", response_model=UsageSummary)
async def get_usage_summary(instance_id: str = Query(...)) -> UsageSummary:
    """Get usage summary for an instance."""
    async with async_session() as session:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())

        # All-time stats by provider
        stmt = (
            select(
                UsageRecord.provider,
                func.count().label("total_calls"),
                func.sum(UsageRecord.input_tokens).label("total_input_tokens"),
                func.sum(UsageRecord.output_tokens).label("total_output_tokens"),
                func.sum(UsageRecord.estimated_cost).label("total_cost"),
            )
            .where(UsageRecord.instance_id == instance_id)
            .group_by(UsageRecord.provider)
        )
        result = await session.execute(stmt)
        rows = result.all()

        providers = []
        total_calls = 0
        total_tokens = 0
        total_cost = 0.0

        for row in rows:
            calls = row.total_calls
            input_t = row.total_input_tokens or 0
            output_t = row.total_output_tokens or 0
            cost = row.total_cost or 0.0
            providers.append(ProviderUsage(
                provider=row.provider,
                total_calls=calls,
                total_input_tokens=input_t,
                total_output_tokens=output_t,
                total_cost=round(cost, 6),
            ))
            total_calls += calls
            total_tokens += input_t + output_t
            total_cost += cost

        # Today's calls
        today_stmt = (
            select(func.count())
            .where(UsageRecord.instance_id == instance_id)
            .where(UsageRecord.timestamp >= today_start)
        )
        today_result = await session.execute(today_stmt)
        today_calls = today_result.scalar() or 0

        return UsageSummary(
            total_calls=total_calls,
            total_tokens=total_tokens,
            total_cost=round(total_cost, 6),
            today_calls=today_calls,
            by_provider=providers,
        )
