import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

/* ─────── Button ─────── */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'lg';
}) {
  const base = 'inline-flex items-center justify-center font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed outline-none';

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
    md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
    lg: 'px-7 py-3.5 text-base rounded-xl gap-2.5',
  };

  const variants: Record<BtnVariant, string> = {
    primary:
      'bg-cyan-gradient text-gray-950 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 hover:brightness-110 active:scale-[0.98]',
    secondary:
      'bg-white/[0.04] border border-white/[0.08] text-gray-200 hover:bg-white/[0.08] hover:border-cyan-500/30',
    ghost:
      'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]',
    danger:
      'bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 hover:border-red-500/50',
  };

  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

/* ─────── Card ─────── */
export function Card({
  className = '',
  hover = false,
  children,
}: {
  className?: string;
  hover?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`glass rounded-2xl p-6 transition-all duration-300 ${
        hover ? 'hover:-translate-y-1 hover:border-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/5' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ─────── Badge ─────── */
type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({
  variant = 'default',
  className = '',
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}) {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-white/[0.04] text-gray-400 border-white/[0.06]',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-300 border-red-500/20',
    info: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ─────── Input ─────── */
export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 outline-none backdrop-blur transition-all duration-200 focus:border-cyan-500/50 focus:bg-white/[0.05] focus:shadow-[0_0_20px_rgba(6,182,212,0.08)] disabled:opacity-40 ${className}`}
      {...props}
    />
  );
}

/* ─────── Section Heading ─────── */
export function SectionHeading({
  title,
  subtitle,
  className = '',
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <h2 className="text-2xl font-bold tracking-tight text-gray-100">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

/* ─────── Logo ─────── */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes: Record<string, string> = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-14 w-14 text-xl',
  };
  return (
    <div
      className={`${sizes[size]} grid place-items-center rounded-xl bg-cyan-gradient font-black text-gray-950 shadow-lg shadow-cyan-500/25`}
    >
      E
    </div>
  );
}

/* ─────── Progress Bar ─────── */
export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-white/[0.05] ${className}`}>
      <div
        className="h-full rounded-full bg-cyan-gradient transition-all duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/* ─────── Spinner ─────── */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="url(#cyanGrad)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="cyanGrad" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#06b6d4" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
    </svg>
  );
}
