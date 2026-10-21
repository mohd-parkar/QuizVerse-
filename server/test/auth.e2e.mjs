// Accounts, Sign in with Google (everything except Google's own token check) and "only signed-in users can play".
// Needs the server running and MONGODB_URI. Creates throwaway users and removes them afterwards.
//
// Google's ID-token verification needs a real token from a real Google sign-in, so it cannot run here. What is
// tested instead is everything around it: the endpoint's behaviour, and the account find/create/link logic,
// which is called directly with the profile Google would have supplied.
import 'dotenv/config';
import mongoose from 'mongoose';
import { io } from 'socket.io-client';
import { findOrCreateGoogleUser } from '../src/services/googleAuth.js';
import { User } from '../src/models/User.js';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000';
const tag = 'ga' + Math.floor(Math.random() * 1e6);
let failures = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failures += 1;
  console.log(cond ? 'PASS' : 'FAIL', name, extra);
};

const post = async (path, body, cookie = '') => {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
  return { http: res.status, cookie: res.headers.get('set-cookie')?.split(';')[0], ...(await res.json().catch(() => ({}))) };
};
const profile = (n, extra = {}) => ({
  googleId: `${tag}-g${n}`,
  email: `${tag}g${n}@test.dev`,
  emailVerified: true,
  name: `Tom ${tag}`,
  picture: `https://example.test/p${n}.png`,
  ...extra,
});

try {
  await mongoose.connect(process.env.MONGODB_URI);

  // ---- server endpoints
  const config = await (await fetch(`${BASE}/api/auth/config`)).json();
  const configured = Boolean(config.googleClientId);
  ok('config endpoint answers', 'googleClientId' in config, configured ? '(Google configured)' : '(Google not configured)');
  const bad = await post('/api/auth/google', { credential: 'x'.repeat(40) });
  ok(configured ? 'forged Google credential is rejected (401)' : 'Google endpoint is a clear 503 when not configured', bad.http === (configured ? 401 : 503), `${bad.http}`);
  ok('missing credential is a 400', (await post('/api/auth/google', {})).http === 400);
  ok('no login cookie is issued for a bad credential', !bad.cookie);

  // ---- account logic
  const first = await findOrCreateGoogleUser(profile(1));
  ok('new Google user is created with a clean username', first.username === `Tom ${tag}` && first.googleId === `${tag}-g1` && !first.passwordHash);
  ok('public profile carries the picture', first.toPublic().picture === 'https://example.test/p1.png');

  const again = await findOrCreateGoogleUser(profile(1, { picture: 'https://example.test/new.png' }));
  ok('same Google id returns the same account (no duplicate)', String(again._id) === String(first._id) && (await User.countDocuments({ googleId: `${tag}-g1` })) === 1);
  ok('picture is refreshed', again.picture === 'https://example.test/new.png');

  const second = await findOrCreateGoogleUser(profile(2)); // same display name as the first user
  ok('a taken username gets a unique alternative', second.username !== first.username && second.username.startsWith('Tom'), second.username);

  const odd = await findOrCreateGoogleUser(profile(3, { name: 'Ana 😀 <script>x</script>', email: `${tag}g3@test.dev` }));
  ok('odd characters are stripped from usernames', !/[<>😀]/u.test(odd.username) && odd.username.length >= 3, odd.username);

  const tiny = await findOrCreateGoogleUser(profile(4, { name: 'A' }));
  ok('very short names still produce a valid username', tiny.username.length >= 3 && tiny.username.length <= 24, tiny.username);

  let refused = null;
  await findOrCreateGoogleUser(profile(5, { emailVerified: false })).catch((e) => { refused = e.code; });
  ok('unverified Google email is refused', refused === 'EMAIL_NOT_VERIFIED' && !(await User.exists({ googleId: `${tag}-g5` })));

  // ---- linking with an existing email/password account
  const email = `${tag}link@test.dev`;
  const registered = await post('/api/auth/register', { username: `${tag}link`, email, password: 'secret12' });
  const linked = await findOrCreateGoogleUser(profile(6, { email, name: 'Someone Else' }));
  ok('Google sign-in with the same verified email links to the existing account', String(linked._id) === registered.user.id && linked.googleId === `${tag}-g6` && linked.username === `${tag}link`);
  ok('the password still works after linking', (await post('/api/auth/login', { email, password: 'secret12' })).http === 200);

  // ---- Google-only accounts cannot be password-logged-in
  const gOnly = await post('/api/auth/login', { email: `${tag}g1@test.dev`, password: 'anything' });
  ok('a Google-only account cannot log in with a password', gOnly.http === 401 && /Google/.test(gOnly.error));

  // ---- only signed-in users can play
  ok('room lookup needs login', (await fetch(`${BASE}/api/rooms/ABCDEF`)).status === 401);
  ok('hosting needs login', (await post('/api/rooms', { topic: 'javascript' })).http === 401);
  const anon = io(BASE, { transports: ['websocket'], reconnection: false });
  const refusal = await new Promise((r) => anon.on('connect_error', r));
  ok('a socket without login is refused', refusal.message === 'LOGIN_REQUIRED');
  anon.close();
  const forged = io(BASE, { transports: ['websocket'], reconnection: false, extraHeaders: { cookie: 'qv_token=not-a-real-token' } });
  const forgedRefusal = await new Promise((r) => forged.on('connect_error', r));
  ok('a socket with a forged cookie is refused', forgedRefusal.message === 'LOGIN_REQUIRED');
  forged.close();
  const real = await post('/api/auth/login', { email, password: 'secret12' });
  const authed = io(BASE, { transports: ['websocket'], reconnection: false, extraHeaders: { cookie: real.cookie } });
  ok('a signed-in socket connects', await new Promise((r) => { authed.on('connect', () => r(true)); authed.on('connect_error', () => r(false)); }));
  authed.close();
} catch (err) {
  failures += 1;
  console.log('FAIL unexpected error:', err);
} finally {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.collection('users').deleteMany({ $or: [{ googleId: new RegExp(`^${tag}`) }, { username: new RegExp(`^${tag}`) }, { email: new RegExp(`^${tag}`) }] });
  }
  await mongoose.disconnect().catch(() => {});
  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
