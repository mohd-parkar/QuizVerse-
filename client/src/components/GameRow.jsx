import { Link } from 'react-router-dom';
import { ChevronRight, Users } from 'lucide-react';
import { formatDate } from '../lib/format.js';
import { RankBadge } from './ui.jsx';

// One finished game in a list (dashboard + history).
export default function GameRow({ game }) {
  return (
    <Link
      to={`/history/${game.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-line bg-surface/80 p-4 transition hover:border-white/20 hover:bg-raised"
    >
      <RankBadge rank={game.rank} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{game.topic}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
          <span>{formatDate(game.endedAt)}</span>
          <span className="capitalize">{game.difficulty}</span>
          <span className="inline-flex items-center gap-1">
            <Users size={12} /> {game.playerCount}
          </span>
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono font-bold tabular-nums">{game.score.toLocaleString()}</p>
        <p className="text-xs text-muted">
          {game.correctCount}/{game.questionCount} correct
        </p>
      </div>
      <ChevronRight size={16} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-white" />
    </Link>
  );
}
