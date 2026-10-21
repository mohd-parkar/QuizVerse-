import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { useAuth } from '../lib/authStore.js';
import { useApi } from '../lib/useApi.js';
import { percent } from '../lib/format.js';
import AppShell from '../components/AppShell.jsx';
import GameRow from '../components/GameRow.jsx';
import { Button, Card, Skeleton } from '../components/ui.jsx';

function StatTile({ label, value, loading }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      {loading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="mt-1 font-mono text-3xl font-bold tabular-nums">{value}</p>}
    </Card>
  );
}

function TopicInsight({ icon: Icon, tone, label, topic }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/80 p-4">
      <span className={`rounded-xl p-2 ${tone}`}><Icon size={18} /></span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="truncate font-medium">
          {topic.topic} <span className="font-mono text-sm text-muted">{percent(topic.accuracy)}</span>
        </p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const { data: stats, loading: statsLoading } = useApi('/history/stats');
  const { data: recent, loading: recentLoading } = useApi('/history?limit=3');

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight wrap-anywhere sm:text-3xl">Hey, {user.username} 👋</h1>
          <p className="mt-1 text-muted">Ready for another round?</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold">Join a game</h2>
            <p className="mt-1 text-sm text-muted">Enter the 6-character code from your host.</p>
            <form
              className="mt-5 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length === 6) navigate(`/join/${code}`);
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABC123"
                aria-label="Room code"
                className="min-w-0 flex-1 rounded-xl border border-line bg-raised px-4 py-3 font-mono tracking-[0.3em] outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
              <Button type="submit" disabled={code.length !== 6}>Join</Button>
            </form>
          </Card>
          <Card className="flex flex-col">
            <h2 className="text-lg font-semibold">Host a quiz</h2>
            <p className="mt-1 text-sm text-muted">Choose a topic and let the AI write the questions.</p>
            <Button className="mt-5 w-fit" onClick={() => navigate('/host')}>
              <Plus size={16} /> Create room
            </Button>
          </Card>
        </div>

        <section aria-label="Your stats">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Games" value={stats?.games} loading={statsLoading} />
            <StatTile label="Wins" value={stats?.wins} loading={statsLoading} />
            <StatTile label="Accuracy" value={percent(stats?.accuracy)} loading={statsLoading} />
            <StatTile label="Points" value={stats?.points?.toLocaleString()} loading={statsLoading} />
          </div>
          {(stats?.bestTopic || stats?.weakestTopic) && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {stats.bestTopic && (
                <TopicInsight icon={TrendingUp} tone="bg-good/10 text-good" label="Strongest topic" topic={stats.bestTopic} />
              )}
              {stats.weakestTopic && (
                <TopicInsight icon={TrendingDown} tone="bg-bad/10 text-bad" label="Needs practice" topic={stats.weakestTopic} />
              )}
            </div>
          )}
        </section>

        <section aria-label="Recent games">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent games</h2>
            <Link to="/history" className="inline-flex items-center gap-1 text-sm text-muted hover:text-white">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {recentLoading ? (
            <div className="space-y-2"><Skeleton className="h-[72px]" /><Skeleton className="h-[72px]" /></div>
          ) : recent?.games.length ? (
            <div className="space-y-2">{recent.games.map((g) => <GameRow key={g.id} game={g} />)}</div>
          ) : (
            <Card className="text-center text-sm text-muted">
              No games yet. Host one or join a friend’s room and your results will show up here.
            </Card>
          )}
        </section>
      </motion.div>
    </AppShell>
  );
}
