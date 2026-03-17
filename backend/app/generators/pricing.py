"""Cost estimation for LLM API calls."""

# (provider, model) -> (input_cost_per_1k_tokens, output_cost_per_1k_tokens) in USD
PRICING: dict[tuple[str, str], tuple[float, float]] = {
    # Anthropic
    ("anthropic", "claude-haiku-4-5"): (0.001, 0.005),
    ("anthropic", "claude-sonnet-4-5"): (0.003, 0.015),
    ("anthropic", "claude-sonnet-4-6"): (0.003, 0.015),
    ("anthropic", "claude-opus-4-6"): (0.015, 0.075),
    # OpenAI
    ("openai", "gpt-4o-mini"): (0.00015, 0.0006),
    ("openai", "gpt-4o"): (0.005, 0.015),
    # Google Gemini
    ("gemini", "gemini-2.0-flash"): (0.0001, 0.0004),
    ("gemini", "gemini-2.5-flash"): (0.00015, 0.0006),
    ("gemini", "gemini-2.5-pro"): (0.00125, 0.01),
    # Ollama (free, local)
    ("ollama", "*"): (0.0, 0.0),
}


def estimate_cost(provider: str, model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate cost in USD for an API call."""
    key = (provider, model)
    if key not in PRICING:
        # Try wildcard match for ollama
        key = (provider, "*")
    if key not in PRICING:
        return 0.0

    input_rate, output_rate = PRICING[key]
    return (input_tokens / 1000 * input_rate) + (output_tokens / 1000 * output_rate)
