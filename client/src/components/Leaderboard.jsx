import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Crown, Home } from 'lucide-react';
import { useRoom } from '../lib/roomStore.js';
import AnimatedNumber from './AnimatedNumber.jsx';
import Avatar from './Avatar.jsx';
import { Button, Card } from './ui.jsx';

const MAX_ROWS = 8;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Between questions. The board first shows the *previous* scores, then re-sorts, so rank changes are visible.
export function BoardView() {
  const lb = useRoom((s) => s.game.leaderboard);
  const playerId = useRoom((s) => s.playerId);
  const [settled, setSettled] = useState(false);

  // the parent keys this component by question, so `settled` starts false for every board
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 900);
    return () => clearTimeout(t);
  }, []);

  const rows = useMemo(() => {
    const withShown = lb.leaderboard.map((r, i) => ({ ...r, order: i, shown: settled ? r.score : r.score - r.delta }));
    withShown.sort((a, b) => b.shown - a.shown || a.order - b.order);
    // equal scores share the rank of the first of them
    return withShown.map((r) => ({ ...r, shownRank: withShown.findIndex((x) => x.shown === r.shown) + 1 }));
  }, [lb, settled]);

  const visible = rows.filter((r, i) => i < MAX_ROWS || r.id === playerId);

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-muted">After question {lb.qIndex + 1}</p>
      </div>

      <ul className="space-y-2">
        {visible.map((r) => (
          <motion.li
            key={r.id}
            layout
            transition={{ type: 'spring', stiffness: 350, damping: 32 }}
            className={`flex items-center gap-3 rounded-2xl border p-3 ${
              r.id === playerId ? 'border-accent bg-accent-soft' : 'border-line bg-surface/80'
            } ${r.connected ? '' : 'opacity-50'}`}
          >
            <span className="w-7 text-center font-mono text-lg font-bold text-muted">{r.shownRank}</span>
            <Avatar name={r.nickname} size={38} />
            <span className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="truncate font-medium">{r.nickname}</span>
              {r.id === playerId && <span className="shrink-0 text-xs text-muted">you</span>}
            </span>
            {r.delta > 0 && (
              <motion.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-full bg-good/10 px-2 py-0.5 font-mono text-xs font-bold text-good"
              >
                +{r.delta}
              </motion.span>
            )}
            <span className="w-16 text-right font-mono text-lg font-bold tabular-nums">
              <AnimatedNumber value={r.shown} />
            </span>
          </motion.li>
        ))}
      </ul>

      <motion.p
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-center text-sm text-muted"
      >
        {lb.isLast ? 'Final results coming up…' : 'Next question coming up…'}
      </motion.p>
    </div>
  );
}

const PODIUM = [
  { place: 1, height: 176, delay: 1.4, tone: 'from-amber-300/30 to-amber-300/5 border-amber-300/40' },
  { place: 2, height: 128, delay: 0.8, tone: 'from-zinc-300/25 to-zinc-300/5 border-zinc-300/30' },
  { place: 3, height: 96, delay: 0.3, tone: 'from-orange-400/25 to-orange-400/5 border-orange-400/30' },
];

export function FinalView() {
  const navigate = useNavigate();
  const final = useRoom((s) => s.game.final);
  const playerId = useRoom((s) => s.playerId);
  const leave = useRoom((s) => s.leave);

  const board = final.leaderboard;
  const me = board.find((r) => r.id === playerId);
  // podium order is 2nd, 1st, 3rd; ties can share a rank, so go by position
  const top = board.slice(0, 3);
  const columns = [1, 0, 2].filter((i) => top[i]).map((i) => ({ player: top[i], ...PODIUM[i] }));

  useEffect(() => {
    if (!me || me.rank > 3 || reducedMotion()) return undefined;
    const t = setTimeout(() => {
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.65 }, colors: ['#8b5cf6', '#c4b5fd', '#fcd34d', '#ffffff'] });
    }, 1900);
    return () => clearTimeout(t);
  }, [me]);

  const headline = !me ? 'Game over' : me.rank === 1 ? 'You won! 🏆' : `You finished #${me.rank}`;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {headline}
        </motion.h1>
        {me && (
          <p className="mt-1 text-muted">
            {me.correctCount}/{final.totalQuestions} correct · <span className="font-mono text-white">{me.score.toLocaleString()}</span> pts
          </p>
        )}
      </div>

      <div className="mx-auto flex w-full items-end justify-center gap-3" aria-label="Podium">
        {columns.map(({ player, place, height, delay, tone }) => (
          <div key={player.id} className="flex min-w-0 max-w-36 flex-1 flex-col items-center sm:w-36 sm:flex-none">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay + 0.3 }} className="mb-2 w-full min-w-0 text-center">
              <div className="relative mx-auto w-fit">
                <Avatar name={player.nickname} size={place === 1 ? 64 : 52} />
                {place === 1 && <Crown size={20} className="absolute -top-3 left-1/2 -translate-x-1/2 text-amber-300" aria-hidden="true" />}
              </div>
              <p className="mt-2 max-w-full truncate text-sm font-semibold">{player.nickname}</p>
              <p className="font-mono text-xs text-muted">{player.score.toLocaleString()}</p>
            </motion.div>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height }}
              transition={{ delay, duration: 0.7, ease: 'easeOut' }}
              className={`flex w-full items-start justify-center rounded-t-2xl border border-b-0 bg-gradient-to-b pt-3 ${tone}`}
            >
              <span className="font-mono text-3xl font-extrabold">{place}</span>
            </motion.div>
          </div>
        ))}
      </div>

      <Card className="p-2">
        <ul>
          {board.map((r) => (
            <li
              key={r.id}
              className={`flex items-center gap-2 rounded-xl px-2 py-2.5 sm:gap-3 sm:px-3 ${r.id === playerId ? 'bg-accent-soft' : ''}`}
            >
              <span className="w-7 text-center font-mono font-bold text-muted">{r.rank}</span>
              <Avatar name={r.nickname} size={34} />
              <span className="min-w-0 flex-1 truncate font-medium">{r.nickname}</span>
              <span className="text-xs text-muted max-sm:hidden">{r.correctCount}/{final.totalQuestions}</span>
              <span className="w-16 text-right font-mono font-bold tabular-nums sm:w-20">{r.score.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex justify-center">
        <Button onClick={() => { leave(); navigate('/'); }}>
          <Home size={16} /> Back home
        </Button>
      </div>
    </div>
  );
}
