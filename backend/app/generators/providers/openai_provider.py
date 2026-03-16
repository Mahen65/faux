"""OpenAI (GPT) LLM provider."""

from . import LLMProvider, LLMResponse


class OpenAIProvider(LLMProvider):
    provider_name = "openai"

    def __init__(self, api_key: str | None = None, model: str | None = None):
        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError("Install openai: pip install openai")

        if not api_key:
            raise ValueError("API key required for OpenAI")

        self.client = OpenAI(api_key=api_key)
        self.model = model or "gpt-4o-mini"

    def generate(self, system_prompt: str, user_message: str, max_tokens: int = 4096) -> LLMResponse:
        from openai import OpenAIError

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
            )

            text = response.choices[0].message.content or ""
            usage = response.usage

            return LLMResponse(
                text=text,
                input_tokens=usage.prompt_tokens if usage else 0,
                output_tokens=usage.completion_tokens if usage else 0,
                model=self.model,
                provider=self.provider_name,
            )
        except OpenAIError as e:
            raise RuntimeError(f"OpenAI API error: {e}") from e
