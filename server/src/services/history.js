import mongoose from 'mongoose';
import { GameSession } from '../models/GameSession.js';

// Read side of finished games. Every function takes the *caller's* userId and only ever
// returns games that user played in; the chatbot tools (later) call these same functions.

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const sameUser = (a, b) => a && String(a) === String(b);

/** Newest-first list of the user's finished games, one summary row each. */
export async function getHistory(userId, { limit = 20 } = {}) {
  const uid = oid(userId);
  const rows = await GameSession.aggregate([
    { $match: { 'players.userId': uid } },
    { $sort: { endedAt: -1 } },
    { $limit: Math.min(Math.max(limit, 1), 100) },
    {
      $project: {
        roomCode: 1,
        topic: 1,
        difficulty: '$settings.difficulty',
        endedAt: 1,
        questionCount: { $size: '$questions' },
        playerCount: { $size: '$players' },
        me: { $arrayElemAt: [{ $filter: { input: '$players', cond: { $eq: ['$$this.userId', uid] } } }, 0] },
      },
    },
    {
      $project: {
        roomCode: 1,
        topic: 1,
        difficulty: 1,
        endedAt: 1,
        questionCount: 1,
        playerCount: 1,
        rank: '$me.rank',
        score: '$me.score',
        correctCount: '$me.correctCount',
      },
    },
  ]);
  return rows.map(({ _id, ...rest }) => ({ id: String(_id), ...rest }));
}

/** One game in full: final standings plus the caller's own answer to every question. */
export async function getGameDetail(userId, gameId) {
  if (!mongoose.isValidObjectId(gameId)) return null;
  const game = await GameSession.findOne({ _id: gameId, 'players.userId': oid(userId) }).lean();
  if (!game) return null;

  const me = game.players.find((p) => sameUser(p.userId, userId));
  const standings = [...game.players]
    .sort((a, b) => a.rank - b.rank || a.nickname.localeCompare(b.nickname))
    .map((p) => ({ nickname: p.nickname, rank: p.rank, score: p.score, correctCount: p.correctCount, isMe: p === me }));

  return {
    id: String(game._id),
    roomCode: game.roomCode,
    topic: game.topic,
    settings: game.settings,
    endedAt: game.endedAt,
    me: { rank: me.rank, score: me.score, correctCount: me.correctCount },
    standings,
    questions: game.questions.map((q, i) => {
      const a = me.answers.find((x) => x.qIndex === i);
      return {
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        myChoice: a?.choice ?? null,
        correct: a?.correct ?? false,
        points: a?.points ?? 0,
      };
    }),
  };
}

/** Questions the user got wrong (or skipped), newest games first, optionally filtered by topic. */
export async function getMistakes(userId, { topic, limit = 10 } = {}) {
  const games = await GameSession.find({ 'players.userId': oid(userId) })
    .sort({ endedAt: -1 })
    .limit(30)
    .lean();
  const needle = topic?.trim().toLowerCase();
  const out = [];

  for (const g of games) {
    if (needle && !g.topic.toLowerCase().includes(needle)) continue;
    const me = g.players.find((p) => sameUser(p.userId, userId));
    for (const a of me?.answers ?? []) {
      const q = g.questions[a.qIndex];
      if (a.correct || !q) continue;
      out.push({
        topic: g.topic,
        playedAt: g.endedAt,
        question: q.text,
        yourAnswer: a.choice == null ? null : q.options[a.choice],
        correctAnswer: q.options[q.correctIndex],
        explanation: q.explanation,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Lifetime numbers for the dashboard: totals, plus accuracy per topic. */
export async function getStats(userId) {
  const uid = oid(userId);
  const [res] = await GameSession.aggregate([
    { $match: { 'players.userId': uid } },
    { $addFields: { playerCount: { $size: '$players' }, questionCount: { $size: '$questions' } } },
    { $unwind: '$players' },
    { $match: { 'players.userId': uid } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              games: { $sum: 1 },
              // a "win" needs opponents: finishing first in a solo game does not count
              wins: { $sum: { $cond: [{ $and: [{ $eq: ['$players.rank', 1] }, { $gt: ['$playerCount', 1] }] }, 1, 0] } },
              points: { $sum: '$players.score' },
              correct: { $sum: '$players.correctCount' },
              questions: { $sum: '$questionCount' },
            },
          },
        ],
        topics: [
          {
            $group: {
              _id: { $toLower: '$topic' },
              topic: { $first: '$topic' },
              games: { $sum: 1 },
              correct: { $sum: '$players.correctCount' },
              questions: { $sum: '$questionCount' },
            },
          },
          { $sort: { games: -1 } },
          { $limit: 50 },
        ],
      },
    },
  ]);

  const t = res.totals[0];
  if (!t) return { games: 0, wins: 0, points: 0, accuracy: null, bestTopic: null, weakestTopic: null, topics: [] };

  const topics = res.topics.map((x) => ({
    topic: x.topic,
    games: x.games,
    questions: x.questions,
    accuracy: x.questions ? x.correct / x.questions : 0,
  }));
  // need a few questions behind a topic before calling it a strength or weakness
  const ranked = topics.filter((x) => x.questions >= 5).sort((a, b) => b.accuracy - a.accuracy);

  return {
    games: t.games,
    wins: t.wins,
    points: t.points,
    accuracy: t.questions ? t.correct / t.questions : null,
    bestTopic: ranked[0] ?? null,
    weakestTopic: ranked.length > 1 ? ranked.at(-1) : null,
    topics: topics.slice(0, 5),
  };
}
