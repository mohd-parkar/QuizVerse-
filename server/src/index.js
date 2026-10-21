import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import authRoutes from './routes/auth.js';
import questionRoutes from './routes/questions.js';
import roomRoutes from './routes/rooms.js';
import historyRoutes from './routes/history.js';
import chatRoutes from './routes/chat.js';
import { registerSockets } from './sockets/index.js';
import { ensureVectorIndex } from './ai/vectorStore.js';

const app = express();
const server = http.createServer(app);

// behind a platform proxy (Render, Railway...) the real client IP is in X-Forwarded-For, which the rate limiters need
if (env.isProd) app.set('trust proxy', 1);

// CSP is left off: the page loads Google Fonts and a half-right policy breaks more than it protects.
// COOP must allow popups, otherwise the Sign in with Google window cannot hand its result back to the page.
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// In production one server serves both the API and the built React app, so the browser sees a single
// origin: cookies and WebSockets just work, with no CORS or cross-site cookie trouble.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (env.isProd && fs.existsSync(path.join(clientDist, 'index.html'))) {
  // build output has content hashes in its names, so it can be cached forever
  app.use('/assets', express.static(path.join(clientDist, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(clientDist, { index: false }));
  // any other page is a client-side route (/room/ABC123, /history/...): hand it to React
  app.get(/^\/(?!socket\.io\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

export const io = new Server(server, {
  cors: { origin: env.clientUrl, credentials: true },
});

registerSockets(io);

try {
  await connectDb();
  // not awaited: building the vector index can take a while and the quiz works without it
  ensureVectorIndex().then((status) => console.log(`Vector index: ${status}`));
  server.listen(env.port, () => console.log(`Server on http://localhost:${env.port}`));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
