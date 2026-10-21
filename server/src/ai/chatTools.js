import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getGameDetail, getHistory, getMistakes, getStats } from '../services/history.js';
import { searchStudyNotes } from './vectorStore.js';

/**
 * The chatbot's window into the database.
 *
 * `userId` comes from the authenticated request and is captured here in a closure. It is NOT a tool
 * parameter, so the model cannot ask for another user's data, whatever the conversation says.
 */
export function createTools(userId) {
  // a failing query should read as "no data" to the model, not crash the whole turn
  const safe = (fn) => async (input) => {
    try {
      return JSON.stringify(await fn(input));
    } catch (err) {
      console.error('chat tool failed:', err.message);
      return JSON.stringify({ error: 'Could not load that data right now.' });
    }
  };

  const getMyQuizHistory = tool(
    safe(async ({ limit }) => {
      const games = await getHistory(userId, { limit });
      if (!games.length) return { note: 'The user has not finished any games yet.', games: [] };
      return {
        games: games.map((g) => ({
          gameId: g.id,
          topic: g.topic,
          finishedAt: g.endedAt,
          difficulty: g.difficulty,
          players: g.playerCount,
          yourRank: g.rank,
          yourScore: g.score,
          correct: `${g.correctCount}/${g.questionCount}`,
        })),
      };
    }),
    {
      name: 'get_my_quiz_history',
      description:
        "List the user's most recent finished quiz games, newest first: topic, date, rank, score and accuracy. Use for 'what quizzes did I take', 'how did I do recently'.",
      schema: z.object({ limit: z.number().int().min(1).max(20).default(5).describe('How many games to return') }),
    }
  );

  const getGameLeaderboard = tool(
    safe(async ({ gameId }) => {
      let id = gameId;
      if (id === 'latest') {
        const [latest] = await getHistory(userId, { limit: 1 });
        if (!latest) return { note: 'The user has not finished any games yet.' };
        id = latest.id;
      }
      const game = await getGameDetail(userId, id);
      if (!game) return { note: 'No such game among the games this user played.' };
      return {
        topic: game.topic,
        finishedAt: game.endedAt,
        questions: game.questions.length,
        standings: game.standings.slice(0, 10).map((s) => ({
          rank: s.rank,
          nickname: s.nickname,
          score: s.score,
          correct: `${s.correctCount}/${game.questions.length}`,
          isTheUser: s.isMe,
        })),
      };
    }),
    {
      name: 'get_game_leaderboard',
      description:
        "Final standings (rank, nickname, score) of one game the user played, e.g. 'who were the top 3 in my last quiz'. Pass gameId from get_my_quiz_history, or the word 'latest' for the most recent game.",
      schema: z.object({
        gameId: z.string().describe("A gameId from get_my_quiz_history, or 'latest'"),
      }),
    }
  );

  const getMyStats = tool(
    safe(async () => {
      const s = await getStats(userId);
      if (!s.games) return { note: 'The user has not finished any games yet.' };
      return {
        gamesPlayed: s.games,
        wins: s.wins,
        totalPoints: s.points,
        overallAccuracy: s.accuracy,
        strongestTopic: s.bestTopic,
        weakestTopic: s.weakestTopic,
        topicsPlayed: s.topics,
      };
    }),
    {
      name: 'get_my_stats',
      description:
        "The user's lifetime numbers: games played, wins, points, accuracy overall and per topic, strongest and weakest topic. Use for 'what am I good at', 'what should I practise'.",
      schema: z.object({}),
    }
  );

  const getMyMistakes = tool(
    safe(async ({ topic, limit }) => {
      const mistakes = await getMistakes(userId, { topic, limit });
      if (!mistakes.length) return { note: 'No wrong answers found' + (topic ? ` for "${topic}"` : '') + '.', mistakes: [] };
      return { mistakes };
    }),
    {
      name: 'get_my_mistakes',
      description:
        'Questions the user answered wrongly or skipped in past games, with their answer, the correct answer and an explanation. Use for review, revision and "what did I get wrong".',
      schema: z.object({
        topic: z.string().optional().describe('Only mistakes from games whose topic contains this text'),
        limit: z.number().int().min(1).max(15).default(8),
      }),
    }
  );

  const searchMyStudyNotes = tool(
    safe(async ({ query }) => {
      const notes = await searchStudyNotes(userId, query, 4);
      if (!notes.length) return { note: 'No related notes found in the user\'s past games.', notes: [] };
      return { notes };
    }),
    {
      name: 'search_my_study_notes',
      description:
        "Semantic search over the user's own past quiz notes (questions they missed with the correct answer and explanation, plus game summaries). Use when a request is about a concept or topic rather than a date or rank, e.g. 'help me with what I keep getting wrong about networking', 'what should I review about photosynthesis'. Then explain the concept using the notes.",
      schema: z.object({ query: z.string().min(2).max(200).describe('What the user wants to study, in natural language') }),
    }
  );

  return [getMyQuizHistory, getGameLeaderboard, getMyStats, getMyMistakes, searchMyStudyNotes];
}
