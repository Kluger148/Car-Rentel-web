import { Link } from '@tanstack/react-router';

/** Switches between the two pages behind the user chip. */
export function SettingsTabs({ active }: { active: 'profile' | 'account' }) {
  return (
    <nav className="tabs" aria-label="Settings">
      <Link to="/profile" className="tab" aria-current={active === 'profile' ? 'page' : undefined}>
        Profile
      </Link>
      <Link to="/account" className="tab" aria-current={active === 'account' ? 'page' : undefined}>
        Account
      </Link>
    </nav>
  );
}
