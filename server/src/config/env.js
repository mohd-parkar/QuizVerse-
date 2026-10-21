import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  googleApiKey: process.env.GOOGLE_API_KEY || '',
  // OAuth "Web application" client id for Sign in with Google (public value; no secret is needed)
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  chatModel: process.env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash',
  // comma-separated list, tried in order after the main model
  fallbackModels: (process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean),
  embedModel: process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001',
  isProd: process.env.NODE_ENV === 'production',
};

// a guessable signing secret would let anyone forge login cookies
if (env.isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production.');
}
