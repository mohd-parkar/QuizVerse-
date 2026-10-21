import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Users, X } from 'lucide-react';
import { useRoom } from '../lib/roomStore.js';
import { useCountdown } from '../lib/useCountdown.js';
import { Card } from './ui.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

function tileStyle({ revealing, selected, locked, isCorrect, mineWrong }) {
  if (revealing) {
    if (isCorrect) return 'border-good bg-good/10';
    if (mineWrong) return 'border-bad bg-bad/10';
    return 'border-line bg-surface/60 opacity-60';
  }
  if (selected) return 'border-accent bg-accent-soft shadow-[0_0_28px_-8px_var(--color-accent)]';
  if (locked) return 'border-line bg-surface/60 opacity-50';
  return 'border-line bg-surface hover:border-white/25 hover:bg-raised';
}

// One screen for both "question" and "reveal": same layout, the tiles just change meaning.
export default function QuestionView() {
  const game = useRoom((s) => s.game);
  const playerId = useRoom((s) => s.playerId);
  const answer = useRoom((s) => s.answer);

  const revealing = game.phase === 'reveal';
  const q = revealing ? game.reveal : game.question;
  const mine = revealing ? game.reveal.results[playerId] : null;
  const remaining = useCountdown(revealing ? null : game.question?.endsAt);
  const locked = game.myChoice !== null;

  // 1-4 or A-D answer from the keyboard
  useEffect(() => {
    if (revealing) return undefined;
    const onKey = (e) => {
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = '1234'.indexOf(e.key);
      const idx = i >= 0 ? i : 'abcd'.indexOf(e.key.toLowerCase());
      if (idx >= 0) answer(idx);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealing, answer]);

  const answeredTotal = revealing ? game.reveal.distribution.reduce((a, b) => a + b, 0) : 0;
  const durationMs = game.question?.durationMs ?? 1;
  const urgent = !revealing && remaining <= 5000;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-muted">
          Question <span className="font-mono text-white">{q.qIndex + 1}</span> / {q.total}
        </span>
        {revealing ? (
          <span className="text-muted">Answer</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted">
            <Users size={14} /> {game.progress.answered}/{game.progress.total} answered
          </span>
        )}
      </div>

      {/* timer */}
      {!revealing && (
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              key={q.qIndex}
              className={`h-full origin-left rounded-full ${urgent ? 'bg-bad' : 'bg-accent'}`}
              initial={{ scaleX: Math.min(1, remaining / durationMs) }}
              animate={{ scaleX: 0 }}
              transition={{ duration: remaining / 1000, ease: 'linear' }}
            />
          </div>
          <span
            className={`w-8 text-right font-mono text-lg font-bold tabular-nums ${urgent ? 'text-bad' : 'text-white'}`}
            aria-label="Seconds left"
          >
            {Math.ceil(remaining / 1000)}
          </span>
        </div>
      )}

      <motion.div key={q.qIndex} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="flex min-h-32 items-center justify-center text-center">
          <h1 className="text-xl font-semibold leading-snug wrap-anywhere sm:text-2xl">{q.text}</h1>
        </Card>
      </motion.div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" role={revealing ? undefined : 'group'} aria-label="Answers">
        {q.options.map((option, i) => {
          const isCorrect = revealing && i === game.reveal.correctIndex;
          const mineWrong = revealing && mine?.choice === i && !isCorrect;
          const share = answeredTotal ? (game.reveal?.distribution[i] ?? 0) / answeredTotal : 0;
          return (
            <motion.li key={`${q.qIndex}-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
              <button
                type="button"
                disabled={revealing || locked}
                onClick={() => answer(i)}
                aria-pressed={!revealing && game.myChoice === i}
                className={`relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border p-4 text-left font-medium transition focus-visible:outline-2 focus-visible:outline-accent ${tileStyle({
                  revealing,
                  selected: game.myChoice === i,
                  locked,
                  isCorrect,
                  mineWrong,
                })}`}
              >
                {revealing && (
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 bg-white/5"
                    initial={{ width: 0 }}
                    animate={{ width: `${share * 100}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  />
                )}
                <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 font-mono text-sm font-bold">
                  {LETTERS[i]}
                </span>
                <span className="relative min-w-0 flex-1 wrap-anywhere">{option}</span>
                {revealing && (
                  <span className="relative flex shrink-0 items-center gap-2 text-sm text-muted">
                    <span className="font-mono">{game.reveal.distribution[i]}</span>
                    {isCorrect && <Check size={18} className="text-good" aria-label="Correct answer" />}
                    {mineWrong && <X size={18} className="text-bad" aria-label="Your answer" />}
                  </span>
                )}
              </button>
            </motion.li>
          );
        })}
      </ul>

      {revealing ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3">
          <div className="text-center">
            {mine?.choice == null ? (
              <p className="text-lg font-semibold text-muted">Time’s up — no answer</p>
            ) : mine.correct ? (
              <motion.p
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 14 }}
                className="text-3xl font-extrabold text-good"
              >
                +{mine.points}
              </motion.p>
            ) : (
              <p className="text-lg font-semibold text-bad">Not quite</p>
            )}
          </div>
          {q.explanation && (
            <Card className="text-sm leading-relaxed text-muted wrap-anywhere">
              <span className="font-medium text-white">Why: </span>
              {q.explanation}
            </Card>
          )}
        </motion.div>
      ) : (
        <p className="text-center text-sm text-muted" role="status">
          {locked ? 'Answer locked in · waiting for the others…' : 'Tap an answer, or press 1–4'}
        </p>
      )}
    </div>
  );
}
