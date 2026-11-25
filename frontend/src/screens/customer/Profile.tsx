import { useState } from 'react';
import {
  BadgeCheck,
  Bell,
  ChevronDown,
  ChevronRight,
  Fingerprint,
  HelpCircle,
  Info,
  Lock,
  LogOut,
  Moon,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sun,
  User,
  Volume2,
} from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../state/ToastContext';
import { Avatar, Button, Notice, SectionTitle, Sheet, Switch, cn } from '../../components/ui';
import { ModeBadge } from '../../components/AppShell';

const faqs = [
  {
    q: 'What happens when I have no network?',
    a: 'Once funds are locked into an OAC, your device can sign payment authorisations entirely offline. The merchant verifies them locally and stores the receipt until a relay is possible.',
  },
  {
    q: 'Is an offline payment final?',
    a: 'No. An offline receipt is an authorisation, not settlement. RIFT Core re-verifies signatures, anti-replay and overspend rules when the receipt is relayed.',
  },
  {
    q: 'What if the same allocation is spent twice?',
    a: 'Core quarantines the conflicting sequence. Offline double-spend cannot be fully prevented without trusted hardware, which is why settlement is asynchronous and simulated here.',
  },
  {
    q: 'Does this move real money?',
    a: 'No. Every balance, transfer and settlement in this build is simulated for the hackathon. The status SETTLED (SIMULATED) is deliberate.',
  },
];

