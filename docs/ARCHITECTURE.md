# Faux — System Documentation

## Overview

Faux is an intelligent form-filling browser extension powered by LLM providers. It detects form fields on web pages, classifies them, generates contextual test data using AI, and auto-fills forms. A RAG system learns from past submissions to improve accuracy over time.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python 3.12), async/await |
| Database | PostgreSQL 16 + pgvector |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2, 384-dim) |
| Extension | TypeScript/Preact, Chrome Manifest V3 |
| Build | Vite + CRXJS (extension), Docker Compose (backend) |
| LLM Providers | Anthropic, OpenAI, Google Gemini, Ollama (local) |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  Chrome Extension                        │
│                                                          │
│  ┌──────────┐   ┌────────────┐   ┌──────────────────┐  │
│  │  Popup   │──▶│ Background │──▶│  Content Script   │  │
│  │ (Preact) │   │  Worker    │   │  (DOM Analysis)   │  │
│  │          │   │            │   │                    │  │
│  │ Main Tab │   │  Message   │   │ ┌──────────────┐  │  │
│  │ Settings │   │  Router    │   │ │  Discovery   │  │  │
│  │ Account  │   │            │   │ │  Classifier  │  │  │
│  └──────────┘   └────────────┘   │ │  Filler      │  │  │
│                                   │ └──────┬───────┘  │  │
│  chrome.storage.local             │        │          │  │
│  (API keys, profiles, settings)   └────────┼──────────┘  │
└────────────────────────────────────────────┼─────────────┘
                                             │ HTTP
                                             ▼
┌─────────────────────────────────────────────────────────┐
│                   FastAPI Backend                         │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   /generate  │  │ /submissions │  │   /usage     │  │
│  │   -data      │  │              │  │   /summary   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  │
│         │                  │                             │
│  ┌──────▼───────┐  ┌──────▼───────┐                     │
│  │  RAG Service │  │  Embedding   │                     │
│  │  (retrieve)  │  │  Service     │                     │
│  └──────┬───────┘  └──────┬───────┘                     │
│         │                  │                             │
│  ┌──────▼───────┐         │                             │
│  │ LLM Provider │         │                             │
│  │   Factory    │         │                             │
│  └──────────────┘         │                             │
│                            ▼                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │           PostgreSQL + pgvector                   │   │
│  │  ┌──────────────┬────────────────┬────────────┐  │   │
│  │  │ UsageRecord  │ FormSubmission │ Submission │  │   │
│  │  │              │                │ Field      │  │   │
│  │  │              │                │ (Vector)   │  │   │
│  │  └──────────────┴────────────────┴────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Complete End-to-End

1. **Analyze Page** — Extension scrapes DOM, detects fields, groups into sections
2. **Generate Values** — Extension sends field metadata to backend
3. Backend retrieves RAG context (similar past submissions via pgvector cosine search)
4. Backend calls LLM with system prompt + persona + RAG examples + field metadata
5. LLM returns JSON with classified fields and generated values
6. Falls back to rule-based classifier + Faker if LLM unavailable
7. **Fill Selected** — Extension injects values into DOM (native setters + framework events)
8. **Submit** — Extension clicks submit button, then fire-and-forget reports submission to backend
9. Backend embeds submitted field values and stores in pgvector for future RAG

### RAG Learning Loop

```
Submit Form → Embed field labels+values → Store in pgvector
                                               │
Next similar form → Embed field labels ────────┘
                  → Cosine search top-3 matches
                  → Inject examples into LLM prompt
                  → Better, more consistent output
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/generate-data` | Generate values for form fields |
| POST | `/api/v1/submissions` | Store submitted form data + embeddings |
| GET | `/api/v1/usage/summary` | Usage stats per instance |
| POST | `/api/v1/providers/test` | Test LLM provider connection |

### Headers (sent by extension)

| Header | Description |
|--------|-------------|
| `X-LLM-Provider` | anthropic, openai, gemini, or ollama |
| `X-LLM-Api-Key` | Provider API key (not needed for Ollama) |
| `X-LLM-Model` | Model ID (e.g., claude-haiku-4-5) |
| `X-Instance-Id` | Unique browser instance UUID |

### POST /api/v1/generate-data

**Request:**
```json
{
  "fields": [
    {
      "id": "fb-123-1",
      "tag": "input",
      "type": "text",
      "label_text": "Patient Name",
      "placeholder": "Optional",
      "surrounding_text": "Audiogram Input..."
    }
  ],
  "persona": "72-year-old retired teacher with hearing loss",
  "locale": "en_US"
}
```

