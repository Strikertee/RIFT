import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  LayoutGrid,
  Lock,
  RadioTower,
  Send,
  ShieldCheck,
  Signal,
  Smartphone,
  Tv,
  Wifi,
  Zap,
} from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../state/ToastContext';
import { Button, Chip, Field, Money, Notice, SectionTitle, Segmented, Sheet, TextInput, cn } from '../../components/ui';
import { CashflowChart, Donut } from '../../components/charts';
import { formatKobo, greeting, parseNairaToKobo, shortId } from '../../lib/format';
import type { CustomerTab } from '../../components/AppShell';

const spending = [
  { label: 'Groceries', value: 18_400, color: '#30D158', kobo: 1_840_000 },
  { label: 'Transport', value: 9_600, color: '#FFB224', kobo: 960_000 },
  { label: 'Airtime & data', value: 7_700, color: '#22D3EE', kobo: 770_000 },
  { label: 'Utilities', value: 4_500, color: '#A78BFA', kobo: 450_000 },
  { label: 'Transfers', value: 8_500, color: '#F471B5', kobo: 850_000 },
];

const services = [
  { label: 'Airtime', icon: Smartphone },
  { label: 'Data', icon: Wifi },
  { label: 'Electricity', icon: Zap },
  { label: 'TV', icon: Tv },
  { label: 'More', icon: LayoutGrid },
];

function copy(text: string) {
  try {
    navigator.clipboard?.writeText(text);
  } catch {
    /* clipboard optional */
  }
}

