import { AnimatePresence, motion } from 'framer-motion';
import { useRoom } from '../lib/roomStore.js';
import { useCountdown } from '../lib/useCountdown.js';
import QuestionView from './QuestionView.jsx';
import { BoardView, FinalView } from './Leaderboard.jsx';

function Countdown({ endsAt, topic }) {
  const remaining = useCountdown(endsAt);
  const n = Math.max(1, Math.ceil(remaining / 1000));
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center" role="status" aria-live="polite">
      <p className="text-sm uppercase tracking-widest text-muted">Get ready</p>
      <p className="mt-1 max-w-full px-2 text-lg font-medium text-violet-200 wrap-anywhere">{topic}</p>
      <div className="relative mt-8 flex h-40 items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={n}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="font-mono text-9xl font-extrabold text-accent drop-shadow-[0_0_40px_var(--color-accent)]"
          >
            {n}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

// Everything that happens after the host presses Start, driven by the server's phase events.
export default function Game() {
  const room = useRoom((s) => s.room);
  const game = useRoom((s) => s.game);

  let view;
  if (!game?.phase) {
    view = <p className="py-32 text-center text-muted" role="status">Syncing with the game…</p>;
  } else if (game.phase === 'countdown') {
    view = <Countdown endsAt={game.countdownEndsAt} topic={room.topic} />;
  } else if (game.phase === 'question' || game.phase === 'reveal') {
    view = <QuestionView />;
  } else if (game.phase === 'leaderboard') {
    view = <BoardView key={game.leaderboard.qIndex} />;
  } else {
    view = <FinalView />;
  }

  return (
    <div className="bg-glow min-h-dvh">
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">{view}</main>
    </div>
  );
}
