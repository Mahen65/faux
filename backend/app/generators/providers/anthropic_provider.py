"""Anthropic (Claude) LLM provider."""

from . import LLMProvider, LLMResponse


class AnthropicProvider(LLMProvider):
    provider_name = "anthropic"

    def __init__(self, api_key: str | None = None, model: str | None = None):
        try:
            import anthropic
        except ImportError:
            raise ImportError("Install anthropic: pip install anthropic")

        if not api_key:
            raise ValueError("API key required for Anthropic")

        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model or "claude-haiku-4-5"

    def generate(self, system_prompt: str, user_message: str, max_tokens: int = 4096) -> LLMResponse:
        import anthropic

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )

            text = next((b.text for b in response.content if b.type == "text"), "")

            return LLMResponse(
                text=text,
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                model=self.model,
                provider=self.provider_name,
            )
        except anthropic.APIError as e:
            raise RuntimeError(f"Anthropic API error: {e}") from e
