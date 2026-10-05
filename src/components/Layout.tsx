import { useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { auth } from '../lib/api';
import { LoginPage } from '../routes/LoginPage';
import { CalendarIcon, HeartIcon, MoonIcon, SearchIcon, SunIcon, VanIcon } from './icons';

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
            <span className="brand__name">
              Van<span>Scan</span>
            </span>
          </Link>
          <nav className="topnav" aria-label="Main">
            <Link to="/" data-active={pathname === '/' || pathname.startsWith('/search')}>
              <SearchIcon size={15} />
              <span>Searches</span>
            </Link>
            <Link to="/favourites" data-active={pathname.startsWith('/favourites')}>
              <HeartIcon size={15} />
              <span>Favorites</span>
            </Link>
            <Link to="/runs" data-active={pathname.startsWith('/runs')}>
              <CalendarIcon size={15} />
              <span>Scan history</span>
            </Link>
          </nav>
          <div className="topbar__meta">
            <span className="user-chip" title={session.user.email}>
              <span className="user-chip__avatar" aria-hidden="true">
                {(session.user.name ?? session.user.email).trim().charAt(0).toUpperCase()}
              </span>
              <span className="user-chip__name">{session.user.name ?? session.user.email}</span>
            </span>
            <button type="button" className="btn btn--ghost btn--sm signout" onClick={signOut}>
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
