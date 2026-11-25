import type { ReactNode } from 'react';
import {
  ArrowLeftRight,
  Banknote,
  House,
  Landmark,
  LogOut,
  Moon,
  RadioTower,
  RefreshCw,
  Sun,
  User,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import { formatKobo } from '../lib/format';
import { Avatar, cn, IconBtn } from './ui';
import type { Role } from '../types';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl border border-brand/25 bg-brand-deep shadow-[0_10px_30px_-12px_rgb(var(--brand)/.6)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(var(--brand)/.35),transparent_65%)]" />
        <Zap className="relative h-5 w-5 fill-brand text-brand" strokeWidth={2.4} />
      </div>
      {!compact && (
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[19px] font-semibold tracking-[-0.03em]">Devions</span>
          <span className="rounded-md border border-brand/25 bg-brand/10 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.18em] text-brand">
            Bank
          </span>
        </div>
      )}
    </div>
  );
}

export function NetworkPill({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold',
        online
          ? 'border-brand/25 bg-brand/10 text-brand'
          : 'border-rift/30 bg-rift/10 text-rift-fg',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full bg-current', online && 'animate-pulse-dot')} />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: string }) {
  const live = mode === 'live';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.13em]',
        live ? 'border-brand/30 bg-brand/10 text-brand' : 'border-rift/35 bg-rift/10 text-rift-fg',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full bg-current', live && 'animate-pulse-dot')} />
      {live ? 'Live core · connected' : 'Simulated core · offline-first'}
    </span>
  );
}

