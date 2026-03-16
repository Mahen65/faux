"""Classification pipeline: rules -> fuzzy -> (future: LLM fallback)."""

from app.models.schemas import FieldDescriptor
from app.classifiers.rules import classify_by_rules
from app.classifiers.fuzzy import classify_by_fuzzy


def classify_field(field: FieldDescriptor) -> tuple[str, float]:
    """
    Classify a single field through the pipeline.

    Returns (field_type, confidence).
    """
    # Stage 1: Rule-based classification
    field_type, confidence = classify_by_rules(field)
    if confidence >= 0.8:
        return field_type, confidence

    # Stage 2: Fuzzy matching (for lower confidence results)
    fuzzy_result = classify_by_fuzzy(field)
    if fuzzy_result:
        fuzzy_type, fuzzy_confidence = fuzzy_result
        # Use fuzzy result if it's better
        if fuzzy_confidence > confidence:
            return fuzzy_type, fuzzy_confidence

    # Stage 3: LLM fallback (Phase 6 - not yet implemented)
    # if confidence < 0.6 and settings.llm_api_key:
    #     llm_result = classify_by_llm(field)
    #     ...

    return field_type, confidence


def classify_fields(fields: list[FieldDescriptor]) -> list[tuple[str, str, float]]:
    """
    Classify a batch of fields.

    Returns list of (field_id, field_type, confidence).
    """
    results = []
    for field in fields:
        field_type, confidence = classify_field(field)
        results.append((field.id, field_type, confidence))
    return results
