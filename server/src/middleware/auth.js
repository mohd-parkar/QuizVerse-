import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

export const COOKIE_NAME = 'qv_token';

export function signToken(userId) {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '7d' });
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    // the app and API are served from one origin (see index.js), so Lax is enough and safest
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export async function userFromToken(token) {
  if (!token) return null;
  try {
    const { sub } = jwt.verify(token, env.jwtSecret);
    return await User.findById(sub);
  } catch {
    return null;
  }
}

export async function requireAuth(req, res, next) {
  const user = await userFromToken(req.cookies[COOKIE_NAME]);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  req.user = user;
  next();
}
