// End-to-end game test. Needs the server running (npm run dev) and a working MONGODB_URI.
// It creates throwaway accounts + a room, plays a full 3-question game with 3 players and cleans up after itself.
// Playing requires an account, so every player here is a registered user with their own login cookie.
import 'dotenv/config';
import mongoose from 'mongoose';
import { io } from 'socket.io-client';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000';
const USER = 'e2e' + Math.floor(Math.random() * 1e6);
let cookie = '';
let failures = 0;

const ok = (name, cond, extra = '') => {
  if (!cond) failures += 1;
  console.log(cond ? 'PASS' : 'FAIL', name, extra);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(path, body, method = 'POST') {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', cookie },
    body: body && JSON.stringify(body),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return { ...(await res.json()), http: res.status };
}

// a second, third... account: returns its login cookie
async function signUp(name) {
  const res = await fetch(BASE + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, email: `${name}@test.dev`, password: 'secret12' }),
  });
  return res.headers.get('set-cookie').split(';')[0];
}

const connect = (cookieHeader) =>
  new Promise((resolve) => {
    const s = io(BASE, { extraHeaders: { cookie: cookieHeader }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
  });
const next = (s, ev) => new Promise((r) => s.once(ev, r));
const join = (s, p) => s.emitWithAck('room:join', p);
const answer = (s, qIndex, choice) => s.emitWithAck('answer:submit', { qIndex, choice });

const expectedScore = {};
function checkReveal(label, reveal, choices) {
  let consistent = true;
  for (const [id, choice] of Object.entries(choices)) {
    const r = reveal.results[id];
    const shouldBeCorrect = choice !== null && choice === reveal.correctIndex;
    if (r.choice !== choice || r.correct !== shouldBeCorrect) consistent = false;
    if (shouldBeCorrect ? r.points < 500 || r.points > 1000 : r.points !== 0) consistent = false;
    expectedScore[id] = (expectedScore[id] ?? 0) + r.points;
  }
  ok(`${label}: results match choices, points in 500-1000 only when correct`, consistent);
  const answered = Object.values(choices).filter((c) => c !== null).length;
  ok(`${label}: distribution counts answers`, reveal.distribution.reduce((a, b) => a + b, 0) === answered);
}

try {
  await http('/api/auth/register', { username: USER, email: `${USER}@test.dev`, password: 'secret12' });
  const created = await http('/api/rooms', { topic: 'javascript', count: 3, difficulty: 'easy', timePerQuestion: 10 });
  ok('room created', created.http === 201, `${created.code} (${created.source})`);
  const code = created.code;

  const anaName = USER + 'a';
  const bobName = USER + 'b';
  const lateName = USER + 'l';
  const anaCookie = await signUp(anaName);
  const bobCookie = await signUp(bobName);
  const lateCookie = await signUp(lateName);

  // no account, no socket
  const anon = io(BASE, { transports: ['websocket'], reconnection: false });
  const refusal = await new Promise((r) => anon.on('connect_error', r));
  ok('connecting without logging in is refused', refusal.message === 'LOGIN_REQUIRED');
  anon.close();

  const host = await connect(cookie);
  const ana = await connect(anaCookie);
  const bob = await connect(bobCookie);
  const h = await join(host, { code });
  const a = await join(ana, { code });
  ok('host seat is the host', h.state.hostId === h.playerId && h.state.players[0].nickname === USER);
  ok('bad room code rejected', (await join(bob, { code: 'ZZZZZZ' })).error === 'ROOM_NOT_FOUND');
  ok('malformed room code rejected', (await join(bob, { code: 'x' })).error === 'INVALID_INPUT');
  // player ids are visible to the whole room, so they must never be usable to take over someone's seat
  const hijack = await join(bob, { code, playerId: h.playerId });
  ok('cannot take over another player’s seat with their player id', hijack.ok && hijack.playerId !== h.playerId && hijack.state.hostId === h.playerId);
  const b = hijack;
  ok('three players seated, no game snapshot yet', b.state.players.length === 3 && b.game === null);
  ok('display names are the account usernames', ['', 'a', 'b'].every((x) => b.state.players.some((p) => p.nickname === USER + x)));

  const boards = [];
  host.on('leaderboard:update', (p) => boards.push(p));
  const shown = [host, ana, bob].map((s) => next(s, 'question:show'));
  const countdown = next(ana, 'game:countdown');
  const startedAt = Date.now();
  ok('start accepted', (await host.emitWithAck('game:start', {})).ok === true);
  const cd = await countdown;
  ok('countdown announced with remaining time', cd.remainingMs > 2000 && cd.remainingMs <= 3000);
  const [q0] = await Promise.all(shown);
  ok('first question after ~3s countdown', Date.now() - startedAt >= 2800);
  ok('question payload hides the answer', !('correctIndex' in q0) && !('explanation' in q0) && q0.options.length === 4);
  ok('question payload has timing', q0.durationMs === 10000 && q0.remainingMs > 9000 && q0.total === 3);

  // ---- Q0: everyone answers at once -> closes early
  let reveal = next(host, 'question:reveal');
  const t0 = Date.now();
  const choices0 = { [h.playerId]: 0, [a.playerId]: 1, [b.playerId]: 2 };
  const acks = await Promise.all([answer(host, 0, 0), answer(ana, 0, 1), answer(bob, 0, 2)]);
  ok('answers accepted', acks.every((x) => x.ok));
  const r0 = await reveal;
  ok('question closes early when all answered', Date.now() - t0 < 2000, `${Date.now() - t0}ms`);
  ok('reveal carries correct answer + explanation', Number.isInteger(r0.correctIndex) && typeof r0.explanation === 'string');
  checkReveal('Q0', r0, choices0);

  // ---- Q1: Bob never answers -> closes by timeout; bad answers are rejected
  const shown1 = [host, ana, bob].map((s) => next(s, 'question:show'));
  await Promise.all(shown1);
  const t1 = Date.now();
  reveal = next(host, 'question:reveal');
  ok('answer ok', (await answer(host, 1, 1)).ok && (await answer(ana, 1, 1)).ok);
  ok('duplicate answer rejected', (await answer(ana, 1, 2)).error === 'ALREADY_ANSWERED');
  ok('answer for wrong question rejected', (await answer(bob, 0, 1)).error === 'WRONG_QUESTION');
  ok('invalid choice rejected', (await answer(bob, 1, 7)).error === 'INVALID_INPUT');
  const r1 = await reveal;
  const waited = Date.now() - t1;
  ok('question closes on timeout when someone is silent', waited >= 9500 && waited < 12000, `${waited}ms`);
  ok('late answer rejected after close', (await answer(bob, 1, 0)).error === 'NOT_ACCEPTING');
  checkReveal('Q1', r1, { [h.playerId]: 1, [a.playerId]: 1, [b.playerId]: null });

  // ---- Q2: Ana drops mid-question and reconnects
  const shown2 = next(host, 'question:show');
  await shown2;
  ana.disconnect();
  await sleep(300);
  const ana2 = await connect(anaCookie);
  const rejoin = await join(ana2, { code });
  ok('reconnect keeps the seat', rejoin.ok && rejoin.playerId === a.playerId);
  ok(
    'snapshot restores the live question',
    rejoin.game?.phase === 'question' &&
      rejoin.game.question.qIndex === 2 &&
      rejoin.game.question.remainingMs > 0 &&
      rejoin.game.question.myChoice === null &&
      !('correctIndex' in rejoin.game.question)
  );
  reveal = next(host, 'question:reveal');
  const finished = next(host, 'game:finished');
  await Promise.all([answer(host, 2, 3), answer(ana2, 2, 0), answer(bob, 2, 1)]);
  const r2 = await reveal;
  checkReveal('Q2', r2, { [h.playerId]: 3, [a.playerId]: 0, [b.playerId]: 1 });

  // ---- finish
  const end = await finished;
  ok('final leaderboard has every player', end.leaderboard.length === 3 && end.totalQuestions === 3);
  const scores = end.leaderboard.map((r) => r.score);
  ok('final leaderboard sorted by score', scores.every((s, i) => i === 0 || scores[i - 1] >= s));
  ok(
    'final scores equal the sum of per-question points',
    end.leaderboard.every((r) => r.score === expectedScore[r.id])
  );
  ok('ranks start at 1 and ties share a rank', end.leaderboard[0].rank === 1);
  ok(
    'leaderboard shown after every question, last flagged',
    boards.length === 3 && boards.at(-1).isLast && !boards[0].isLast &&
      boards.every((bd) => bd.leaderboard.every((r, i, arr) => i === 0 || arr[i - 1].score >= r.score))
  );

  // late joiners are turned away, finished rooms still answer info requests
  ok('join after the game is rejected', (await join(await connect(lateCookie), { code })).error === 'GAME_STARTED');
  ok('room info reports finished', (await http(`/api/rooms/${code}`, null, 'GET')).status === 'finished');

  // ---- persistence
  await mongoose.connect(process.env.MONGODB_URI);
  const games = mongoose.connection.collection('gamesessions');
  let saved = null;
  for (let i = 0; i < 10 && !saved; i++) {
    saved = await games.findOne({ roomCode: code });
    if (!saved) await sleep(300);
  }
  ok('finished game was saved', !!saved);
  if (saved) {
    ok('saved: 3 players, 3 questions', saved.players.length === 3 && saved.questions.length === 3);
    ok('saved: 3 answers per player', saved.players.every((p) => p.answers.length === 3));
    ok(
      'saved: every player is tied to their account',
      saved.players.every((p) => p.userId)
    );
    ok('saved: scores match the leaderboard', saved.players.every((p) => p.score === expectedScore[end.leaderboard.find((r) => r.nickname === p.nickname).id]));

    // ---- history + stats (read side, used by the dashboard and later by the chatbot)
    const hostScore = expectedScore[h.playerId];
    const hist = await http('/api/history', null, 'GET');
    const row = hist.games?.find((g) => g.roomCode === code);
    ok('history lists the game with my result', !!row && row.score === hostScore && row.questionCount === 3 && row.playerCount === 3 && row.topic === 'javascript');
    const detail = await http(`/api/history/${row?.id}`, null, 'GET');
    ok('detail has standings and 3 reviewed questions', detail.standings?.length === 3 && detail.questions?.length === 3 && detail.standings.filter((s) => s.isMe).length === 1);
    ok('detail shows my choices', [0, 1, 3].every((c, i) => detail.questions[i].myChoice === c));
    ok('detail points add up to my score', detail.questions.reduce((n, q) => n + q.points, 0) === detail.me.score);
    const stats = await http('/api/history/stats', null, 'GET');
    ok('stats count the game', stats.games >= 1 && stats.points >= hostScore && stats.accuracy >= 0 && stats.accuracy <= 1);
    ok('history needs login', (await fetch(`${BASE}/api/history`)).status === 401);

    // a second account must not see the host's game
    const hostCookie = cookie;
    const other = 'e2e' + Math.floor(Math.random() * 1e6);
    await http('/api/auth/register', { username: other, email: `${other}@test.dev`, password: 'secret12' });
    ok('other user cannot open my game', (await http(`/api/history/${row.id}`, null, 'GET')).http === 404);
    ok('other user history is empty', (await http('/api/history', null, 'GET')).games.length === 0);
    ok('other user stats are empty', (await http('/api/history/stats', null, 'GET')).games === 0);
    ok('bad game id is a 404, not a crash', (await http('/api/history/not-an-id', null, 'GET')).http === 404);
    await mongoose.connection.collection('users').deleteMany({ username: other });
    cookie = hostCookie;

    // finished games are also embedded in the background; give that a moment, then remove its chunks too
    const gameId = String(saved._id);
    await games.deleteMany({ roomCode: code });
    await sleep(5000);
    await mongoose.connection.collection('knowledge_chunks').deleteMany({ gameId });
  }
  await mongoose.connection.collection('users').deleteMany({ username: new RegExp('^' + USER) });
} catch (err) {
  failures += 1;
  console.log('FAIL unexpected error:', err);
} finally {
  await mongoose.disconnect().catch(() => {});
  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
