"""Fuzzy string matching classifier using rapidfuzz."""

from rapidfuzz import process, fuzz

from app.models.schemas import FieldDescriptor

# Known field type labels for fuzzy matching
KNOWN_LABELS: dict[str, str] = {
    "first name": "first_name",
    "given name": "first_name",
    "forename": "first_name",
    "last name": "last_name",
    "family name": "last_name",
    "surname": "last_name",
    "full name": "full_name",
    "your name": "full_name",
    "display name": "full_name",
    "email address": "email",
    "e-mail": "email",
    "email": "email",
    "phone number": "phone",
    "telephone": "phone",
    "mobile number": "phone",
    "cell phone": "phone",
    "password": "password",
    "your password": "password",
    "confirm password": "password",
    "username": "username",
    "user name": "username",
    "login": "username",
    "street address": "street_address",
    "address line 1": "street_address",
    "mailing address": "street_address",
    "city": "city",
    "town": "city",
    "state": "state",
    "province": "state",
    "region": "state",
    "zip code": "zip_code",
    "postal code": "zip_code",
    "postcode": "zip_code",
    "country": "country",
    "date of birth": "date_of_birth",
    "birthday": "date_of_birth",
    "birth date": "date_of_birth",
    "company": "company",
    "organization": "company",
    "employer": "company",
    "company name": "company",
    "job title": "job_title",
    "position": "job_title",
    "occupation": "job_title",
    "website": "url",
    "web address": "url",
    "homepage": "url",
    "credit card number": "credit_card",
    "card number": "credit_card",
    "cvv": "cvv",
    "security code": "cvv",
    "expiration date": "expiry",
    "expiry date": "expiry",
    "message": "message",
    "comment": "message",
    "feedback": "message",
    "description": "message",
    "search": "search",
    "age": "number",
    "quantity": "number",
    "identifier": "identifier",
    "reference number": "identifier",
    "id number": "identifier",
    "hearing threshold": "measurement",
    "audiogram value": "measurement",
    "hz right": "measurement",
    "hz left": "measurement",
    "frequency right": "measurement",
    "frequency left": "measurement",
}


def classify_by_fuzzy(field: FieldDescriptor, threshold: float = 75.0) -> tuple[str, float] | None:
    """
    Classify a field using fuzzy string matching against known labels.

    Returns (field_type, confidence) or None if no good match.
    """
    # Build query from all available text signals
    parts: list[str] = []
    if field.label_text:
        parts.append(field.label_text)
    if field.name:
        # Convert camelCase and snake_case to spaces
        name = field.name.replace("_", " ").replace("-", " ")
        # Insert spaces before uppercase letters
        spaced = ""
        for i, ch in enumerate(name):
            if ch.isupper() and i > 0 and name[i - 1].islower():
                spaced += " "
            spaced += ch
        parts.append(spaced.lower())
    if field.placeholder:
        parts.append(field.placeholder)
    if field.aria_label:
        parts.append(field.aria_label)

    if not parts:
        return None

    query = " ".join(parts).strip().lower()
    if not query:
        return None

    choices = list(KNOWN_LABELS.keys())
    result = process.extractOne(query, choices, scorer=fuzz.token_sort_ratio)

    if result is None:
        return None

    match_text, score, _index = result
    if score < threshold:
        return None

    field_type = KNOWN_LABELS[match_text]
    # Normalize score to 0-1 confidence
    confidence = min(score / 100.0, 0.95)  # Cap at 0.95 since fuzzy isn't perfect

    return field_type, confidence
