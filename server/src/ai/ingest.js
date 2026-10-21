import { Document } from '@langchain/core/documents';
import { getVectorStore } from './vectorStore.js';

const day = (date) => new Date(date).toISOString().slice(0, 10);

/** Turns one finished game into per-player study chunks (for signed-in players only). */
export function chunksForGame(game) {
  const gameId = String(game._id);
  const docs = [];
  const ids = [];

  for (const player of game.players) {
    if (!player.userId) continue; // guests have no account to attach notes to
    const userId = String(player.userId);
    const base = { userId, gameId, topic: game.topic, playedAt: game.endedAt };

    for (const answer of player.answers) {
      const q = game.questions[answer.qIndex];
      if (answer.correct || !q) continue;
      const theirs = answer.choice == null ? 'They did not answer in time.' : `They answered: ${q.options[answer.choice]}.`;
      docs.push(
        new Document({
          pageContent: `Topic: ${game.topic}. Question: ${q.text} Correct answer: ${q.options[q.correctIndex]}. ${theirs} Explanation: ${q.explanation}`,
          metadata: { ...base, kind: 'mistake' },
        })
      );
      ids.push(`${gameId}:${userId}:q${answer.qIndex}`);
    }

    docs.push(
      new Document({
        pageContent:
          `On ${day(game.endedAt)} the player took a ${game.settings.difficulty} quiz on "${game.topic}" with ${game.players.length - 1} other player(s). ` +
          `They finished rank ${player.rank} with ${player.score} points and ${player.correctCount} of ${game.questions.length} correct.`,
        metadata: { ...base, kind: 'summary' },
      })
    );
    ids.push(`${gameId}:${userId}:summary`);
  }
  return { docs, ids };
}

/**
 * Embeds a finished game's chunks and stores them. All chunks go out in one embedding request, and the
 * ids are deterministic, so running this twice for the same game updates rather than duplicates.
 */
export async function ingestGame(game) {
  const { docs, ids } = chunksForGame(game);
  if (!docs.length) return 0;
  await getVectorStore().addDocuments(docs, { ids });
  return docs.length;
}
