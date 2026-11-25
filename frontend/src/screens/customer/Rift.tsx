import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Lock,
  QrCode,
  RadioTower,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Signal,
  Wallet,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../state/ToastContext';
import { Button, Chip, Field, Money, Notice, SectionTitle, Segmented, Sheet, StatusPill, TextInput, cn } from '../../components/ui';
import { Ring } from '../../components/charts';
import { Scanner } from '../../components/Scanner';
import { decodeInvoice, encodeAuth } from '../../lib/qr';
import { formatKobo, humanReason, parseNairaToKobo, shortDate, shortId } from '../../lib/format';
import type { AuthBundle, Invoice, StoredInvoice } from '../../types';

type SpendStep = 'form' | 'qr' | 'done';

export function Rift() {
  const {
    bank,
    allocation,
    offlineAvailableKobo,
    capRemainingKobo,
    activity,
    lockFunds,
    signPayment,
    createInvoice,
    reconcile,
    returnToOnline,
    identities,
    mode,
  } = useApp();
  const { pushToast } = useToast();

  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success' | 'info' | 'rift'; text: string } | null>(null);
  const [spendOpen, setSpendOpen] = useState(false);
  const [step, setStep] = useState<SpendStep>('form');
  const [spendMode, setSpendMode] = useState<'demo' | 'scan'>('demo');
  const [invoice, setInvoice] = useState<StoredInvoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [auth, setAuth] = useState<AuthBundle | null>(null);
  const [spendError, setSpendError] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [signing, setSigning] = useState(false);

  const remaining = allocation ? allocation.oac.allocated_amount_kobo - allocation.spent_amount_kobo : 0;
  const allocatedPercent = allocation ? Math.round((allocation.oac.allocated_amount_kobo / 5_000_000) * 100) : 0;
  const authToken = auth ? encodeAuth(auth) : '';
  const merchantName = identities.merchant.businessName || identities.merchant.displayName;

  const recentActivity = useMemo(() => activity.slice(0, 6), [activity]);

  const resetSpend = () => {
    setStep('form');
    setSpendMode('demo');
    setInvoice(null);
    setPayAmount('');
    setAuth(null);
    setSpendError('');
    setSigning(false);
  };

  const openSpend = () => {
    if (!allocation) {
      setNotice({ tone: 'error', text: 'Lock funds below to enable offline payments.' });
      return;
    }
    resetSpend();
    setSpendOpen(true);
  };

  const handleLock = async () => {
    const kobo = parseNairaToKobo(amount);
    if (kobo <= 0) {
      setNotice({ tone: 'error', text: 'Enter an amount to lock.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await lockFunds(kobo);
      setAmount('');
      setNotice({ tone: 'success', text: `${formatKobo(kobo)} locked — allocation certificate signed.` });
    } catch (err) {
      setNotice({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleSign = async () => {
    setSpendError('');
    let targetInvoice: Invoice;
    let kobo: number;

    if (invoice) {
      targetInvoice = invoice;
      kobo = invoice.a;
    } else {
      kobo = parseNairaToKobo(payAmount);
      if (kobo <= 0) {
        setSpendError('Enter an amount to pay.');
        return;
      }
      if (kobo > remaining) {
        setSpendError('Invoice exceeds your remaining offline allocation.');
        return;
      }
      targetInvoice = createInvoice(kobo);
    }

    setSigning(true);
    try {
      const bundle = await signPayment(targetInvoice, kobo);
      setAuth(bundle);
      setStep('qr');
      pushToast('Authorisation signed locally with Ed25519.');
    } catch (err) {
      setSpendError(humanReason((err as Error).message));
    } finally {
      setSigning(false);
    }
  };

  const handleScanned = (token: string) => {
    try {
      const decoded = decodeInvoice(token);
      setInvoice({
        ...decoded,
        merchant_name: decoded.m === identities.merchant.id ? merchantName : 'Merchant terminal',
      });
      setPayAmount((decoded.a / 100).toFixed(2));
      setSpendMode('scan');
      setScanOpen(false);
      setSpendError('');
    } catch (err) {
      setSpendError(humanReason((err as Error).message));
      setScanOpen(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 animate-rise">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] sm:text-[29px]">RIFT Offline</h1>
          <p className="mt-1 text-[12px] text-text-2">Lock funds now. Spend with zero network.</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-full border border-rift/30 bg-rift/15 text-rift shadow-rift">
          <RadioTower className="h-5 w-5" />
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_348px]">
        <div className="space-y-5">
          <section
            className="relative overflow-hidden rounded-[28px] border border-rift/30 p-5 text-[#241500] shadow-rift animate-rise sm:p-6"
            style={{
              background:
                'radial-gradient(110% 130% at 90% 0%, rgba(255,255,255,.22), transparent 45%), linear-gradient(135deg, #FFC44D 0%, #FFB224 52%, #F5A524 100%)',
            }}
          >
            <div className="pointer-events-none absolute -right-8 top-10 h-52 w-52 rounded-full border border-[#241500]/10" />
            <div className="pointer-events-none absolute -right-16 top-2 h-72 w-72 rounded-full border border-[#241500]/10" />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#241500]/60">Available offline</p>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.12em]', allocation ? 'border-[#241500]/20 bg-[#241500]/10' : 'border-[#241500]/15 bg-[#241500]/5')}>
                    <span className="mr-1 inline-block h-1 w-1 rounded-full bg-current align-middle" />
                    {allocation ? 'Ready' : 'Empty'}
                  </span>
                </div>
                <Money kobo={offlineAvailableKobo} className="mt-2 block text-[40px] font-semibold leading-none text-[#241500] sm:text-[46px]" />
                <p className="num mt-2 text-[11px] font-semibold text-[#241500]/65">
                  {formatKobo(offlineAvailableKobo, { decimals: false })} / {formatKobo(5_000_000, { decimals: false })} limit
                </p>
              </div>
              <Ring percent={allocatedPercent} size={96} stroke={10}>
                <div className="text-center">
                  <p className="num text-[18px] font-bold leading-none">{allocatedPercent}%</p>
                  <p className="mt-0.5 text-[7.5px] font-bold uppercase tracking-[0.1em] text-[#241500]/55">Allocated</p>
                </div>
              </Ring>
            </div>

            <button
              onClick={openSpend}
              disabled={!allocation}
              className={cn(
                'mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border text-[13px] font-bold transition',
                allocation
                  ? 'border-[#241500]/10 bg-[#241500] text-[#ffd98a] hover:bg-[#332000]'
                  : 'cursor-not-allowed border-[#241500]/10 bg-[#241500]/10 text-[#241500]/45',
              )}
            >
              <QrCode className="h-4 w-4" />
              Spend offline via QR
            </button>
            {!allocation && (
              <p className="mt-2 text-center text-[10px] font-medium text-[#241500]/60">Lock funds below to enable offline payments.</p>
            )}
          </section>

          <section className="card animate-rise">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-brand/25 bg-brand/10 text-brand">
                <Lock className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-[15px] font-semibold">Lock for offline</h2>
                <p className="mt-0.5 text-[11px] text-text-2">Issues a signed Offline Allocation Certificate.</p>
              </div>
            </div>

            <div className="mt-5">
              <Field label="Amount to lock">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-text-2">₦</span>
                  <TextInput
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="h-[54px] pl-8 text-[16px]"
                  />
                </div>
              </Field>
              <p className="mt-2 text-[10px] text-text-2">
                Maximum {formatKobo(5_000_000, { decimals: false })} total · {formatKobo(capRemainingKobo, { decimals: false })} of your limit remaining · Available {formatKobo(bank.availableKobo, { decimals: false })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[500_000, 1_000_000, 2_000_000].map((kobo) => (
                  <Chip key={kobo} onClick={() => setAmount((kobo / 100).toString())}>
                    {formatKobo(kobo, { decimals: false })}
                  </Chip>
                ))}
                <Chip onClick={() => setAmount((Math.min(capRemainingKobo, bank.availableKobo) / 100).toString())}>Max</Chip>
              </div>
              {notice && (
                <Notice tone={notice.tone} className="mt-3">
                  {notice.text}
                </Notice>
              )}
              <div className="mt-4 flex gap-3">
                <Button size="lg" className="flex-1" onClick={handleLock} disabled={busy || parseNairaToKobo(amount) <= 0}>
                  {busy ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04120a]/30 border-t-[#04120a]" /> Locking…
                    </>
                  ) : (
                    <>
                      Lock funds <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                {allocation && (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={async () => {
                      try {
                        await returnToOnline();
                      } catch (err) {
                        setNotice({ tone: 'error', text: (err as Error).message });
                      }
                    }}
                  >
                    <RotateCcw className="h-4 w-4" /> Return
                  </Button>
                )}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[9.5px] text-text-3">
                <ShieldCheck className="h-3.5 w-3.5 text-brand" />
                {mode === 'live' ? 'Issued and signed by RIFT Core.' : 'Issued and signed by the simulated local issuer.'}
              </p>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card animate-rise">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-raised text-text-2">
                  <Wallet className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-[14px] font-semibold">Allocation certificate</h2>
                  <p className="mt-0.5 text-[10.5px] text-text-2">
                    {allocation ? 'Ed25519 issuer-signed OAC' : 'No active lock'}
                  </p>
                </div>
              </div>
              {allocation && (
                <button
                  onClick={async () => {
                    try {
                      await reconcile();
                    } catch (err) {
                      setNotice({ tone: 'error', text: (err as Error).message });
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-raised px-2 py-1 text-[9.5px] font-semibold text-text-2 transition hover:text-text"
                >
                  <RefreshCw className="h-3 w-3" /> Reconcile
                </button>
              )}
            </div>

            {allocation ? (
              <div className="mt-4 space-y-2.5 text-[10.5px]">
                <div className="flex justify-between gap-3"><span className="text-text-2">OAC</span><span className="num truncate text-text">{shortId(allocation.oac.oac_id, 18, 4)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-text-2">Remaining / allocated</span><span className="num text-text">{formatKobo(remaining, { decimals: false })} / {formatKobo(allocation.oac.allocated_amount_kobo, { decimals: false })}</span></div>
                <div className="flex justify-between gap-3"><span className="text-text-2">Sequence counter</span><span className="num text-text">{allocation.seq_no_counter}</span></div>
                <div className="flex justify-between gap-3"><span className="text-text-2">Expires</span><span className="num text-text">{new Date(allocation.oac.expires_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</span></div>
                <div className="flex justify-between gap-3"><span className="text-text-2">Issuer key</span><span className="num text-text">{allocation.oac.issuer_key_version}</span></div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-line bg-raised/50 px-4 py-6 text-center">
                <p className="text-[11px] font-semibold text-text-2">No active allocation</p>
                <p className="mt-1 text-[10px] text-text-3">Lock funds to mint a signed certificate.</p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-line bg-raised px-3 py-2.5">
                <p className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-text-3">Online</p>
                <Money kobo={bank.availableKobo} className="mt-1 block text-[13px] font-semibold" />
              </div>
              <div className="rounded-xl border border-rift/20 bg-rift-soft/50 px-3 py-2.5">
                <p className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-rift-fg">Offline</p>
                <Money kobo={offlineAvailableKobo} className="mt-1 block text-[13px] font-semibold text-rift-fg" />
              </div>
            </div>
          </section>

          <section className="card animate-rise">
            <SectionTitle title="How RIFT works" />
            <div className="relative mt-4 space-y-4">
              <div className="absolute left-[15px] top-5 bottom-5 w-px bg-line" />
              {[
                { n: 1, tone: 'brand', title: 'Lock an allocation', text: 'RIFT Core (or the simulated issuer) signs an Offline Allocation Certificate for up to ₦50,000.' },
                { n: 2, tone: 'rift', title: 'Pay over QR', text: 'Your device signs an Ed25519 authorisation bound to the merchant invoice. No data, no Wi-Fi, no problem.' },
                { n: 3, tone: 'brand', title: 'Auto-reconcile', text: 'Merchant or gateway relays the receipt. Core verifies, anti-replays and settles on reconnect.' },
              ].map((item) => (
                <div key={item.n} className="relative flex gap-3">
                  <span className={cn('relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[11px] font-bold', item.tone === 'rift' ? 'border-rift/30 bg-rift/15 text-rift' : 'border-brand/30 bg-brand/15 text-brand')}>
                    {item.n}
                  </span>
                  <div>
                    <p className="text-[11.5px] font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-text-2">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card animate-rise">
            <SectionTitle title="RIFT activity" />
            <div className="mt-3 divide-y divide-line">
              {recentActivity.length === 0 && (
                <p className="py-6 text-center text-[11px] text-text-3">No offline activity yet.</p>
              )}
              {recentActivity.map((entry) => {
                const isSpend = entry.kind === 'spend';
                const isReturn = entry.kind === 'return';
                return (
                  <div key={entry.id} className="flex items-center gap-3 py-3">
                    <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full border', isSpend ? 'border-rift/25 bg-rift/10 text-rift' : isReturn ? 'border-brand/25 bg-brand/10 text-brand' : 'border-line bg-raised text-text-2')}>
                      {isSpend ? <ArrowUpRight className="h-3.5 w-3.5" /> : isReturn ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold">{entry.title}</p>
                      <p className="mt-0.5 truncate text-[9.5px] text-text-2">{entry.subtitle || shortDate(entry.at)}</p>
                    </div>
                    <span className={cn('num shrink-0 text-[11px] font-semibold', isReturn ? 'text-brand' : 'text-rift-fg')}>
                      {isReturn ? '+' : ''}{formatKobo(entry.amount_kobo, { decimals: false })}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <Sheet
        open={spendOpen}
        onClose={() => setSpendOpen(false)}
        title={step === 'qr' ? 'Authorisation token' : step === 'done' ? 'Payment authorised' : 'Spend offline'}
        subtitle={
          step === 'form'
            ? `Signed from your OAC · ${formatKobo(remaining, { decimals: false })} available`
            : step === 'qr'
              ? 'Show this QR to the merchant — no network needed'
              : 'The merchant verifies locally and stores the receipt'
        }
        size="md"
      >
        {step === 'form' && (
          <div className="space-y-4">
            <Segmented
              options={[
                { value: 'demo', label: 'Demo invoice' },
                { value: 'scan', label: 'Scan merchant QR' },
              ]}
              value={spendMode}
              onChange={(value) => {
                setSpendMode(value);
                setInvoice(null);
                setSpendError('');
                if (value === 'scan') setScanOpen(true);
              }}
            />

            {spendMode === 'demo' && !invoice && (
              <>
                <div className="rounded-2xl border border-line bg-raised px-4 py-3.5">
                  <p className="label">Merchant</p>
                  <p className="mt-1 text-[13px] font-semibold">{merchantName}</p>
                  <p className="mt-0.5 text-[10.5px] text-text-2">Single-device stage mode · invoice issued on this device</p>
                </div>
                <Field label="Amount">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-text-2">₦</span>
                    <TextInput
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0.00"
                      inputMode="decimal"
                      className="h-[52px] pl-8 text-[15px]"
                    />
                  </div>
                </Field>
                <div className="flex flex-wrap gap-2">
                  {[50_000, 100_000, 200_000].map((kobo) => (
                    <Chip key={kobo} onClick={() => setPayAmount((kobo / 100).toString())}>
                      {formatKobo(kobo, { decimals: false })}
                    </Chip>
                  ))}
                  <Chip onClick={() => setPayAmount((remaining / 100).toString())}>All</Chip>
                </div>
              </>
            )}

            {spendMode === 'scan' && !invoice && (
              <div className="rounded-2xl border border-dashed border-line bg-raised/50 px-4 py-8 text-center">
                <ScanLine className="mx-auto h-8 w-8 text-text-3" />
                <p className="mt-3 text-[12px] font-semibold">Scan the merchant invoice</p>
                <p className="mt-1 text-[10.5px] text-text-2">Camera needs HTTPS. Paste the invoice token below on HTTP.</p>
                <Button variant="secondary" className="mt-4" onClick={() => setScanOpen(true)}>
                  <ScanLine className="h-4 w-4" /> Open scanner
                </Button>
                <div className="mt-4">
                  <TextInput
                    placeholder="…or paste invoice token"
                    onChange={(e) => {
                      if (!e.target.value.trim()) return;
                      try {
                        const decoded = decodeInvoice(e.target.value.trim());
                        setInvoice({ ...decoded, merchant_name: decoded.m === identities.merchant.id ? merchantName : 'Merchant terminal' });
                        setPayAmount((decoded.a / 100).toFixed(2));
                        setSpendError('');
                      } catch {
                        setSpendError('That does not look like a valid invoice token.');
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {invoice && (
              <div className="rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="label">Invoice captured</p>
                    <p className="mt-1 text-[13px] font-semibold">{invoice.merchant_name}</p>
                    <p className="num mt-0.5 text-[10px] text-text-2">{shortId(invoice.n, 18, 4)}</p>
                  </div>
                  <div className="text-right">
                    <p className="num text-[20px] font-semibold">{formatKobo(invoice.a)}</p>
                    <button className="mt-1 text-[10px] font-semibold text-brand" onClick={() => { setInvoice(null); setPayAmount(''); setSpendMode('scan'); }}>
                      Scan another
                    </button>
                  </div>
                </div>
              </div>
            )}

            {spendError && <Notice tone="error">{spendError}</Notice>}
            <Notice tone="rift">
              The authorisation is signed on this device. The merchant sees an offline authorisation, not a settled payment.
            </Notice>
            <Button
              variant="rift"
              size="lg"
              className="w-full"
              onClick={handleSign}
              disabled={signing || (!invoice && parseNairaToKobo(payAmount) <= 0)}
            >
              {signing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#241500]/30 border-t-[#241500]" /> Signing…
                </>
              ) : (
                <>
                  Sign payment token <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}

        {step === 'qr' && auth && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="qr-frame">
                <QRCodeSVG value={authToken} size={236} level="M" bgColor="#FFFFFF" fgColor="#000000" />
              </div>
            </div>
            <div className="scrollbar-thin max-h-20 overflow-y-auto rounded-xl border border-line bg-raised px-3 py-2 font-mono text-[8px] leading-relaxed text-text-3 break-all">
              {authToken}
            </div>
            <div className="rounded-2xl border border-line bg-raised px-4 py-3 text-center">
              <p className="text-[12px] font-semibold">{invoice?.merchant_name ?? merchantName}</p>
              <p className="num mt-1 text-[24px] font-semibold">{formatKobo(auth.tx.amount_kobo)}</p>
              <p className="num mt-1 text-[9px] text-text-3">{auth.transaction_id}</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-rift/30 bg-rift/10 px-3.5 py-3 text-[11px] text-rift-fg">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-rift" />
              Ed25519-signed · waiting for merchant scan…
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(authToken);
                  pushToast('Authorisation token copied.');
                }}
              >
                <Copy className="h-4 w-4" /> Copy token
              </Button>
              <Button
                onClick={() => {
                  setStep('done');
                  setSpendOpen(false);
                  pushToast('Authorisation ready — switch to Merchant to accept.', 'info');
                }}
              >
                Done for now
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full border border-brand/30 bg-brand/10 text-brand">
              <Check className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-display text-[17px] font-semibold">Authorisation ready</h3>
            <p className="mt-1 max-w-xs text-[11.5px] leading-relaxed text-text-2">
              The merchant verifies the token locally and stores it in their outbox. Settlement happens only after relay.
            </p>
            <Button className="mt-5 w-full" onClick={() => setSpendOpen(false)}>Close</Button>
          </div>
        )}
      </Sheet>

      <Scanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={handleScanned}
        title="Scan merchant invoice"
      />
    </div>
  );
}
