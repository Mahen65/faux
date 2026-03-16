"""Google Gemini LLM provider."""

from . import LLMProvider, LLMResponse


class GeminiProvider(LLMProvider):
    provider_name = "gemini"

    def __init__(self, api_key: str | None = None, model: str | None = None):
        try:
            from google import genai
        except ImportError:
            raise ImportError("Install google-generativeai: pip install google-generativeai")

        if not api_key:
            raise ValueError("API key required for Google Gemini")

        self.client = genai.Client(api_key=api_key)
        self.model = model or "gemini-2.0-flash"

    def generate(self, system_prompt: str, user_message: str, max_tokens: int = 4096) -> LLMResponse:
        try:
            from google.genai import types

            response = self.client.models.generate_content(
                model=self.model,
                contents=user_message,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=max_tokens,
                ),
            )

            text = response.text or ""
            usage = response.usage_metadata
            input_tokens = usage.prompt_token_count if usage else 0
            output_tokens = usage.candidates_token_count if usage else 0

            return LLMResponse(
                text=text,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                model=self.model,
                provider=self.provider_name,
            )
        except Exception as e:
            raise RuntimeError(f"Gemini API error: {e}") from e
