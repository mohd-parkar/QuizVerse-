// Quick single-question check of the assistant (2-3 Gemini requests). Prints tool events and the reply.
import 'dotenv/config';
import mongoose from 'mongoose';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000';
const name = 'smoke' + Math.floor(Math.random() * 1e6);
let cookie = '';
const call = async (path, body) => {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return res;
};
await mongoose.connect(process.env.MONGODB_URI);
try {
  const user = (await (await call('/api/auth/register', { username: name, email: `${name}@test.dev`, password: 'secret12' })).json()).user;
  const oid = new mongoose.Types.ObjectId(user.id);
  await mongoose.connection.collection('gamesessions').insertOne({
    roomCode: 'SMOKE1', hostUserId: oid, topic: 'Space', settings: { count: 1, difficulty: 'easy', timePerQuestion: 20 },
    questions: [{ text: 'Q?', options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: '' }], startedAt: new Date(), endedAt: new Date(),
    players: [{ userId: oid, nickname: name, score: 900, correctCount: 1, rank: 1, answers: [] }, { userId: null, nickname: 'Rival', score: 100, correctCount: 0, rank: 2, answers: [] }],
  });
  const t0 = Date.now();
  const res = await call('/api/chat', { message: process.argv[2] || 'What quizzes have I taken, and how did I do?' });
  let buffer = ''; let text = '';
  for await (const part of res.body) {
    buffer += new TextDecoder().decode(part, { stream: true });
    let i;
    while ((i = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, i); buffer = buffer.slice(i + 2);
      const event = /^event: (.+)$/m.exec(block)?.[1]; const data = JSON.parse(/^data: (.+)$/m.exec(block)?.[1] ?? '{}');
      if (event === 'token') text += data.text; else console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${event}`, JSON.stringify(data));
    }
  }
  console.log('REPLY:', text.replace(/\s+/g, ' '));
} finally {
  await mongoose.connection.collection('gamesessions').deleteMany({ roomCode: 'SMOKE1' });
  const u = await mongoose.connection.collection('users').findOne({ username: name });
  if (u) await mongoose.connection.collection('chatmessages').deleteMany({ userId: u._id });
  await mongoose.connection.collection('users').deleteMany({ username: name });
  await mongoose.disconnect();
}
