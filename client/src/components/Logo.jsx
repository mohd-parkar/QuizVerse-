import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

export default function Logo({ to = '/', className = '' }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 text-lg font-bold tracking-tight ${className}`} aria-label="Quizverse home">
      <span className="flex size-8 items-center justify-center rounded-xl bg-accent text-white shadow-[0_0_24px_-4px_var(--color-accent)]">
        <Zap size={17} fill="currentColor" />
      </span>
      Quizverse
    </Link>
  );
}
