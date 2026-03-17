"""Google Gemini LLM provider (supports AI Studio and Vertex AI)."""

import os
from . import LLMProvider, LLMResponse


class GeminiProvider(LLMProvider):
    provider_name = "gemini"

    def __init__(self, api_key: str | None = None, model: str | None = None):
        try:
            from google import genai
        except ImportError:
            raise ImportError("Install google-genai: pip install google-genai")

        # Use Vertex AI if running on GCP (no API key needed) or if explicitly configured
        use_vertex = os.environ.get("FAUX_GEMINI_USE_VERTEX", "").lower() in ("1", "true")
        gcp_project = os.environ.get("FAUX_GCP_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT")

        if use_vertex or (not api_key and gcp_project):
            self.client = genai.Client(
                vertexai=True,
                project=gcp_project,
                location=os.environ.get("FAUX_GCP_REGION", "us-central1"),
            )
        elif api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            raise ValueError("API key or GCP project required for Gemini")

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
