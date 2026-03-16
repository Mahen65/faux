"""Rule-based field classifier using weighted pattern matching."""

from app.models.schemas import FieldDescriptor
from app.classifiers.patterns import (
    PATTERNS,
    AUTOCOMPLETE_MAP,
    TYPE_MAP,
    SIGNAL_WEIGHTS,
)


def classify_by_rules(field: FieldDescriptor) -> tuple[str, float]:
    """
    Classify a field using rule-based pattern matching.

    Returns (field_type, confidence) tuple.
    """
    # 1. Autocomplete attribute (highest confidence)
    if field.autocomplete and field.autocomplete in AUTOCOMPLETE_MAP:
        return AUTOCOMPLETE_MAP[field.autocomplete], 1.0

    # 2. HTML input type
    if field.type and field.type in TYPE_MAP:
        return TYPE_MAP[field.type], 1.0

    # 3. Textarea default
    if field.tag == "textarea":
        result = _match_patterns(field)
        if result and result[1] > 0.7:
            return result
        return "textarea", 0.8

    # 4. Select default
    if field.tag == "select":
        result = _match_patterns(field)
        if result and result[1] > 0.7:
            return result
        return "select", 0.8

    # 5. Pattern matching against all signals
    result = _match_patterns(field)
    if result:
        return result

    return "unknown", 0.1


def _match_patterns(field: FieldDescriptor) -> tuple[str, float] | None:
    """Run patterns against all available signals for a field."""
    signals: list[tuple[str, float]] = []

    if field.name:
        signals.append((field.name, SIGNAL_WEIGHTS["name"]))
    if field.label_text:
        signals.append((field.label_text, SIGNAL_WEIGHTS["label_text"]))
    if field.placeholder:
        signals.append((field.placeholder, SIGNAL_WEIGHTS["placeholder"]))
    if field.aria_label:
        signals.append((field.aria_label, SIGNAL_WEIGHTS["aria_label"]))
    if field.css_classes:
        signals.append((" ".join(field.css_classes), SIGNAL_WEIGHTS["css_classes"]))

    best: tuple[str, float] | None = None

    for regex, field_type, pattern_weight in PATTERNS:
        for text, signal_weight in signals:
            if regex.search(text):
                confidence = pattern_weight * signal_weight
                if best is None or confidence > best[1]:
                    best = (field_type, confidence)

    return best
