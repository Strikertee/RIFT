import { ArrowRight, RadioTower, Store, Wallet } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { Logo, ModeBadge } from '../components/AppShell';
import type { Role } from '../types';

const roles: Array<{
  role: Role;
  title: string;
  description: string;
  icon: typeof Wallet;
  tone: string;
  iconTone: string;
}> = [
  {
    role: 'customer',
    title: 'Customer',
    description: 'Bank, lock an offline allocation and pay over QR with zero network.',
    icon: Wallet,
    tone: 'hover:border-brand/35',
    iconTone: 'border-brand/25 bg-brand/15 text-brand',
  },
  {
    role: 'merchant',
    title: 'Merchant',
    description: 'Raise invoices, verify signed tokens offline and hold receipts for settlement.',
    icon: Store,
    tone: 'hover:border-rift/35',
    iconTone: 'border-rift/25 bg-rift/15 text-rift',
  },
  {
    role: 'gateway',
    title: 'Gateway',
    description: 'Collect receipt batches from terminals and relay them to RIFT Core.',
    icon: RadioTower,
    tone: 'hover:border-info/35',
    iconTone: 'border-info/25 bg-info/15 text-info',
  },
];

export function RoleGate() {
  const { mode, setRole, ready } = useApp();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand/10 blur-[120px] animate-drift" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[420px] w-[420px] rounded-full bg-rift/8 blur-[120px]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1180px] flex-col px-5 py-6 sm:px-8 lg:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <ModeBadge mode={mode === 'checking' ? 'checking' : mode} />
        </header>

        <main className="my-auto py-12 lg:py-16">
          <div className="max-w-2xl animate-rise">
            <h1 className="font-display text-[42px] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-[54px] lg:text-[62px]">
              One protocol.
              <br />
              Three terminals.
            </h1>
            <p className="mt-5 max-w-xl text-[13px] leading-relaxed text-text-2 sm:text-[14px]">
              RIFT keeps money moving when the network doesn&apos;t. Choose the terminal this device plays —
              you can switch anytime, and every role shares the same cryptographic ledger.
            </p>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((entry, index) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.role}
                  onClick={() => setRole(entry.role)}
                  disabled={!ready}
                  style={{ animationDelay: `${120 + index * 80}ms` }}
                  className={`group relative overflow-hidden rounded-[26px] border border-line bg-surface p-5 text-left shadow-card transition duration-300 hover:-translate-y-1 hover:bg-raised disabled:cursor-wait disabled:opacity-60 ${entry.tone} animate-rise`}
                >
                  <div className="absolute -bottom-10 -right-10 h-32 w-32 opacity-[0.07] transition group-hover:opacity-[0.14]">
                    <svg viewBox="0 0 100 100" className="h-full w-full">
                      <circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" strokeWidth="2" />
                      <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
                      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                  <div className={`grid h-11 w-11 place-items-center rounded-2xl border ${entry.iconTone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-5 font-display text-[16px] font-semibold tracking-tight">{entry.title}</h2>
                  <p className="mt-2 min-h-[52px] text-[12px] leading-relaxed text-text-2">{entry.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-3 transition group-hover:text-text">
                    Enter terminal <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[10px] text-text-3">
          <p>Hackathon demonstration · simulated value only · Ed25519 authorisations, store-and-forward settlement.</p>
          <p className="font-semibold uppercase tracking-[0.14em]">Ogun Innovate 2026</p>
        </footer>
      </div>
    </div>
  );
}
