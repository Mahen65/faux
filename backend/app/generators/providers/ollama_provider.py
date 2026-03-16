"""Ollama (local) LLM provider."""

import json
import urllib.request
import urllib.error

from . import LLMProvider, LLMResponse


class OllamaProvider(LLMProvider):
    provider_name = "ollama"

    def __init__(self, api_key: str | None = None, model: str | None = None, base_url: str | None = None):
        self.model = model or "llama3.2"
        self.base_url = (base_url or "http://localhost:11434").rstrip("/")

    def generate(self, system_prompt: str, user_message: str, max_tokens: int = 4096) -> LLMResponse:
        url = f"{self.base_url}/api/chat"
        payload = json.dumps({
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "stream": False,
            "options": {"num_predict": max_tokens},
        }).encode()

        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read())
        except urllib.error.URLError as e:
            raise RuntimeError(
                f"Ollama not reachable at {self.base_url}. "
                "Make sure Ollama is running (ollama serve)."
            ) from e

        text = data.get("message", {}).get("content", "")
        prompt_tokens = data.get("prompt_eval_count", 0)
        output_tokens = data.get("eval_count", 0)

        return LLMResponse(
            text=text,
            input_tokens=prompt_tokens,
            output_tokens=output_tokens,
            model=self.model,
            provider=self.provider_name,
        )
