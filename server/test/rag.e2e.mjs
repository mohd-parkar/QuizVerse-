// Vector-search (RAG retrieval) test. Needs MONGODB_URI on Atlas and GOOGLE_API_KEY (embeddings only, no chat model).
// Seeds games for two users, indexes them, and checks relevance and per-user isolation. Cleans up after itself.
import 'dotenv/config';
import mongoose from 'mongoose';
import { chunksForGame, ingestGame } from '../src/ai/ingest.js';
import {
  COLLECTION,
  ensureVectorIndex,
  getVectorStore,
  isIndexQueryable,
  makeEmbeddings,
  searchStudyNotes,
} from '../src/ai/vectorStore.js';

let failures = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failures += 1;
  console.log(cond ? 'PASS' : 'FAIL', name, extra);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const oid = () => new mongoose.Types.ObjectId();

const userA = oid();
const userB = oid();
const userC = oid(); // never plays anything

const settings = { count: 3, difficulty: 'medium', timePerQuestion: 20 };
const netQuestions = [
  { text: 'Which protocol uses a three-way handshake to establish a connection?', options: ['UDP', 'TCP', 'ICMP', 'ARP'], correctIndex: 1, explanation: 'TCP sets up a connection with SYN, SYN-ACK and ACK before any data is sent.' },
  { text: 'What does DNS do?', options: ['Translates domain names to IP addresses', 'Encrypts web traffic', 'Assigns MAC addresses', 'Routes packets between networks'], correctIndex: 0, explanation: 'The Domain Name System resolves human-readable names to IP addresses.' },
  { text: 'Which layer of the OSI model handles routing?', options: ['Physical', 'Data link', 'Network', 'Session'], correctIndex: 2, explanation: 'The network layer (layer 3) does routing with IP addresses.' },
];
const answer = (qIndex, choice, correct) => ({ qIndex, choice, correct, points: correct ? 800 : 0, ms: 4000 });
const guest = { userId: null, nickname: 'Guest', score: 100, correctCount: 0, rank: 3, answers: [] };

const gameNet = {
  _id: oid(), topic: 'Computer Networks', settings, questions: netQuestions, endedAt: new Date(),
  players: [
    { userId: userA, nickname: 'Ann', score: 800, correctCount: 1, rank: 1, answers: [answer(0, 0, false), answer(1, 3, false), answer(2, 2, true)] },
    { userId: userB, nickname: 'Ben', score: 0, correctCount: 0, rank: 2, answers: [answer(0, 2, false), answer(1, 1, false), answer(2, 0, false)] },
    guest,
  ],
};
const gameCook = {
  _id: oid(), topic: 'Cooking', settings: { ...settings, count: 1 }, endedAt: new Date(),
  questions: [{ text: 'At what temperature does water boil at sea level, in Celsius?', options: ['90', '100', '110', '120'], correctIndex: 1, explanation: 'Water boils at 100 degrees Celsius at sea level.' }],
  players: [{ userId: userA, nickname: 'Ann', score: 0, correctCount: 0, rank: 1, answers: [answer(0, 3, false)] }],
};
const gameIds = [gameNet._id, gameCook._id].map(String);

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const chunks = mongoose.connection.db.collection(COLLECTION);

  // ---- chunking (no network)
  const { docs, ids } = chunksForGame(gameNet);
  ok('chunks: 2 mistakes + 1 summary for Ann, 3 mistakes + 1 summary for Ben, none for the guest', docs.length === 7 && new Set(ids).size === 7);
  ok('chunk text carries question, correct answer and explanation', docs[0].pageContent.includes('three-way handshake') && docs[0].pageContent.includes('Correct answer: TCP') && docs[0].pageContent.includes('SYN'));
  ok('chunks are tagged with their owner', docs.every((d) => [String(userA), String(userB)].includes(d.metadata.userId)));

  // ---- index
  const status = await ensureVectorIndex();
  ok('vector index exists or was created', status === 'exists' || status === 'created', status);
  for (let i = 0; i < 60 && !(await isIndexQueryable()); i++) await sleep(3000);
  ok('vector index is queryable', await isIndexQueryable());

  // ---- ingest (+ idempotency)
  const n1 = await ingestGame(gameNet);
  const n2 = await ingestGame(gameCook);
  ok('ingested chunks for both games', n1 === 7 && n2 === 2, `${n1}+${n2}`);
  const countBefore = await chunks.countDocuments({ gameId: { $in: gameIds } });
  await ingestGame(gameNet);
  ok('re-ingesting does not duplicate chunks', (await chunks.countDocuments({ gameId: { $in: gameIds } })) === countBefore, `${countBefore} chunks`);
  const stored = await chunks.findOne({ gameId: gameIds[0] });
  ok('stored vectors have 768 dimensions', stored.embedding.length === 768);

  // new documents show up in the index a few seconds later
  const probe = await makeEmbeddings().embedQuery('TCP connection handshake');
  const store = getVectorStore();
  let visible = 0;
  for (let i = 0; i < 40 && !visible; i++) {
    visible = (await store.similaritySearchVectorWithScore(probe, 3, { preFilter: { userId: { $eq: String(userA) } } })).length;
    if (!visible) await sleep(3000);
  }
  ok('new chunks become searchable', visible > 0);

  // ---- relevance
  const net = await searchStudyNotes(userA, 'how do two computers establish a connection before sending data');
  console.log('  net  ->', net.map((r) => `${r.relevance} ${r.kind} ${r.topic}`).join(' | '));
  ok('networking question finds the TCP handshake mistake first', net[0]?.kind === 'mistake' && net[0].text.includes('TCP'));

  const boil = await searchStudyNotes(userA, 'what is the boiling point of water');
  console.log('  boil ->', boil.map((r) => `${r.relevance} ${r.kind} ${r.topic}`).join(' | '));
  ok('cooking question finds the boiling-point mistake first', boil[0]?.topic === 'Cooking' && /boil/i.test(boil[0].text));

  const noise = await searchStudyNotes(userA, 'lattice gauge theory in quantum chromodynamics');
  console.log('  noise->', noise.map((r) => `${r.relevance} ${r.topic}`).join(' | ') || '(none)');
  ok('unrelated question finds nothing relevant', noise.length === 0);

  // ---- isolation: same question, different owner, different data
  const asB = await searchStudyNotes(userB, 'how do two computers establish a connection before sending data');
  ok('Ben gets only his own notes (he answered ICMP, Ann answered UDP)', asB.length > 0 && asB.every((r) => !r.text.includes('answered: UDP')) && asB[0].text.includes('answered: ICMP'));
  ok('Ann gets only her own notes', net.every((r) => !r.text.includes('answered: ICMP')) && net[0].text.includes('answered: UDP'));
  ok('a user with no games gets nothing', (await searchStudyNotes(userC, 'how do two computers establish a connection')).length === 0);
} catch (err) {
  failures += 1;
  console.log('FAIL unexpected error:', err);
} finally {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.collection(COLLECTION).deleteMany({ gameId: { $in: gameIds } });
  }
  await mongoose.disconnect().catch(() => {});
  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
