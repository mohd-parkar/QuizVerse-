import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { DIFFICULTIES, getQuestions } from '../ai/questionGenerator.js';

const router = Router();

const previewSchema = z.object({
  topic: z.string().trim().min(2).max(80),
  count: z.number().int().min(3).max(20).default(5),
  difficulty: z.enum(DIFFICULTIES).default('medium'),
});

// Gemini free tier is rate-limited, so keep generation requests modest per user
const generationLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  keyGenerator: (req) => req.user.id,
  validate: { keyGeneratorIpFallback: false },
});

router.post('/preview', requireAuth, generationLimit, async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { questions, source } = await getQuestions(parsed.data);
  res.json({ source, questions });
});

export default router;
