import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { cleanTopic, DIFFICULTIES, getQuestions } from '../ai/questionGenerator.js';
import { createRoom, getRoom, publicInfo } from '../sockets/roomManager.js';

const router = Router();

const createSchema = z.object({
  topic: z.string().trim().min(2).max(80),
  count: z.number().int().min(3).max(20).default(10),
  difficulty: z.enum(DIFFICULTIES).default('medium'),
  timePerQuestion: z.number().int().min(10).max(60).default(20),
});

const createLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 4,
  keyGenerator: (req) => req.user.id,
  validate: { keyGeneratorIpFallback: false },
});

router.post('/', requireAuth, createLimit, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { topic, count, difficulty, timePerQuestion } = parsed.data;

  const { questions, source } = await getQuestions({ topic, count, difficulty });
  const room = createRoom({
    hostUserId: req.user.id,
    topic: cleanTopic(topic),
    settings: { count, difficulty, timePerQuestion },
    questions,
    source,
  });
  res.status(201).json({ code: room.code, source });
});

// used by the join page to check a code before joining (signed-in users only, like everything else)
router.get('/:code', requireAuth, (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(publicInfo(room));
});

export default router;
