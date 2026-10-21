import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import AppShell from '../components/AppShell.jsx';
import GameRow from '../components/GameRow.jsx';
import { Button, Card, Skeleton } from '../components/ui.jsx';

export default function History() {
  const { data, error, loading } = useApi('/history?limit=50');

  return (
    <AppShell>
      <h1 className="text-3xl font-bold tracking-tight">History</h1>
      <p className="mt-1 text-muted">Every quiz you’ve finished while signed in.</p>

      <div className="mt-6 space-y-2">
        {loading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px]" />)}
        {error && <Card className="text-sm text-bad">Couldn’t load your history. {error.message}</Card>}
        {data && data.games.length === 0 && (
          <Card className="py-10 text-center">
            <p className="font-medium">Nothing here yet</p>
            <p className="mt-1 text-sm text-muted">Finish a game while signed in and it’s saved here.</p>
            <Link to="/host"><Button className="mt-5"><Plus size={16} /> Host a quiz</Button></Link>
          </Card>
        )}
        {data?.games.map((g, i) => (
          <motion.div key={g.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
            <GameRow game={g} />
          </motion.div>
        ))}
      </div>
    </AppShell>
  );
}
