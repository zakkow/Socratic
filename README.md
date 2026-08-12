# Socratic

> Don't just get the answer. Master the concept.

Socratic is a collaborative study application designed to connect students working through difficult academic concepts. Rather than providing direct answers, the platform focuses on guided learning through peer matching, synchronized whiteboards, and a hybrid AI tutoring system.

---

## Features

- **Hybrid AI Architecture**:
  - **Local Classification Tier**: Uses a scikit-learn TF-IDF model for fast topic classification, catalog search, and input moderation.
  - **Reasoning Tier (Groq Llama 3.3-70B)**: Escalates unclassified or complex topics to Groq Llama 3.3-70B for guided Socratic dialogue and step-by-step problem breakdown.
- **Real-Time Peer Matching & Whiteboard**:
  - Matches students working on the same course topics (CS101, MATH201, CIV101, PHYS150).
  - Synchronized canvas whiteboard with brush drawing, shape tools, and low-latency WebSocket stroke sync.
- **Public Solution History & Consent**:
  - Mutual consent publishing requirement (2/2 for peer sessions, 1/1 for AI sessions).
  - Automated solution tagging and search indexing for community review.
- **Safety & Moderation**:
  - Built-in profanity content filter.
  - Persistent user blocking, block guards on friend requests, and a dedicated unblocking interface.
- **Multi-Disciplinary Design**:
  - Neo-Brutalist UI with high contrast compliance and multi-subject visual indicators across Math, Computer Science, Literature, Civics, and Sciences.

---

## Architecture

```
                        ┌──────────────────────────────────────────┐
                        │              React + Vite UI             │
                        │        (Neo-Brutalist CSS System)        │
                        └────────────────────┬─────────────────────┘
                                             │
                                     HTTP / WebSockets
                                             │
                        ┌────────────────────▼─────────────────────┐
                        │             FastAPI Backend              │
                        └──────────┬────────────────────┬──────────┘
                                   │                    │
              ┌────────────────────▼─────┐        ┌─────▼──────────────────┐
              │   Local Scikit-Learn     │        │     Groq Llama 3.3     │
              │   TF-IDF Classifier      │        │    70B Reasoning AI    │
              └──────────────────────────┘        └────────────────────────┘
```

---

## Tech Stack

- **Frontend**: React 18, Vite, Lucide Icons, HTML5 Canvas, Web Audio API
- **Backend**: Python 3.10+, FastAPI, SQLAlchemy, WebSockets, Pydantic
- **ML / AI**: Scikit-Learn (TF-IDF Vectorization), Groq Llama-3.3-70B API
- **Database**: SQLite (`studymatch.db`)

---

## Local Setup

### Prerequisites
- Node.js v18+
- Python 3.10+
- Groq API Key (Free key available at [console.groq.com](https://console.groq.com))

### 1. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file from template
cp .env.example .env

# Set your API Key in backend/.env:
# GROQ_API_KEY=your_groq_api_key_here

# Start backend server
python -m uvicorn main:app --reload --port 8000
```

The backend server will start at `http://localhost:8000`.

### 2. Frontend

```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```

The web client will start at `http://localhost:5173`.

---

## Deployment

- **Frontend (Netlify / Vercel)**: Includes a `netlify.toml` for single-page routing. Set `VITE_API_BASE_URL` to your backend URL in environment settings.
- **Backend (Render / Railway)**: Includes a `Procfile` (`uvicorn main:app --host 0.0.0.0 --port $PORT`). Set `GROQ_API_KEY` in server environment settings.

---

## License

Distributed under the MIT License.
