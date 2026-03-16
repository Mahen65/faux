"""LLM provider abstraction layer."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class LLMResponse:
    """Response from an LLM provider."""

    text: str
    input_tokens: int
    output_tokens: int
    model: str
    provider: str


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    provider_name: str

    @abstractmethod
    def generate(self, system_prompt: str, user_message: str, max_tokens: int = 4096) -> LLMResponse:
        """Generate a response from the LLM."""
        ...
