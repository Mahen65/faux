from pydantic import BaseModel


class FieldDescriptor(BaseModel):
    """Describes a detected interactive element from the browser extension."""

    id: str
    tag: str
    type: str | None = None
    name: str | None = None
    placeholder: str | None = None
    label_text: str | None = None
    aria_label: str | None = None
    autocomplete: str | None = None
    css_classes: list[str] = []
    parent_form_id: str | None = None
    options: list[str] | None = None
    validation_pattern: str | None = None
    min_length: int | None = None
    max_length: int | None = None
    required: bool = False
    surrounding_text: str | None = None


class ClassifiedField(BaseModel):
    """Result of classifying a field with generated data."""

    field_id: str
    field_type: str
    confidence: float
    generated_value: str


class AnalyzeRequest(BaseModel):
    """Request to classify fields and generate data."""

    fields: list[FieldDescriptor]
    profile_id: str | None = None
    locale: str = "en_US"
    persona: str | None = None


class AnalyzeResponse(BaseModel):
    """Response with classified fields and generated values."""

    results: list[ClassifiedField]


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "ok"
    version: str = "0.1.0"


class ProviderUsage(BaseModel):
    """Usage stats for a single provider."""

    provider: str
    total_calls: int
    total_input_tokens: int
    total_output_tokens: int
    total_cost: float


class UsageSummary(BaseModel):
    """Aggregated usage summary."""

    total_calls: int
    total_tokens: int
    total_cost: float
    today_calls: int
    by_provider: list[ProviderUsage]


class SubmittedField(BaseModel):
    """A single field from a form submission."""

    field_id: str
    label: str | None = None
    field_type: str | None = None
    generated_value: str
    submitted_value: str | None = None


class SubmissionRequest(BaseModel):
    """Request to store a form submission."""

    url: str
    page_title: str | None = None
    persona: str | None = None
    form_context: str | None = None
    fields: list[SubmittedField]


class SubmissionResponse(BaseModel):
    """Response after storing a submission."""

    id: int
    fields_stored: int
