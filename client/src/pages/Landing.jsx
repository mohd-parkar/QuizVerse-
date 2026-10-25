import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, KeyRound, ShieldCheck, Sparkles, Trophy, Zap } from 'lucide-react';
import { useAuth } from '../lib/authStore.js';
import { Button, Card } from '../components/ui.jsx';

// headline: each word rises out of a blur, one after another
const headline = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } } };
const wordIn = {
  hidden: { opacity: 0, y: 28, filter: 'blur(10px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 120, damping: 16 } },
};

function Words({ text, shimmer = false }) {
  return text.split(' ').map((word, i, all) => (
    <span key={i}>
      <motion.span variants={wordIn} className={`inline-block ${shimmer ? 'text-shimmer' : ''}`}>
        {word}
      </motion.span>
      {i < all.length - 1 && ' '}
    </span>
  ));
}

// the intro text and form follow once the headline has landed
const fadeUp = (delay) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.5 },
});

function FeatureGroup({ duplicate = false }) {
  return (
    <ul className={`flex shrink-0 gap-4 pr-4 ${duplicate ? 'marquee-dup' : ''}`} aria-hidden={duplicate || undefined}>
      {FEATURES.map(({ icon: Icon, title, text }) => (
        <li key={title} className="w-64 shrink-0 sm:w-80">
          <Card className="h-full p-5 sm:p-6">
            <span className="inline-flex rounded-xl bg-accent-soft p-2.5 text-accent"><Icon size={20} /></span>
            <h2 className="mt-4 font-semibold">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  function join(e) {
    e.preventDefault();
    if (code.trim()) navigate(`/join/${code.trim().toUpperCase()}`);
  }

  return (
    <div className="bg-glow flex min-h-dvh flex-col overflow-x-hidden">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:py-5">
        <div className="flex items-center gap-2 text-lg font-bold">
          <Zap className="text-accent" size={20} /> Quizverse
        </div>
        <nav className="flex items-center gap-2">
          {user ? (
            <Link to="/dashboard"><Button variant="ghost">Dashboard</Button></Link>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost" className="px-3.5 sm:px-5">Log in</Button></Link>
              <Link to="/register"><Button className="px-3.5 sm:px-5">Sign up</Button></Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pt-12 pb-20 text-center sm:pt-28 sm:pb-24">
        <motion.h1
          variants={headline}
          initial="hidden"
          animate="show"
          aria-label="Quiz together. Win in real time."
          className="text-3xl min-[380px]:text-4xl min-[480px]:text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.15] sm:leading-tight"
        >
          <span className="block" aria-hidden="true"><Words text="Quiz together." /></span>
          <span className="block" aria-hidden="true"><Words text="Win in real time." shimmer /></span>
        </motion.h1>
        <motion.p
          {...fadeUp(0.8)}
          className="mt-4 sm:mt-5 max-w-xl text-[15px] sm:text-lg leading-relaxed text-muted px-2 sm:px-0"
        >
          Pick any topic, invite friends with a code, and race through AI-generated questions on a live leaderboard.
        </motion.p>

        <motion.form
          onSubmit={join}
          {...fadeUp(1)}
          className="mt-8 sm:mt-10 flex w-full max-w-md items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-4 sm:pl-5"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="ROOM CODE"
            aria-label="Room code"
            className="min-w-0 flex-1 bg-transparent font-mono text-base sm:text-lg tracking-[0.2em] sm:tracking-[0.3em] text-white outline-none placeholder:text-zinc-600"
          />
          <Button type="submit">Join <ArrowRight size={16} /></Button>
        </motion.form>

        {!user && <motion.p {...fadeUp(1.1)} className="mt-3 text-xs text-muted">Playing needs a free account — sign in with Google or email.</motion.p>}

        <motion.div {...fadeUp(1.15)}>
          <Link to={user ? '/dashboard' : '/register'} className="mt-6 inline-block text-sm text-muted hover:text-white">
            or host your own quiz →
          </Link>
        </motion.div>
      </main>

      {/* A train of cards that slides past forever. The list is rendered twice and the track moves by exactly
          one list's width, so the loop has no visible jump. Hovering pauses it. */}
      <section
        aria-label="What you can do with Quizverse"
        className="marquee overflow-hidden pb-20 [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)]"
      >
        <div className="marquee-track flex w-max">
          <FeatureGroup />
          <FeatureGroup duplicate />
        </div>
      </section>

      <footer className="border-t border-line py-6 text-center text-sm text-muted">
        Quizverse · built with the MERN stack, Socket.IO and Gemini
      </footer>
    </div>
  );
}

const FEATURES = [
  { icon: Sparkles, title: 'Any topic, instantly', text: 'Type a subject and the questions are written for you, with an explanation for every answer.' },
  { icon: Zap, title: 'Live and competitive', text: 'Everyone plays on the same clock. Faster correct answers earn more points, and the leaderboard moves in real time.' },
  { icon: KeyRound, title: 'Join in seconds', text: 'Share a 6-letter code or a link. Friends join from any phone with Google or email, nothing to install.' },
  { icon: Trophy, title: 'A podium every game', text: 'Watch the ranks reshuffle after each question, then celebrate on the final podium.' },
  { icon: ShieldCheck, title: 'Fair play built in', text: 'The server runs every timer and keeps the answers hidden until a question closes, so nobody can cheat.' },
  { icon: BarChart3, title: 'Learn from every game', text: 'Review each answer, track your accuracy by topic, and ask the built-in AI assistant about your results or anything you want to study.' },
];
