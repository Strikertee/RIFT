import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  CloudUpload,
  Copy,
  Delete,
  Download,
  FileJson,
  Inbox,
  QrCode,
  RadioTower,
  ReceiptText,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Store,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../state/ToastContext';
import { TerminalShell } from '../../components/AppShell';
import { Scanner } from '../../components/Scanner';
import {
  Button,
  EmptyState,
  IconBtn,
  Money,
  Notice,
  SectionTitle,
  Segmented,
  Sheet,
  StatusPill,
  cn,
} from '../../components/ui';
import { encodeAuth, encodeInvoice } from '../../lib/qr';
import { formatKobo, humanReason, shortDate, shortId } from '../../lib/format';
import type { Receipt, StoredInvoice } from '../../types';

type Tab = 'till' | 'receipts' | 'sync';
type OutboxFilter = 'all' | 'pending' | 'settled';

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'till', label: 'Till' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'sync', label: 'Sync & relay' },
];

function receiptMatches(receipt: Receipt, filter: OutboxFilter): boolean {
  if (filter === 'pending') return receipt.sync_status === 'PENDING_RELAY' || receipt.sync_status === 'CRYPTO_VALIDATED';
  if (filter === 'settled') return receipt.sync_status === 'SETTLED (SIMULATED)' || receipt.sync_status === 'RELAYED';
  return true;
}

