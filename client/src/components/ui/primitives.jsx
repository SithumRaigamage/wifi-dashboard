// Flat, borderless design-system primitives per the design spec.
// Cards: --surface-1 fill, 12px radius, no border, no shadow.
import { cn } from '../../lib/utils.js';

export function Card({ className, ...props }) {
  return (
    <div
      className={cn('rounded-[var(--radius-card)] bg-[var(--surface-1)] p-4', className)}
      {...props}
    />
  );
}

const badgeVariants = {
  success: 'bg-[var(--bg-success)] text-[var(--text-success)]',
  warning: 'bg-[var(--bg-warning)] text-[var(--text-warning)]',
  danger: 'bg-[var(--bg-danger)] text-[var(--text-danger)]',
  muted: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
};

// Full-pill status/quality badge (12px / 400).
export function Badge({ className, variant = 'muted', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-normal',
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  );
}

// Default (filled) + outline button variants, 8px radius, weight 500.
export function Button({ className, variant = 'default', size = 'md', disabled, ...props }) {
  const variants = {
    default:
      'bg-[var(--text-primary)] text-[var(--surface-0)] hover:opacity-90',
    outline:
      'bg-transparent text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--surface-2)]',
  };
  const sizes = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };
  return (
    <button
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius)] font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-[var(--surface-2)]', className)} />;
}

// 13px/500 secondary section header, used above each section's content.
export function SectionHeader({ children, right, className }) {
  return (
    <div className={cn('mb-2 flex items-center justify-between', className)}>
      <h2 className="text-[13px] font-medium text-[var(--text-secondary)]">{children}</h2>
      {right}
    </div>
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5',
        'text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]',
        'focus:border-[var(--border-strong)]',
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5',
        'text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

// Flat pill toggle (no gradient/shadow) for the on/off Settings rows.
export function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-[var(--text-success)]' : 'bg-[var(--border-strong)]'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}
