# Quizverse

A real-time multiplayer quiz platform. A host picks a topic, the questions are written by AI, friends join a
room with a code, everyone answers on the same clock, and a live leaderboard decides the winner. A built-in
study assistant answers questions about your own quiz history and helps you review what you got wrong.q

Deployed Link 🚀: https://quizverse.site

**Stack:** MongoDB · Express · React · Node.js (MERN) + Socket.IO, Tailwind CSS, Framer Motion,
LangChain JS + Google Gemini, MongoDB Atlas Vector Search.

## Features

- **Accounts only** – playing, hosting and the assistant all need an account: sign up with email, or continue with Google. Your username is your name in the game.
- **Live rooms** – 6-character codes, lobby, host controls (start, remove players), up to 30 players, reconnect after a refresh or dropped connection.
- **Server-authoritative game** – the server runs the timers and scoring; the correct answer never reaches a client before a question closes. Faster correct answers score more (500–1000).
- **AI-written questions** – any topic, validated with Zod, cached in MongoDB, with an offline question bank as a fallback.
- **History and stats** – every finished game is saved for signed-in players: rank, score, per-question review, accuracy by topic.
- **Study assistant** (right sidebar, signed-in pages only, switched off during a live game) – a LangChain agent with tools over *your* data, plus vector search over your past mistakes.

## How the assistant works

```
question ──► agent (Gemini) ──► decides which tool to call
                                 ├─ get_my_quiz_history      ┐
                                 ├─ get_game_leaderboard     │ exact answers: MongoDB queries,
                                 ├─ get_my_stats             │ scoped to the logged-in user
                                 ├─ get_my_mistakes          ┘
                                 └─ search_my_study_notes ──► semantic search: embeddings in Atlas Vector Search,
                                                              filtered to the logged-in user
```

- The user id comes from the login cookie and is captured server-side inside each tool. It is **not** a tool parameter, so the model cannot be talked into reading someone else's data.
- Structured questions ("who were the top 3 in my last quiz?") use database queries because they need exact answers. Fuzzy ones ("help me with what I keep getting wrong about networking") use vector search over embedded missed questions and explanations.
- When a game ends, its chunks are embedded in the background (one embedding request per game). `npm run ingest:backfill` indexes older games.

## Project layout

```
client/            React (Vite) app
  src/pages/       Landing, Auth, Dashboard, History, Lobby, CreateRoom, Join
  src/components/  game screens, leaderboard, chat panel, UI primitives
  src/lib/         api, socket, zustand stores (auth, room/game, chat)
server/
  src/ai/          Gemini client + quota handling, question generator, chat agent, tools, vector store
  src/sockets/     room manager, game loop, socket handlers
  src/routes/      auth, rooms, questions, history, chat (SSE)
  src/services/    history/stats queries (shared by the API and the chatbot tools)
  test/            end-to-end tests (see below)
render.yaml        one-service deployment blueprint
```

## Run it locally

Requirements: Node 20+, a MongoDB **Atlas** cluster (the free M0 tier works; vector search needs Atlas), and a Google AI Studio API key.

```bash
cd server && npm install && cp .env.example .env   # then fill in the values below
cd ../client && npm install
```

`server/.env`:

| Variable | Meaning |
|---|---|
| `MONGODB_URI` | Atlas connection string (include a database name, e.g. `/quizverse`) |
| `JWT_SECRET` | random string, 32+ characters (required in production) |
| `GOOGLE_API_KEY` | key from aistudio.google.com/apikey (Gemini) |
| `GOOGLE_CLIENT_ID` | OAuth client id for "Continue with Google" (optional; see below). Without it the button is simply hidden. |
| `GEMINI_CHAT_MODEL` | main model, e.g. `gemini-3.5-flash` |
| `GEMINI_FALLBACK_MODEL` | comma-separated fallbacks, tried in order |
| `GEMINI_EMBED_MODEL` | embedding model, `gemini-embedding-001` |
| `CLIENT_URL` | where the browser loads the app (`http://localhost:5173` in dev) |

Two terminals:

