# LLM Cost Benchmark — Form Filling

Cost estimates for filling a web form using the Faux backend's LLM-powered generation.

## Token Usage Per Request (50 Fields)

| Component | Estimated Tokens |
|-----------|-----------------|
| System prompt | ~350 |
| Field metadata (50 fields × ~40 tokens) | ~2,000 |
| Persona + RAG context (optional) | ~200–500 |
| **Total input** | **~2,500–2,850** |
| **Total output** (50 JSON objects × ~30 tokens) | **~1,500** |

## Cost Per Form Fill (50 Fields)

| Provider | Model | Input Cost | Output Cost | Total / Fill | Cost / 1,000 Fills |
|----------|-------|-----------|-------------|-------------|-------------------|
| Google | gemini-2.0-flash | $0.0003 | $0.0006 | **$0.0009** | **$0.90** |
| OpenAI | gpt-4o-mini | $0.0004 | $0.0009 | **$0.0013** | **$1.30** |
| Anthropic | claude-haiku-4-5 | $0.0029 | $0.0075 | **$0.0104** | **$10.40** |
| Google | gemini-2.5-pro | $0.0036 | $0.0150 | **$0.0186** | **$18.60** |
| Anthropic | claude-sonnet-4-6 | $0.0086 | $0.0225 | **$0.0311** | **$31.10** |
| OpenAI | gpt-4o | $0.0143 | $0.0225 | **$0.0368** | **$36.80** |
| Anthropic | claude-opus-4-6 | $0.0428 | $0.1125 | **$0.1553** | **$155.30** |
| Ollama | local models | $0.00 | $0.00 | **$0.00** | **$0.00** |

## Pricing Rates (per 1K tokens)

| Provider | Model | Input Rate | Output Rate |
|----------|-------|-----------|-------------|
| Google | gemini-2.0-flash | $0.0001 | $0.0004 |
| OpenAI | gpt-4o-mini | $0.00015 | $0.0006 |
| Anthropic | claude-haiku-4-5 | $0.001 | $0.005 |
| Google | gemini-2.5-pro | $0.00125 | $0.01 |
| Anthropic | claude-sonnet-4-6 | $0.003 | $0.015 |
| OpenAI | gpt-4o | $0.005 | $0.015 |
| Anthropic | claude-opus-4-6 | $0.015 | $0.075 |
| Ollama | any | $0.00 | $0.00 |

## Scaling Estimates

Estimates based on 50 fields per fill using the default model (claude-haiku-4-5).

| Usage | Fills / Month | Monthly Cost |
|-------|--------------|-------------|
| Light (personal use) | 100 | $1.04 |
| Moderate (small team) | 1,000 | $10.40 |
| Heavy (testing pipeline) | 10,000 | $104.00 |

### Budget-Optimized Alternatives

| Usage | Fills / Month | gemini-2.0-flash | gpt-4o-mini |
|-------|--------------|-----------------|-------------|
| Light | 100 | $0.09 | $0.13 |
| Moderate | 1,000 | $0.90 | $1.30 |
| Heavy | 10,000 | $9.00 | $13.00 |

## Assumptions

- 50 form fields per request (single LLM call)
- ~2,850 input tokens (system prompt + field metadata + persona/RAG context)
- ~1,500 output tokens (JSON array of 50 classified fields)
- No retries or fallback calls
- Pricing as of March 2026
