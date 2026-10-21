import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Users, X } from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { formatDate } from '../lib/format.js';
import AppShell from '../components/AppShell.jsx';
import Avatar from '../components/Avatar.jsx';
import { Card, RankBadge, Skeleton } from '../components/ui.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

function QuestionReview({ q, index }) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 font-medium leading-snug wrap-anywhere">
          <span className="mr-2 font-mono text-muted">{index + 1}.</span>
          {q.text}
        </p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-xs font-bold ${
            q.correct ? 'bg-good/10 text-good' : q.myChoice == null ? 'bg-white/5 text-muted' : 'bg-bad/10 text-bad'
          }`}
        >
          {q.correct ? `+${q.points}` : q.myChoice == null ? 'No answer' : '0'}
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {q.options.map((option, i) => {
          const isCorrect = i === q.correctIndex;
          const mineWrong = i === q.myChoice && !isCorrect;
          return (
            <li
              key={i}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm ${
                isCorrect ? 'border-good/50 bg-good/10' : mineWrong ? 'border-bad/50 bg-bad/10' : 'border-line text-muted'
              }`}
            >
              <span className="font-mono text-xs font-bold opacity-70">{LETTERS[i]}</span>
              <span className="min-w-0 flex-1 wrap-anywhere">{option}</span>
              {isCorrect && <Check size={15} className="text-good" aria-label="Correct answer" />}
              {mineWrong && <X size={15} className="text-bad" aria-label="Your answer" />}
            </li>
          );
        })}
      </ul>
      {q.explanation && <p className="text-sm leading-relaxed text-muted wrap-anywhere">{q.explanation}</p>}
    </Card>
  );
}

export default function HistoryDetail() {
  const { id } = useParams();
  const { data: game, error, loading } = useApi(`/history/${id}`);

  return (
    <AppShell>
      <Link to="/history" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft size={14} /> History
      </Link>

      {loading && (
        <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
      )}

      {error && (
        <Card className="py-10 text-center">
          <p className="font-medium">Game not found</p>
          <p className="mt-1 text-sm text-muted">It may not exist, or it isn’t one of yours.</p>
        </Card>
      )}

      {game && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold">{game.topic}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
                <span>{formatDate(game.endedAt)}</span>
                <span className="capitalize">{game.settings.difficulty}</span>
                <span>{game.settings.timePerQuestion}s per question</span>
                <span className="inline-flex items-center gap-1"><Users size={13} /> {game.standings.length}</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <RankBadge rank={game.me.rank} className="text-base" />
              <div className="text-right">
                <p className="font-mono text-2xl font-bold tabular-nums">{game.me.score.toLocaleString()}</p>
                <p className="text-xs text-muted">{game.me.correctCount}/{game.questions.length} correct</p>
              </div>
            </div>
          </Card>

          <section aria-label="Final standings">
            <h2 className="mb-3 text-lg font-semibold">Final standings</h2>
            <Card className="p-2">
              <ul>
                {game.standings.map((s) => (
                  <li key={s.nickname} className={`flex items-center gap-2 rounded-xl px-2 py-2.5 sm:gap-3 sm:px-3 ${s.isMe ? 'bg-accent-soft' : ''}`}>
                    <span className="w-7 text-center font-mono font-bold text-muted">{s.rank}</span>
                    <Avatar name={s.nickname} size={34} />
                    <span className="flex min-w-0 flex-1 items-baseline gap-2">
                      <span className="truncate font-medium">{s.nickname}</span>
                      {s.isMe && <span className="shrink-0 text-xs text-muted">you</span>}
                    </span>
                    <span className="text-xs text-muted max-sm:hidden">{s.correctCount}/{game.questions.length}</span>
                    <span className="w-16 text-right font-mono font-bold tabular-nums sm:w-20">{s.score.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <section aria-label="Question review">
            <h2 className="mb-3 text-lg font-semibold">Review your answers</h2>
            <div className="space-y-3">
              {game.questions.map((q, i) => <QuestionReview key={i} q={q} index={i} />)}
            </div>
          </section>
        </motion.div>
      )}
    </AppShell>
  );
}
