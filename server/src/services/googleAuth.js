import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

let client;

/**
 * Checks a Google ID token (the "credential" the Sign in with Google button returns): signature,
 * expiry, and that it was issued for OUR client id. Returns the profile fields we use.
 */
export async function verifyGoogleCredential(credential) {
  if (!env.googleClientId) throw new Error('Google sign-in is not configured');
  client ??= new OAuth2Client(env.googleClientId);
  const ticket = await client.verifyIdToken({ idToken: credential, audience: env.googleClientId });
  const p = ticket.getPayload();
  return { googleId: p.sub, email: p.email, emailVerified: p.email_verified === true, name: p.name, picture: p.picture };
}

// usernames are unique and show up on leaderboards, so build a clean one from the Google name
async function uniqueUsername(source) {
  const base =
    String(source)
      .replace(/[^\p{L}\p{N} _.-]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 20) || 'player';
  const root = base.length >= 3 ? base : `${base}player`.slice(0, 20);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? root : `${root.slice(0, 19 - String(i).length)}${Math.floor(100 + Math.random() * 900)}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  return `player${Date.now().toString(36)}`.slice(0, 24);
}

/**
 * Finds the account for a verified Google profile, creating or linking one as needed:
 *  1. same Google id            -> that account
 *  2. same (verified) email     -> the existing email/password account gets linked to Google
 *  3. otherwise                 -> a new account
 * Linking by email is safe because Google has verified that the person owns the address.
 */
export async function findOrCreateGoogleUser(profile) {
  if (!profile.emailVerified || !profile.email) {
    const err = new Error('Your Google email address is not verified.');
    err.code = 'EMAIL_NOT_VERIFIED';
    throw err;
  }
  const email = profile.email.toLowerCase();

  const find = async () => {
    const byGoogle = await User.findOne({ googleId: profile.googleId });
    if (byGoogle) {
      if (profile.picture && byGoogle.picture !== profile.picture) {
        byGoogle.picture = profile.picture;
        await byGoogle.save();
      }
      return byGoogle;
    }
    const byEmail = await User.findOne({ email });
    if (byEmail) {
      byEmail.googleId = profile.googleId;
      byEmail.picture ??= profile.picture;
      await byEmail.save();
      return byEmail;
    }
    return null;
  };

  const existing = await find();
  if (existing) return existing;

  try {
    return await User.create({
      username: await uniqueUsername(profile.name || email.split('@')[0]),
      email,
      googleId: profile.googleId,
      picture: profile.picture,
    });
  } catch (err) {
    // two sign-ins racing to create the same account: the loser just picks up the winner's
    if (err.code === 11000) {
      const winner = await find();
      if (winner) return winner;
    }
    throw err;
  }
}