export function Profile() {
  const { identity, prefs, setPrefs, mode, health, resetDemo, leaveRole, outbox } = useApp();
  const { pushToast } = useToast();
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const settled = outbox.filter((r) => r.sync_status === 'SETTLED (SIMULATED)').length;

  return (
    <div className="space-y-5">
      <div className="animate-rise">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] sm:text-[29px]">Profile</h1>
        <p className="mt-1 text-[12px] text-text-2">Settings, security and demo controls.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_348px]">
        <div className="space-y-5">
          <section className="relative overflow-hidden rounded-[28px] border border-line bg-surface p-5 shadow-card animate-rise">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-2xl" />
            <div className="flex items-center gap-4">
              <Avatar initials="TB" className="h-14 w-14 text-[16px]" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[19px] font-semibold">{identity?.displayName ?? 'Treasure B. Okafor'}</h2>
                <p className="num mt-0.5 text-[11px] text-text-2">{identity?.phone}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-[9px] font-semibold text-brand">
                    <BadgeCheck className="h-3 w-3" /> Tier 2 · BVN linked
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-line bg-raised px-2 py-0.5 text-[9px] font-semibold text-text-2">
                    <Smartphone className="h-3 w-3" /> This device
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4">
              <div>
                <p className="label">Account</p>
                <p className="num mt-1 text-[12px] font-semibold">{identity?.accountNumber ?? '0123454771'}</p>
              </div>
              <div>
                <p className="label">Settled receipts</p>
                <p className="num mt-1 text-[12px] font-semibold">{settled}</p>
              </div>
              <div>
                <p className="label">Core mode</p>
                <p className="mt-1 text-[12px] font-semibold capitalize">{mode === 'live' ? 'Live' : 'Simulated'}</p>
              </div>
            </div>
          </section>

          <section className="card animate-rise">
            <SectionTitle title="Preferences" />
            <div className="mt-4 divide-y divide-line">
              <div className="flex items-center justify-between gap-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-raised text-text-2">
                    {prefs.theme === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                  </span>
                  <div>
                    <p className="text-[12px] font-semibold">Theme</p>
                    <p className="text-[10px] text-text-2">Dark is the default Devions palette.</p>
                  </div>
                </div>
                <div className="flex rounded-xl border border-line bg-raised p-0.5">
                  {(['dark', 'light'] as const).map((theme) => (
                    <button
                      key={theme}
                      onClick={() => setPrefs({ theme })}
                      className={cn('rounded-lg px-2.5 py-1 text-[10px] font-semibold capitalize transition', prefs.theme === theme ? 'bg-overlay text-text' : 'text-text-2')}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-raised text-text-2"><User className="h-3.5 w-3.5" /></span>
                  <div>
                    <p className="text-[12px] font-semibold">Hide balances</p>
                    <p className="text-[10px] text-text-2">Masks every Money component.</p>
                  </div>
                </div>
                <Switch checked={prefs.hideBalance} onChange={(v) => setPrefs({ hideBalance: v })} label="Hide balances" />
              </div>
              <div className="flex items-center justify-between gap-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-raised text-text-2"><Volume2 className="h-3.5 w-3.5" /></span>
                  <div>
                    <p className="text-[12px] font-semibold">Tap sounds</p>
                    <p className="text-[10px] text-text-2">Subtle feedback on primary actions.</p>
                  </div>
                </div>
                <Switch checked={prefs.sound} onChange={(v) => setPrefs({ sound: v })} label="Tap sounds" />
              </div>
              <div className="flex items-center justify-between gap-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-raised text-text-2"><Bell className="h-3.5 w-3.5" /></span>
                  <div>
                    <p className="text-[12px] font-semibold">Notifications</p>
                    <p className="text-[10px] text-text-2">Settlement and relay updates.</p>
                  </div>
                </div>
                <Switch checked={prefs.notifications} onChange={(v) => setPrefs({ notifications: v })} label="Notifications" />
              </div>
            </div>
          </section>

          <section className="card animate-rise">
            <SectionTitle title="Security" />
            <div className="mt-3 space-y-2">
              {[
                { icon: Fingerprint, title: 'Biometric login', text: 'Demo preference only' },
                { icon: Lock, title: 'Device app lock', text: 'Not enabled in this build' },
                { icon: ShieldCheck, title: 'Ed25519 device keys', text: 'Private key stored on this device' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    onClick={() => pushToast(`${item.title} is a demo control in this build.`, 'info')}
                    className="flex w-full items-center gap-3 rounded-2xl border border-line bg-raised px-3.5 py-3 text-left transition hover:border-line-strong"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-text-2"><Icon className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11.5px] font-semibold">{item.title}</span>
                      <span className="block text-[10px] text-text-2">{item.text}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-text-3" />
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card animate-rise">
            <SectionTitle title="Core status" />
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-text-2">Mode</span>
                <ModeBadge mode={mode} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-text-2">Issuer key</span>
                <span className={cn('text-[11px] font-semibold', health?.issuer_key_loaded ? 'text-brand' : 'text-rift-fg')}>
                  {health?.issuer_key_loaded ? 'Loaded' : mode === 'live' ? 'Unavailable' : 'Local demo key'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-text-2">Database</span>
                <span className="text-[11px] font-semibold">{health?.database ?? 'local storage'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-text-2">Version</span>
                <span className="num text-[11px] font-semibold">{health?.version ?? '1.0.0'}</span>
              </div>
            </div>
          </section>

          <section className="card animate-rise">
            <SectionTitle title="Support" />
            <div className="mt-3 space-y-2">
              <button onClick={() => setHelpOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-raised px-3.5 py-3 text-left transition hover:border-line-strong">
                <HelpCircle className="h-4 w-4 text-text-2" />
                <span className="flex-1 text-[11.5px] font-semibold">Help & FAQ</span>
                <ChevronRight className="h-4 w-4 text-text-3" />
              </button>
              <button onClick={() => setAboutOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-raised px-3.5 py-3 text-left transition hover:border-line-strong">
                <Info className="h-4 w-4 text-text-2" />
                <span className="flex-1 text-[11.5px] font-semibold">About this demo</span>
                <ChevronRight className="h-4 w-4 text-text-3" />
              </button>
              <button onClick={leaveRole} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-raised px-3.5 py-3 text-left transition hover:border-line-strong">
                <LogOut className="h-4 w-4 text-text-2" />
                <span className="flex-1 text-[11.5px] font-semibold">Switch terminal</span>
                <ChevronRight className="h-4 w-4 text-text-3" />
              </button>
            </div>
          </section>

          <section className="card border-danger/20 animate-rise">
            <SectionTitle title="Demo data" />
            <p className="mt-2 text-[10.5px] leading-relaxed text-text-2">
              Reset allocations, outbox, identities and simulated balances. This cannot be undone.
            </p>
            <Button variant="danger" className="mt-4 w-full" onClick={() => setResetOpen(true)}>
              <RotateCcw className="h-4 w-4" /> Reset demo data
            </Button>
          </section>
        </div>
      </div>

      <Sheet open={helpOpen} onClose={() => setHelpOpen(false)} title="Help & FAQ" subtitle="RIFT protocol in plain language" size="md">
        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <div key={faq.q} className="rounded-2xl border border-line bg-raised">
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="text-[12px] font-semibold">{faq.q}</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-text-3 transition', openFaq === index && 'rotate-180')} />
              </button>
              {openFaq === index && (
                <p className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-text-2">{faq.a}</p>
              )}
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={aboutOpen} onClose={() => setAboutOpen(false)} title="About Devions Bank" subtitle="Ogun Innovate Hackathon 2026" size="sm">
        <div className="space-y-4">
          <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4">
            <p className="text-[12px] font-semibold">RIFT · Resilient Infrastructure for Financial Transactions</p>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-text-2">
              An offline-first payment demonstration built around Ed25519 authorisations, deterministic transaction IDs and
              store-and-forward settlement.
            </p>
          </div>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between"><span className="text-text-2">Version</span><span className="num">1.0.0</span></div>
            <div className="flex justify-between"><span className="text-text-2">Stack</span><span>React · FastAPI · PostgreSQL</span></div>
            <div className="flex justify-between"><span className="text-text-2">Settlement</span><span className="text-brand">SETTLED (SIMULATED)</span></div>
            <div className="flex justify-between"><span className="text-text-2">Deployment</span><span>Docker · Nobus Cloud</span></div>
          </div>
          <Notice tone="rift">All money is simulated. No real banking integration is connected.</Notice>
        </div>
      </Sheet>

      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title="Reset demo data?" subtitle="This clears local protocol state" size="sm">
        <div className="space-y-4">
          <Notice tone="error">
            All identities, allocations, invoices, receipts and simulated balances will be removed. The page reloads at the
            role gate.
          </Notice>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="danger" className="flex-1" onClick={resetDemo}>
              <RefreshCw className="h-4 w-4" /> Reset
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