export function Overview({ onNavigate }: { onNavigate: (tab: CustomerTab) => void }) {
  const { bank, identity, allocation, prefs, setPrefs, online } = useApp();
  const { pushToast } = useToast();
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState<string | null>(null);
  const [sendStep, setSendStep] = useState<'form' | 'processing' | 'done'>('form');
  const [recipient, setRecipient] = useState('');
  const [account, setAccount] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'in' | 'out'>('all');
  const [serviceAmount, setServiceAmount] = useState('');
  const [serviceRef, setServiceRef] = useState('');

  const total = bank.availableKobo + bank.reservedKobo;
  const offline = allocation
    ? allocation.oac.allocated_amount_kobo - allocation.spent_amount_kobo
    : 0;
  const firstName = (identity?.displayName ?? 'Treasure').split(' ')[0];

  const visibleTx = useMemo(() => {
    if (historyFilter === 'all') return bank.transactions;
    return bank.transactions.filter((t) => (historyFilter === 'in' ? t.kind === 'in' : t.kind !== 'in'));
  }, [bank.transactions, historyFilter]);

  const closeSend = () => {
    setSendOpen(false);
    window.setTimeout(() => {
      setSendStep('form');
      setRecipient('');
      setAccount('');
      setSendAmount('');
    }, 200);
  };

  const submitSend = () => {
    const kobo = parseNairaToKobo(sendAmount);
    if (!recipient.trim() || account.replace(/\D/g, '').length < 6 || kobo <= 0) {
      pushToast('Enter a recipient, account number and amount.', 'error');
      return;
    }
    if (kobo > bank.availableKobo) {
      pushToast('Amount exceeds your available online balance.', 'error');
      return;
    }
    setSendStep('processing');
    window.setTimeout(() => setSendStep('done'), 900);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_348px]">
      <div className="space-y-5">
        <div className="animate-rise">
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] sm:text-[29px]">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-[12px] text-text-2">Your money, simply managed.</p>
        </div>

        <section
          className="relative overflow-hidden rounded-[28px] border border-brand/20 p-5 text-white shadow-hero animate-rise sm:p-6"
          style={{
            background:
              'radial-gradient(110% 150% at 88% -10%, rgb(255 178 36 / .18), transparent 55%), radial-gradient(90% 120% at 10% 110%, rgb(48 209 88 / .16), transparent 60%), linear-gradient(135deg, #145334 0%, #0d2b1e 52%, #09130f 100%)',
          }}
        >
          <div className="pointer-events-none absolute -right-10 top-0 h-52 w-52 rounded-full border border-white/5" />
          <div className="pointer-events-none absolute -right-2 top-8 h-40 w-40 rounded-full border border-white/5" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/55">Total balance</p>
              <Money kobo={total} className="mt-2 block text-[40px] font-semibold leading-none text-white sm:text-[46px]" />
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label={prefs.hideBalance ? 'Show balance' : 'Hide balance'}
                onClick={() => setPrefs({ hideBalance: !prefs.hideBalance })}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                {prefs.hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white/60">
                <Signal className="h-4 w-4" />
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
            <div>
              <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/50">
                <Wifi className="h-3 w-3" /> Available online
              </p>
              <Money kobo={bank.availableKobo} className="mt-1 block text-[17px] font-semibold text-white" />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-rift">
                <RadioTower className="h-3 w-3" /> RIFT offline
              </p>
              <Money kobo={offline} className="mt-1 block text-[17px] font-semibold text-rift" />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">
            <span>Devions Platinum</span>
            <span className="num tracking-[0.1em]">···· 4771</span>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-3 animate-rise">
          <Button size="lg" className="h-[52px]" onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4" /> Send
          </Button>
          <Button variant="secondary" size="lg" className="h-[52px]" onClick={() => setReceiveOpen(true)}>
            <Download className="h-4 w-4" /> Receive
          </Button>
          <Button variant="rift" size="lg" className="h-[52px]" onClick={() => onNavigate('rift')}>
            <Lock className="h-4 w-4" /> Lock
          </Button>
        </div>

        <section className="card animate-rise">
          <SectionTitle
            title="Quick services"
            action={
              <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand" onClick={() => setServiceOpen('More services')}>
                See all <ChevronRight className="h-3.5 w-3.5" />
              </button>
            }
          />
          <div className="mt-5 grid grid-cols-5 gap-2">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <button
                  key={service.label}
                  onClick={() => setServiceOpen(service.label)}
                  className="group flex flex-col items-center gap-2"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-line bg-raised text-text-2 transition group-hover:border-line-strong group-hover:text-text">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-[9.5px] font-medium text-text-2">{service.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card animate-rise">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SectionTitle title="Cash flow" />
              <p className="mt-1 text-[10px] text-text-3">Demo analytics · last 7 days</p>
            </div>
            <Segmented
              options={[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
              value="week"
              onChange={() => undefined}
              className="w-[152px]"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex gap-6">
              <div>
                <p className="flex items-center gap-1.5 text-[9.5px] text-text-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Money in
                </p>
                <p className="num mt-1 text-[15px] font-semibold text-brand">₦38,400</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-[9.5px] text-text-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rift" /> Money out
                </p>
                <p className="num mt-1 text-[15px] font-semibold text-rift">₦31,100</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9.5px] text-text-2">Net</p>
              <p className="num mt-1 text-[15px] font-semibold">+₦7,300</p>
            </div>
          </div>
          <CashflowChart className="mt-2" />
        </section>
      </div>

      <div className="space-y-5">
        <section className="card animate-rise">
          <div className="flex items-center justify-between">
            <SectionTitle title="Spending mix" />
            <span className="rounded-full border border-line bg-raised px-2.5 py-1 text-[9.5px] font-semibold text-text-2">
              November
            </span>
          </div>
          <div className="mt-5 flex items-center gap-5">
            <Donut
              segments={spending.map((s) => ({ value: s.value, color: s.color }))}
              centerTop="Spent"
              centerBottom="₦48.7k"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-2">
              {spending.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-2 text-[10.5px]">
                  <span className="flex min-w-0 items-center gap-2 text-text-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.color }} />
                    <span className="truncate">{formatKobo(item.kobo, { decimals: false })}</span>
                  </span>
                  <span className="num text-text-3">{Math.round((item.value / 48700) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-rift/30 bg-[linear-gradient(135deg,rgb(56_42_16),rgb(35_27_12))] p-5 shadow-rift animate-rise">
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border border-rift/10" />
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-rift/30 bg-rift/15 text-rift">
              <RadioTower className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="font-display text-[15px] font-semibold text-text">Pay without network</h2>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-2">
                Lock funds once, then spend over QR with zero connectivity.
              </p>
              <button
                onClick={() => onNavigate('rift')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-rift px-3 py-2 text-[11px] font-bold text-[#241500] transition hover:brightness-105"
              >
                Open RIFT <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>

        <section className="card animate-rise">
          <SectionTitle
            title="Recent activity"
            action={
              <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand" onClick={() => setHistoryOpen(true)}>
                See all <ChevronRight className="h-3.5 w-3.5" />
              </button>
            }
          />
          <div className="mt-3 divide-y divide-line">
            {bank.transactions.slice(0, 5).map((tx) => {
              const isIn = tx.kind === 'in';
              const isRift = tx.kind === 'rift';
              return (
                <div key={tx.id} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-full border',
                      isIn
                        ? 'border-brand/25 bg-brand/10 text-brand'
                        : isRift
                          ? 'border-rift/25 bg-rift/10 text-rift'
                          : 'border-line bg-raised text-text-2',
                    )}
                  >
                    {isIn ? <ArrowDownLeft className="h-3.5 w-3.5" /> : isRift ? <RadioTower className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-semibold">{tx.title}</p>
                    <p className="mt-0.5 text-[9.5px] text-text-2">{tx.subtitle}</p>
                  </div>
                  <span className={cn('num shrink-0 text-[11.5px] font-semibold', isIn ? 'text-brand' : 'text-text')}>
                    {isIn ? '+' : '−'}
                    {formatKobo(tx.amount_kobo, { decimals: false })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex items-center justify-between rounded-2xl border border-line bg-surface/60 px-4 py-3 text-[10px] text-text-3">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-brand" /> Ed25519 secured
          </span>
          <span className={online ? 'text-brand' : 'text-rift-fg'}>{online ? 'Core reachable' : 'Offline ready'}</span>
        </div>
      </div>

      <Sheet
        open={sendOpen}
        onClose={closeSend}
        title={sendStep === 'done' ? 'Transfer sent' : 'Send money'}
        subtitle={sendStep === 'done' ? 'Simulated bank transfer' : 'Demo banking · no real money moves'}
        size="sm"
      >
        {sendStep === 'form' && (
          <div className="space-y-4">
            <Field label="Recipient">
              <TextInput value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="e.g. Ada Okafor" />
            </Field>
            <Field label="Account number">
              <TextInput value={account} onChange={(e) => setAccount(e.target.value)} placeholder="10-digit account number" inputMode="numeric" />
            </Field>
            <Field label="Amount (₦)">
              <TextInput value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />
            </Field>
            <Notice tone="info">This is a mock transfer for the hackathon demo. No real bank integration is connected.</Notice>
            <Button className="w-full" size="lg" onClick={submitSend}>
              Continue transfer <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {sendStep === 'processing' && (
          <div className="flex flex-col items-center py-10">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand" />
            <p className="mt-4 text-[13px] font-semibold">Sending…</p>
            <p className="mt-1 text-[11px] text-text-2">Simulating interbank settlement</p>
          </div>
        )}
        {sendStep === 'done' && (
          <div className="space-y-4 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-brand/30 bg-brand/10 text-brand">
              <Check className="h-7 w-7" />
            </div>
            <div>
              <p className="num text-[28px] font-semibold">{formatKobo(parseNairaToKobo(sendAmount))}</p>
              <p className="mt-1 text-[12px] text-text-2">
                sent to {recipient} · {account}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-raised px-4 py-3 text-left text-[11px]">
              <div className="flex justify-between"><span className="text-text-2">Reference</span><span className="num">SIM-TRF-{Date.now().toString(36).toUpperCase()}</span></div>
              <div className="mt-2 flex justify-between"><span className="text-text-2">Status</span><span className="text-brand">Simulated success</span></div>
            </div>
            <Button className="w-full" onClick={closeSend}>Done</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={receiveOpen} onClose={() => setReceiveOpen(false)} title="Receive money" subtitle="Share your demo account details" size="sm">
        <div className="space-y-4">
          <div className="rounded-3xl border border-brand/20 bg-[linear-gradient(135deg,#145334,#0b2118)] p-5 text-white">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/50">Devions account</p>
            <p className="num mt-2 text-[22px] font-semibold">{identity?.displayName ?? 'Treasure B. Okafor'}</p>
            <p className="num mt-1 text-[15px] text-white/70">{identity?.accountNumber ?? '0123454771'}</p>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              copy(identity?.accountNumber ?? '0123454771');
              pushToast('Account number copied.');
            }}
          >
            <Copy className="h-4 w-4" /> Copy account number
          </Button>
          <Notice tone="info">Mock account for demonstration only. Do not send real money.</Notice>
        </div>
      </Sheet>

      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="Transaction history" subtitle="Demo bank activity" size="md">
        <Segmented
          options={[
            { value: 'all', label: 'All' },
            { value: 'in', label: 'Money in' },
            { value: 'out', label: 'Money out' },
          ]}
          value={historyFilter}
          onChange={setHistoryFilter}
          className="mb-4"
        />
        <div className="divide-y divide-line">
          {visibleTx.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-[12px] font-semibold">{tx.title}</p>
                <p className="mt-0.5 text-[10px] text-text-2">{tx.subtitle}</p>
              </div>
              <span className={cn('num text-[12px] font-semibold', tx.kind === 'in' ? 'text-brand' : 'text-text')}>
                {tx.kind === 'in' ? '+' : '−'}{formatKobo(tx.amount_kobo, { decimals: false })}
              </span>
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={Boolean(serviceOpen)}
        onClose={() => setServiceOpen(null)}
        title={serviceOpen ?? 'Quick service'}
        subtitle="Demo bill payment"
        size="sm"
      >
        <div className="space-y-4">
          <Field label="Customer / meter / phone reference">
            <TextInput value={serviceRef} onChange={(e) => setServiceRef(e.target.value)} placeholder="e.g. 04123456789" />
          </Field>
          <Field label="Amount (₦)">
            <TextInput value={serviceAmount} onChange={(e) => setServiceAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />
          </Field>
          <div className="flex flex-wrap gap-2">
            {['500', '1000', '2000'].map((v) => (
              <Chip key={v} onClick={() => setServiceAmount(v)}>₦{Number(v).toLocaleString()}</Chip>
            ))}
          </div>
          <Button
            variant="rift"
            className="w-full"
            onClick={() => {
              if (!serviceRef.trim() || parseNairaToKobo(serviceAmount) <= 0) {
                pushToast('Enter a reference and amount.', 'error');
                return;
              }
              pushToast(`${serviceOpen} payment simulated successfully.`);
              setServiceOpen(null);
              setServiceRef('');
              setServiceAmount('');
            }}
          >
            Pay {serviceAmount ? `₦${Number(serviceAmount).toLocaleString()}` : ''}
          </Button>
          <Notice tone="rift">Mock service payment. No biller is contacted.</Notice>
        </div>
      </Sheet>
    </div>
  );
}
