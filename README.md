# ⚗️ Faux

**AI-powered synthetic data generator** — a Chrome extension that intelligently fills forms with contextual test data using LLMs.

Faux detects form fields on any web page, understands context through AI, and generates realistic, coherent test data. It learns from past submissions via RAG to improve accuracy over time.

## Features

- **Smart Field Detection** — Automatically discovers and classifies form fields using labels, ARIA attributes, placeholders, and table context
- **Section-Based Filling** — Groups fields into logical sections, fill one section at a time
- **Multi-Provider LLM Support** — Anthropic (Claude), OpenAI (GPT), Google Gemini, Ollama (local/free)
- **RAG Learning** — Stores past submissions as vector embeddings, retrieves similar examples to improve future generation
- **User Profiles** — Create personas (e.g., "Senior Patient", "College Student") that influence generated data
- **Usage Tracking** — Monitor API calls, tokens, and estimated costs per provider
- **Intelligent Fallback** — Rule-based classifier + Faker when no LLM is configured

## Architecture

```
Chrome Extension (Preact)  ──HTTP──▶  FastAPI Backend
                                          │
                                    ┌─────┴─────┐
                                    │ PostgreSQL │
                                    │ + pgvector │
                                    └───────────┘
```

| Component | Tech |
|-----------|------|
| Extension | TypeScript, Preact, Chrome Manifest V3 |
| Backend | Python 3.12, FastAPI, SQLAlchemy (async) |
| Database | PostgreSQL 16 + pgvector |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| LLM | Anthropic, OpenAI, Gemini, Ollama |

## Quick Start

### 1. Start the backend (Docker)

```bash
docker compose up -d
```

This starts:
- **Backend** at http://localhost:8888 (Swagger docs at /docs)
- **PostgreSQL + pgvector** at localhost:5432
- **pgAdmin** at http://localhost:5050 (admin@faux.dev / admin)

### 2. Build the extension

```bash
cd extension
npm install
npm run dev
```

### 3. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/dist` folder

### 4. Configure

1. Click the Faux extension icon
2. Go to **Settings** tab
3. Select your LLM provider and enter an API key (or choose Ollama for free local generation)
4. Click **Save Settings** → **Test Connection**

## Usage

1. Navigate to any web page with forms
2. Click the Faux icon → **Analyze Page**
3. Select the sections you want to fill
4. Click **Generate Values** (calls LLM) → **Fill Selected** → **Submit**

## Environment Variables

All variables use the `FAUX_` prefix:

| Variable | Default | Description |
|----------|---------|-------------|
| `FAUX_DATABASE_URL` | `postgresql+asyncpg://faux:faux@localhost:5432/faux` | Database connection |
| `FAUX_LLM_API_KEY` | — | Server-side fallback API key |
| `FAUX_LLM_PROVIDER` | `anthropic` | Default LLM provider |
| `FAUX_RAG_ENABLED` | `true` | Enable RAG retrieval |
| `FAUX_RAG_TOP_K` | `3` | Similar submissions to retrieve |
| `FAUX_EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Local embedding model |

## Local Development (without Docker)

```bash
# Start just the database
docker compose up db pgadmin -d

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --port 8888 --host 0.0.0.0

# Extension
cd extension
npm install
npm run dev
```

## Project Structure

```
Faux/
├── docker-compose.yml
├── docs/
│   └── ARCHITECTURE.md       # Full system documentation
├── backend/
│   ├── Dockerfile
│   └── app/
│       ├── api/endpoints/     # REST endpoints
│       ├── classifiers/       # Rule-based classification pipeline
│       ├── generators/        # LLM + Faker data generation
│       │   └── providers/     # Multi-provider abstraction
│       ├── services/          # RAG + embeddings
│       └── db/                # SQLAlchemy models
└── extension/
    └── src/
        ├── content/           # Field detection + form filling
        ├── background/        # Service worker
        ├── popup/             # UI (Main, Settings, Account tabs)
        └── shared/            # Types, messages, settings
```

## License

MIT
