import { Link } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState } from 'react';
import type { User } from '../lib/api';

interface UserMenuProps {
  user: User;
  /** True on the profile and account pages, to mark the button like an active nav link. */
  active: boolean;
  onSignOut: () => void;
}

/** The avatar in the top bar: opens a menu with the profile and account pages and Sign out. */
export function UserMenu({ user, active, onSignOut }: UserMenuProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const displayName = user.name ?? user.email;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="user-menu" ref={boxRef}>
      <button
        ref={buttonRef}
        type="button"
        className="user-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${displayName}`}
        data-active={active || open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="user-chip__avatar" aria-hidden="true">
          {displayName.trim().charAt(0).toUpperCase()}
        </span>
        <span className="user-chip__name">{displayName}</span>
        <svg className="user-chip__caret" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="user-menu__panel" id={menuId} role="menu">
          <div className="user-menu__who">
            <strong>{displayName}</strong>
            {user.name && <span>{user.email}</span>}
          </div>
          <Link to="/profile" role="menuitem" className="user-menu__item" onClick={close}>
            Profile
          </Link>
          <Link to="/account" role="menuitem" className="user-menu__item" onClick={close}>
            Account
          </Link>
          <button
            type="button"
            role="menuitem"
            className="user-menu__item user-menu__item--danger"
            onClick={() => {
              close();
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