**Response:**
```json
{
  "results": [
    {
      "field_id": "fb-123-1",
      "field_type": "full_name",
      "confidence": 0.95,
      "generated_value": "Margaret Thompson"
    }
  ]
}
```

### POST /api/v1/submissions

**Request:**
```json
{
  "url": "https://example.com/hearing-test",
  "page_title": "AudiologyBot",
  "fields": [
    {
      "field_id": "fb-123-1",
      "label": "Patient Name",
      "field_type": "full_name",
      "generated_value": "Margaret Thompson",
      "submitted_value": "Margaret Thompson"
    }
  ]
}
```

**Response:**
```json
{
  "id": 42,
  "fields_stored": 1
}
```

---

## Database Models

### UsageRecord
Tracks LLM API calls for cost analytics.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer PK | Auto-increment |
| instance_id | String(64), indexed | Browser instance |
| provider | String(32) | LLM provider name |
| model | String(64) | Model ID |
| input_tokens | Integer | Prompt tokens |
| output_tokens | Integer | Completion tokens |
| estimated_cost | Float | USD estimate |
| timestamp | DateTime | Auto-set |

### FormSubmission
Records a submitted form with metadata.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer PK | Auto-increment |
| url | String(2048) | Page URL |
| page_title | String(512) | Page title |
| persona | Text | Active persona description |
| form_context | Text | Surrounding page text |
| instance_id | String(64), indexed | Browser instance |
| submitted_at | DateTime | Auto-set |

### SubmissionField
Individual field with vector embedding for RAG.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer PK | Auto-increment |
| submission_id | FK → form_submissions | Parent |
| field_id | String(256) | Faux field ID |
| label | String(512) | Field label text |
| field_type | String(64) | Classified type |
| generated_value | Text | LLM-generated value |
| submitted_value | Text | Actual submitted value |
| was_corrected | Boolean | submitted ≠ generated |
| embedding | Vector(384) | sentence-transformers embedding |

HNSW index on `embedding` column with `vector_cosine_ops` for fast similarity search.

---

## Classification Pipeline

Four-tier fallback system:

1. **LLM Generation** (primary) — Full context-aware generation via Claude/GPT/Gemini/Ollama
2. **Rule-based** — Regex patterns on autocomplete, type, name, label, placeholder, aria-label, CSS classes
3. **Fuzzy matching** — rapidfuzz token_sort_ratio against 70+ known field labels
4. **Faker** — Random but realistic dummy data as last resort

### Supported Field Types (35+)

| Category | Types |
|----------|-------|
| Personal | first_name, last_name, full_name, email, phone, password, username |
| Address | street_address, city, state, zip_code, country |
| Identity | date_of_birth, date, company, job_title |
| Web | url, search |
| Payment | credit_card, cvv, expiry |
| Content | message, textarea, comment |
| Controls | checkbox, radio, select |
| Domain | identifier, measurement, number |
| Fallback | unknown |

---

## LLM Providers

| Provider | Default Model | Requires Key | Notes |
|----------|---------------|-------------|-------|
| Anthropic | claude-haiku-4-5 | Yes | Best contextual understanding |
| OpenAI | gpt-4o-mini | Yes | Fast, cost-effective |
| Gemini | gemini-2.0-flash | Yes | Competitive pricing |
| Ollama | llama3.2 | No | Free, local, private |

Provider is selected in extension Settings tab. API key stored in `chrome.storage.local`, passed per-request via headers. Backend falls back to `FAUX_LLM_API_KEY` env var if no header.

---

## Extension Components

### Content Script
Runs on every page. Handles:
- **Field Discovery** — CSS selectors for inputs, textareas, selects, ARIA roles, contenteditable
- **Label Resolution** — 7-strategy cascade: aria-label → label[for] → parent label → aria-labelledby → sibling text → parent sibling → table context
- **Section Detection** — Groups fields by container (form, fieldset, section, .panel, .card)
- **Value Injection** — Native value setters + framework event dispatch (React, Angular, Vue)
- **Submit** — Finds submit button by type, text content, or position; reports data for RAG

### Popup (3 tabs)
- **Main** — Analyze → Generate → Fill → Submit workflow with section selection
- **Settings** — Provider selection, API key, model, Ollama URL, test connection
- **Account** — Usage stats (calls, tokens, cost) + user profiles (persona prompts)

