import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, RouterProvider, createBrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import BetCreate from './pages/BetCreate.js';
import Home from './pages/Home.js';
import Group from './pages/Group.js';
import GroupCreate from './pages/GroupCreate.js';
import GroupMembers from './pages/GroupMembers.js';
import GroupSettled from './pages/GroupSettled.js';
import Profile from './pages/Profile.js';
import Bet from './pages/Bet.js';
import Settle from './pages/Settle.js';
import Login from './pages/Login.js';
import Admin from './pages/Admin.js';
import { ApiError, api, clearSessionToken, hasSessionToken } from './lib/api.js';
import type { AppBootstrap } from './lib/types.js';

function ProtectedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [bootstrap, setBootstrap] = useState<AppBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  async function loadBootstrap() {
    if (!hasSessionToken()) {
      setUnauthorized(true);
      setBootstrap(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextBootstrap = await api.getBootstrap();
      setBootstrap(nextBootstrap);
      setUnauthorized(false);
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) {
        clearSessionToken();
        setUnauthorized(true);
        setBootstrap(null);
      } else {
        setError(loadError instanceof Error ? loadError.message : 'Could not load your session.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBootstrap();

    const syncAuth = () => {
      void loadBootstrap();
    };

    window.addEventListener('sidebets:auth-changed', syncAuth);
    window.addEventListener('storage', syncAuth);

    return () => {
      window.removeEventListener('sidebets:auth-changed', syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  useEffect(() => {
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountMenuOpen]);

  async function handleLogout() {
    await api.logout();
    navigate('/login', { replace: true });
  }

  const usernameInitial = bootstrap?.currentUser.username.slice(0, 1).toUpperCase() ?? '';

  if (unauthorized) {
    return <Navigate to="/login" replace />;
  }

  if (loading || !bootstrap) {
    if (!loading && error) {
      return (
        <div className="app-shell">
          <div className="app-frame">
            <section className="card error">{error}</section>
            <button type="button" className="button" onClick={() => void loadBootstrap()}>
              Retry session load
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="app-shell">
        <div className="app-frame">
          <section className="card muted">Loading your SideBets session…</section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="topbar">
          <div>
            <div className="brand">SideBets</div>
          </div>
          <div className="topbar-actions">
            <nav className="nav nav-primary" aria-label="Primary navigation">
              <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/">
                Home
              </NavLink>
              {bootstrap.currentUser.isAdmin ? (
                <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/admin">
                  Admin
                </NavLink>
              ) : null}
            </nav>

            <div className="nav nav-account" aria-label="Account actions">
              <div ref={accountMenuRef} className="account-menu-shell">
                <button
                  type="button"
                  className="account-summary account-trigger"
                  aria-expanded={accountMenuOpen}
                  aria-controls="account-menu"
                  aria-label={`Open account menu for ${bootstrap.currentUser.username}`}
                  onClick={() => setAccountMenuOpen((open) => !open)}
                >
                  <span className="account-avatar" aria-hidden="true">
                    {usernameInitial}
                  </span>
                  <span className="account-name">{bootstrap.currentUser.username}</span>
                  <span className={`account-chevron${accountMenuOpen ? ' open' : ''}`} aria-hidden="true">
                    ▾
                  </span>
                </button>

                {accountMenuOpen ? (
                  <div id="account-menu" className="account-menu" aria-label="Account menu">
                    <Link className="account-menu-item" to="/profile">
                      Profile
                    </Link>
                    <button
                      type="button"
                      className="account-menu-item account-menu-danger"
                      onClick={() => void handleLogout()}
                    >
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {error ? <section className="card error">{error}</section> : null}

        <Outlet
          context={{
            bootstrap,
            refreshBootstrap: loadBootstrap
          }}
        />
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/',
    element: <ProtectedLayout />,
    children: [
      {
        index: true,
        element: <Home />
      },
      {
        path: 'groups/new',
        element: <GroupCreate />
      },
      {
        path: 'admin',
        element: <Admin />
      },
      {
        path: 'profile',
        element: <Profile />
      },
      {
        path: 'groups/:groupId',
        element: <Group />
      },
      {
        path: 'groups/:groupId/members',
        element: <GroupMembers />
      },
      {
        path: 'groups/:groupId/settled',
        element: <GroupSettled />
      },
      {
        path: 'groups/:groupId/bets/new',
        element: <BetCreate />
      },
      {
        path: 'bets/:betId',
        element: <Bet />
      },
      {
        path: 'bets/:betId/settle',
        element: <Settle />
      }
    ]
  }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
