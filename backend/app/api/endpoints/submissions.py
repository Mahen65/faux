"""Submission storage endpoint — stores form data with vector embeddings."""

import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.db.models import FormSubmission, SubmissionField
from app.models.schemas import SubmissionRequest, SubmissionResponse
from app.services.embedding import embed_texts

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/submissions", response_model=SubmissionResponse)
async def store_submission(
    body: SubmissionRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> SubmissionResponse:
    """Store a form submission with vector embeddings for RAG."""
    instance_id = request.headers.get("x-instance-id")

    # Create submission record
    submission = FormSubmission(
        url=body.url,
        page_title=body.page_title,
        persona=body.persona,
        form_context=body.form_context,
        instance_id=instance_id,
    )
    session.add(submission)
    await session.flush()  # Get the submission ID

    # Prepare texts for batch embedding
    texts_to_embed = []
    for field in body.fields:
        value = field.submitted_value or field.generated_value
        label = field.label or field.field_id
        texts_to_embed.append(f"{label}: {value}")

    # Generate embeddings
    embeddings = await embed_texts(texts_to_embed)

    # Create field records with embeddings
    for i, field in enumerate(body.fields):
        was_corrected = (
            field.submitted_value is not None
            and field.submitted_value != field.generated_value
        )
        sub_field = SubmissionField(
            submission_id=submission.id,
            field_id=field.field_id,
            label=field.label,
            field_type=field.field_type,
            generated_value=field.generated_value,
            submitted_value=field.submitted_value,
            was_corrected=was_corrected,
            embedding=embeddings[i] if i < len(embeddings) else None,
        )
        session.add(sub_field)

    await session.commit()

    logger.info(
        "Stored submission #%d with %d fields (url=%s)",
        submission.id, len(body.fields), body.url[:80],
    )

    return SubmissionResponse(id=submission.id, fields_stored=len(body.fields))
