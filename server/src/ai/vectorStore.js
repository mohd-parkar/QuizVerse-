import mongoose from 'mongoose';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import { env } from '../config/env.js';

// Per-user study notes (missed questions, game summaries) stored with embeddings in MongoDB Atlas.
export const COLLECTION = 'knowledge_chunks';
export const INDEX_NAME = 'knowledge_vector_index';
// 768 keeps the vectors small enough for the free Atlas tier and loses little accuracy
export const EMBED_DIMENSIONS = 768;
// vectorSearchScore is cosine similarity rescaled to 0..1. With this embedding model, genuine matches
// scored 0.79-0.87 and unrelated text 0.70-0.75, so: nothing under the floor, and nothing far behind
// the best hit. Tuned on a small sample; adjust if real data shows good notes being dropped.
const MIN_RELEVANCE = 0.76;
const WITHIN_TOP = 0.08;

const collection = () => mongoose.connection.db.collection(COLLECTION);

export function makeEmbeddings() {
  if (!env.googleApiKey) throw new Error('GOOGLE_API_KEY is not set');
  return new GoogleGenerativeAIEmbeddings({
    model: env.embedModel,
    apiKey: env.googleApiKey,
    outputDimensionality: EMBED_DIMENSIONS,
  });
}

export function getVectorStore() {
  return new MongoDBAtlasVectorSearch(makeEmbeddings(), {
    collection: collection(),
    indexName: INDEX_NAME,
    textKey: 'text',
    embeddingKey: 'embedding',
  });
}

/**
 * Creates the Atlas vector index if it is missing. `userId` is a filter field so every search can be
 * restricted to one user's chunks inside the database. Index builds take a few seconds to a minute.
 * Returns 'exists' | 'created' | 'unavailable' (e.g. not running on Atlas).
 */
export async function ensureVectorIndex() {
  try {
    await mongoose.connection.db.createCollection(COLLECTION).catch(() => {}); // already exists is fine
    const existing = await collection().listSearchIndexes(INDEX_NAME).toArray();
    if (existing.length) return 'exists';
    await collection().createSearchIndex({
      name: INDEX_NAME,
      type: 'vectorSearch',
      definition: {
        fields: [
          { type: 'vector', path: 'embedding', numDimensions: EMBED_DIMENSIONS, similarity: 'cosine' },
          { type: 'filter', path: 'userId' },
        ],
      },
    });
    return 'created';
  } catch (err) {
    console.warn('Vector search index not available:', err.message);
    return 'unavailable';
  }
}

export async function isIndexQueryable() {
  const [index] = await collection().listSearchIndexes(INDEX_NAME).toArray();
  return Boolean(index?.queryable);
}

/** Most relevant study notes for `query`, restricted to this user's own chunks. */
export async function searchStudyNotes(userId, query, k = 4) {
  const results = await getVectorStore().similaritySearchWithScore(query, k, {
    preFilter: { userId: { $eq: String(userId) } },
  });
  const best = results[0]?.[1] ?? 0; // results arrive best-first
  return results
    .filter(([, score]) => score >= MIN_RELEVANCE && score >= best - WITHIN_TOP)
    .map(([doc, score]) => ({
      kind: doc.metadata.kind,
      topic: doc.metadata.topic,
      playedAt: doc.metadata.playedAt,
      relevance: Number(score.toFixed(2)),
      text: doc.pageContent,
    }));
}
