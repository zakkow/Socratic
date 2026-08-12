# 🏛️ Socratic

> **Don't just get the answer. Master the concept.**

Socratic is a modern, AI-powered collaborative learning platform built to connect students working through difficult academic concepts. Rather than spoon-feeding homework answers, Socratic enforces **Socratic pedagogy**—guiding students step-by-step through interactive peer matching, real-time synchronized whiteboards, and a hybrid tiered AI tutoring engine.

---

## 🌟 Key Features

* **⚡ Hybrid Tiered AI Architecture**:
  * **Edge / Local ML Classifier**: Uses a local `scikit-learn` TF-IDF vectorizer and cosine similarity matrix for sub-millisecond topic classification, catalog routing, and rule-based gibberish moderation.
  * **Reasoning Tier (Groq Llama 3.3-70B)**: Unclassifiable or complex topics automatically escalate to Groq Llama 3.3-70B for intelligent academic verification and guided 4-step Socratic dialogue.
* **🤝 Real-Time Peer Matching & Whiteboard**:
  * Matches students studying identical course topics (`CS101`, `MATH201`, `CIV101`, `PHYS150`).
  * Live synchronized canvas whiteboard supporting brush drawing, shape tools, and low-latency WebSocket stroke dispatches.
* **📜 Public Community Solutions & Mutual Consent `(x/2)`**:
  * End-of-session 5-star pedagogical ratings and mutual consent publishing `(2/2 for peers, 1/1 for AI)`.
  * Automated AI quality inspection and search tag extraction (`#ChainRule`, `#Derivatives`, `#Recursion`).
* **🛡️ Social Safety & Persistent Moderation**:
  * Profanity content filter with real-time text redaction (`***`).
  * Persistent user blocking with block guards on friend requests and a dedicated **Blocked Users Drawer** with 1-click unblocking.
* **📱 Multi-Disciplinary Neo-Brutalist UI**:
  * Bold black borders, vibrant color palette, floating multi-disciplinary academic chips (Math, CS, Literature, Civics, Science), and full WCAG AA contrast compliance.

---

## 🏗️ Architecture Overview

```
                        ┌──────────────────────────────────────────┐
                        │              React + Vite UI             │
                        │    (Neo-Brutalist CSS Design System)     │
                        └────────────────────┬─────────────────────┘
                                             │
                                     HTTP / WebSockets
                                             │
                        ┌────────────────────▼─────────────────────┐
                        │             FastAPI Backend              │
                        └──────────┬────────────────────┬──────────┘
                                   │                    │
              ┌────────────────────▼─────┐        ┌─────▼──────────────────┐
              │  Local Scikit-Learn ML   │        │     Groq Llama 3.3     │
              │   TF-IDF Classifier      │        │    70B Reasoning AI    │
              └──────────────────────────┘        └────────────────────────┘
```

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, Lucide Icons, Web Audio API (`soundFX.js`), HTML5 Canvas
- **Backend**: Python 3.10+, FastAPI, SQLAlchemy, WebSockets, Pydantic
- **Machine Learning & AI**: Scikit-Learn (TF-IDF Vectorization), Groq Llama-3.3-70B API
- **Database**: SQLite (`studymatch.db`) with dynamic schema migration
- **Styling**: Vanilla CSS3 custom properties (Design System tokenized architecture)

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: v3.10 or higher
- **Groq API Key**: Get a free API key at [console.groq.com](https://console.groq.com)

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Create .env configuration file
cp .env.example .env

# Add your Groq API Key to backend/.env:
# GROQ_API_KEY=gsk_your_actual_api_key_here

# Launch FastAPI backend server
python -m uvicorn main:app --reload --port 8000
```
*The backend server will run on `http://localhost:8000` (API Docs available at `http://localhost:8000/docs`).*

---

### 2. Frontend Setup

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install Node modules
npm install

# Start Vite development server
npm run dev
```
*The web application will launch locally at `http://localhost:5173`.*

---

## 📦 Production Deployment

### Frontend (Netlify / Vercel)
The repository includes a pre-configured [netlify.toml](frontend/netlify.toml) file supporting Single-Page Application (SPA) routing:
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
- **Environment Variable**: Set `VITE_API_BASE_URL` to your live FastAPI backend URL.

### Backend (Render / Railway / Fly.io)
The repository includes a [Procfile](backend/Procfile) for containerized web execution:
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Environment Variable**: Set `GROQ_API_KEY` in server environment settings.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
