import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { streamReply } from '../ai/chatAgent.js';
import { isQuotaError } from '../ai/gemini.js';
import { isUserInActiveGame } from '../sockets/roomManager.js';

const router = Router();
router.use(requireAuth);

const HISTORY_SENT_TO_MODEL = 12;
const HISTORY_SHOWN = 50;

const bodySchema = z.object({ message: z.string().trim().min(1).max(1000) });

// the free Gemini tier is the bottleneck, so keep each user's pace modest
const chatLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user.id,
  validate: { keyGeneratorIpFallback: false },
});

const toClient = (m) => ({ id: String(m._id), role: m.role, content: m.content, createdAt: m.createdAt });

router.get('/history', async (req, res) => {
  const rows = await ChatMessage.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(HISTORY_SHOWN).lean();
  res.json({ messages: rows.reverse().map(toClient) });
});

router.delete('/history', async (req, res) => {
  await ChatMessage.deleteMany({ userId: req.user.id });
  res.json({ ok: true });
});

// Server-sent events over POST: `token` (text chunk), `tool` (lookup started/finished), `done`, `error`.
router.post('/', chatLimit, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Send a message of 1 to 1000 characters.' });

  // no help with a quiz that is in progress
  if (isUserInActiveGame(req.user.id)) {
    return res.status(409).json({ error: 'The assistant is switched off while you are in a live quiz.', code: 'IN_GAME' });
  }

  const { message } = parsed.data;
  const recent = await ChatMessage.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(HISTORY_SENT_TO_MODEL).lean();
  const history = recent.reverse().map((m) => ({ role: m.role, content: m.content }));
  await ChatMessage.create({ userId: req.user.id, role: 'user', content: message });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data = {}) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  // stop paying for tokens nobody will read if the user closes the tab or hits stop
  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });

  // Gemini can be slow to start; a comment line every few seconds keeps proxies from closing the stream
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 10_000);

  let reply = '';
  try {
    for await (const event of streamReply({ userId: req.user.id, history, message, signal: abort.signal })) {
      if (event.type === 'token') {
        reply += event.text;
        send('token', { text: event.text });
      } else {
        send('tool', { name: event.name, status: event.status });
      }
    }
    if (reply.trim()) await ChatMessage.create({ userId: req.user.id, role: 'assistant', content: reply });
    send('done');
  } catch (err) {
    if (!abort.signal.aborted) {
      console.error('chat failed:', err.message);
      send('error', {
        message: isQuotaError(err)
          ? 'The assistant has reached its daily AI limit. Please try again later.'
          : 'The assistant is unavailable right now. Please try again in a moment.',
      });
    }
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

export default router;
