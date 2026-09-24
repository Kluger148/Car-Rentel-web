import { useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { auth } from '../lib/api';
import { LoginPage } from '../routes/LoginPage';
import { MoonIcon, SunIcon, VanIcon } from './icons';

type Theme = 'light' | 'dark';

function readStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem('theme');
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(() => readStoredTheme());

  useEffect(() => {
    const root = document.documentElement;
    if (theme) root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
    try {
      if (theme) localStorage.setItem('theme', theme);
    } catch {
      // Private mode or blocked storage: the toggle still works for this session.
    }
  }, [theme]);

  const toggle = () => {
    const current =
      theme ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(current === 'dark' ? 'light' : 'dark');
  };

  return { theme, toggle };
}

export function useSession() {
  return useSyncExternalStore(auth.subscribe, () => auth.session);
}

export function Layout() {
  const { theme, toggle } = useTheme();
  const session = useSession();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const themeButton = (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );

  if (!session) return <LoginPage />;

  const signOut = () => {
    auth.set(null);
    queryClient.clear();
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="container topbar__inner">
          <Link to="/" className="brand">
            <span className="brand__mark">
              <VanIcon size={17} />
            </span>
            VanScan
          </Link>
          <nav className="topnav">
            <Link to="/" data-active={pathname === '/' || pathname.startsWith('/search')}>
              Searches
            </Link>
            <Link to="/favourites" data-active={pathname.startsWith('/favourites')}>
              Favorites
            </Link>
            <Link to="/runs" data-active={pathname.startsWith('/runs')}>
              Scan history
            </Link>
          </nav>
          <div className="topbar__meta">
            <span>{session.user.name ?? session.user.email}</span>
            <button type="button" className="link-quiet" onClick={signOut}>
              Sign out
            </button>
          </div>
          {themeButton}
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container">
          Skyscanner car-hire quotes for complete 330-day rentals, collected daily. Quotes are not reservations:
          review price, mileage and conditions on the booking site before presenting a deal to a customer.
        </div>
      </footer>
    </div>
  );
}
