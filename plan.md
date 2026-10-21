# Quizverse — Project Plan

A real-time multiplayer quiz platform (MERN + Socket.IO) with a dark, modern UI and a RAG-powered study chatbot (LangChain JS + Gemini).

---

## 1. Goals

1. **Multiplayer quiz rooms** — host picks a topic, players join with a code, everyone plays the same quiz live, leaderboard at the end (and after each question).
2. **AI-generated questions** — topic in, validated multiple-choice questions out, cached in MongoDB.
3. **Right-sidebar chatbot** (outside quiz rooms only) that can:
   - teach/explain topics and solve queries,
   - answer questions about the user's own data ("what quizzes did I take?", "who were the top 3 in my last quiz?") via retrieval from our database.
4. **Slick dark UI** — consistent design system, smooth animations, mobile-friendly.

Non-goals (for now): payments, native apps, public question marketplace.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite, Tailwind CSS, shadcn/ui, Framer Motion, Lucide | Dark theme only |
| State | Zustand | Light, good for socket-driven state |
| Backend | Node.js + Express | REST for CRUD/auth/chat, Socket.IO for gameplay |
| Realtime | Socket.IO | Rooms, reconnection, acks built in |
| Database | MongoDB Atlas + Mongoose | Also provides Atlas Vector Search |
| Auth | JWT (httpOnly cookie) + bcrypt | Guests can join with a nickname; hosting & chatbot need an account |
| LLM | **Google Gemini** via `@langchain/google-genai` | Free tier (Google AI Studio key) |
| RAG / agents | **LangChain JS** (+ LangGraph for the agent loop) | `@langchain/mongodb` for vector store |
| Validation | Zod | Request validation + LLM structured output |
| Deploy | Vercel (client), Render/Railway (server), Atlas (DB) | Socket.IO needs a persistent server, not serverless |

> Model names change often. Check Google AI Studio for the current free-tier Flash / Flash-Lite models and the current embedding model before coding, and keep them in env vars (`GEMINI_CHAT_MODEL`, `GEMINI_EMBED_MODEL`).

---

## 3. Architecture

```
React (Vite) ──REST──▶ Express ──▶ MongoDB Atlas
     │                    │            ▲   (data + vector index)
     └──Socket.IO────────▶│            │
                          ▼            │
                  LangChain JS ────────┘
                  ├─ Question generator (structured output)
                  └─ Chat agent (tools + retriever)
                          │
                          ▼
                     Gemini API
```

Server layout:

```
server/
  src/
    config/        env, db, gemini
    models/        User, Quiz, Question, GameSession, ChatMessage
    routes/        auth, quizzes, sessions, chat
    sockets/       roomManager, gameLoop, handlers
    ai/
      questionGenerator.js   # topic -> validated questions
      chatAgent.js           # LangGraph agent
      tools/                 # user-scoped DB tools
      vectorStore.js         # Atlas vector search wrapper
      ingest.js              # embed finished sessions / explanations
    middleware/    auth, rateLimit, error
client/
  src/
    components/ui/   shadcn primitives (themed)
    features/        auth, lobby, game, leaderboard, chat, history
    lib/             socket, api, store
```

---

## 4. Data Models (Mongoose)

- **User**: `username`, `email`, `passwordHash`, `avatar`, `createdAt`
- **Question**: `topic`, `difficulty`, `text`, `options[4]`, `correctIndex`, `explanation`, `source` (`ai`|`manual`), `createdAt`
- **GameSession** (one finished or in-progress game):
  - `roomCode`, `hostId`, `topic`, `status` (`lobby|active|finished`)
  - `questions[]` (refs or snapshots), `settings` (timePerQuestion, count, difficulty)
  - `players[]`: `{ userId?, nickname, score, answers[{qIndex, choice, correct, ms}] }`
  - `leaderboard[]` (final ranks), `startedAt`, `endedAt`
- **ChatMessage**: `userId`, `role`, `content`, `createdAt` (chat history per user)
- **Embeddings collection** (`knowledge_chunks`): `userId?`, `type` (`session_summary`|`question_explanation`), `text`, `embedding[]`, `metadata`

Indexes: `GameSession.roomCode` (unique while active), `GameSession.players.userId`, Atlas vector index on `knowledge_chunks.embedding`.

---

## 5. Gameplay Design (Socket.IO)

**Server is authoritative**: it owns timers, correct answers and scoring. Clients never receive `correctIndex` until the question closes.

### Flow
1. Host `POST /sessions` (topic, count, time, difficulty) → server generates/fetches questions → creates room with 6-char code.
2. Players `room:join` with code + nickname (or JWT).
3. Host `game:start` → server loops: send question → timer → collect answers → reveal → leaderboard → next.
4. After last question: final leaderboard persisted to `GameSession`, podium shown.

### Events

