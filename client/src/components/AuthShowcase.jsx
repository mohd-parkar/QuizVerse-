import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Trophy, Zap } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber.jsx';
import Avatar from './Avatar.jsx';
import Logo from './Logo.jsx';

// A scripted mini-game: who scores next, and how much. Cycles forever so the leaderboard keeps reshuffling.
const START = [
  { name: 'Maya', score: 1200 },
  { name: 'Leo', score: 1100 },
  { name: 'Priya', score: 900 },
  { name: 'Sam', score: 700 },
];
const PLAN = [
  [2, 520],
  [3, 640],
  [1, 400],
  [0, 300],
  [3, 450],
  [2, 380],
];
const PAUSE_TICKS = 2;

const POINTS = [
  { icon: Sparkles, text: 'AI-written questions on any topic' },
  { icon: Zap, text: 'Live rooms with friends, one tap to join' },
  { icon: Trophy, text: 'Leaderboards, history and a study assistant' },
];

function LiveLeaderboard() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2200);
    return () => clearInterval(id);
  }, []);

  const step = tick % (PLAN.length + PAUSE_TICKS); // after the last point, rest a moment, then start over
  const rows = useMemo(() => {
    const scores = START.map((p) => p.score);
    for (let i = 0; i < Math.min(step, PLAN.length); i++) scores[PLAN[i][0]] += PLAN[i][1];
    const last = step >= 1 && step <= PLAN.length ? PLAN[step - 1] : null;
    return START.map((p, i) => ({ ...p, score: scores[i], gained: last && last[0] === i ? last[1] : 0 })).sort(
      (a, b) => b.score - a.score
    );
  }, [step]);

  return (
    <div className="w-full max-w-sm rounded-3xl border border-line bg-base/60 p-5 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold">Live leaderboard</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-good/10 px-2.5 py-1 text-[11px] font-bold tracking-wider text-good">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-good opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-good" />
          </span>
          LIVE
        </span>
      </div>
      <ul className="space-y-2">
        {rows.map((p, i) => (
          <motion.li
            key={p.name}
            layout
            transition={{ type: 'spring', stiffness: 350, damping: 32 }}
            className={`flex items-center gap-3 rounded-2xl border p-2.5 ${
              i === 0 ? 'border-accent/50 bg-accent-soft' : 'border-line bg-surface/70'
            }`}
          >
            <span className="w-5 text-center font-mono text-sm font-bold text-muted">{i + 1}</span>
            <Avatar name={p.name} size={32} />
            <span className="flex-1 text-sm font-medium">{p.name}</span>
            {p.gained > 0 && (
              <motion.span
                key={`${step}-${p.name}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-full bg-good/10 px-2 py-0.5 font-mono text-[11px] font-bold text-good"
              >
                +{p.gained}
              </motion.span>
            )}
            <span className="w-14 text-right font-mono text-sm font-bold tabular-nums">
              <AnimatedNumber value={p.score} duration={0.7} />
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

// Left half of the sign-in screen (large screens only).
export default function AuthShowcase() {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface/40 p-10 lg:flex xl:p-14">
      <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-accent/25 blur-[110px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-16 size-96 rounded-full bg-violet-500/15 blur-[120px]"
      />

      <Logo className="relative" />

      <div className="relative flex flex-1 flex-col items-center justify-center py-10 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-md text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl"
        >
          Your next quiz night starts{' '}
          <span className="bg-gradient-to-r from-violet-300 to-accent bg-clip-text text-transparent">here.</span>
        </motion.h2>
        <ul className="mt-6 w-fit space-y-3 text-left">
          {POINTS.map(({ icon: Icon, text }, i) => (
            <motion.li
              key={text}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="flex items-center gap-3 text-zinc-300"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon size={16} />
              </span>
              {text}
            </motion.li>
          ))}
        </ul>
        <div className="mt-10 flex w-full justify-center">
          <LiveLeaderboard />
        </div>
      </div>

      <p className="relative text-center text-sm text-muted">Free to play. Sign in with Google or email.</p>
    </aside>
  );
}
