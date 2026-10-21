import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getGameDetail, getHistory, getStats } from '../services/history.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const limit = Number.parseInt(req.query.limit, 10) || 20;
  res.json({ games: await getHistory(req.user.id, { limit }) });
});

// registered before "/:id" so "stats" is not read as a game id
router.get('/stats', async (req, res) => {
  res.json(await getStats(req.user.id));
});

router.get('/:id', async (req, res) => {
  const game = await getGameDetail(req.user.id, req.params.id);
  // same answer for "missing" and "not yours", so ids cannot be probed
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
});

export default router;
