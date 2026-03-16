"""Provider test endpoint."""

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.generators.providers.factory import create_provider

router = APIRouter()


class TestResult(BaseModel):
    success: bool
    message: str
    model: str | None = None


@router.post("/providers/test", response_model=TestResult)
async def test_provider(request: Request) -> TestResult:
    """Test an LLM provider connection with a minimal request."""
    provider_name = request.headers.get("x-llm-provider", "anthropic")
    api_key = request.headers.get("x-llm-api-key")
    model = request.headers.get("x-llm-model")

    try:
        provider = create_provider(provider_name, api_key=api_key, model=model)
        response = provider.generate(
            system_prompt="Reply with exactly: OK",
            user_message="Test connection",
            max_tokens=10,
        )
        return TestResult(success=True, message="Connection successful", model=response.model)
    except (ImportError, ValueError) as e:
        return TestResult(success=False, message=str(e))
    except RuntimeError as e:
        return TestResult(success=False, message=str(e))
    except Exception as e:
        return TestResult(success=False, message=f"Unexpected error: {e}")
