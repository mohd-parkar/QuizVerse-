import { motion } from 'framer-motion';

export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary:
      'bg-accent text-white hover:brightness-110 shadow-[0_0_24px_-6px_var(--color-accent)]',
    ghost: 'bg-white/5 text-white hover:bg-white/10 border border-line',
  };
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

// `icon` is a lucide component shown inside the field; `right` is an element (e.g. a show/hide button) at its end
export function Input({ label, icon: Icon, right, className = '', ...props }) {
  return (
    <label className="block text-sm">
      {label && <span className="mb-1.5 block font-medium text-zinc-300">{label}</span>}
      <span className="relative block">
        {Icon && (
          <Icon size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        )}
        <input
          className={`w-full rounded-xl border border-line bg-raised py-3 text-white outline-none transition max-sm:text-base placeholder:text-zinc-600 hover:border-white/20 focus:border-accent focus:ring-2 focus:ring-accent/30 ${
            Icon ? 'pl-10' : 'pl-4'
          } ${right ? 'pr-11' : 'pr-4'} ${className}`}
          {...props}
        />
        {right && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{right}</span>}
      </span>
    </label>
  );
}

export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-white/5 ${className}`} />;
}

const RANK_STYLES = {
  1: 'border-amber-300/40 bg-amber-300/15 text-amber-200',
  2: 'border-zinc-300/30 bg-zinc-300/10 text-zinc-200',
  3: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
};

export function RankBadge({ rank, className = '' }) {
  return (
    <span
      className={`inline-flex min-w-10 items-center justify-center rounded-full border px-2.5 py-1 font-mono text-sm font-bold ${
        RANK_STYLES[rank] ?? 'border-line bg-white/5 text-muted'
      } ${className}`}
      aria-label={`Rank ${rank}`}
    >
      #{rank}
    </span>
  );
}

// pill-style single choice control (difficulty, question count, timer...)
export function Segmented({ label, options, value, onChange }) {
  return (
    <div className="text-sm">
      <span className="mb-1.5 block text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl border border-line bg-raised p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-lg px-3 py-2 font-medium transition focus-visible:outline-2 focus-visible:outline-accent ${
              value === o.value ? 'bg-accent text-white shadow-[0_0_18px_-6px_var(--color-accent)]' : 'text-muted hover:text-white'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Card({ className = '', ...props }) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface/80 p-6 backdrop-blur ${className}`}
      {...props}
    />
  );
}