export function MerchantApp() {
  const {
    identity,
    identities,
    mode,
    outbox,
    invoices,
    lastAuth,
    lastBatch,
    createInvoice,
    acceptToken,
    relay,
    exportBatch,
    ingestBatch,
    online,
  } = useApp();
  const { pushToast } = useToast();

  const [tab, setTab] = useState<Tab>('till');
  const [amountDigits, setAmountDigits] = useState('');
  const [invoice, setInvoice] = useState<StoredInvoice | null>(null);
  const [authInput, setAuthInput] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [receiptSheet, setReceiptSheet] = useState<Receipt | null>(null);
  const [filter, setFilter] = useState<OutboxFilter>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [batch, setBatch] = useState<{ json: string; chunks: string[] } | null>(null);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [batchNotice, setBatchNotice] = useState('');

  const merchantName = identity?.businessName || identity?.displayName || 'Mama Nkechi Foods';
  const merchantId = identity?.id ?? identities.merchant.id;
  const amountNaira = Number(amountDigits || '0');
  const amountKobo = amountNaira * 100;

  const myReceipts = useMemo(
    () => outbox.filter((r) => r.merchant_id === merchantId || r.merchant_id === identities.merchant.id),
    [outbox, merchantId, identities.merchant.id],
  );
  const filtered = myReceipts.filter((r) => receiptMatches(r, filter));

  const pending = myReceipts.filter((r) => r.sync_status === 'PENDING_RELAY' || r.sync_status === 'CRYPTO_VALIDATED');
  const settled = myReceipts.filter((r) => r.sync_status === 'SETTLED (SIMULATED)' || r.sync_status === 'RELAYED');
  const rejected = myReceipts.filter((r) => r.sync_status.startsWith('REJECTED') || r.sync_status === 'QUARANTINED_COLLISION');
  const pendingAmount = pending.reduce((sum, r) => sum + r.amount_kobo, 0);
  const settledAmount = settled.reduce((sum, r) => sum + r.amount_kobo, 0);
  const lastSettled = settled
    .slice()
    .sort((a, b) => new Date(b.settled_at ?? b.created_at).getTime() - new Date(a.settled_at ?? a.created_at).getTime())[0];

  const press = (key: string) => {
    setError('');
    if (key === 'del') {
      setAmountDigits((current) => current.slice(0, -1));
      return;
    }
    if (key === '00') {
      setAmountDigits((current) => (current ? `${current}00`.slice(0, 7) : ''));
      return;
    }
    setAmountDigits((current) => `${current}${key}`.replace(/^0+/, '').slice(0, 7));
  };

  const handleCreateInvoice = () => {
    setError('');
    if (amountKobo <= 0) {
      setError('Enter an invoice amount first.');
      return;
    }
    try {
      const created = createInvoice(amountKobo);
      setInvoice(created);
      pushToast(`Invoice ${created.n.slice(0, 10)} ready to scan.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAccept = async (token = authInput) => {
    setError('');
    if (!token.trim()) {
      setError('Paste or scan a customer authorisation token.');
      return;
    }
    setBusy(true);
    try {
      const receipt = await acceptToken(token.trim());
      setAuthInput('');
      setReceiptSheet(receipt);
      setInvoice(null);
      setTab('receipts');
      setFilter('all');
    } catch (err) {
      setError(humanReason((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const handleRelay = async () => {
    setError('');
    if (!pending.length) {
      setError('No pending receipts to relay.');
      return;
    }
    setBusy(true);
    try {
      await relay(pending.map((r) => r.transaction_id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    setError('');
    setBatchNotice('');
    const result = exportBatch();
    if (!result.count) {
      setBatchNotice('Nothing to export yet. Create an invoice and accept a customer authorisation first.');
      return;
    }
    const chunks: string[] = [];
    const size = 450;
    for (let i = 0; i < result.json.length; i += size) chunks.push(result.json.slice(i, i + size));
    setBatch({ json: result.json, chunks });
    setChunkIndex(0);
    setBatchNotice(`${chunks.length} QR chunk${chunks.length === 1 ? '' : 's'} generated. Hand them to a gateway in any order.`);
    pushToast(`Batch exported · ${result.count} receipt${result.count === 1 ? '' : 's'}.`);
  };

  const batchToken = batch ? `RB.${batch.chunks.length}.${chunkIndex + 1}.${batch.chunks[chunkIndex]}` : '';

  return (
    <TerminalShell
      contextLabel="Merchant terminal"
      title={merchantName}
      subtitle={`${shortId(merchantId, 16, 4)} · ${mode === 'live' ? 'live core' : 'simulated core'}`}
      icon={<Store className="h-5 w-5" />}
      actions={
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold',
            online ? 'border-brand/25 bg-brand/10 text-brand' : 'border-rift/30 bg-rift/10 text-rift-fg',
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" /> {online ? 'Online' : 'Offline'}
        </span>
      }
    >
      <div className="mb-5 grid grid-cols-3 gap-1 rounded-2xl border border-line bg-raised p-1">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setTab(entry.key)}
            className={cn(
              'h-10 rounded-xl text-[12px] font-semibold transition',
              tab === entry.key ? 'bg-overlay text-text shadow-[0_1px_0_rgb(255_255_255/.04)_inset]' : 'text-text-2 hover:text-text',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'till' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_348px]">
          <div className="space-y-5">
            <section className="card animate-rise">
              <p className="label">Invoice amount</p>
              <p className="num mt-1 text-[36px] font-semibold leading-none">
                {amountKobo > 0 ? formatKobo(amountKobo, { decimals: false }) : '₦0'}
              </p>
              <div className="mt-4 flex h-11 items-center justify-center rounded-2xl border border-line bg-raised text-[13px] font-semibold text-text-2">
                {amountNaira > 0 ? amountNaira.toLocaleString('en-NG') : 'Type amount (₦)'}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'].map((key) => (
                  <button
                    key={key}
                    onClick={() => press(key)}
                    className={cn(
                      'grid h-[52px] place-items-center rounded-2xl border border-line bg-raised text-[17px] font-semibold transition hover:border-line-strong hover:bg-overlay',
                      key === 'del' && 'text-danger',
                    )}
                  >
                    {key === 'del' ? <Delete className="h-4 w-4" /> : key}
                  </button>
                ))}
              </div>
              {error && <Notice tone="error" className="mt-3">{error}</Notice>}
              <Button
                variant="rift"
                size="lg"
                className="mt-4 w-full"
                onClick={handleCreateInvoice}
                disabled={amountKobo <= 0}
              >
                <QrCode className="h-4 w-4" /> Create invoice QR
              </Button>
            </section>

            {invoice && (
              <section className="card animate-pop">
                <div className="text-center">
                  <p className="label">Customer scans this</p>
                  <div className="mt-3 flex justify-center">
                    <div className="qr-frame">
                      <QRCodeSVG value={encodeInvoice(invoice)} size={220} level="M" bgColor="#FFFFFF" fgColor="#000000" />
                    </div>
                  </div>
                  <p className="num mt-3 text-[24px] font-semibold">{formatKobo(invoice.a)}</p>
                  <p className="mt-1 text-[10.5px] text-text-2">
                    {invoice.merchant_name} · invoice {shortId(invoice.n, 12, 4)}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(encodeInvoice(invoice));
                      pushToast('Invoice token copied.');
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-1.5 text-[10px] font-semibold text-text-2"
                  >
                    <Copy className="h-3 w-3" /> Copy invoice token
                  </button>
                </div>
              </section>
            )}

            <section className="card animate-rise">
              <SectionTitle title="Accept customer authorisation" />
              <p className="mt-1 text-[10.5px] text-text-2">
                Local verification checks the issuer OAC, customer signature, amount, nonce and sequence.
              </p>
              <textarea
                value={authInput}
                onChange={(e) => setAuthInput(e.target.value)}
                placeholder="Paste the customer's authorisation token here…"
                className="input-shell mt-3 min-h-[86px] w-full resize-none font-mono text-[9.5px] leading-relaxed"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setScanOpen(true)}>
                  <ScanLine className="h-4 w-4" /> Scan with camera
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!lastAuth) {
                      setError('No customer authorisation on this device yet.');
                      return;
                    }
                    setAuthInput(encodeAuth(lastAuth));
                    pushToast('Demo token loaded into the verifier.', 'info');
                  }}
                >
                  <ClipboardPaste className="h-4 w-4" /> Pull demo token
                </Button>
              </div>
              <Button className="mt-3 w-full" onClick={() => handleAccept()} disabled={busy || !authInput.trim()}>
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04120a]/30 border-t-[#04120a]" /> Verifying…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" /> Verify & accept payment
                  </>
                )}
              </Button>
              <Notice tone="rift" className="mt-3">
                An accepted receipt is an offline authorisation. It becomes SETTLED (SIMULATED) only after relay.
              </Notice>
            </section>
          </div>

          <div className="space-y-5">
            <section className="card animate-rise">
              <SectionTitle title="Today's takings" />
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-rift/25 bg-rift/10 px-2.5 py-2.5">
                  <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-rift-fg">Pending</p>
                  <p className="num mt-1 text-[14px] font-semibold text-rift-fg">{formatKobo(pendingAmount, { decimals: false })}</p>
                </div>
                <div className="rounded-xl border border-brand/25 bg-brand/10 px-2.5 py-2.5">
                  <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-brand">Settled</p>
                  <p className="num mt-1 text-[14px] font-semibold text-brand">{formatKobo(settledAmount, { decimals: false })}</p>
                </div>
                <div className="rounded-xl border border-line bg-raised px-2.5 py-2.5">
                  <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-text-3">Rejected</p>
                  <p className="num mt-1 text-[14px] font-semibold">{rejected.length}</p>
                </div>
              </div>
            </section>

            <section className="card animate-rise">
              <SectionTitle
                title="Receipt outbox"
                action={
                  <div className="flex items-center gap-0.5 rounded-xl border border-line bg-raised p-0.5">
                    {(['all', 'pending', 'settled'] as const).map((value) => (
                      <button
                        key={value}
                        onClick={() => setFilter(value)}
                        className={cn('rounded-lg px-2 py-1 text-[9.5px] font-semibold capitalize transition', filter === value ? 'bg-overlay text-text' : 'text-text-2')}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                }
              />
              <div className="mt-2">
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={<RadioTower className="h-5 w-5" />}
                    title="No receipts yet"
                    description="Verified offline payments land here and wait for relay to RIFT Core."
                  />
                ) : (
                  <div className="divide-y divide-line">
                    {filtered.slice(0, 8).map((receipt) => (
                      <button
                        key={receipt.transaction_id}
                        onClick={() => setReceiptSheet(receipt)}
                        className="flex w-full items-center justify-between gap-3 py-3 text-left"
                      >
                        <div className="min-w-0">
                          <p className="num text-[13px] font-semibold">{formatKobo(receipt.amount_kobo, { decimals: false })}</p>
                          <p className="mt-0.5 truncate text-[9.5px] text-text-2">{shortDate(receipt.created_at)} · {shortId(receipt.transaction_id, 12, 4)}</p>
                        </div>
                        <StatusPill status={receipt.sync_status} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {tab === 'receipts' && (
        <div className="space-y-5">
          <section className="card animate-rise">
            <SectionTitle title="Takings" />
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-rift/25 bg-rift/10 px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-rift-fg">Pending</p>
                <p className="num mt-1 text-[20px] font-semibold text-rift-fg">{formatKobo(pendingAmount, { decimals: false })}</p>
                <p className="mt-1 text-[9.5px] text-text-2">{pending.length} receipt{pending.length === 1 ? '' : 's'}</p>
              </div>
              <div className="rounded-2xl border border-brand/25 bg-brand/10 px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-brand">Settled</p>
                <p className="num mt-1 text-[20px] font-semibold text-brand">{formatKobo(settledAmount, { decimals: false })}</p>
                <p className="mt-1 text-[9.5px] text-text-2">{settled.length} receipt{settled.length === 1 ? '' : 's'}</p>
              </div>
              <div className="rounded-2xl border border-line bg-raised px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-3">Rejected</p>
                <p className="num mt-1 text-[20px] font-semibold">{rejected.length}</p>
                <p className="mt-1 text-[9.5px] text-text-2">Collisions and invalid signatures</p>
              </div>
            </div>
          </section>

          <section className="card animate-rise">
            <SectionTitle
              title="Receipt outbox"
              action={
                <div className="flex items-center gap-0.5 rounded-xl border border-line bg-raised p-0.5">
                  {(['all', 'pending', 'settled'] as const).map((value) => (
                    <button
                      key={value}
                      onClick={() => setFilter(value)}
                      className={cn('rounded-lg px-2.5 py-1 text-[10px] font-semibold capitalize transition', filter === value ? 'bg-overlay text-text' : 'text-text-2')}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              }
            />
            {filtered.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-5 w-5" />}
                title="No receipts yet"
                description="Verified offline payments land here and wait for relay to RIFT Core."
              />
            ) : (
              <div className="mt-3 divide-y divide-line">
                {filtered.map((receipt) => (
                  <button
                    key={receipt.transaction_id}
                    onClick={() => setReceiptSheet(receipt)}
                    className="flex w-full items-center justify-between gap-4 py-3.5 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="num text-[14px] font-semibold">{formatKobo(receipt.amount_kobo)}</p>
                        <StatusPill status={receipt.sync_status} />
                      </div>
                      <p className="mt-1 truncate text-[10px] text-text-2">
                        {shortId(receipt.transaction_id, 20, 4)} · seq {receipt.seq_no} · {shortDate(receipt.created_at)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-text-3" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'sync' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_348px]">
          <div className="space-y-5">
            <section className="card animate-rise">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SectionTitle title="Relay to RIFT Core" />
                  <p className="mt-1 text-[10.5px] text-text-2">
                    {pending.length} receipt{pending.length === 1 ? '' : 's'} awaiting settlement · {mode === 'live' ? 'live core' : 'simulated core with anti-replay'}
                  </p>
                </div>
                <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold', online ? 'border-brand/25 bg-brand/10 text-brand' : 'border-rift/30 bg-rift/10 text-rift-fg')}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" /> {online ? 'Online' : 'Offline'}
                </span>
              </div>
              <Button className="mt-4 w-full" size="lg" onClick={handleRelay} disabled={busy || !pending.length}>
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04120a]/30 border-t-[#04120a]" /> Relaying…
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" /> Relay batch now
                  </>
                )}
              </Button>
              <p className="mt-3 text-[10px] text-text-3">
                {lastSettled
                  ? `Last settled ${shortDate(lastSettled.settled_at ?? lastSettled.created_at)} · ${shortId(lastSettled.clearing_ref ?? '', 14, 4)}`
                  : 'No sync yet on this device. Auto-relay fires when connectivity returns.'}
              </p>
              {error && <Notice tone="error" className="mt-3">{error}</Notice>}
            </section>

            <section className="card animate-rise">
              <SectionTitle title="Hand batch to a gateway" />
              <p className="mt-1 text-[10.5px] text-text-2">
                Export pending receipts as optical QR chunks. The gateway can scan them in any order.
              </p>
              <Button variant="secondary" className="mt-3 w-full" onClick={handleExport}>
                <Upload className="h-4 w-4" /> Export pending batch
              </Button>
              {batchNotice && <Notice tone={batch?.chunks.length ? 'info' : 'info'} className="mt-3">{batchNotice}</Notice>}

              {batch && batch.chunks.length > 0 && (
                <div className="mt-4 rounded-2xl border border-line bg-raised p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="label">Batch QR chunk</p>
                      <p className="num mt-1 text-[12px] font-semibold">
                        {chunkIndex + 1} / {batch.chunks.length}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <IconBtn label="Previous chunk" onClick={() => setChunkIndex((i) => Math.max(0, i - 1))} className="h-8 w-8">
                        <ChevronLeft className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn label="Next chunk" onClick={() => setChunkIndex((i) => Math.min(batch.chunks.length - 1, i + 1))} className="h-8 w-8">
                        <ChevronRight className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-center">
                    <div className="qr-frame">
                      <QRCodeSVG value={batchToken} size={220} level="L" bgColor="#FFFFFF" fgColor="#000000" />
                    </div>
                  </div>
                  <p className="mt-2 break-all text-center font-mono text-[8px] text-text-3">
                    {batchToken.slice(0, 58)}…
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(batchToken);
                        pushToast('Chunk token copied.');
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy chunk
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(batch.json);
                        pushToast('Full batch JSON copied.');
                      }}
                    >
                      <FileJson className="h-3.5 w-3.5" /> Copy JSON
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>

          <section className="card animate-rise">
            <SectionTitle
              title="Receipt outbox"
              action={
                <div className="flex items-center gap-0.5 rounded-xl border border-line bg-raised p-0.5">
                  {(['all', 'pending', 'settled'] as const).map((value) => (
                    <button
                      key={value}
                      onClick={() => setFilter(value)}
                      className={cn('rounded-lg px-2 py-1 text-[9.5px] font-semibold capitalize transition', filter === value ? 'bg-overlay text-text' : 'text-text-2')}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              }
            />
            {filtered.length === 0 ? (
              <EmptyState
                icon={<RadioTower className="h-5 w-5" />}
                title="No receipts yet"
                description="Verified offline payments land here and wait for relay to RIFT Core."
              />
            ) : (
              <div className="mt-2 divide-y divide-line">
                {filtered.map((receipt) => (
                  <button
                    key={receipt.transaction_id}
                    onClick={() => setReceiptSheet(receipt)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="num text-[13px] font-semibold">{formatKobo(receipt.amount_kobo, { decimals: false })}</p>
                      <p className="mt-0.5 truncate text-[9.5px] text-text-2">{shortDate(receipt.created_at)}</p>
                    </div>
                    <StatusPill status={receipt.sync_status} />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <Scanner open={scanOpen} onClose={() => setScanOpen(false)} onScan={(token) => { setScanOpen(false); setAuthInput(token); pushToast('Authorisation scanned.', 'info'); }} title="Scan authorisation token" />

      <Sheet
        open={Boolean(receiptSheet)}
        onClose={() => setReceiptSheet(null)}
        title="Offline receipt"
        subtitle="Local verification passed"
        size="sm"
      >
        {receiptSheet && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-brand/25 bg-brand/5 px-4 py-5 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-brand/30 bg-brand/10 text-brand">
                <Check className="h-6 w-6" />
              </div>
              <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.16em] text-brand">Authorised offline</p>
              <p className="num mt-1 text-[30px] font-semibold">{formatKobo(receiptSheet.amount_kobo)}</p>
              <p className="mt-1 text-[10.5px] text-text-2">{receiptSheet.merchant_name}</p>
              <div className="mt-3 flex justify-center"><StatusPill status={receiptSheet.sync_status} /></div>
            </div>
            <div className="space-y-2.5 rounded-2xl border border-line bg-raised px-4 py-3 text-[10.5px]">
              <div className="flex justify-between gap-3"><span className="text-text-2">Signature check</span><span className="font-semibold text-brand">PASS</span></div>
              <div className="flex justify-between gap-3"><span className="text-text-2">Transaction</span><span className="num truncate">{shortId(receiptSheet.transaction_id, 20, 4)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-text-2">OAC</span><span className="num truncate">{shortId(receiptSheet.oac_id, 16, 4)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-text-2">Sequence</span><span className="num">{receiptSheet.seq_no}</span></div>
              <div className="flex justify-between gap-3"><span className="text-text-2">Invoice nonce</span><span className="num truncate">{shortId(receiptSheet.invoice_nonce, 14, 4)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-text-2">Captured</span><span className="num">{shortDate(receiptSheet.created_at)}</span></div>
              {receiptSheet.clearing_ref && (
                <div className="flex justify-between gap-3"><span className="text-text-2">Clearing ref</span><span className="num text-brand">{receiptSheet.clearing_ref}</span></div>
              )}
              {receiptSheet.rejection_reason && (
                <div className="flex justify-between gap-3"><span className="text-text-2">Reason</span><span className="text-danger">{humanReason(receiptSheet.rejection_reason)}</span></div>
              )}
            </div>
            <Notice tone="rift">
              This receipt is an authorisation, not settlement. Value moves only when Core confirms the relay.
            </Notice>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                navigator.clipboard?.writeText(JSON.stringify(receiptSheet, null, 2));
                pushToast('Receipt JSON copied.');
              }}
            >
              <Copy className="h-4 w-4" /> Copy receipt JSON
            </Button>
          </div>
        )}
      </Sheet>
    </TerminalShell>
  );
}
