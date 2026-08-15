# Socratic

> Hit a wall? So did someone else. Socratic pairs you up and guides you both through it, not past it.

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
                        │                                          │
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

## Email Verification & Authentication

Socratic requires students to sign up with a valid university email ending in `.edu`.

### 1. Demo OTP Mode (Default)
By default, Socratic runs in **Demo OTP mode** with zero email server setup required:
1. Enter your name, `.edu` email (e.g. `alex@stanford.edu`), and password.
2. The system generates a 6-digit PIN, displays it on the verification card, and pre-fills the input.
3. Click **"Verify .edu Inbox & Enter Socratic"** to complete registration.
4. The PIN is also logged to the backend console.

### 2. Real Email Delivery via Gmail SMTP (Optional)
To send real one-time PIN codes directly to actual user inboxes:
1. Go to your [Google Account Security Settings](https://myaccount.google.com/security) and ensure **2-Step Verification** is turned ON.
2. Generate an App Password at [Google App Passwords](https://myaccount.google.com/apppasswords) (select app name e.g. "Socratic").
3. Add the following variables to your `backend/.env` (or Render Environment Variables):
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_16_letter_app_password
   ```
*(You can also use SendGrid, Mailgun, or Resend by updating `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` accordingly).*

---

## Deployment

- **Frontend (Netlify / Vercel)**:
  - Deployed from the `frontend/` directory with `netlify.toml` for client-side routing.
  - Set the `VITE_API_BASE_URL` environment variable in Netlify to your Render backend URL (e.g. `https://socratic-backend.onrender.com`).
- **Backend (Render / Railway)**:
  - Deployed using the root `Procfile` (`uvicorn main:app --host 0.0.0.0 --port $PORT`).
  - Set `GROQ_API_KEY` (and optional `SMTP_*` variables) in Render's Environment settings.

> **Note on Render Free Tier Cold Starts**: The backend is hosted on Render's free tier, which spins down after 15 minutes of inactivity. When visiting the site after a period of inactivity, the first request may take ~30–50 seconds while the server wakes up. Subsequent requests are fast. You do not need to keep the Render dashboard open—requests from Netlify wake it up automatically.

---

## License

Distributed under the MIT License.

