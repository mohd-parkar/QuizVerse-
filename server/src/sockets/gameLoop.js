import { GameSession } from '../models/GameSession.js';
import { ingestGame } from '../ai/ingest.js';
import { closeRoom, publicState } from './roomManager.js';

// Server-authoritative game loop. Phases: countdown -> (question -> reveal -> leaderboard)* -> finished.
// Clients get a `remainingMs` with every timed event instead of a clock time, so a wrong
// device clock can never skew a timer.

const COUNTDOWN_MS = 3_000;
const REVEAL_MS = 5_000;
const LEADERBOARD_MS = 4_000;
const FINISHED_ROOM_TTL_MS = 30 * 60_000;
const MAX_POINTS = 1000; // a correct answer is worth 500-1000 depending on speed

let io;
export function initGame(server) {
  io = server;
}

const emit = (room, event, payload) => io.to(room.code).emit(event, payload);
const connectedPlayers = (room) => [...room.players.values()].filter((p) => p.connected);

export function stopGame(room) {
  clearTimeout(room.game?.timer);
  clearTimeout(room.cleanupTimer);
}

export function startGame(room) {
  room.status = 'active';
  room.startedAt = new Date();
  for (const p of room.players.values()) {
    p.score = 0;
    p.correctCount = 0;
    p.answers = [];
  }
  room.game = {
    index: -1,
    phase: 'countdown',
    endsAt: Date.now() + COUNTDOWN_MS,
    startedAt: 0,
    answers: new Map(), // playerId -> { choice, ms }
    reveal: null,
    leaderboard: null,
    final: null,
    timer: null,
  };
  emit(room, 'room:state', publicState(room));
  emit(room, 'game:countdown', { remainingMs: COUNTDOWN_MS });
  room.game.timer = setTimeout(() => nextQuestion(room), COUNTDOWN_MS);
}

// what a client may see of the current question: never the correct answer
function questionPayload(room) {
  const g = room.game;
  const q = room.questions[g.index];
  return {
    qIndex: g.index,
    total: room.questions.length,
    text: q.text,
    options: q.options,
    durationMs: room.settings.timePerQuestion * 1000,
    remainingMs: Math.max(0, g.endsAt - Date.now()),
  };
}

const progressPayload = (room) => ({
  answered: room.game.answers.size,
  total: connectedPlayers(room).length,
});

function nextQuestion(room) {
  const g = room.game;
  g.index += 1;
  if (g.index >= room.questions.length) return finishGame(room);

  g.phase = 'question';
  g.answers = new Map();
  g.reveal = null;
  g.startedAt = Date.now();
  g.endsAt = g.startedAt + room.settings.timePerQuestion * 1000;

  emit(room, 'question:show', questionPayload(room));
  emit(room, 'answers:progress', progressPayload(room));
  g.timer = setTimeout(() => closeQuestion(room), g.endsAt - g.startedAt);
}

/** Returns an error code, or null when the answer was accepted. */
export function submitAnswer(room, player, { qIndex, choice } = {}) {
  const g = room.game;
  if (!g || g.phase !== 'question') return 'NOT_ACCEPTING';
  if (qIndex !== g.index) return 'WRONG_QUESTION';
  if (!Number.isInteger(choice) || choice < 0 || choice > 3) return 'INVALID_INPUT';
  if (g.answers.has(player.id)) return 'ALREADY_ANSWERED';
  const now = Date.now();
  if (now > g.endsAt) return 'TOO_LATE';

  g.answers.set(player.id, { choice, ms: now - g.startedAt });
  emit(room, 'answers:progress', progressPayload(room));

  // everyone still connected has answered: no reason to wait out the clock
  if (connectedPlayers(room).every((p) => g.answers.has(p.id))) closeQuestion(room);
  return null;
}

