"""Generate realistic fake data for classified fields."""

from faker import Faker

from app.models.schemas import ClassifiedField
from app.generators.faker_map import FAKER_MAP


def generate_data(
    classified: list[tuple[str, str, float]],
    locale: str = "en_US",
) -> list[ClassifiedField]:
    """
    Generate fake data for classified fields.

    Args:
        classified: List of (field_id, field_type, confidence) from the pipeline.
        locale: Faker locale for localized data generation.

    Returns:
        List of ClassifiedField with generated values.
    """
    fake = Faker(locale)

    results = []
    for field_id, field_type, confidence in classified:
        generator = FAKER_MAP.get(field_type, FAKER_MAP["unknown"])
        value = generator(fake)

        results.append(
            ClassifiedField(
                field_id=field_id,
                field_type=field_type,
                confidence=confidence,
                generated_value=str(value),
            )
        )

    return results
