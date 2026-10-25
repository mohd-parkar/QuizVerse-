import { Link, NavLink, useNavigate } from 'react-router-dom';
import { History, LayoutDashboard, LogOut, Zap } from 'lucide-react';
import { useAuth } from '../lib/authStore.js';
import ChatPanel from './ChatPanel.jsx';

const navClass = ({ isActive }) =>
  `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-white/10 text-white' : 'text-muted hover:text-white'
  }`;

// Header, page container and the study-assistant sidebar for the signed-in area.
// The assistant lives only here, so it is never on screen inside a quiz room.
export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="bg-glow min-h-dvh">
      <header className="sticky top-0 z-10 h-14 border-b border-line bg-base/70 backdrop-blur">
        <div className="mx-auto flex h-full w-full max-w-[1500px] items-center justify-between gap-3 px-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-lg font-bold">
            <Zap className="text-accent" size={20} /> <span className="max-sm:sr-only">Quizverse</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main">
            <NavLink to="/dashboard" className={navClass}>
              <LayoutDashboard size={15} /> Dashboard
            </NavLink>
            <NavLink to="/history" className={navClass}>
              <History size={15} /> History
            </NavLink>
          </nav>
          <div className="flex items-center gap-2 text-sm text-muted">
            {user?.picture ? (
              <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-7 rounded-full border border-line" />
            ) : user?.username ? (
              <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
                {user.username.charAt(0).toUpperCase()}
              </span>
            ) : null}
            <span className="max-w-28 truncate max-sm:hidden">{user?.username}</span>
            <button
              type="button"
              aria-label="Log out"
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              className="rounded-full p-2 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1500px]">
        <main className="mx-auto min-w-0 max-w-5xl flex-1 px-4 pb-12 pt-10 sm:pt-14">{children}</main>
        <ChatPanel />
      </div>
    </div>
  );
}
