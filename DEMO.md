# Demo script (about 6 minutes)

## Before you present (do this the day before and again 10 minutes before)

- [ ] Open `https://<your-url>/api/health` to wake the server if it is on a free plan.
- [ ] **Warm the question cache.** Host one room for each topic you will use, with the exact count and difficulty you will demo. A cached topic starts instantly; a new one can take 30+ seconds on the free Gemini tier.
- [ ] **Give the assistant something to talk about.** Sign in as your demo account and finish one game with a few deliberately wrong answers (a friend or a second browser works). Wait a minute so the study notes are indexed.
- [ ] Check Gemini quota at ai.dev/rate-limit. Each model allows few requests a day; do not run the test suite right before presenting.
- [ ] Have two devices ready: your laptop (host) and a phone (player), each signed in to a different account (everyone needs an account to play). A second browser profile also works.
- [ ] Close other tabs; zoom the browser to ~110%.

## Script

**1. The pitch (30 s)**
"Quizverse is a multiplayer quiz platform. Anyone can host a game on any topic, friends join with a code, and everyone races on the same clock. It also has an AI study assistant that knows your own results."

**2. Host a game (1 min)**
- Log in → *Create room*. Type the cached topic, 5 questions, 20 s each.
- Say: "The questions are written by Gemini through LangChain, validated against a schema, and cached in MongoDB so popular topics are instant."
- Land in the lobby: point at the big room code.

**3. Players join (1 min)**
- Phone: open the link, sign in (Google is one tap), tap *Join game*. Say: "Everyone plays as their account, so results go into their history."
- Players pop into the lobby live. Say: "That is Socket.IO. The server owns the game state."
- Optionally remove a player with the ✕ to show host controls.

**4. Play (2 min)**
- Press *Start*. Countdown, then answer from the phone (and press 1–4 on the laptop).
- Say: "Scoring is on the server: faster correct answers earn more, and the correct answer is never sent to the browser until the question closes, so you cannot cheat from dev tools."
- **Reconnect trick:** refresh the phone mid-question. It drops straight back into the live question with the right time left.
- Watch the leaderboard reorder between questions, then the podium and confetti.

**5. The assistant (1.5 min)** — *signed-in laptop, from the dashboard*
- Open the right sidebar. Ask: **"Who were the top 3 in my last game?"**
  Say: "The assistant calls a tool that queries MongoDB, scoped to my account, so it answers with real data, not a guess."
- Ask: **"I keep missing questions about <topic you got wrong>. Help me understand."**
  Say: "This one uses RAG: my missed questions are embedded and stored in Atlas Vector Search; the agent retrieves the relevant ones and teaches from them."
- Mention: it is switched off during a live game so it cannot be used to cheat, and it can never see another user's data.

**6. Wrap up (30 s)**
History page with the per-question review, then the architecture in one line: *React + Express + Socket.IO + MongoDB Atlas (data and vector search) + LangChain agent on Gemini, deployed as a single service.*

## If something goes wrong

| Problem | What to do |
|---|---|
| New topic is slow | Say "free-tier Gemini is slow; cached topics are instant" and switch to a warmed topic. |
| Question generation fails | It silently uses the built-in bank (JavaScript, science, history, geography, general knowledge). Pick one of those topics. |
| Assistant says it hit the daily limit | Show the history page instead and explain the tool/RAG design from the README diagram. |
| Assistant is slow (30–60 s) | Narrate the status line ("Looking up the leaderboard…") – it is showing the tool call happening. |
| Phone cannot reach the server | Use a second browser window as the player instead. |
| Server was asleep | First request takes up to a minute; open the health URL ahead of time. |

## Likely questions

- **Why tools *and* vector search?** Exact questions (ranks, scores) need exact database answers; fuzzy study questions benefit from semantic retrieval. Using each where it fits is more accurate than embedding everything.
- **How do you stop one user reading another's data?** The user id comes from the authenticated cookie and is baked into each tool on the server; the vector search is pre-filtered by user id inside Atlas. There is an automated test that tries to break this.
- **What about the free-tier limits?** Caching, a model fallback chain that remembers exhausted models, and an offline question bank.
- **How would it scale?** Move room state to Redis with the Socket.IO Redis adapter and run several instances.
