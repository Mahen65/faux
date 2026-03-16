"""Provider factory — creates the appropriate LLM provider by name."""

from . import LLMProvider


def create_provider(provider_name: str, api_key: str | None = None, model: str | None = None) -> LLMProvider:
    """Create an LLM provider instance by name."""
    match provider_name:
        case "anthropic":
            from .anthropic_provider import AnthropicProvider
            return AnthropicProvider(api_key=api_key, model=model)
        case "openai":
            from .openai_provider import OpenAIProvider
            return OpenAIProvider(api_key=api_key, model=model)
        case "gemini":
            from .gemini_provider import GeminiProvider
            return GeminiProvider(api_key=api_key, model=model)
        case "ollama":
            from .ollama_provider import OllamaProvider
            return OllamaProvider(api_key=api_key, model=model)
        case _:
            raise ValueError(f"Unknown LLM provider: {provider_name}")
