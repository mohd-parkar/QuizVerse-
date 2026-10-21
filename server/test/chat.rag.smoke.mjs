// One concept question through the whole stack: seeded missed questions -> embeddings -> vector tool -> reply.
// Uses a few Gemini requests (free-tier quota is small), so run it sparingly. Needs the server running.
import 'dotenv/config';
import mongoose from 'mongoose';
import { ingestGame } from '../src/ai/ingest.js';
import { getVectorStore, makeEmbeddings } from '../src/ai/vectorStore.js';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000';
const name = 'rag' + Math.floor(Math.random() * 1e6);
let cookie = '';
const call = async (path, body) => {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return res;
};

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection;
let gameId;
try {
  const user = (await (await call('/api/auth/register', { username: name, email: `${name}@test.dev`, password: 'secret12' })).json()).user;
  const uid = new mongoose.Types.ObjectId(user.id);
  const q = (text, options, correctIndex, explanation) => ({ text, options, correctIndex, explanation });
  const game = {
    _id: new mongoose.Types.ObjectId(), roomCode: 'RAGSM1', hostUserId: uid, topic: 'Computer Networks',
    settings: { count: 2, difficulty: 'medium', timePerQuestion: 20 }, startedAt: new Date(), endedAt: new Date(),
    questions: [
      q('Which protocol uses a three-way handshake to establish a connection?', ['UDP', 'TCP', 'ICMP', 'ARP'], 1, 'TCP sets up a connection with SYN, SYN-ACK and ACK before any data is sent.'),
      q('What does DNS do?', ['Translates domain names to IP addresses', 'Encrypts web traffic', 'Assigns MAC addresses', 'Routes packets'], 0, 'DNS resolves human-readable names to IP addresses.'),
    ],
    players: [
      { userId: uid, nickname: name, score: 0, correctCount: 0, rank: 1, answers: [{ qIndex: 0, choice: 0, correct: false, points: 0, ms: 5000 }, { qIndex: 1, choice: 1, correct: false, points: 0, ms: 5000 }] },
      { userId: null, nickname: 'Rival', score: 0, correctCount: 0, rank: 1, answers: [] },
    ],
  };
  gameId = String(game._id);
  await db.collection('gamesessions').insertOne(game);
  console.log('indexed chunks:', await ingestGame(game));

  // wait until the new chunks are searchable
  const probe = await makeEmbeddings().embedQuery('TCP handshake');
  for (let i = 0; i < 40; i++) {
    const hits = await getVectorStore().similaritySearchVectorWithScore(probe, 2, { preFilter: { userId: { $eq: user.id } } });
    if (hits.length) break;
    await new Promise((r) => setTimeout(r, 3000));
  }

  const t0 = Date.now();
  const res = await call('/api/chat', { message: process.argv[2] || 'I keep struggling with how computers connect to each other. Can you help me understand what I got wrong?' });
  let buffer = '';
  let text = '';
  for await (const part of res.body) {
    buffer += new TextDecoder().decode(part, { stream: true });
    let i;
    while ((i = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, i);
      buffer = buffer.slice(i + 2);
      const event = /^event: (.+)$/m.exec(block)?.[1];
      if (!event) continue;
      const data = JSON.parse(/^data: (.+)$/m.exec(block)?.[1] ?? '{}');
      if (event === 'token') text += data.text;
      else console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${event}`, JSON.stringify(data));
    }
  }
  console.log('REPLY:', text.replace(/\s+/g, ' '));
} finally {
  await db.collection('knowledge_chunks').deleteMany({ gameId });
  await db.collection('gamesessions').deleteMany({ roomCode: 'RAGSM1' });
  const u = await db.collection('users').findOne({ username: name });
  if (u) await db.collection('chatmessages').deleteMany({ userId: u._id });
  await db.collection('users').deleteMany({ username: name });
  await mongoose.disconnect();
}
