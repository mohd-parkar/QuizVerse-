import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Sparkles, Square, Trash2, X } from 'lucide-react';
import { useChat } from '../lib/chatStore.js';
import Markdown from './Markdown.jsx';

const SUGGESTIONS = [
  'Show my last quiz results',
  'Who were the top 3 in my last game?',
  'Which topics am I weakest at?',
  'Explain recursion simply',
];
const MAX_LENGTH = 1000;

function Bubble({ message }) {
  const mine = message.role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          mine ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md border border-line bg-surface text-zinc-200 wrap-anywhere'
        }`}
      >
        {mine ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : <Markdown>{message.content}</Markdown>}
      </div>
    </div>
  );
}

function Typing({ label }) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-muted" role="status">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-accent"
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}

export default function ChatPanel() {
  const { open, messages, streaming, status, error, setOpen, send, stop, clear } = useChat();
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottom = useRef(true);

  // fetch past messages the first time the panel is open (also after a refresh with it left open)
  useEffect(() => {
    if (open) useChat.getState().load();
  }, [open]);

  // follow new text, unless the reader scrolled up to look at something
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, status, error, open]);

  // grow the textarea with its content, up to ~5 lines
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft, open]);

  function submit(text = draft) {
    if (!text.trim() || streaming) return;
    stickToBottom.current = true;
    setDraft('');
    send(text);
  }

  const onScroll = (e) => {
    const el = e.currentTarget;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-20 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_-8px_var(--color-accent)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Sparkles size={16} /> Ask AI
          </motion.button>
        )}
      </AnimatePresence>

      {open && (
        <motion.aside
          key="panel"
          aria-label="Study assistant"
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          className="slim-scroll fixed inset-0 z-30 flex flex-col bg-base lg:sticky lg:inset-auto lg:top-14 lg:z-0 lg:h-[calc(100dvh-3.5rem)] lg:w-[400px] lg:shrink-0 lg:border-l lg:border-line lg:bg-surface/60 lg:backdrop-blur"
        >
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <Sparkles size={16} className="text-accent" /> Study assistant
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clear}
                disabled={!messages.length}
                aria-label="Clear conversation"
                title="Clear conversation"
                className="rounded-full p-2 text-muted transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                <Trash2 size={15} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="rounded-full p-2 text-muted transition hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div ref={listRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {!messages.length && !streaming && (
              <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
                <span className="rounded-2xl bg-accent-soft p-3 text-accent"><Sparkles size={24} /></span>
                <div>
                  <p className="font-medium">How can I help?</p>
                  <p className="mt-1 max-w-64 text-sm text-muted">
                    Ask me to explain a topic, or about your own quizzes and scores.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="rounded-full border border-line bg-white/5 px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (m.content ? <Bubble key={m.id} message={m} /> : null))}
            {status && <Typing label={status} />}
            {error && (
              <p className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-red-300" role="alert">
                {error}
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="border-t border-line p-3"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-raised p-1.5 pl-3 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder="Ask about a topic or your quizzes…"
                aria-label="Message the assistant"
                className="max-h-[120px] min-w-0 flex-1 resize-none self-center bg-transparent py-1.5 text-sm text-white outline-none placeholder:text-zinc-600 max-sm:text-base"
              />
              {streaming ? (
                <button type="button" onClick={stop} aria-label="Stop" className="rounded-xl bg-white/10 p-2.5 text-white transition hover:bg-white/20">
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label="Send"
                  className="rounded-xl bg-accent p-2.5 text-white transition hover:brightness-110 disabled:opacity-30"
                >
                  <ArrowUp size={14} strokeWidth={3} />
                </button>
              )}
            </div>
            <p className="mt-2 text-center text-[11px] text-zinc-600">
              AI can make mistakes. Check anything important.
              {draft.length > MAX_LENGTH - 100 && <span className="ml-2 text-muted">{draft.length}/{MAX_LENGTH}</span>}
            </p>
          </form>
        </motion.aside>
      )}
    </>
  );
}
