import { create } from 'zustand';
import { api } from './api.js';

const TOOL_LABELS = {
  get_my_quiz_history: 'Checking your quiz history…',
  get_game_leaderboard: 'Looking up the leaderboard…',
  get_my_stats: 'Crunching your stats…',
  get_my_mistakes: 'Finding the questions you missed…',
};
const THINKING = 'Thinking…';

const readOpen = () => {
  try {
    return localStorage.getItem('qv_chat_open') === '1';
  } catch {
    return false;
  }
};
const writeOpen = (open) => {
  try { localStorage.setItem('qv_chat_open', open ? '1' : '0'); } catch { /* storage unavailable */ }
};

// Reads a text/event-stream body and calls onEvent(name, data) for each complete event.
async function readEvents(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const name = /^event: (.+)$/m.exec(block)?.[1];
      if (!name) continue; // keep-alive comment
      onEvent(name, JSON.parse(/^data: (.+)$/m.exec(block)?.[1] ?? '{}'));
    }
  }
}

let controller = null; // aborts the in-flight reply

export const useChat = create((set, get) => ({
  open: readOpen(),
  messages: [],
  loaded: false,
  streaming: false,
  status: null, // what the assistant is doing right now
  error: null,

  setOpen(open) {
    writeOpen(open);
    set({ open });
  },

  async load() {
    if (get().loaded) return;
    try {
      const { messages } = await api.get('/chat/history');
      set((s) => (s.messages.length ? { loaded: true } : { messages, loaded: true }));
    } catch {
      set({ loaded: true }); // an empty chat is fine; sending still works
    }
  },

  async send(text) {
    const message = text.trim();
    if (!message || get().streaming) return;

    const key = crypto.randomUUID();
    const replyId = `a-${key}`;
    set((s) => ({
      messages: [...s.messages, { id: `u-${key}`, role: 'user', content: message }, { id: replyId, role: 'assistant', content: '' }],
      streaming: true,
      status: THINKING,
      error: null,
    }));

    const append = (chunk) =>
      set((s) => ({ messages: s.messages.map((m) => (m.id === replyId ? { ...m, content: m.content + chunk } : m)) }));

    controller = new AbortController();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'The assistant is unavailable right now.');
      }
      await readEvents(res.body, (name, data) => {
        if (name === 'token') {
          set({ status: null });
          append(data.text);
        } else if (name === 'tool') {
          set({ status: data.status === 'running' ? (TOOL_LABELS[data.name] ?? THINKING) : THINKING });
        } else if (name === 'error') {
          throw new Error(data.message);
        }
      });
    } catch (err) {
      if (err.name !== 'AbortError') set({ error: err.message || 'Something went wrong.' });
    } finally {
      controller = null;
      // an empty reply bubble (error, or stopped before any text) is just removed
      set((s) => ({
        streaming: false,
        status: null,
        messages: s.messages.filter((m) => m.id !== replyId || m.content),
      }));
    }
  },

  stop: () => controller?.abort(),

  async clear() {
    controller?.abort();
    try {
      await api.delete('/chat/history');
      set({ messages: [], error: null });
    } catch (err) {
      set({ error: err.message });
    }
  },
}));