function closeQuestion(room) {
  const g = room.game;
  if (!g || g.phase !== 'question') return;
  clearTimeout(g.timer);

  const q = room.questions[g.index];
  const durationMs = room.settings.timePerQuestion * 1000;
  const results = {};
  const distribution = [0, 0, 0, 0];

  for (const p of room.players.values()) {
    const a = g.answers.get(p.id);
    let correct = false;
    let points = 0;
    if (a) {
      distribution[a.choice] += 1;
      correct = a.choice === q.correctIndex;
      if (correct) {
        points = Math.round(MAX_POINTS * (1 - 0.5 * (Math.min(a.ms, durationMs) / durationMs)));
        p.score += points;
        p.correctCount += 1;
      }
    }
    p.answers.push({ qIndex: g.index, choice: a?.choice ?? null, correct, points, ms: a?.ms ?? null });
    results[p.id] = { choice: a?.choice ?? null, correct, points };
  }

  g.phase = 'reveal';
  g.reveal = {
    qIndex: g.index,
    total: room.questions.length,
    text: q.text,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    distribution,
    results,
  };
  emit(room, 'question:reveal', { ...g.reveal, remainingMs: REVEAL_MS });
  g.timer = setTimeout(() => showLeaderboard(room), REVEAL_MS);
}

// highest score first; ties on score share a rank (correct answers break the order, not the rank)
function rankPlayers(room) {
  const sorted = [...room.players.values()].sort(
    (a, b) => b.score - a.score || b.correctCount - a.correctCount || a.nickname.localeCompare(b.nickname)
  );
  let rank = 0;
  return sorted.map((p, i) => {
    if (i === 0 || p.score !== sorted[i - 1].score) rank = i + 1;
    return { id: p.id, nickname: p.nickname, score: p.score, correctCount: p.correctCount, rank, connected: p.connected };
  });
}

function showLeaderboard(room) {
  const g = room.game;
  g.phase = 'leaderboard';
  const board = rankPlayers(room).map((row) => ({
    ...row,
    delta: room.players.get(row.id).answers.at(-1)?.points ?? 0,
  }));
  const isLast = g.index === room.questions.length - 1;
  g.leaderboard = { qIndex: g.index, leaderboard: board, isLast, remainingMs: LEADERBOARD_MS };
  emit(room, 'leaderboard:update', g.leaderboard);
  g.timer = setTimeout(() => nextQuestion(room), LEADERBOARD_MS);
}

function finishGame(room) {
  const g = room.game;
  g.phase = 'finished';
  room.status = 'finished';
  g.final = rankPlayers(room);

  emit(room, 'room:state', publicState(room));
  emit(room, 'game:finished', { leaderboard: g.final, totalQuestions: room.questions.length });

  persist(room, g.final).catch((err) => console.error('Failed to save game session:', err.message));
  room.cleanupTimer = setTimeout(() => closeRoom(room.code, 'finished'), FINISHED_ROOM_TTL_MS);
}

async function persist(room, ranked) {
  const rankOf = new Map(ranked.map((r) => [r.id, r.rank]));
  const saved = await GameSession.create({
    roomCode: room.code,
    hostUserId: room.hostUserId,
    topic: room.topic,
    settings: room.settings,
    questions: room.questions,
    startedAt: room.startedAt,
    endedAt: new Date(),
    players: ranked.map((r) => {
      const p = room.players.get(r.id);
      return {
        userId: p.userId,
        nickname: p.nickname,
        score: p.score,
        correctCount: p.correctCount,
        rank: rankOf.get(p.id),
        answers: p.answers,
      };
    }),
  });

  // best effort and off the critical path: the game is already saved; study notes can be rebuilt later
  ingestGame(saved.toObject()).catch((err) => console.warn('Study-note indexing failed:', err.message));
}

// lets a player who reconnects (or refreshes) mid-game pick up exactly where the room is
export function gameSnapshot(room, playerId) {
  const g = room.game;
  if (!g) return null;
  const snap = { phase: g.phase };
  if (g.phase === 'countdown') snap.remainingMs = Math.max(0, g.endsAt - Date.now());
  if (g.phase === 'question') {
    snap.question = { ...questionPayload(room), myChoice: g.answers.get(playerId)?.choice ?? null };
    snap.progress = progressPayload(room);
  }
  if (g.phase === 'reveal' || g.phase === 'leaderboard') snap.reveal = g.reveal;
  if (g.phase === 'leaderboard') snap.leaderboard = g.leaderboard;
  if (g.phase === 'finished') snap.final = { leaderboard: g.final, totalQuestions: room.questions.length };
  return snap;
}
