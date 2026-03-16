"""LLM-powered contextual data generation using any supported provider."""

import json
import logging

from app.config import settings
from app.models.schemas import ClassifiedField, FieldDescriptor
from app.generators.providers import LLMResponse
from app.generators.providers.factory import create_provider

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """\
You are a test-data generator for web forms. You receive form field metadata \
and must return realistic values as JSON.

CRITICAL RULES FOR TEXT FIELDS (textarea, chat inputs, reply boxes, answer fields):
- ALWAYS write in FIRST PERSON as the person filling the form
- NEVER use third person ("The patient reports...", "The user states...")
- NEVER write clinical summaries or reports
- Write exactly how a real person would type: casual, natural, conversational
- If "surrounding_text" contains a question, answer it directly as yourself
- Example: If asked "How has your hearing been?" → "I've been having some \
trouble hearing in noisy places, especially restaurants" NOT "Patient reports \
difficulty hearing in noisy environments"

RULES FOR DATA FIELDS (inputs, numbers, dates, IDs):
- Generate coherent, realistic values across all fields
- For measurements, use domain-appropriate values with natural variation
- Respect validation constraints (min, max, pattern) if provided

OUTPUT FORMAT — return ONLY a JSON array:
[{"field_id": "...", "field_type": "...", "confidence": 0.0-1.0, "generated_value": "..."}]

Valid field_type values: full_name, email, phone, date, number, identifier, \
measurement, message, textarea, url, password, unknown
"""


def _build_field_summary(field: FieldDescriptor) -> dict:
    """Build a compact summary of a field for the LLM prompt."""
    summary: dict = {"id": field.id, "tag": field.tag}
    if field.type:
        summary["type"] = field.type
    if field.name:
        summary["name"] = field.name
    if field.label_text:
        summary["label"] = field.label_text
    if field.placeholder:
        summary["placeholder"] = field.placeholder
    if field.aria_label:
        summary["aria_label"] = field.aria_label
    if field.autocomplete:
        summary["autocomplete"] = field.autocomplete
    if field.options:
        summary["options"] = field.options[:10]
    if field.min_length is not None:
        summary["min_length"] = field.min_length
    if field.max_length is not None:
        summary["max_length"] = field.max_length
    if field.validation_pattern:
        summary["pattern"] = field.validation_pattern
    if field.surrounding_text:
        summary["surrounding_text"] = field.surrounding_text
    return summary


def generate_with_llm(
    fields: list[FieldDescriptor],
    provider_name: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
    persona: str | None = None,
    rag_context: str | None = None,
) -> tuple[list[ClassifiedField], LLMResponse] | None:
    """
    Use an LLM provider to generate contextually appropriate form data.

    Returns (ClassifiedField[], LLMResponse) or None if unavailable/fails.
    """
    # Resolve provider settings: request params → env vars → defaults
    provider_name = provider_name or settings.llm_provider or "anthropic"
    api_key = api_key or settings.llm_api_key

    if not api_key and provider_name != "ollama":
        logger.info("No API key for provider '%s', skipping LLM", provider_name)
        return None

    field_summaries = [_build_field_summary(f) for f in fields]
    user_message = (
        f"Here are {len(fields)} form fields detected on a web page. "
        f"Generate realistic, contextual test data for each one.\n\n"
        f"Fields:\n{json.dumps(field_summaries, indent=2)}"
    )

    # Build system prompt with optional persona and RAG context
    system_prompt = SYSTEM_PROMPT
    if persona:
        system_prompt = (
            f"PERSONA: Fill the form as this person: {persona}\n\n"
            f"{system_prompt}"
        )
    if rag_context:
        system_prompt = (
            f"{system_prompt}\n\n{rag_context}\n\n"
            "Use these examples as reference for generating similar high-quality "
            "values, but adapt to the current form's specific fields."
        )

    logger.info("LLM request: provider=%s, model=%s, fields=%d", provider_name, model, len(fields))

    try:
        provider = create_provider(provider_name, api_key=api_key, model=model)
        llm_response = provider.generate(system_prompt, user_message)

        text = llm_response.text.strip()
        if not text:
            logger.warning("LLM returned empty text")
            return None

        # Extract JSON from the response (handle markdown code blocks)
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            text = text.rsplit("```", 1)[0]
        text = text.strip()

        parsed = json.loads(text)
        if not isinstance(parsed, list):
            logger.warning("LLM returned non-list JSON")
            return None

        results = []
        for item in parsed:
            results.append(
                ClassifiedField(
                    field_id=item["field_id"],
                    field_type=item.get("field_type", "unknown"),
                    confidence=float(item.get("confidence", 0.9)),
                    generated_value=str(item.get("generated_value", "")),
                )
            )

        logger.info("LLM generated %d fields (tokens: %d in, %d out)",
                     len(results), llm_response.input_tokens, llm_response.output_tokens)
        return results, llm_response

    except (ImportError, ValueError) as e:
        logger.error("Provider setup error: %s", e)
        return None
    except RuntimeError as e:
        logger.error("LLM generation error: %s", e)
        return None
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.error("Failed to parse LLM response: %s", e)
        return None