### State Persistence
- `chrome.storage.session` — Popup state (survives open/close, cleared on browser restart)
- `chrome.storage.local` — Settings, profiles, instance ID (persistent)

---

## Docker Setup

### Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| db | pgvector/pgvector:pg16 | 5432 | PostgreSQL + vector extensions |
| pgadmin | dpage/pgadmin4 | 5050 | Database management UI |
| backend | Custom (Python 3.12) | 8888 | FastAPI application |

### Quick Start

```bash
# Start everything
docker compose up -d

# Start only DB + pgAdmin (for local backend dev)
docker compose up db pgadmin -d

# Access
# Backend: http://localhost:8888/docs (Swagger)
# pgAdmin: http://localhost:5050 (admin@faux.local / admin)
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FAUX_DATABASE_URL` | postgresql+asyncpg://faux:faux@localhost:5432/faux | Database connection |
| `FAUX_LLM_API_KEY` | (none) | Server-side fallback API key |
| `FAUX_LLM_PROVIDER` | anthropic | Default provider |
| `FAUX_RAG_ENABLED` | true | Enable/disable RAG |
| `FAUX_RAG_TOP_K` | 3 | Number of similar submissions to retrieve |
| `FAUX_RAG_SIMILARITY_THRESHOLD` | 0.65 | Minimum cosine similarity |
| `FAUX_EMBEDDING_MODEL` | all-MiniLM-L6-v2 | sentence-transformers model |

---

## File Structure

```
Bot/
├── docker-compose.yml
├── docs/
│   └── ARCHITECTURE.md          ← You are here
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── app/
│       ├── main.py              — FastAPI app + lifespan
│       ├── config.py            — Settings (env vars)
│       ├── api/
│       │   ├── router.py        — Route registration
│       │   └── endpoints/
│       │       ├── generate.py  — POST /generate-data
│       │       ├── health.py    — GET /health
│       │       ├── providers.py — POST /providers/test
│       │       ├── submissions.py — POST /submissions
│       │       └── usage.py     — GET /usage/summary
│       ├── classifiers/
│       │   ├── pipeline.py      — 3-stage classifier
│       │   ├── patterns.py      — Regex patterns + weights
│       │   ├── rules.py         — Rule-based classifier
│       │   └── fuzzy.py         — Fuzzy string matching
│       ├── generators/
│       │   ├── llm_generator.py — LLM orchestration + prompt
│       │   ├── data_generator.py — Faker-based fallback
│       │   ├── faker_map.py     — Field type → Faker method
│       │   ├── pricing.py       — Cost estimation
│       │   └── providers/
│       │       ├── __init__.py  — LLMProvider ABC + LLMResponse
│       │       ├── factory.py   — create_provider()
│       │       ├── anthropic_provider.py
│       │       ├── openai_provider.py
│       │       ├── gemini_provider.py
│       │       └── ollama_provider.py
│       ├── services/
│       │   ├── embedding.py     — sentence-transformers
│       │   └── rag.py           — Vector similarity search
│       ├── db/
│       │   ├── __init__.py
│       │   ├── models.py        — SQLAlchemy ORM models
│       │   └── session.py       — Async engine + sessions
│       └── models/
│           └── schemas.py       — Pydantic request/response
├── extension/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── manifest.json
│       ├── content/
│       │   ├── index.ts         — Content script (messages)
│       │   ├── analyzer/
│       │   │   ├── discovery.ts — Field detection + sections
│       │   │   └── classifier.ts — Local fallback classifier
│       │   └── filler/
│       │       └── value-injector.ts — DOM value injection
│       ├── background/
│       │   └── index.ts         — Service worker (routing)
│       ├── popup/
│       │   ├── App.tsx          — Main app (tabbed UI)
│       │   ├── index.tsx
│       │   ├── index.html
│       │   ├── popup.css
│       │   └── components/
│       │       ├── TabBar.tsx
│       │       ├── SettingsTab.tsx
│       │       ├── AccountTab.tsx
│       │       ├── ProfileEditor.tsx
│       │       ├── FieldList.tsx
│       │       ├── SectionList.tsx
│       │       └── StatusBar.tsx
│       └── shared/
│           ├── types.ts         — TypeScript interfaces
│           ├── messages.ts      — Message protocol
│           ├── settings.ts      — chrome.storage wrapper
│           └── constants.ts     — Config + provider metadata
└── public/
    └── icons/                   — Extension icons
```
