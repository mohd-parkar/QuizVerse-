import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/authStore.js';
import Landing from './pages/Landing.jsx';
import Auth from './pages/Auth.jsx';
import NotFound from './pages/NotFound.jsx';

// the heavier screens (markdown, confetti, animations) load only when first visited
const Join = lazy(() => import('./pages/Join.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const CreateRoom = lazy(() => import('./pages/CreateRoom.jsx'));
const Lobby = lazy(() => import('./pages/Lobby.jsx'));
const History = lazy(() => import('./pages/History.jsx'));
const HistoryDetail = lazy(() => import('./pages/HistoryDetail.jsx'));

function Loading() {
  return <div className="bg-glow flex min-h-dvh items-center justify-center text-muted" role="status">Loading…</div>;
}

// Signed-in users only. Everyone else is sent to log in and then brought back to the page they wanted
// (including a room they were invited to).
function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (user) return children;
  return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
}

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => { init(); }, [init]);

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/history" element={<Protected><History /></Protected>} />
        <Route path="/history/:id" element={<Protected><HistoryDetail /></Protected>} />
        <Route path="/host" element={<Protected><CreateRoom /></Protected>} />
        <Route path="/join/:code" element={<Protected><Join /></Protected>} />
        <Route path="/room/:code" element={<Protected><Lobby /></Protected>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
