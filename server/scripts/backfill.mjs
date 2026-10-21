// Builds study notes (embeddings) for games finished before the vector search existed, or whose
// indexing failed. Safe to run repeatedly: chunks have deterministic ids, so they are updated, not duplicated.
//   npm run ingest:backfill
import 'dotenv/config';
import mongoose from 'mongoose';
import { GameSession } from '../src/models/GameSession.js';
import { ingestGame } from '../src/ai/ingest.js';
import { ensureVectorIndex } from '../src/ai/vectorStore.js';

await mongoose.connect(process.env.MONGODB_URI);
console.log('Vector index:', await ensureVectorIndex());

let games = 0;
let chunks = 0;
for await (const game of GameSession.find().sort({ endedAt: 1 }).lean()) {
  try {
    chunks += await ingestGame(game);
    games += 1;
  } catch (err) {
    console.warn(`Skipped game ${game._id}: ${err.message}`);
  }
}
console.log(`Indexed ${chunks} chunks from ${games} games.`);
await mongoose.disconnect();