| Direction | Event | Payload |
|---|---|---|
| C→S | `room:join` | `{ code, nickname }` |
| C→S | `room:leave` | — |
| C→S | `game:start` | — (host only) |
| C→S | `answer:submit` | `{ qIndex, choice }` |
| S→C | `room:state` | players, host, settings |
| S→C | `room:player-joined` / `-left` | player |
| S→C | `question:show` | `{ qIndex, text, options, endsAt }` (no answer) |
| S→C | `question:reveal` | `{ correctIndex, explanation, results }` |
| S→C | `leaderboard:update` | ranked players |
| S→C | `game:finished` | final leaderboard + podium |
| S→C | `error` | `{ code, message }` |

### Scoring
`points = correct ? round(1000 * (1 - elapsed / timeLimit * 0.5)) : 0` — faster correct answers score more (tunable). Timing uses server timestamps (`endsAt`), never client clocks.

### Edge cases
- Reconnect: rejoin by session token; resend current question and remaining time.
- Host disconnects: grace period, then transfer host or end game.
- Duplicate answers ignored; late answers rejected.
- Room state held in memory (`Map`), persisted at the end. Redis adapter is a stretch goal for multi-instance scaling.

---

## 6. AI Features (LangChain JS + Gemini)

### 6.1 Question generation
- `ChatGoogleGenerativeAI.withStructuredOutput(zodSchema)` to return `{ questions: [{ text, options[4], correctIndex, explanation }] }`.
- Validate with Zod; retry once on failure; reject duplicates and bad option counts.
- **Cache**: store in `Question` by `topic + difficulty`; reuse before calling Gemini again. This is the main defense against free-tier rate limits.
- Generate in one batched call per quiz, not one per question.

### 6.2 Chatbot agent
Three capabilities, handled by one LangGraph ReAct agent (`createReactAgent`) with a system prompt that lists the tools and scope:

1. **General tutoring** — explain topics, solve doubts (model knowledge, no tool needed).
2. **Personal data (structured retrieval via tools)** — every tool receives `userId` from the **server-side auth context**, never from the model:
   - `get_my_quiz_history({ limit })`
   - `get_session_leaderboard({ sessionId | "latest" })` — only for sessions the user participated in
   - `get_my_stats()` — averages, best topics, weakest topics
   - `get_my_mistakes({ topic? })`