```bash
cd server && npm run dev     # API + WebSockets on :5000, creates the vector index on first start
cd client && npm run dev     # app on :5173 (proxies /api and /socket.io to :5000)
```

## Tests

All tests are end-to-end scripts that talk to a running server and clean up the data they create.

| Command (in `server/`) | What it checks | Gemini use |
|---|---|---|
| `npm run test:e2e` | Whole game with 3 signed-in players: rooms, scoring, early close, timeouts, rejected answers, reconnect, seat-hijack attempt, saved results, history and stats, access control | none |
| `npm run test:auth` | Google account find/create/link logic, Google endpoint behaviour, "only signed-in users can play" for REST and sockets (20 checks) | none |
| `npm run test:rag` | Chunking, vector index, retrieval relevance, per-user isolation, idempotent indexing (15 checks) | embeddings only |
| `npm run test:chat` | The real assistant: answers match seeded data, another account sees nothing, prompt-injection attempt, memory, blocked during a live game (20 checks) | ~10 requests |

Start the server first (`npm run dev`). `test/chat.smoke.mjs` and `test/chat.rag.smoke.mjs` are single-question checks of the assistant.

## Sign in with Google (setup)

The button uses Google Identity Services: the browser gets an ID token from Google and the server verifies it (signature, expiry and that it was issued for *your* client id). No client secret is involved.

1. Go to console.cloud.google.com, create or select a project.
2. **Google Auth Platform / OAuth consent screen**: choose *External*, set an app name and support email. While the app is in *Testing*, only accounts you list under **Test users** can sign in; click *Publish app* to let anyone in (the basic email/profile scopes need no review).
3. **Credentials → Create credentials → OAuth client ID → Web application**. Under **Authorized JavaScript origins** add `http://localhost:5173` for development (exactly this, not 127.0.0.1) and your deployed URL later. No redirect URIs are needed.
4. Put the client id in `server/.env` as `GOOGLE_CLIENT_ID` and restart the server. Accounts are matched by Google id first, then by verified email, so someone who signed up with email can later use Google with the same address.

## Gemini free-tier limits (read this before a demo)

The free tier allows only a small number of requests **per model per day** (about 20 in testing) and replies can take 30–60 seconds when Google is busy. The app is built around that:

- Questions are cached per topic and difficulty, so a repeated topic costs nothing and is instant.
- A model that runs out of quota is remembered and skipped until it resets; the app moves down `GEMINI_FALLBACK_MODEL`. Each model has its own allowance, so more models means more headroom.
- If every model is out, question generation falls back to a built-in bank (JavaScript, general knowledge, science, history, geography) and the assistant shows a clear "daily limit reached" message.
- Enabling billing on the Google Cloud project removes these limits at very low cost for a project this size.
- Free-tier prompts may be used by Google to improve its products. The app only sends quiz data (nicknames, scores, questions) – never passwords or emails.

## Deploy (Render, one service)

The server serves the built React app, so the browser sees one origin and cookies and WebSockets just work.

1. Push the repo to GitHub.
2. In Atlas → Network Access, allow `0.0.0.0/0` (Render's IPs change).
3. Render → New → **Blueprint** → select the repo. Fill `MONGODB_URI`, `GOOGLE_API_KEY`, `GOOGLE_CLIENT_ID` (add your Render URL to its Authorized JavaScript origins) and `CLIENT_URL` (the service's own URL, e.g. `https://quizverse.onrender.com`); `JWT_SECRET` is generated.
4. After the first deploy, check `https://<your-url>/api/health`. The vector index is created on first start.
5. Optional: `npm run ingest:backfill` (Render shell) to index games played earlier.

Notes: the free Render plan sleeps after 15 minutes idle (the first request takes ~30–60 s to wake it), and live games live in server memory, so a restart ends games in progress (finished games are in the database).

## Known limitations

- Live game state is in memory on a single server instance; scaling out would need the Socket.IO Redis adapter.
- No "play again" button yet; finished rooms close after 30 minutes.
- Playing needs an account. The Google ID-token check itself is only exercised with a real Google sign-in (the tests cover everything around it).
- Relevance thresholds for vector search were tuned on a small sample.