function HeaderControls({ contextLabel }: { contextLabel: string }) {
  const { prefs, setPrefs, leaveRole, online, identity } = useApp();
  const initials =
    identity?.role === 'merchant'
      ? 'MN'
      : identity?.role === 'gateway'
        ? 'GW'
        : 'TB';
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <span className="hidden rounded-full border border-line bg-raised px-3 py-1.5 text-[10px] font-semibold text-text-2 md:inline-flex">
        {contextLabel}
      </span>
      <NetworkPill online={online} />
      <IconBtn
        label={prefs.sound ? 'Mute sounds' : 'Enable sounds'}
        onClick={() => setPrefs({ sound: !prefs.sound })}
        className="hidden sm:grid"
      >
        {prefs.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </IconBtn>
      <IconBtn
        label="Toggle theme"
        onClick={() => setPrefs({ theme: prefs.theme === 'dark' ? 'light' : 'dark' })}
      >
        {prefs.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </IconBtn>
      <IconBtn label="Switch terminal" onClick={leaveRole}>
        <RefreshCw className="h-4 w-4" />
      </IconBtn>
      <Avatar initials={initials} />
    </div>
  );
}

const customerNav = [
  { key: 'overview', label: 'Overview', sub: 'Balance & activity', icon: House },
  { key: 'rift', label: 'RIFT Offline', sub: 'Spend without network', icon: RadioTower },
  { key: 'loans', label: 'Loans', sub: 'Offers & calculator', icon: Landmark },
  { key: 'profile', label: 'Profile', sub: 'Settings & security', icon: User },
] as const;

export type CustomerTab = (typeof customerNav)[number]['key'];

function Sidebar({
  tab,
  onTab,
}: {
  tab: CustomerTab;
  onTab: (tab: CustomerTab) => void;
}) {
  const { allocation, offlineAvailableKobo, identity, capRemainingKobo } = useApp();
  const allocated = allocation?.oac.allocated_amount_kobo ?? 0;
  const percent = Math.round((allocated / 5_000_000) * 100);
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[352px] flex-col border-r border-line bg-bg/70 px-6 py-5 backdrop-blur-xl lg:flex">
      <div className="px-1">
        <Logo />
      </div>
      <nav className="mt-8 space-y-2">
        {customerNav.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          const rift = item.key === 'rift';
          return (
            <button
              key={item.key}
              onClick={() => onTab(item.key)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition',
                active
                  ? rift
                    ? 'border-rift/35 bg-rift-soft text-text'
                    : 'border-brand/30 bg-brand-soft text-text'
                  : 'border-transparent text-text-2 hover:border-line hover:bg-raised',
              )}
            >
              <span
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-xl border',
                  active
                    ? rift
                      ? 'border-rift/30 bg-rift/15 text-rift'
                      : 'border-brand/30 bg-brand/15 text-brand'
                    : 'border-line bg-raised text-text-2',
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className={cn('block text-[12.5px] font-semibold', active && 'text-text')}>{item.label}</span>
                <span className="mt-0.5 block text-[10.5px] text-text-2">{item.sub}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4">
        <div className="rounded-2xl border border-rift/30 bg-rift-soft/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-rift-fg">RIFT allocation</span>
            <span className="num text-[10px] font-semibold text-rift-fg">{percent}%</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-rift/15">
            <div className="h-full rounded-full bg-rift transition-all" style={{ width: `${Math.min(100, percent)}%` }} />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="num text-[16px] font-semibold text-rift-fg">
              {formatKobo(offlineAvailableKobo, { decimals: false })}
            </span>
            <span className="text-[10px] text-text-2">/ {formatKobo(5_000_000, { decimals: false })}</span>
          </div>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-text-2">
            {capRemainingKobo > 0
              ? 'Locked for offline spending. Settles on reconnect.'
              : 'Offline allocation limit fully used.'}
          </p>
        </div>
        <div className="flex items-center gap-2.5 px-1">
          <Avatar initials="TB" className="h-8 w-8" />
          <div className="min-w-0">
            <p className="truncate text-[11.5px] font-semibold">{identity?.displayName ?? 'Treasure B. Okafor'}</p>
            <p className="text-[10px] text-text-2">Tier 2 · BVN linked</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function BottomNav({ tab, onTab }: { tab: CustomerTab; onTab: (tab: CustomerTab) => void }) {
  const items: Array<{ key: CustomerTab; label: string; icon: typeof House }> = [
    { key: 'overview', label: 'Home', icon: House },
    { key: 'loans', label: 'Loans', icon: Landmark },
    { key: 'rift', label: 'RIFT', icon: RadioTower },
    { key: 'profile', label: 'Me', icon: User },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-dock backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4 px-2 py-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          const rift = item.key === 'rift';
          return (
            <button
              key={item.key}
              onClick={() => onTab(item.key)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[9.5px] font-semibold transition',
                active ? (rift ? 'text-rift' : 'text-brand') : 'text-text-3',
              )}
            >
              <span className={cn('grid h-8 w-8 place-items-center rounded-full', active && (rift ? 'bg-rift/12' : 'bg-brand/12'))}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function CustomerShell({
  tab,
  onTab,
  children,
}: {
  tab: CustomerTab;
  onTab: (tab: CustomerTab) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar tab={tab} onTab={onTab} />
      <div className="lg:pl-[352px]">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/75 backdrop-blur-xl">
          <div className="flex h-[64px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
            <div className="flex items-center gap-3">
              <div className="lg:hidden">
                <Logo />
              </div>
              <span className="hidden text-[11px] font-semibold text-text-2 lg:inline">Customer wallet</span>
            </div>
            <HeaderControls contextLabel="Customer wallet" />
          </div>
        </header>
        <main className="mx-auto max-w-[1240px] px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-10 lg:pt-7">
          {children}
        </main>
      </div>
      <BottomNav tab={tab} onTab={onTab} />
    </div>
  );
}

export function TerminalShell({
  contextLabel,
  title,
  subtitle,
  icon,
  actions,
  children,
}: {
  contextLabel: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/75 backdrop-blur-xl">
        <div className="mx-auto flex h-[64px] max-w-[1220px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Logo compact />
            </div>
            <span className="text-[11px] font-semibold text-text-2">{contextLabel}</span>
          </div>
          <HeaderControls contextLabel={contextLabel} />
        </div>
      </header>
      <main className="mx-auto max-w-[1220px] px-4 pb-24 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-7">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full border border-rift/30 bg-rift/15 text-rift">
              {icon}
            </div>
            <div>
              <h1 className="font-display text-[21px] font-semibold tracking-tight">{title}</h1>
              <p className="mt-0.5 text-[11.5px] text-text-2">{subtitle}</p>
            </div>
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}

export function RoleChip({ role }: { role: Role }) {
  const labels: Record<Role, string> = { customer: 'Customer', merchant: 'Merchant', gateway: 'Gateway' };
  const icons = { customer: Banknote, merchant: ArrowLeftRight, gateway: RadioTower };
  const Icon = icons[role];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 text-[10px] font-semibold text-text-2">
      <Icon className="h-3 w-3" />
      {labels[role]}
    </span>
  );
}

export function RoleSwitchFooter() {
  const { leaveRole } = useApp();
  return (
    <button
      onClick={leaveRole}
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-2 transition hover:text-text"
    >
      <LogOut className="h-3.5 w-3.5" /> Switch terminal
    </button>
  );
}
