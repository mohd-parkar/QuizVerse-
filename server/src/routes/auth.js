import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { findOrCreateGoogleUser, verifyGoogleCredential } from '../services/googleAuth.js';
import { COOKIE_NAME, requireAuth, setAuthCookie, signToken } from '../middleware/auth.js';

const router = Router();

// Only the endpoints worth brute-forcing are limited. The app calls /me and /config on every page load, so
// those must never count (and a whole classroom can share one IP address behind the same Wi-Fi).
const tooMany = { error: 'Too many attempts. Please wait a few minutes and try again.' };
// failed logins only: successful ones do not use up the allowance
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, skipSuccessfulRequests: true, message: tooMany });
const signupLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, message: tooMany });

const registerSchema = z.object({
  username: z.string().trim().min(3).max(24),
  email: z.string().trim().email(),
  password: z.string().min(6).max(72),
});

const googleSchema = z.object({ credential: z.string().min(20).max(4096) });

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

router.post('/register', signupLimit, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { username, email, password } = parsed.data;

  const exists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
  if (exists) return res.status(409).json({ error: 'Username or email already in use' });

  const user = await User.create({ username, email, passwordHash: await bcrypt.hash(password, 10) });
  setAuthCookie(res, signToken(user.id));
  res.status(201).json({ user: user.toPublic() });
});

// tells the browser whether to show the Google button (the client id is public by design)
router.get('/config', (_req, res) => {
  res.json({ googleClientId: env.googleClientId || null });
});

router.post('/google', loginLimit, async (req, res) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Missing Google credential' });
  if (!env.googleClientId) return res.status(503).json({ error: 'Google sign-in is not set up on this server.' });

  let profile;
  try {
    profile = await verifyGoogleCredential(parsed.data.credential);
  } catch (err) {
    console.warn('Google credential rejected:', err.message);
    return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
  }

  try {
    const user = await findOrCreateGoogleUser(profile);
    setAuthCookie(res, signToken(user.id));
    res.json({ user: user.toPublic() });
  } catch (err) {
    if (err.code === 'EMAIL_NOT_VERIFIED') return res.status(401).json({ error: err.message });
    throw err;
  }
});

router.post('/login', loginLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email or password' });

  const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
  // Google-only accounts have no password hash, so they can never match here
  const ok = user?.passwordHash && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Invalid email or password. If you signed up with Google, use the Google button.' });

  setAuthCookie(res, signToken(user.id));
  res.json({ user: user.toPublic() });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

export default router;
