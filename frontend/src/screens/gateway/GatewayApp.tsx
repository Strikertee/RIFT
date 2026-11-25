import { useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  ClipboardPaste,
  CloudUpload,
  Copy,
  Inbox,
  Layers,
  RadioTower,
  RefreshCw,
  ScanLine,
  Search,
  Shield,
  ShieldCheck,
  Signal,
  Upload,
  Wifi,
  X,
} from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../state/ToastContext';
import { TerminalShell } from '../../components/AppShell';
import { Scanner } from '../../components/Scanner';
import {
  Button,
  EmptyState,
  Notice,
  SectionTitle,
  StatusPill,
  cn,
} from '../../components/ui';
import { formatKobo, shortDate, shortId } from '../../lib/format';
import type { Receipt } from '../../types';

export function GatewayApp() {
  const { outbox, relay, ingestBatch, lastBatch, identity, mode, online } = useApp();
  const { pushToast } = useToast();

  const [scanOpen, setScanOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [chunks, setChunks] = useState<Record<number, string>>({});
  const [chunkTotal, setChunkTotal] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const queued = outbox.filter((r) => r.sync_status === 'PENDING_RELAY' || r.sync_status === 'CRYPTO_VALIDATED');
  const settled = outbox.filter((r) => r.sync_status === 'SETTLED (SIMULATED)' || r.sync_status === 'RELAYED');
  const rejected = outbox.filter((r) => r.sync_status.startsWith('REJECTED') || r.sync_status === 'QUARANTINED_COLLISION');
  const attempts = outbox.filter((r) => r.sync_status !== 'PENDING_RELAY').length;
  const ledger = outbox
    .filter((r) => r.sync_status !== 'PENDING_RELAY')
    .filter((r) => {
      const needle = search.trim().toLowerCase();
      if (!needle) return true;
      return [r.transaction_id, r.merchant_name, r.oac_id, r.clearing_ref ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => new Date(b.settled_at ?? b.created_at).getTime() - new Date(a.settled_at ?? a.created_at).getTime());

  const lastRelay = outbox
    .filter((r) => r.settled_at)
    .sort((a, b) => new Date(b.settled_at ?? '').getTime() - new Date(a.settled_at ?? '').getTime())[0];

  const selectedAmount = useMemo(
    () => queued.filter((r) => selected.includes(r.transaction_id)).reduce((sum, r) => sum + r.amount_kobo, 0),
    [queued, selected],
  );

  const ingest = (json: string) => {
    setError('');
    try {
      const count = ingestBatch(json);
      if (!count) {
        pushToast('No new receipts in this batch.', 'info');
        return;
      }
      setPaste('');
      setChunks({});
      setChunkTotal(0);
      pushToast(`${count} receipt${count === 1 ? '' : 's'} queued for relay.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleToken = (token: string) => {
    setError('');
    const trimmed = token.trim();
    if (!trimmed) return;
    const match = /^RB\.(\d+)\.(\d+)\.([\s\S]*)$/.exec(trimmed);
    if (!match) {
      ingest(trimmed);
      return;
    }
    const total = Number(match[1]);
    const index = Number(match[2]);
    const payload = match[3];
    const next = total === chunkTotal ? { ...chunks, [index]: payload } : { [index]: payload };
    setChunks(next);
    setChunkTotal(total);
    if (Object.keys(next).length >= total) {
      const json = Array.from({ length: total }, (_, i) => next[i + 1] ?? '').join('');
      ingest(json);
    } else {
      pushToast(`Chunk ${Object.keys(next).length}/${total} ingested — scan the rest.`, 'info');
    }
  };

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const handleRelay = async (ids?: string[]) => {
    setError('');
    const target = ids ?? selected;
    if (!target.length) {
      setError('Select at least one queued receipt to relay.');
      return;
    }
    setBusy(true);
    try {
      await relay(target);
      setSelected([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <TerminalShell
      contextLabel="Gateway relay"
      title={identity?.displayName ?? 'Gateway 01'}
      subtitle={`Store-and-forward relay node · ${mode === 'live' ? 'live core' : 'simulated core'}`}
      icon={<RadioTower className="h-5 w-5" />}
      actions={
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold', online ? 'border-brand/25 bg-brand/10 text-brand' : 'border-rift/30 bg-rift/10 text-rift-fg')}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" /> {online ? 'Online' : 'Offline'}
        </span>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Queued', value: String(queued.length), tone: 'text-rift-fg border-rift/25 bg-rift/10' },
          { label: 'Settled', value: String(settled.length), tone: 'text-brand border-brand/25 bg-brand/10' },
          { label: 'Rejected', value: String(rejected.length), tone: 'text-danger border-danger/25 bg-danger/10' },
          { label: 'Attempts', value: String(attempts), tone: 'text-text border-line bg-raised' },
        ].map((stat) => (
          <div key={stat.label} className={cn('rounded-2xl border px-4 py-3', stat.tone)}>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-70">{stat.label}</p>
            <p className="num mt-1.5 text-[22px] font-semibold leading-none">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_348px]">
        <div className="space-y-5">
          <section className="card animate-rise">
            <SectionTitle title="Ingest receipt batch" />
            <div className="mt-3 rounded-2xl border border-dashed border-line bg-raised/40 px-4 py-8 text-center">
              <CloudUpload className="mx-auto h-7 w-7 text-text-3" />
              <p className="mt-2 text-[11.5px] text-text-2">Scan every merchant batch QR in order</p>
              {chunkTotal > 0 && (
                <div className="mx-auto mt-3 max-w-[260px]">
                  <div className="h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(Object.keys(chunks).length / chunkTotal) * 100}%` }} />
                  </div>
                  <p className="mt-1.5 text-[9.5px] text-text-2">
                    {Object.keys(chunks).length} / {chunkTotal} chunks · waiting for the rest
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setScanOpen(true)}>
                <ScanLine className="h-4 w-4" /> Scan with camera
              </Button>
              <Button variant="secondary" onClick={() => pushToast('Paste a chunk or full batch JSON below.', 'info')}>
                <ClipboardPaste className="h-4 w-4" /> Use pasted token
              </Button>
            </div>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="…or paste the QR payload here"
              className="input-shell mt-3 min-h-[64px] w-full resize-none font-mono text-[9.5px]"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  if (!lastBatch) {
                    setError('No merchant batch on this device. Export one from the merchant Sync tab first.');
                    return;
                  }
                  ingest(lastBatch);
                }}
              >
                <Inbox className="h-4 w-4" /> Pull demo batch
              </Button>
              <Button variant="secondary" onClick={() => pushToast('Queue refreshed from local outbox.', 'info')}>
                <RefreshCw className="h-4 w-4" /> Refresh queue
              </Button>
            </div>
            {paste.trim() && (
              <Button className="mt-3 w-full" onClick={() => handleToken(paste)}>
                <Upload className="h-4 w-4" /> Ingest pasted payload
              </Button>
            )}
            {error && <Notice tone="error" className="mt-3">{error}</Notice>}
            <Notice tone="info" className="mt-3">
              Batch chunks use <span className="font-mono">RB.&lt;total&gt;.&lt;index&gt;.&lt;payload&gt;</span>. Chunks can arrive in any order; the gateway reassembles them when all are present.
            </Notice>
          </section>

          <section className="card animate-rise">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle title="Relay queue" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-2">
                  Relay selected ({selected.length}){selected.length > 0 && ` · ${formatKobo(selectedAmount, { decimals: false })}`}
                </span>
                <Button
                  size="sm"
                  onClick={() => handleRelay()}
                  disabled={busy || selected.length === 0}
                >
                  {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#04120a]/30 border-t-[#04120a]" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Relay selected
                </Button>
              </div>
            </div>

            {queued.length === 0 ? (
              <EmptyState
                icon={<Shield className="h-5 w-5" />}
                title="Queue clear"
                description="Ingest a merchant batch to verify and relay its receipts to RIFT Core."
              />
            ) : (
              <>
                <div className="mt-3 flex items-center justify-between border-b border-line pb-2">
                  <button
                    onClick={() => setSelected(selected.length === queued.length ? [] : queued.map((r) => r.transaction_id))}
                    className="inline-flex items-center gap-2 text-[10px] font-semibold text-text-2"
                  >
                    <span className={cn('grid h-4 w-4 place-items-center rounded border', selected.length === queued.length ? 'border-brand bg-brand text-[#04120a]' : 'border-line-strong')}>
                      {selected.length === queued.length && <Check className="h-3 w-3" />}
                    </span>
                    Select all
                  </button>
                  <Button size="sm" onClick={() => handleRelay(queued.map((r) => r.transaction_id))} disabled={busy}>
                    <RefreshCw className="h-3.5 w-3.5" /> Relay all
                  </Button>
                </div>
                <div className="divide-y divide-line">
                  {queued.map((receipt) => (
                    <button
                      key={receipt.transaction_id}
                      onClick={() => toggle(receipt.transaction_id)}
                      className="flex w-full items-center gap-3 py-3 text-left"
                    >
                      <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded border', selected.includes(receipt.transaction_id) ? 'border-brand bg-brand text-[#04120a]' : 'border-line-strong')}>
                        {selected.includes(receipt.transaction_id) && <Check className="h-3 w-3" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="num text-[13px] font-semibold">{formatKobo(receipt.amount_kobo)}</p>
                          <StatusPill status={receipt.sync_status} />
                        </div>
                        <p className="mt-0.5 truncate text-[9.5px] text-text-2">
                          {receipt.merchant_name} · seq {receipt.seq_no} · {shortId(receipt.transaction_id, 14, 4)}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-brand">
                        <ShieldCheck className="h-2.5 w-2.5" /> Sig valid
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card animate-rise">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle title="Settlement ledger" />
              <span className="text-[9.5px] text-text-3">{ledger.length} records</span>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-3" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tx / merchant / OAC"
                className="h-10 w-full rounded-xl border border-line bg-raised pl-9 pr-3 text-[11px] outline-none placeholder:text-text-3 focus:border-brand/50"
              />
            </div>
            {ledger.length === 0 ? (
              <EmptyState
                icon={<Search className="h-5 w-5" />}
                title="No settlements yet"
                description="Relayed receipts appear here with their clearing reference."
              />
            ) : (
              <div className="scrollbar-thin mt-3 max-h-[360px] divide-y divide-line overflow-y-auto pr-1">
                {ledger.map((receipt) => (
                  <div key={receipt.transaction_id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="num text-[12.5px] font-semibold">{formatKobo(receipt.amount_kobo, { decimals: false })}</p>
                      <StatusPill status={receipt.sync_status} />
                    </div>
                    <p className="mt-1 truncate text-[9.5px] text-text-2">{receipt.merchant_name}</p>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[8.5px] text-text-3">
                      <span className="num truncate">{shortId(receipt.transaction_id, 16, 4)}</span>
                      <span className="num shrink-0">{receipt.clearing_ref ?? (receipt.settled_at ? shortDate(receipt.settled_at) : '—')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card animate-rise">
            <SectionTitle title="Node monitor" />
            <div className="mt-3 space-y-2">
              {[
                { label: 'Connectivity', value: online ? 'Online' : 'Offline', good: online },
                { label: 'Core mode', value: mode === 'live' ? 'Live' : 'Simulated', accent: mode !== 'live' },
                { label: 'Last relay', value: lastRelay?.settled_at ? shortDate(lastRelay.settled_at) : '—' },
                { label: 'Node id', value: shortId(identity?.id ?? 'gw_...', 12, 4), mono: true },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-raised px-3 py-2.5">
                  <span className="text-[10.5px] text-text-2">{row.label}</span>
                  <span className={cn('text-[10.5px] font-semibold', row.good && 'text-brand', row.accent && 'text-rift-fg', row.mono && 'num')}>{row.value}</span>
                </div>
              ))}
            </div>
            <Notice tone="info" className="mt-3">
              Offline receipts are authorisations, not settlement. Value moves only when Core confirms a relay.
            </Notice>
          </section>
        </div>
      </div>

      <Scanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(token) => {
          setScanOpen(false);
          handleToken(token);
        }}
        title="Scan merchant batch QR"
      />
    </TerminalShell>
  );
}
