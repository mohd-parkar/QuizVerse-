import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Crown, LogOut, Timer, X } from 'lucide-react';
import { useAuth } from '../lib/authStore.js';
import { useRoom } from '../lib/roomStore.js';
import Avatar from '../components/Avatar.jsx';
import Game from '../components/Game.jsx';
import { Button, Card } from '../components/ui.jsx';

export default function Lobby() {
  const code = useParams().code.toUpperCase();
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const { room, playerId, notice, join, leave, start, kick, clearNotice } = useRoom();
  const [copied, setCopied] = useState('');
  const [startError, setStartError] = useState('');
  const [starting, setStarting] = useState(false);
  const attempted = useRef(null);

  // arriving without a seat (fresh from "create room", or after a refresh): take or retake one
  useEffect(() => {
    if (authLoading || notice || room?.code === code || attempted.current === code) return;
    attempted.current = code;
    join(code).catch((err) => navigate(`/join/${code}`, { replace: true, state: { error: err.message } }));
  }, [authLoading, notice, room?.code, code, join, navigate]);

  if (notice) {
    return (
      <div className="bg-glow flex min-h-dvh items-center justify-center px-4">
        <Card className="max-w-sm text-center">
          <p className="font-semibold">{notice}</p>
          <Link to="/" onClick={clearNotice}><Button className="mt-5">Back home</Button></Link>
        </Card>
      </div>
    );
  }

  if (room?.code !== code) {
    return (
      <div className="bg-glow flex min-h-dvh items-center justify-center text-muted" role="status">
        Joining room…
      </div>
    );
  }

  // once the host presses Start, the same URL becomes the live game
  if (room.status !== 'lobby') return <Game />;

  const isHost = room.hostId === playerId;
  const connected = room.players.filter((p) => p.connected).length;

  function copy(kind, text) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(''), 1500);
    });
  }

  async function onStart() {
    setStartError('');
    setStarting(true);
    try {
      await start();
    } catch (err) {
      setStartError(err.message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="bg-glow min-h-dvh">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-5">
        <span className="text-sm text-muted">Lobby</span>
        <Button variant="ghost" onClick={() => { leave(); navigate('/'); }}>
          <LogOut size={14} /> Leave
        </Button>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-32">
        <Card className="text-center">
          <p className="text-xs uppercase tracking-widest text-muted">Room code</p>
          <p className="mt-2 select-all font-mono text-5xl font-bold tracking-[0.25em] text-white sm:text-6xl">
            {room.code}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="ghost" onClick={() => copy('code', room.code)}>
              {copied === 'code' ? <Check size={14} /> : <Copy size={14} />} Copy code
            </Button>
            <Button variant="ghost" onClick={() => copy('link', `${location.origin}/join/${room.code}`)}>
              {copied === 'link' ? <Check size={14} /> : <Copy size={14} />} Copy link
            </Button>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="max-w-full rounded-full bg-accent-soft px-3 py-1 font-medium text-violet-200 wrap-anywhere">{room.topic}</span>
            <span className="rounded-full border border-line px-3 py-1 text-muted">{room.settings.count} questions</span>
            <span className="rounded-full border border-line px-3 py-1 capitalize text-muted">{room.settings.difficulty}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-muted">
              <Timer size={13} /> {room.settings.timePerQuestion}s
            </span>
          </div>
        </Card>

        <section aria-label="Players">
          <h2 className="mb-3 text-sm font-medium text-muted">
            Players · {connected}/{room.maxPlayers}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {room.players.map((p) => (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: p.connected ? 1 : 0.45, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  className="group relative flex items-center gap-3 rounded-2xl border border-line bg-surface/80 p-3"
                >
                  <Avatar name={p.nickname} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium">
                      <span className="truncate">{p.nickname}</span>
                      {p.isHost && <Crown size={13} className="shrink-0 text-amber-300" aria-label="Host" />}
                    </p>
                    <p className="text-xs text-muted">
                      {p.id === playerId ? 'You' : p.connected ? 'Ready' : 'Reconnecting…'}
                    </p>
                  </div>
                  {isHost && p.id !== playerId && (
                    <button
                      type="button"
                      onClick={() => kick(p.id)}
                      aria-label={`Remove ${p.nickname}`}
                      className="-mr-1 ml-auto shrink-0 self-start rounded-full p-1 text-muted opacity-0 transition hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-base/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-2 px-4 py-4">
          {isHost ? (
            <>
              <Button onClick={onStart} disabled={starting || connected < 1} className="w-full max-w-sm py-3">
                Start game · {connected} {connected === 1 ? 'player' : 'players'}
              </Button>
              {startError && <p className="text-sm text-bad">{startError}</p>}
            </>
          ) : (
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="py-2 text-sm text-muted"
            >
              Waiting for the host to start…
            </motion.p>
          )}
        </div>
      </footer>
    </div>
  );
}
