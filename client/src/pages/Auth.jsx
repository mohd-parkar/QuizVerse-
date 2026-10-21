import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, Lock, LoaderCircle, Mail, User } from 'lucide-react';
import { useAuth } from '../lib/authStore.js';
import { safeNext } from '../lib/nextPath.js';
import AuthShowcase from '../components/AuthShowcase.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import Logo from '../components/Logo.jsx';
import { Input } from '../components/ui.jsx';

export default function Auth({ mode }) {
  const isRegister = mode === 'register';
  const { user, login, register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();
  const next = safeNext(useSearchParams()[0].get('next'));
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={next} replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isRegister) await register(form.username, form.email, form.password);
      else await login(form.email, form.password);
      navigate(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle(credential) {
    setError('');
    setBusy(true);
    try {
      await googleLogin(credential);
      navigate(next);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      <AuthShowcase />

      <div className="bg-glow relative flex min-h-dvh flex-col px-6 py-6 sm:px-10 lg:bg-none">
        <div className="flex items-center justify-between">
          <Logo className="lg:invisible" />
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-white">
            <ArrowLeft size={14} /> Home
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-sm"
          >
            <h1 className="text-3xl font-bold tracking-tight">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
            <p className="mt-2 text-muted">
              {isRegister ? 'Free, and it takes under a minute.' : 'Sign in to host quizzes, join rooms and track your progress.'}
            </p>

            {/* log in: Google first. Sign up: Google sits between the fields and the submit button (below) */}
            {!isRegister && <GoogleButton onCredential={onGoogle} onError={setError} />}

            <form onSubmit={submit} className="mt-6 space-y-4">
              {isRegister && (
                <Input
                  label="Username"
                  icon={User}
                  value={form.username}
                  onChange={set('username')}
                  placeholder="How you'll appear in games"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={24}
                />
              )}
              <Input
                label="Email"
                icon={Mail}
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
              <Input
                label="Password"
                icon={Lock}
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder={isRegister ? 'At least 6 characters' : 'Your password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={6}
                right={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-3 text-sm text-red-300"
                >
                  <CircleAlert size={16} className="mt-0.5 shrink-0" /> {error}
                </motion.p>
              )}

              {isRegister && <GoogleButton bare onCredential={onGoogle} onError={setError} />}

              <motion.button
                type="submit"
                disabled={busy}
                whileTap={{ scale: 0.98 }}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 font-semibold text-white shadow-[0_8px_28px_-8px_var(--color-accent)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" /> Please wait…
                  </>
                ) : (
                  <>
                    {isRegister ? 'Create account' : 'Log in'}
                    <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
                  </>
                )}
              </motion.button>
            </form>

            <p className="mt-8 text-center text-sm text-muted">
              {isRegister ? 'Already have an account?' : 'New to Quizverse?'}{' '}
              <Link
                to={`${isRegister ? '/login' : '/register'}${search}`}
                className="font-medium text-white underline-offset-4 hover:underline"
              >
                {isRegister ? 'Log in' : 'Create an account'}
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