3. **Semantic retrieval (vector RAG)** — `retrieve_study_context({ query })` searches `knowledge_chunks` (the user's past missed questions + explanations, and session summaries) using `MongoDBAtlasVectorSearch` with a `userId` pre-filter. Lets the bot say "you missed a question on closures last week — here's the concept".

Why tools *and* vectors: structured questions ("top 3 in my last quiz") need exact answers from queries; fuzzy questions ("help me with what I got wrong on networking") benefit from embeddings.

### 6.3 Ingestion
When a session finishes, a background job:
- builds a short summary per player (topic, score, rank, weak areas),
- embeds missed questions + explanations,
- writes chunks to `knowledge_chunks` with `userId` metadata.

### 6.4 Safeguards
- Chat endpoint requires auth; data tools are scoped to the caller's `userId`.
- Chatbot UI is hidden/disabled while inside an active quiz room (and the endpoint rejects if the user is in an active session) → no cheating.
- Prompt-injection hygiene: treat retrieved text as data; system prompt forbids revealing other users' personal data.
- Stream responses (SSE) for a responsive feel.

### 6.5 Free-tier constraints (plan for them)
- Rate limits (requests/min and per day) — add per-user rate limiting, a simple request queue, and graceful "AI is busy" errors.
- Cache aggressively (questions, embeddings).
- Free-tier prompts may be used by Google to improve products — don't send secrets; keep personal data in prompts minimal (usernames and scores only).
- Keep a **seeded fallback question bank** (~50 questions across a few topics) so a demo works even if the API quota is exhausted.

---

## 7. REST API (sketch)

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register`, `/login`, `/logout` | Auth |
| GET | `/api/auth/me` | Current user |
| POST | `/api/sessions` | Create room (generates questions) |
| GET | `/api/sessions/:code` | Room info (pre-join) |
| GET | `/api/sessions/mine` | My history |
| GET | `/api/sessions/:id` | Session results |
| POST | `/api/chat` | Send message (SSE stream) |
| GET | `/api/chat/history` | Past messages |

---

## 8. UI / UX

### Design principles
Black theme, modern and slick: high contrast, lots of breathing room, one accent colour, subtle depth, purposeful motion.

### Design tokens (Tailwind theme)
- **Background**: `#0a0a0b` (base), `#111113` (surface), `#18181b` (raised)
- **Border**: `rgba(255,255,255,0.08)`
- **Text**: `#fafafa` primary, `#a1a1aa` muted
- **Accent**: one of violet `#8b5cf6` / lime `#a3e635` / cyan `#22d3ee` (pick one, use for CTAs, timer, highlights)
- **Feedback**: green `#22c55e` correct, red `#ef4444` wrong
- **Radius**: 12–16px cards, pill buttons; **Shadows**: soft glows, not heavy drop shadows
- **Fonts**: Inter/Geist (UI), mono font for room codes, timers and scores

### Screens
1. Landing — hero, "Join with code" input front and centre, "Host a quiz" CTA
2. Auth — login/register (minimal, centred card)
3. Dashboard — join/create, recent games, quick stats
4. Create room — topic, count, difficulty, time per question
5. Lobby — big room code, animated player avatars joining, host Start button
6. Question — large question card, 4 answer tiles (keys 1–4), shrinking timer bar/ring, live "answered" count
7. Reveal — correct tile highlights, explanation, points earned
8. Between-question leaderboard — rows animate when ranks change
9. Final podium — top 3 podium, confetti for the winner, full list below
10. History & stats — past games, per-topic accuracy
11. **Chat sidebar** — collapsible right panel (glass effect), streaming replies, typing indicator, suggested prompts ("My last quiz results", "Explain recursion"), disabled with a note while in a room

### Motion (Framer Motion)
Layout animations for leaderboard reorder, spring on answer press, timer easing, staggered lobby avatars, podium rise.

### Quality bar
Responsive down to ~360px (players will join on phones), keyboard-accessible, visible focus rings, AA contrast, skeleton loaders (no bare spinners), `prefers-reduced-motion` respected.

---

## 9. Milestones (~7 weeks; adjust to your deadline)

| Week | Deliverable |
|---|---|
| 1 | Repo setup, Vite + Tailwind + shadcn dark theme, Express + Mongo, auth (register/login/JWT), design tokens |
| 2 | Question generator (LangChain + Gemini + Zod), caching, seeded fallback bank |
| 3 | Socket.IO rooms: create, join, lobby, host controls |
| 4 | Game loop: timer, answers, scoring, reveal, leaderboard, final podium, persistence |
| 5 | UI polish pass on all game screens + animations; reconnection handling |
| 6 | Chatbot: sidebar UI, LangGraph agent, user-scoped tools, SSE streaming |
| 7 | Vector RAG (ingestion + retrieval), history/stats page, testing, deploy, demo script |

Buffer: use any slack on Redis adapter, achievements, or host-uploaded custom questions.

---

## 10. Testing

- Unit: scoring function, Zod schemas, tool functions (with mocked DB).
- Integration: socket flow with `socket.io-client` simulating 3+ players.
- AI: a small fixed set of chat prompts to check that tools are called with the right user scope and that other users' data is never returned.
- Manual: multi-device playtest (phones + laptop) before the demo.

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Gemini free-tier rate limits / outages | Cache questions, batch generation, seeded fallback bank, per-user rate limiting |
| LLM returns malformed/wrong questions | Structured output + Zod validation + retry; `explanation` field helps spot errors |
| Cheating via chatbot | Chat disabled in rooms (client + server check) |
| Data leak across users in RAG | `userId` injected server-side into tools and vector pre-filters |
| Socket scaling / state loss on restart | Single instance for the demo; Redis adapter as a stretch goal |
| Scope creep | Core quiz flow first; chatbot vector RAG is the last build step |

---

## 12. Environment Variables

```
MONGODB_URI=
JWT_SECRET=
CLIENT_URL=
GOOGLE_API_KEY=            # Gemini (Google AI Studio)
GEMINI_CHAT_MODEL=
GEMINI_EMBED_MODEL=
```

## 13. Key Packages

- Server: `express`, `socket.io`, `mongoose`, `zod`, `jsonwebtoken`, `bcrypt`, `cookie-parser`, `cors`, `express-rate-limit`, `langchain`, `@langchain/core`, `@langchain/google-genai`, `@langchain/mongodb`, `@langchain/langgraph`
- Client: `react`, `react-router-dom`, `socket.io-client`, `zustand`, `tailwindcss`, `framer-motion`, `lucide-react`, `canvas-confetti`

---

## 14. Implementation status and deviations from this plan

All seven milestones are built. What changed along the way:

- **Chat transport:** server-sent events over `POST /api/chat` (token, tool, done, error events) rather than WebSockets.
- **Assistant design:** a LangChain `createAgent` with four exact-query tools over MongoDB plus one vector-search tool (`search_my_study_notes`), as planned. Tools take the user id from the authenticated request, never from the model.
- **Vector search:** 768-dimension `gemini-embedding-001` vectors in Atlas Vector Search with a `userId` pre-filter. Relevance is cut off by an absolute floor and a window below the best hit.
- **Gemini free-tier reality:** about 20 requests per model per day and 30-60 s latency were observed. Added a model fallback chain that remembers exhausted models, per-model timeouts and SSE keep-alives. The seeded question bank is used when nothing else is available.
- **Deployment:** a single service that serves both the API and the built React app (same origin) instead of Vercel + Render, because cross-site cookies and proxied WebSockets are unreliable. See `render.yaml`.
- **Not done:** Redis adapter, "play again", host-uploaded questions, achievements (stretch goals).
- **Auth:** an account is required for everything, including joining a game (no guests). Email/password or "Continue with Google" (Google Identity Services; the server verifies the ID token). The username is the in-game name. Seats are matched by account, never by a client-sent id.
- **Testing:** end-to-end suites in `server/test` (game, auth: 20, retrieval: 15, assistant: 20). No browser/UI automated tests.
