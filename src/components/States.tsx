import type { ReactNode } from 'react';
import { AlertIcon, SearchIcon } from './icons';

export function DealSkeleton({ count = 5 }: { count?: number }) {
  return (
    <ul className="deal-list" aria-busy="true" aria-label="Loading deals">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="card deal">
          <div className="deal__body">
            <div className="skeleton" style={{ width: 120, height: 18, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: '55%', height: 20, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: '35%', height: 15, marginBottom: 14 }} />
            <div className="skeleton" style={{ width: '80%', height: 15 }} />
          </div>
          <div className="deal__price">
            <div className="skeleton" style={{ width: 110, height: 30, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 140, height: 36 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

interface StateProps {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

function StateBlock({ title, children, icon, action }: StateProps) {
  return (
    <div className="card state">
      <div className="state__icon">{icon}</div>
      <h2>{title}</h2>
      {children}
      {action}
    </div>
  );
}

export function NoMatchesState({ onReset }: { onReset: () => void }) {
  return (
    <StateBlock
      title="No deals match these filters"
      icon={<SearchIcon size={24} />}
      action={
        <button type="button" className="btn btn--ghost" onClick={onReset}>
          Clear all filters
        </button>
      }
    >
      <p>Try widening the price cap, choosing a different vehicle class, or clearing the location filter.</p>
    </StateBlock>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <StateBlock
      title="Could not load data"
      icon={<AlertIcon size={24} />}
      action={
        onRetry ? (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            Try again
          </button>
        ) : undefined
      }
    >
      <p>{message}</p>
      <code className="code-block">cd backend{'\n'}npm run start:dev</code>
    </StateBlock>
  );
}
