import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { env } from '../config/env.js';

export function makeChatModel(model, { temperature = 0.7 } = {}) {
  if (!env.googleApiKey) throw new Error('GOOGLE_API_KEY is not set');
  return new ChatGoogleGenerativeAI({
    model,
    apiKey: env.googleApiKey,
    temperature,
    maxRetries: 0, // retries/fallback are handled by callers so we control timing
  });
}

// ---- quota handling -------------------------------------------------------------------------
// The free tier gives each model its own small daily allowance. When a model says "quota exceeded"
// we remember that and skip it until it resets, instead of failing slowly on every request.

const exhaustedUntil = new Map(); // model name -> epoch ms
const MAX_BACKOFF_MS = 24 * 3600_000;

export const isQuotaError = (err) =>
  err?.status === 429 || /\b429\b|quota|RESOURCE_EXHAUSTED/i.test(err?.message ?? '');

// "Please retry in 14h46m2.5s" -> milliseconds
function retryDelayMs(err) {
  const m = /retry in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i.exec(err?.message ?? '');
  if (!m) return 60_000;
  const ms = ((Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0)) * 1000;
  return Math.min(Math.max(ms, 5_000), MAX_BACKOFF_MS);
}

export function markExhausted(model, err) {
  exhaustedUntil.set(model, Date.now() + retryDelayMs(err));
  console.warn(`Gemini quota reached for ${model}; skipping it for ${Math.round(retryDelayMs(err) / 60_000)} min`);
}

const isAvailable = (model) => (exhaustedUntil.get(model) ?? 0) <= Date.now();

/** Models to try, best first, without the ones currently known to be out of quota. */
export function modelChain() {
  const all = [...new Set([env.chatModel, ...env.fallbackModels])];
  const usable = all.filter(isAvailable);
  return usable; // empty = every model is out of quota; callers handle that
}
