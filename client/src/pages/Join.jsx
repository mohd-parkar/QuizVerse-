import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Zap } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/authStore.js';
import { savedSession, useRoom } from '../lib/roomStore.js';
import Avatar from '../components/Avatar.jsx';
import { Button, Card } from '../components/ui.jsx';

// Reached only when signed in (the route is protected): you play as your account, so there is nothing to type.
export default function Join() {
  const code = useParams().code.toUpperCase();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const join = useRoom((s) => s.join);

  const [info, setInfo] = useState(null); // null = loading, false = not found
  const [error, setError] = useState(location.state?.error ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/rooms/${code}`).then(setInfo).catch(() => setInfo(false));
  }, [code]);

  // already seated in this room from this tab: go straight back in
  if (savedSession(code).playerId) return <Navigate to={`/room/${code}`} replace />;

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await join(code);
      navigate(`/room/${code}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="bg-glow flex min-h-dvh items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <Link to="/dashboard" className="mb-8 flex items-center justify-center gap-2 text-xl font-bold">
          <Zap className="text-accent" size={22} /> Quizverse
        </Link>

        <Card>
          {info === null && <p className="text-center text-muted">Looking for room…</p>}

          {info === false && (
            <div className="text-center">
              <h1 className="text-lg font-semibold">Room not found</h1>
              <p className="mt-1 text-sm text-muted">
                Nothing is running with code <span className="font-mono text-white">{code}</span>. Check the code with your host.
              </p>
              <Link to="/dashboard"><Button variant="ghost" className="mt-5">Back to dashboard</Button></Link>
            </div>
          )}

          {info && (
            <div className="space-y-5">
              <div>
                <p className="font-mono text-sm tracking-[0.3em] text-accent">{info.code}</p>
                <h1 className="mt-1 text-xl font-semibold wrap-anywhere">{info.topic}</h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <Users size={14} /> {info.playerCount} / {info.maxPlayers} players
                </p>
              </div>
              {info.status !== 'lobby' ? (
                <p className="text-sm text-bad">This game has already started.</p>
              ) : (
                <>
                  <div className="flex items-center gap-3 rounded-xl border border-line bg-raised p-3">
                    <Avatar name={user.username} size={36} />
                    <div className="min-w-0 text-sm">
                      <p className="text-muted">Joining as</p>
                      <p className="truncate font-medium">{user.username}</p>
                    </div>
                  </div>
                  {error && <p className="text-sm text-bad" role="alert">{error}</p>}
                  <Button onClick={submit} disabled={busy} className="w-full">
                    {busy ? 'Joining…' : 'Join game'}
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
