import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as app_settings
from app.models.schemas import AnalyzeRequest, AnalyzeResponse
from app.classifiers.pipeline import classify_fields
from app.generators.data_generator import generate_data
from app.generators.llm_generator import generate_with_llm, _build_field_summary
from app.generators.pricing import estimate_cost
from app.db.session import async_session, get_session
from app.db.models import UsageRecord
from app.services.rag import retrieve_similar_submissions

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/generate-data", response_model=AnalyzeResponse)
async def generate_form_data(
    body: AnalyzeRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> AnalyzeResponse:
    """Classify fields and generate contextual dummy data."""
    # Read provider settings from headers (extension sends these)
    provider = request.headers.get("x-llm-provider") or app_settings.llm_provider
    api_key = request.headers.get("x-llm-api-key") or app_settings.llm_api_key
    model = request.headers.get("x-llm-model")
    instance_id = request.headers.get("x-instance-id")

    # RAG: retrieve similar past submissions for context
    field_summaries = [_build_field_summary(f) for f in body.fields]
    rag_context = await retrieve_similar_submissions(
        field_summaries,
        session=session,
        persona=body.persona,
    )

    # Try LLM-powered generation first
    llm_result = generate_with_llm(
        body.fields,
        provider_name=provider,
        api_key=api_key,
        model=model,
        persona=body.persona,
        rag_context=rag_context,
    )
    if llm_result is not None:
        results, llm_response = llm_result
        logger.info(
            "LLM generation: provider=%s, model=%s, tokens=%d/%d, rag=%s",
            llm_response.provider, llm_response.model,
            llm_response.input_tokens, llm_response.output_tokens,
            "yes" if rag_context else "no",
        )

        # Save usage record
        if instance_id:
            cost = estimate_cost(
                llm_response.provider, llm_response.model,
                llm_response.input_tokens, llm_response.output_tokens,
            )
            record = UsageRecord(
                instance_id=instance_id,
                provider=llm_response.provider,
                model=llm_response.model,
                input_tokens=llm_response.input_tokens,
                output_tokens=llm_response.output_tokens,
                estimated_cost=cost,
            )
            session.add(record)
            await session.commit()

        return AnalyzeResponse(results=results)

    # Fall back to rule-based classification + Faker
    classified = classify_fields(body.fields)
    results = generate_data(classified, locale=body.locale)
    return AnalyzeResponse(results=results)
