import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Info, X, XCircle } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { formatKobo } from '../lib/format';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function playTap() {
  try {
    const raw = localStorage.getItem('devions-bank-prefs-v1');
    const prefs = raw ? JSON.parse(raw) : null;
    if (prefs && prefs.sound === false) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 620;
    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch {
    /* audio optional */
  }
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'rift' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-[#04120a] hover:brightness-105 active:brightness-95 shadow-[0_10px_30px_-12px_rgb(var(--brand)/.65)]',
  secondary: 'bg-raised text-text border border-line hover:bg-overlay hover:border-line-strong',
  ghost: 'bg-transparent text-text-2 hover:bg-raised hover:text-text',
  rift: 'bg-rift text-[#241500] hover:brightness-105 active:brightness-95 shadow-[0_10px_30px_-12px_rgb(var(--rift)/.7)]',
  danger: 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/15',
  outline: 'bg-transparent text-text border border-line-strong hover:bg-raised',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[12px] rounded-xl gap-1.5',
  md: 'h-11 px-4 text-[13px] rounded-2xl gap-2',
  lg: 'h-[52px] px-5 text-[14px] rounded-2xl gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
        variants[variant],
        sizes[size],
        className,
      )}
      onClick={(e) => {
        playTap();
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconBtn({
  label,
  className,
  children,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-full border border-line bg-raised text-text-2 transition hover:border-line-strong hover:text-text',
        className,
      )}
      onClick={(e) => {
        playTap();
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="mb-2 block text-[12px] font-semibold text-text-2">{label}</span>}
      {children}
      {hint && <span className="mt-1.5 block text-[11px] text-text-3">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('input-shell w-full', className)} {...props} />;
}

const noticeTones = {
  info: 'border-info/25 bg-info/10 text-info',
  error: 'border-danger/25 bg-danger/10 text-danger',
  success: 'border-brand/25 bg-brand/10 text-brand',
  rift: 'border-rift/30 bg-rift/10 text-rift-fg',
};

export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: keyof typeof noticeTones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-[12px] leading-relaxed', noticeTones[tone], className)}>
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        playTap();
        onChange(!checked);
      }}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full border transition',
        checked ? 'border-brand/40 bg-brand/80' : 'border-line bg-raised',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all',
          checked ? 'left-[22px]' : 'left-0.5 bg-text-2',
        )}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1 rounded-2xl border border-line bg-raised p-1', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => {
            playTap();
            onChange(option.value);
          }}
          className={cn(
            'flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-[12px] font-semibold transition',
            value === option.value
              ? 'bg-overlay text-text shadow-[0_1px_0_rgb(255_255_255/.04)_inset]'
              : 'text-text-2 hover:text-text',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        playTap();
        onClick?.();
      }}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition',
        active
          ? 'border-brand/40 bg-brand/10 text-brand'
          : 'border-line bg-raised text-text-2 hover:border-line-strong hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

export function Money({
  kobo,
  className,
  decimals = true,
}: {
  kobo: number;
  className?: string;
  decimals?: boolean;
}) {
  const { prefs } = useApp();
  const [shown, setShown] = useState(kobo);
  const previous = useRef(kobo);

  useEffect(() => {
    const from = previous.current;
    previous.current = kobo;
    if (from === kobo) {
      setShown(kobo);
      return;
    }
    const start = performance.now();
    const duration = 520;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (kobo - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [kobo]);

  if (prefs.hideBalance) {
    return <span className={cn('num', className)}>₦••••••</span>;
  }
  const naira = shown / 100;
  const whole = Math.floor(naira).toLocaleString('en-NG');
  const fraction = Math.round((naira - Math.floor(naira)) * 100)
    .toString()
    .padStart(2, '0');
  return (
    <span className={cn('num', className)}>
      ₦{whole}
      {decimals && <span className="opacity-55">.{fraction}</span>}
    </span>
  );
}

export function StatusPill({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const settled = status === 'SETTLED (SIMULATED)' || status === 'RELAYED';
  const pending = status === 'PENDING_RELAY' || status === 'CRYPTO_VALIDATED';
  const rejected = status.startsWith('REJECTED') || status === 'FAILED';
  const quarantined = status === 'QUARANTINED_COLLISION';
  const replay = status === 'IDEMPOTENT_REPLAY';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
        settled && 'border-brand/30 bg-brand/10 text-brand',
        pending && 'border-rift/30 bg-rift/10 text-rift-fg',
        rejected && 'border-danger/30 bg-danger/10 text-danger',
        quarantined && 'border-info/30 bg-info/10 text-info',
        replay && 'border-info/30 bg-info/10 text-info',
        !settled && !pending && !rejected && !quarantined && !replay && 'border-line bg-raised text-text-2',
        className,
      )}
    >
      <span className="h-1 w-1 rounded-full bg-current" />
      {status.replace(' (SIMULATED)', ' · SIM')}
    </span>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 animate-fade bg-black/65 backdrop-blur-[6px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-line bg-surface shadow-[0_40px_120px_-30px_rgba(0,0,0,.9)] animate-sheet-up sm:rounded-[28px]',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-2xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-[17px] font-semibold tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-text-2">{subtitle}</p>}
          </div>
          <IconBtn label="Close" onClick={onClose} className="h-8 w-8 shrink-0">
            <X className="h-4 w-4" />
          </IconBtn>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-8">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className={cn(
            'pointer-events-auto flex max-w-[92vw] items-center gap-2.5 rounded-2xl border px-4 py-3 text-left text-[12px] font-medium shadow-[0_20px_50px_-20px_rgba(0,0,0,.9)] backdrop-blur-xl animate-toast-in',
            toast.tone === 'error' && 'border-danger/30 bg-[#2a1515]/95 text-danger',
            toast.tone === 'success' && 'border-brand/25 bg-[#10241a]/95 text-text',
            toast.tone === 'rift' && 'border-rift/30 bg-[#2a2110]/95 text-rift-fg',
            toast.tone === 'info' && 'border-info/25 bg-[#101f26]/95 text-text',
          )}
        >
          {toast.tone === 'success' ? (
            <Check className="h-4 w-4 shrink-0 text-brand" />
          ) : toast.tone === 'error' ? (
            <XCircle className="h-4 w-4 shrink-0 text-danger" />
          ) : (
            <Info className="h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0">{toast.message}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-line bg-raised text-text-2">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-[14px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-text-2">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <div
      className={cn(
        'grid h-9 w-9 place-items-center rounded-full border border-brand/20 bg-brand/15 text-[11px] font-bold text-brand',
        className,
      )}
    >
      {initials}
    </div>
  );
}

export function RowLink({
  icon,
  title,
  subtitle,
  right,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-raised px-3.5 py-3 text-left transition hover:border-line-strong"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-text-2">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold">{title}</span>
        {subtitle && <span className="mt-0.5 block text-[11px] text-text-2">{subtitle}</span>}
      </span>
      {right ?? <ChevronRight className="h-4 w-4 text-text-3" />}
    </button>
  );
}

export function SectionTitle({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

export function MoneyText({ kobo, className }: { kobo: number; className?: string }) {
  const { prefs } = useApp();
  return <span className={cn('num', className)}>{prefs.hideBalance ? '₦••••' : formatKobo(kobo, { decimals: false })}</span>;
}
