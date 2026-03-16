"""RAG retrieval service — finds similar past submissions via pgvector."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import FormSubmission, SubmissionField
from app.services.embedding import embed_text

logger = logging.getLogger(__name__)


async def retrieve_similar_submissions(
    field_summaries: list[dict],
    session: AsyncSession,
    top_k: int | None = None,
    similarity_threshold: float | None = None,
    persona: str | None = None,
) -> str:
    """
    Retrieve similar past submissions and format as LLM context.

    Returns a formatted text block to inject into the system prompt,
    or empty string if no matches found.
    """
    if not settings.rag_enabled:
        return ""

    top_k = top_k or settings.rag_top_k
    similarity_threshold = similarity_threshold or settings.rag_similarity_threshold

    # Build query from field labels/names
    query_parts = []
    for field in field_summaries:
        label = field.get("label") or field.get("name") or field.get("placeholder") or ""
        if label:
            query_parts.append(label)

    if not query_parts:
        return ""

    query_text = ", ".join(query_parts)
    logger.info("RAG query: %s", query_text[:100])

    try:
        query_embedding = await embed_text(query_text)
    except Exception as e:
        logger.warning("RAG embedding failed: %s", e)
        return ""

    try:
        # Search for similar fields using cosine distance
        distance_col = SubmissionField.embedding.cosine_distance(query_embedding).label("distance")

        stmt = (
            select(
                SubmissionField,
                FormSubmission.url,
                FormSubmission.page_title,
                distance_col,
            )
            .join(FormSubmission, SubmissionField.submission_id == FormSubmission.id)
            .where(SubmissionField.embedding.is_not(None))
            .order_by(distance_col)
            .limit(top_k * 5)  # Get extra to group by submission
        )

        # Optionally filter by persona
        if persona:
            stmt = stmt.where(FormSubmission.persona == persona)

        result = await session.execute(stmt)
        rows = result.all()

        if not rows:
            logger.info("RAG: no similar submissions found")
            return ""

        # Group by submission, take top-K unique submissions
        seen_submissions: dict[int, list] = {}
        for field, url, page_title, distance in rows:
            similarity = 1.0 - distance
            if similarity < similarity_threshold:
                continue
            sid = field.submission_id
            if sid not in seen_submissions:
                seen_submissions[sid] = {
                    "url": url,
                    "title": page_title,
                    "similarity": similarity,
                    "fields": [],
                }
            value = field.submitted_value or field.generated_value
            label = field.label or field.field_id
            corrected = " (user-corrected)" if field.was_corrected else ""
            seen_submissions[sid]["fields"].append(f'  "{label}": "{value}"{corrected}')

        if not seen_submissions:
            return ""

        # Take top-K submissions by highest similarity
        sorted_subs = sorted(
            seen_submissions.values(),
            key=lambda s: s["similarity"],
            reverse=True,
        )[:top_k]

        # Format as context block
        lines = ["EXAMPLES FROM SIMILAR PAST SUBMISSIONS (use as reference):"]
        for i, sub in enumerate(sorted_subs, 1):
            title = sub["title"] or sub["url"][:60]
            lines.append(f"--- Example {i} (from: {title}, similarity: {sub['similarity']:.2f}) ---")
            lines.extend(sub["fields"])

        rag_context = "\n".join(lines)
        logger.info("RAG: injecting %d examples into prompt", len(sorted_subs))
        return rag_context

    except Exception as e:
        logger.warning("RAG retrieval failed: %s", e)
        return ""
