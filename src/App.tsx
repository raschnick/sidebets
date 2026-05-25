import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, RouterProvider, createBrowserRouter, useNavigate } from 'react-router-dom';
import Home from './pages/Home.js';
import Group from './pages/Group.js';
import GroupCreate from './pages/GroupCreate.js';
import Bet from './pages/Bet.js';
import Settle from './pages/Settle.js';
import Login from './pages/Login.js';
import Admin from './pages/Admin.js';
import { ApiError, api, clearSessionToken, hasSessionToken } from './lib/api.js';
import type { AppBootstrap } from './lib/types.js';

function ProtectedLayout() {
  const navigate = useNavigate();
  const [bootstrap, setBootstrap] = useState<AppBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleLogout() {
    await api.logout();
    navigate('/login', { replace: true });
  }

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
          <nav className="nav" aria-label="Primary navigation">
            <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/">
              Home
            </NavLink>
            {bootstrap.currentUser.isAdmin ? (
              <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/admin">
                Admin
              </NavLink>
            ) : null}
            <span className="pill pill-accent">
              {bootstrap.currentUser.username}
              {bootstrap.currentUser.isAdmin ? ' · admin' : ''}
            </span>
            <button type="button" className="button-ghost" onClick={() => void handleLogout()}>
              Log out
            </button>
          </nav>
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
        path: 'groups/:groupId',
        element: <Group />
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
