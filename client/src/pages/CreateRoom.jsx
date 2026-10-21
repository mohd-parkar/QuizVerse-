import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { api } from '../lib/api.js';
import { Button, Card, Input, Segmented } from '../components/ui.jsx';

const SUGGESTIONS = ['JavaScript', 'World History', 'Space', 'Movies', 'Football', 'Biology'];

export default function CreateRoom() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');
  const [timePerQuestion, setTime] = useState(20);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBuilding(true);
    try {
      const { code } = await api.post('/rooms', { topic, count, difficulty, timePerQuestion });
      navigate(`/room/${code}`);
    } catch (err) {
      setError(err.message);
      setBuilding(false);
    }
  }

  return (
    <div className="bg-glow min-h-dvh">
      <div className="mx-auto w-full max-w-xl px-4 py-8">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
          <ArrowLeft size={14} /> Back
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Host a quiz</h1>
        <p className="mt-1 text-muted">Pick a topic. The questions are written for you.</p>

        <Card className="mt-6">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <Input
                label="Topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. The Roman Empire"
                required
                minLength={2}
                maxLength={80}
                autoFocus
              />
              <div className="mt-2.5 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTopic(s)}
                    className="rounded-full border border-line bg-white/5 px-3 py-1 text-xs text-muted transition hover:border-accent hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <Segmented
              label="Questions"
              value={count}
              onChange={setCount}
              options={[5, 10, 15, 20].map((n) => ({ value: n, label: String(n) }))}
            />
            <Segmented
              label="Difficulty"
              value={difficulty}
              onChange={setDifficulty}
              options={[
                { value: 'easy', label: 'Easy' },
                { value: 'medium', label: 'Medium' },
                { value: 'hard', label: 'Hard' },
              ]}
            />
            <Segmented
              label="Time per question"
              value={timePerQuestion}
              onChange={setTime}
              options={[10, 20, 30, 45].map((n) => ({ value: n, label: `${n}s` }))}
            />

            {error && <p className="text-sm text-bad">{error}</p>}
            <Button type="submit" disabled={building} className="w-full py-3">
              <Sparkles size={16} /> Create room
            </Button>
          </form>
        </Card>
      </div>

      <AnimatePresence>
        {building && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="status"
            className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-base/90 backdrop-blur"
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="rounded-full bg-accent-soft p-5 text-accent"
            >
              <Sparkles size={32} />
            </motion.div>
            <div className="px-6 text-center">
              <p className="text-lg font-semibold">Building your quiz…</p>
              <p className="mt-1 text-sm text-muted wrap-anywhere">
                Writing {count} questions about “{topic}”. New topics can take up to 30 seconds.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
