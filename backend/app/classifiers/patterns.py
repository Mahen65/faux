"""Field classification patterns - maps regex patterns to field types with weights."""

import re

# Each pattern: (compiled_regex, field_type, base_confidence)
PATTERNS: list[tuple[re.Pattern[str], str, float]] = [
    # Email
    (re.compile(r"^email$", re.I), "email", 1.0),
    (re.compile(r"e[-_]?mail", re.I), "email", 0.9),
    (re.compile(r"\bmail\b", re.I), "email", 0.7),

    # Phone
    (re.compile(r"^tel$", re.I), "phone", 1.0),
    (re.compile(r"phone|mobile|cell|telephone", re.I), "phone", 0.9),
    (re.compile(r"\btel\b", re.I), "phone", 0.8),

    # Password
    (re.compile(r"^password$", re.I), "password", 1.0),
    (re.compile(r"pass[-_]?w(?:or)?d|pwd", re.I), "password", 0.9),
    (re.compile(r"confirm[-_]?pass", re.I), "password", 0.9),

    # First name
    (re.compile(r"^given[-_]?name$", re.I), "first_name", 1.0),
    (re.compile(r"first[-_]?name|fname|given", re.I), "first_name", 0.9),

    # Last name
    (re.compile(r"^family[-_]?name$", re.I), "last_name", 1.0),
    (re.compile(r"last[-_]?name|lname|surname|family", re.I), "last_name", 0.9),

    # Full name
    (re.compile(r"full[-_]?name|your[-_]?name|display[-_]?name", re.I), "full_name", 0.9),
    (re.compile(r"\bname\b", re.I), "full_name", 0.7),

    # Username
    (re.compile(r"user[-_]?name|login|handle|screen[-_]?name", re.I), "username", 0.9),

    # Address
    (re.compile(r"street|address[-_]?(?:line)?[-_]?1|addr", re.I), "street_address", 0.9),
    (re.compile(r"city|town|locality", re.I), "city", 0.9),
    (re.compile(r"state|province|region", re.I), "state", 0.9),
    (re.compile(r"zip|postal[-_]?code|postcode", re.I), "zip_code", 0.9),
    (re.compile(r"country", re.I), "country", 0.9),

    # Date
    (re.compile(r"date[-_]?of[-_]?birth|dob|birth[-_]?date|birthday", re.I), "date_of_birth", 0.9),
    (re.compile(r"\bdate\b", re.I), "date", 0.6),

    # Company / Job
    (re.compile(r"company|organization|org[-_]?name|employer", re.I), "company", 0.9),
    (re.compile(r"job[-_]?title|position|role|occupation", re.I), "job_title", 0.9),

    # URL
    (re.compile(r"\burl\b|website|homepage|web[-_]?address", re.I), "url", 0.9),

    # Credit card
    (re.compile(r"card[-_]?number|cc[-_]?num|credit[-_]?card", re.I), "credit_card", 0.9),
    (re.compile(r"\bcvv\b|cvc|security[-_]?code", re.I), "cvv", 0.9),
    (re.compile(r"expir|exp[-_]?date|exp[-_]?month", re.I), "expiry", 0.9),

    # Message / Comment
    (re.compile(r"message|comment|feedback|description|notes|bio|about", re.I), "message", 0.7),

    # Search
    (re.compile(r"search|query|find|keyword", re.I), "search", 0.8),

    # Number
    (re.compile(r"\bage\b|quantity|amount|count", re.I), "number", 0.7),

    # Generic identifier (catches "Patient ID", "Employee ID", "Reference No", etc.)
    (re.compile(r"\bid\b|identifier|ref[-_\s]?(?:no|number|num)?", re.I), "identifier", 0.7),

    # Measurement / Audiogram
    (re.compile(r"\d+\s*(?:hz|khz)\s*(?:right|left|r\b|l\b)", re.I), "measurement", 0.9),
    (re.compile(r"(?:right|left)\s*\d*\s*(?:hz|khz|db)", re.I), "measurement", 0.9),
    (re.compile(r"\b\d+\s*(?:right|left)\b", re.I), "measurement", 0.85),
    (re.compile(r"\b(?:hz|frequency|db|decibel|threshold|audiogram)\b", re.I), "measurement", 0.8),
]

# HTML autocomplete attribute -> field type (from the HTML Living Standard)
AUTOCOMPLETE_MAP: dict[str, str] = {
    "given-name": "first_name",
    "family-name": "last_name",
    "name": "full_name",
    "email": "email",
    "tel": "phone",
    "street-address": "street_address",
    "address-line1": "street_address",
    "address-level2": "city",
    "address-level1": "state",
    "postal-code": "zip_code",
    "country-name": "country",
    "country": "country",
    "bday": "date_of_birth",
    "organization": "company",
    "organization-title": "job_title",
    "url": "url",
    "username": "username",
    "new-password": "password",
    "current-password": "password",
    "cc-number": "credit_card",
    "cc-csc": "cvv",
    "cc-exp": "expiry",
}

# HTML input type -> field type
TYPE_MAP: dict[str, str] = {
    "email": "email",
    "tel": "phone",
    "password": "password",
    "url": "url",
    "number": "number",
    "date": "date",
    "search": "search",
    "checkbox": "checkbox",
    "radio": "radio",
}

# Signal weights for pattern matching
SIGNAL_WEIGHTS: dict[str, float] = {
    "name": 0.85,
    "label_text": 0.9,
    "placeholder": 0.75,
    "aria_label": 0.85,
    "css_classes": 0.5,
}
