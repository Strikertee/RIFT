import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AllocationRecord,
  AuthBundle,
  BankState,
  HealthResponse,
  Identity,
  Invoice,
  Mode,
  Prefs,
  Receipt,
  RelayResult,
  RiftActivity,
  Role,
  StoredInvoice,
} from '../types';
import { generateKeyPair, isoNow, randomHex, randomId } from '../lib/crypto';
import { decodeAuth, decodeInvoice, encodeAuth, makeInvoice, verifyAuthorisation } from '../lib/qr';
import { LS, loadLS, removeLS, saveLS, wipeDemo } from '../lib/storage';
import { demoIssueOac, demoRelay, demoSpentFor, getDemoIssuer } from '../lib/demo-core';
import { ApiError, getAllocation, getHealth, issueAllocation, register, relayTransactions } from '../lib/api';
import { shortId } from '../lib/format';
import { useToast } from './ToastContext';

export const OFFLINE_CAP_KOBO = 5_000_000;
export const START_BALANCE_KOBO = 5_000_000;

interface AppContextValue {
  role: Role | null;
  setRole: (role: Role) => void;
  leaveRole: () => void;
  mode: Mode;
  health: HealthResponse | null;
  ready: boolean;
  identity: Identity | null;
  identities: Record<Role, Identity>;
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  bank: BankState;
  allocations: AllocationRecord[];
  allocation: AllocationRecord | null;
  invoices: StoredInvoice[];
  outbox: Receipt[];
  activity: RiftActivity[];
  lastAuth: AuthBundle | null;
  lastBatch: string;
  capRemainingKobo: number;
  offlineAvailableKobo: number;
  online: boolean;
  issuerPublicKeys: string[];
  lockFunds: (amountKobo: number) => Promise<void>;
  signPayment: (invoice: Invoice, amountKobo: number) => Promise<AuthBundle>;
  createInvoice: (amountKobo: number) => StoredInvoice;
  acceptToken: (token: string) => Promise<Receipt>;
  relay: (onlyIds?: string[]) => Promise<RelayResult[]>;
  ingestBatch: (json: string) => number;
  exportBatch: () => { json: string; count: number };
  reconcile: () => Promise<void>;
  returnToOnline: () => Promise<void>;
  resetDemo: () => void;
  refreshMode: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function phoneFor(role: Role): string {
  const prefix = role === 'merchant' ? '+23481' : '+23480';
  return prefix + randomHex(8).replace(/[a-f]/g, (c) => String((c.charCodeAt(0) - 87) % 10));
}

function makeIdentity(role: Role): Identity {
  const pair = generateKeyPair();
  if (role === 'customer') {
    return {
      role,
      id: `usr_${randomId()}`,
      displayName: 'Treasure B. Okafor',
      phone: phoneFor(role),
      publicKeyHex: pair.publicKeyHex,
      privateKeyHex: pair.privateKeyHex,
      accountNumber: '0123454771',
    };
  }
  if (role === 'merchant') {
    const id = `mch_${randomId()}`;
    return {
      role,
      id,
      displayName: 'Mama Nkechi Foods',
      businessName: 'Mama Nkechi Foods',
      phone: phoneFor(role),
      publicKeyHex: pair.publicKeyHex,
      privateKeyHex: pair.privateKeyHex,
      merchantCode: id,
      accountNumber: '0223456789',
    };
  }
  return {
    role,
    id: `gw_${randomHex(10)}`,
    displayName: 'Gateway 01',
    phone: '+2348099990000',
    publicKeyHex: pair.publicKeyHex,
    privateKeyHex: pair.privateKeyHex,
  };
}

function loadIdentities(): Record<Role, Identity> {
  const saved = loadLS<Partial<Record<Role, Identity>>>(LS.identities, {});
  const next: Record<Role, Identity> = {
    customer: saved.customer?.publicKeyHex ? saved.customer : makeIdentity('customer'),
    merchant: saved.merchant?.publicKeyHex ? saved.merchant : makeIdentity('merchant'),
    gateway: saved.gateway?.publicKeyHex ? saved.gateway : makeIdentity('gateway'),
  };
  saveLS(LS.identities, next);
  return next;
}

function initialBank(): BankState {
  const now = Date.now();
  const day = 86_400_000;
  return {
    availableKobo: START_BALANCE_KOBO,
    reservedKobo: 0,
    transactions: [
      { id: 'bt_1', title: 'Transfer to Ada O.', subtitle: 'Today, 09:41', amount_kobo: 850_000, kind: 'out' },
      { id: 'bt_2', title: 'Payment received', subtitle: 'Yesterday, 16:20', amount_kobo: 2_500_000, kind: 'in' },
      { id: 'bt_3', title: 'Electricity — IKEDC', subtitle: '18 Nov, 08:15', amount_kobo: 420_000, kind: 'out' },
      { id: 'bt_4', title: 'Offline payment — Mama Nkechi', subtitle: '17 Nov, 13:02', amount_kobo: 180_000, kind: 'rift' },
      { id: 'bt_5', title: 'Airtime — MTN', subtitle: '16 Nov, 19:44', amount_kobo: 100_000, kind: 'out' },
    ],
    riftActivity: [
      {
        id: 'ra_1',
        title: 'Offline payment — Mama Nkechi',
        subtitle: '17 Nov, 13:02',
        amount_kobo: 180_000,
        kind: 'spend',
        at: new Date(now - day * 2).toISOString(),
      },
      {
        id: 'ra_2',
        title: 'Returned to online balance',
        subtitle: '17 Nov, 18:40',
        amount_kobo: 820_000,
        kind: 'return',
        at: new Date(now - day * 2 + 20_000_000).toISOString(),
      },
    ],
  };
}

function loadBank(): BankState {
  const saved = loadLS<BankState | null>(LS.bank, null);
  if (saved?.transactions && typeof saved.availableKobo === 'number') return saved;
  return initialBank();
}

function loadPrefs(): Prefs {
  return loadLS<Prefs>(LS.prefs, {
    theme: 'dark',
    hideBalance: false,
    sound: true,
    notifications: true,
  });
}

function applyTheme(theme: Prefs['theme']) {
  const root = document.documentElement;
  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark', theme === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F3F1EA' : '#0A0F0D');
}

async function registerIdentity(candidate: Identity): Promise<Identity> {
  let current = candidate;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await register({
        user_type: current.role === 'merchant' ? 'MERCHANT' : 'CUSTOMER',
        display_name: current.role === 'merchant' ? current.businessName || current.displayName : current.displayName,
        phone_number: current.phone,
        public_key_hex: current.publicKeyHex,
        business_name: current.role === 'merchant' ? current.businessName || current.displayName : undefined,
      });
      return {
        ...current,
        id: res.user_id,
        backendUserId: res.user_id,
        accountNumber: res.mock_account_number,
        merchantCode: current.role === 'merchant' ? res.user_id : current.merchantCode,
        mockBalanceKobo: res.mock_balance_kobo,
      };
    } catch (err) {
      const conflict = err instanceof ApiError && err.status === 409;
      if (!conflict || attempt > 0) throw err;
      const pair = generateKeyPair();
      current = { ...current, ...pair, phone: phoneFor(current.role) };
    }
  }
  throw new Error('Registration failed');
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { pushToast } = useToast();
  const [role, setRoleState] = useState<Role | null>(() => loadLS<Role | null>(LS.role, null));
  const [mode, setMode] = useState<Mode>('checking');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [identities, setIdentities] = useState<Record<Role, Identity>>(loadIdentities);
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [bank, setBank] = useState<BankState>(loadBank);
  const [allocations, setAllocations] = useState<AllocationRecord[]>(() =>
    loadLS<AllocationRecord[]>(LS.allocations, []),
  );
  const [invoices, setInvoices] = useState<StoredInvoice[]>(() => loadLS<StoredInvoice[]>(LS.invoices, []));
  const [outbox, setOutbox] = useState<Receipt[]>(() => loadLS<Receipt[]>(LS.outbox, []));
  const [activity, setActivity] = useState<RiftActivity[]>(() => loadLS<RiftActivity[]>(LS.activity, []));
  const [lastAuth, setLastAuth] = useState<AuthBundle | null>(() => loadLS<AuthBundle | null>(LS.lastAuth, null));
  const [lastBatch, setLastBatch] = useState<string>(() => loadLS<string>(LS.lastBatch, ''));
  const [liveIssuerPub, setLiveIssuerPub] = useState<string>(() => loadLS<string>(LS.liveIssuerPub, ''));
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const booted = useRef(false);
  const roleRef = useRef<Role | null>(role);
  const relayRef = useRef<((ids?: string[]) => Promise<RelayResult[]>) | null>(null);

  const demoIssuerPub = useMemo(() => getDemoIssuer().publicKeyHex, []);
  const issuerPublicKeys = useMemo(
    () => Array.from(new Set([liveIssuerPub, demoIssuerPub].filter(Boolean))),
    [liveIssuerPub, demoIssuerPub],
  );

  useEffect(() => saveLS(LS.identities, identities), [identities]);
  useEffect(() => saveLS(LS.bank, bank), [bank]);
  useEffect(() => saveLS(LS.allocations, allocations), [allocations]);
  useEffect(() => saveLS(LS.invoices, invoices), [invoices]);
  useEffect(() => saveLS(LS.outbox, outbox), [outbox]);
  useEffect(() => saveLS(LS.activity, activity), [activity]);
  useEffect(() => saveLS(LS.lastAuth, lastAuth), [lastAuth]);
  useEffect(() => saveLS(LS.lastBatch, lastBatch), [lastBatch]);
  useEffect(() => saveLS(LS.prefs, prefs), [prefs]);
  useEffect(() => applyTheme(prefs.theme), [prefs.theme]);
  useEffect(() => {
    roleRef.current = role;
    if (role) saveLS(LS.role, role);
  }, [role]);

  const identity = role ? identities[role] : null;

  const now = Date.now();
  const liveAllocations = allocations.filter(
    (a) =>
      a.status !== 'REVOKED' &&
      a.status !== 'EXPIRED' &&
      new Date(a.oac.expires_at).getTime() > now,
  );
  const allocation =
    liveAllocations
      .filter((a) => a.spent_amount_kobo < a.oac.allocated_amount_kobo)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
  const offlineAvailableKobo = liveAllocations.reduce(
    (sum, a) => sum + Math.max(0, a.oac.allocated_amount_kobo - a.spent_amount_kobo),
    0,
  );
  const capRemainingKobo = Math.max(
    0,
    OFFLINE_CAP_KOBO - liveAllocations.reduce((sum, a) => sum + a.oac.allocated_amount_kobo, 0),
  );

  const addActivity = useCallback((entry: Omit<RiftActivity, 'id' | 'at'> & { at?: string }) => {
    setActivity((current) =>
      [
        {
          id: `ra_${randomHex(8)}`,
          at: entry.at ?? new Date().toISOString(),
          title: entry.title,
          subtitle: entry.subtitle,
          amount_kobo: entry.amount_kobo,
          kind: entry.kind,
        },
        ...current,
      ].slice(0, 40),
    );
  }, []);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState((current) => ({ ...current, ...patch }));
  }, []);

  const probe = useCallback(async (): Promise<{ mode: Mode; health: HealthResponse | null }> => {
    try {
      const h = await getHealth();
      if (h.issuer_key_loaded) {
        saveLS(LS.liveIssuerPub, h.issuer_pubkey_hex);
        setLiveIssuerPub(h.issuer_pubkey_hex);
        return { mode: 'live', health: h };
      }
      return { mode: 'demo', health: h };
    } catch {
      return { mode: 'demo', health: null };
    }
  }, []);

  // Boot: detect Core, then bind both edge identities so the customer's demo invoice
  // always references the merchant id the merchant will actually use.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    let cancelled = false;

    (async () => {
      const probed = await probe();
      if (cancelled) return;
      setHealth(probed.health);
      let nextMode = probed.mode;

      if (nextMode === 'live') {
        let current = loadIdentities();
        try {
          for (const r of ['customer', 'merchant'] as const) {
            if (!current[r].backendUserId) {
              current = { ...current, [r]: await registerIdentity(current[r]) };
              if (cancelled) return;
              setIdentities(current);
              saveLS(LS.identities, current);
            }
          }
          const customer = current.customer;
          if (typeof customer.mockBalanceKobo === 'number') {
            setBank((b) => ({ ...b, availableKobo: customer.mockBalanceKobo ?? b.availableKobo }));
          }
        } catch {
          nextMode = 'demo';
          pushToast('Core registration unavailable — simulated core active.', 'info');
        }
      }

      if (cancelled) return;
      setMode(nextMode);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [probe, pushToast]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      pushToast('Back online — relay is available.', 'info');
      if (roleRef.current === 'merchant' || roleRef.current === 'gateway') {
        window.setTimeout(() => {
          relayRef.current?.().catch(() => undefined);
        }, 1400);
      }
    };
    const handleOffline = () => {
      setOnline(false);
      pushToast('Offline — QR payments still work.', 'rift');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pushToast]);

  const setRole = useCallback(
    (next: Role) => {
      setRoleState(next);
      const candidate = identities[next];
      if (mode === 'live' && next !== 'gateway' && !candidate.backendUserId) {
        registerIdentity(candidate)
          .then((updated) => {
            setIdentities((current) => {
              const merged = { ...current, [next]: updated };
              saveLS(LS.identities, merged);
              return merged;
            });
          })
          .catch(() => {
            setMode('demo');
            pushToast('Core registration failed — simulated core active.', 'info');
          });
      }
    },
    [identities, mode, pushToast],
  );

  const leaveRole = useCallback(() => {
    setRoleState(null);
    removeLS(LS.role);
  }, []);

  const demoLock = useCallback(
    (amountKobo: number) => {
      const customer = identities.customer;
      const oac = demoIssueOac(customer, amountKobo, bank.availableKobo, capRemainingKobo);
      const record: AllocationRecord = {
        oac,
        spent_amount_kobo: 0,
        seq_no_counter: 0,
        status: 'ACTIVE',
        created_at: isoNow(),
        mode: 'demo',
      };
      setAllocations((current) => [record, ...current]);
      setBank((current) => ({
        ...current,
        availableKobo: current.availableKobo - amountKobo,
        reservedKobo: current.reservedKobo + amountKobo,
      }));
      addActivity({
        title: 'Locked for offline spending',
        subtitle: `OAC ${shortId(oac.oac_id, 16, 4)}`,
        amount_kobo: amountKobo,
        kind: 'lock',
      });
    },
    [identities.customer, bank.availableKobo, capRemainingKobo, addActivity],
  );

  const lockFunds = useCallback(
    async (amountKobo: number) => {
      if (amountKobo <= 0) throw new Error('Enter an amount to lock.');
      if (!Number.isInteger(amountKobo)) throw new Error('Amount must be whole kobo.');
      if (amountKobo > capRemainingKobo) {
        throw new Error('Amount exceeds your remaining offline allocation limit.');
      }
      if (amountKobo > bank.availableKobo) {
        throw new Error('Amount exceeds your available online balance.');
      }

      if (mode === 'live') {
        try {
          const res = await issueAllocation(identities.customer.id, amountKobo);
          const record: AllocationRecord = {
            oac: {
              oac_id: res.oac_id,
              customer_id: res.customer_id,
              customer_pubkey_hex: res.customer_pubkey_hex,
              allocated_amount_kobo: res.allocated_amount_kobo,
              currency: res.currency,
              issued_at: res.issued_at,
              expires_at: res.expires_at,
              issuer_key_version: res.issuer_key_version,
              issuer_signature_hex: res.issuer_signature_hex,
            },
            spent_amount_kobo: 0,
            seq_no_counter: 0,
            status: 'ACTIVE',
            created_at: isoNow(),
            mode: 'live',
          };
          setAllocations((current) => [record, ...current]);
          setBank((current) => ({
            ...current,
            availableKobo: res.available_balance_kobo,
            reservedKobo: res.reserved_balance_kobo,
          }));
          addActivity({
            title: 'Locked for offline spending',
            subtitle: `OAC ${shortId(res.oac_id, 16, 4)}`,
            amount_kobo: amountKobo,
            kind: 'lock',
          });
          pushToast(`₦${(amountKobo / 100).toLocaleString()} locked — allocation certificate signed.`);
          return;
        } catch (err) {
          if (err instanceof ApiError && [400, 401, 403, 409, 422].includes(err.status)) {
            throw new Error(err.message);
          }
          setMode('demo');
          pushToast('Core unreachable — using the simulated issuer for this lock.', 'info');
        }
      }

      demoLock(amountKobo);
      pushToast(`₦${(amountKobo / 100).toLocaleString()} locked — allocation certificate signed.`);
    },
    [mode, identities.customer, capRemainingKobo, bank.availableKobo, addActivity, pushToast, demoLock],
  );

  const createInvoice = useCallback(
    (amountKobo: number): StoredInvoice => {
      if (amountKobo <= 0) throw new Error('Enter an invoice amount.');
      const merchant = identities.merchant;
      const invoice = makeInvoice(merchant.id, amountKobo);
      const stored: StoredInvoice = {
        ...invoice,
        merchant_name: merchant.businessName || merchant.displayName,
      };
      setInvoices((current) => [stored, ...current.filter((i) => i.n !== invoice.n)].slice(0, 100));
      return stored;
    },
    [identities.merchant],
  );

  const signPayment = useCallback(
    async (invoice: Invoice, amountKobo: number): Promise<AuthBundle> => {
      const active = allocation;
      if (!active) throw new Error('Lock funds before spending offline.');
      const remaining = active.oac.allocated_amount_kobo - active.spent_amount_kobo;
      if (amountKobo <= 0) throw new Error('Enter an amount to pay.');
      if (amountKobo > remaining) throw new Error('Invoice exceeds your remaining offline allocation.');

      const { createAuthBundle } = await import('../lib/qr');
      const bundle = createAuthBundle(
        active,
        invoice,
        amountKobo,
        identities.customer.id,
        identities.customer.privateKeyHex,
      );

      setAllocations((current) =>
        current.map((a) => {
          if (a.oac.oac_id !== active.oac.oac_id) return a;
          const spent = a.spent_amount_kobo + amountKobo;
          return {
            ...a,
            spent_amount_kobo: spent,
            seq_no_counter: bundle.tx.seq_no,
            status: spent >= a.oac.allocated_amount_kobo ? 'EXHAUSTED' : 'ACTIVE',
          };
        }),
      );

      const stored: StoredInvoice = {
        ...invoice,
        merchant_name:
          invoice.m === identities.merchant.id
            ? identities.merchant.businessName || identities.merchant.displayName
            : 'Merchant terminal',
      };
      setInvoices((current) => [stored, ...current.filter((i) => i.n !== invoice.n)].slice(0, 100));
      setLastAuth(bundle);
      addActivity({
        title: `Offline payment — ${stored.merchant_name}`,
        subtitle: `Seq ${bundle.tx.seq_no} · ${bundle.transaction_id.slice(0, 14)}…`,
        amount_kobo: amountKobo,
        kind: 'spend',
      });
      return bundle;
    },
    [allocation, identities.customer, identities.merchant, addActivity],
  );

  const detectBundleMode = useCallback(
    (bundle: AuthBundle): 'live' | 'demo' => {
      if (liveIssuerPub) {
        const live = verifyAuthorisation({ bundle, issuerPublicKeyHex: liveIssuerPub });
        if (live.ok) return 'live';
      }
      return 'demo';
    },
    [liveIssuerPub],
  );

  const acceptToken = useCallback(
    async (token: string): Promise<Receipt> => {
      const bundle = decodeAuth(token);
      const invoice = invoices.find((i) => i.n === bundle.tx.invoice_nonce);
      if (!invoice) throw new Error('INVOICE_NOT_FOUND');
      const lastSeqNo = outbox
        .filter((r) => r.oac_id === bundle.tx.oac_id)
        .reduce((max, r) => Math.max(max, r.seq_no), 0);

      let verification: { ok: true; transactionId: string } | { ok: false; reason: string } = {
        ok: false,
        reason: 'ISSUER_KEY_UNAVAILABLE',
      };
      for (const key of issuerPublicKeys) {
        const result = verifyAuthorisation({
          bundle,
          issuerPublicKeyHex: key,
          expectedMerchantId: invoice.m,
          expectedAmountKobo: invoice.a,
          expectedNonce: invoice.n,
          invoiceConsumed: Boolean(invoice.consumed_at),
          lastSeqNo,
        });
        if (result.ok) {
          verification = result;
          break;
        }
        verification = result;
      }
      if (!verification.ok) throw new Error(verification.reason);

      const receipt: Receipt = {
        transaction_id: bundle.transaction_id,
        merchant_id: bundle.tx.merchant_id,
        merchant_name: invoice.merchant_name || identities.merchant.displayName,
        amount_kobo: bundle.tx.amount_kobo,
        currency: bundle.tx.currency,
        seq_no: bundle.tx.seq_no,
        oac_id: bundle.tx.oac_id,
        invoice_nonce: bundle.tx.invoice_nonce,
        customer_timestamp: bundle.tx.customer_timestamp,
        customer_pubkey_hex: bundle.customer_pubkey_hex,
        customer_signature_hex: bundle.customer_signature_hex,
        oac_token: bundle.oac_token,
        sync_status: 'PENDING_RELAY',
        created_at: isoNow(),
        mode: detectBundleMode(bundle),
      };

      setOutbox((current) =>
        current.some((r) => r.transaction_id === receipt.transaction_id)
          ? current
          : [receipt, ...current],
      );
      setInvoices((current) =>
        current.map((i) => (i.n === invoice.n ? { ...i, consumed_at: isoNow() } : i)),
      );
      pushToast('Authorised offline — receipt saved to outbox.');
      return receipt;
    },
    [invoices, outbox, issuerPublicKeys, identities.merchant.displayName, detectBundleMode, pushToast],
  );

  const relay = useCallback(
    async (onlyIds?: string[]): Promise<RelayResult[]> => {
      const pending = outbox.filter(
        (r) =>
          (r.sync_status === 'PENDING_RELAY' || r.sync_status === 'CRYPTO_VALIDATED') &&
          (!onlyIds || onlyIds.includes(r.transaction_id)),
      );
      if (!pending.length) return [];

      const nodeId =
        roleRef.current === 'gateway' ? identities.gateway.id : identities.merchant.id;
      const results: RelayResult[] = [];

      const liveBatch = pending.filter((r) => r.mode === 'live');
      if (liveBatch.length) {
        try {
          const liveResults = await relayTransactions(liveBatch, nodeId);
          results.push(...liveResults);
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'Relay failed';
          results.push(
            ...liveBatch.map((r) => ({
              transaction_id: r.transaction_id,
              status: 'FAILED' as const,
              validation_result: 'FAILED',
              rejection_reason: reason,
            })),
          );
        }
      }

      const demoBatch = pending.filter((r) => r.mode === 'demo');
      if (demoBatch.length) {
        results.push(...demoRelay(demoBatch, demoIssuerPub));
      }

      const byId = new Map(results.map((r) => [r.transaction_id, r]));
      setOutbox((current) =>
        current.map((r) => {
          const result = byId.get(r.transaction_id);
          if (!result) return r;
          return {
            ...r,
            sync_status: result.status,
            clearing_ref: result.simulated_clearing_reference ?? r.clearing_ref,
            settled_at: result.settled_at ?? r.settled_at,
            rejection_reason: result.rejection_reason,
            validation_result: result.validation_result,
          };
        }),
      );

      const settled = results.filter((r) => r.status === 'SETTLED (SIMULATED)');
      if (settled.length) {
        const amount = settled.reduce((sum, r) => {
          const receipt = pending.find((p) => p.transaction_id === r.transaction_id);
          return sum + (receipt?.amount_kobo ?? 0);
        }, 0);
        setBank((current) => ({
          ...current,
          reservedKobo: Math.max(0, current.reservedKobo - amount),
        }));
        addActivity({
          title: `${settled.length} receipt${settled.length === 1 ? '' : 's'} settled`,
          subtitle: 'Core re-verified signatures and anti-replay',
          amount_kobo: amount,
          kind: 'settle',
        });
      }

      pushToast(
        `${settled.length} settled · ${results.length - settled.length} rejected or replayed`,
        settled.length ? 'success' : 'info',
      );
      return results;
    },
    [outbox, identities.gateway.id, identities.merchant.id, demoIssuerPub, addActivity, pushToast],
  );
  relayRef.current = relay;

  const ingestBatch = useCallback(
    (json: string): number => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error('Paste a valid receipt batch JSON.');
      }
      const entries = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { receipts?: unknown[] }).receipts)
          ? (parsed as { receipts: unknown[] }).receipts
          : [];
      if (!entries.length) throw new Error('No receipts found in this batch.');

      let added = 0;
      setOutbox((current) => {
        const next = [...current];
        for (const raw of entries) {
          const entry = raw as Partial<Receipt>;
          if (!entry.transaction_id || !entry.oac_token || !entry.customer_signature_hex) continue;
          if (next.some((r) => r.transaction_id === entry.transaction_id)) continue;
          const bundle = {
            v: 1 as const,
            tx: {
              amount_kobo: entry.amount_kobo ?? 0,
              currency: 'NGN' as const,
              customer_timestamp: entry.customer_timestamp ?? 0,
              invoice_nonce: entry.invoice_nonce ?? '',
              merchant_id: entry.merchant_id ?? '',
              oac_id: entry.oac_id ?? '',
              seq_no: entry.seq_no ?? 0,
            },
            customer_pubkey_hex: entry.customer_pubkey_hex ?? '',
            customer_signature_hex: entry.customer_signature_hex,
            transaction_id: entry.transaction_id,
            oac_token: entry.oac_token,
          };
          next.unshift({
            ...(entry as Receipt),
            merchant_name: entry.merchant_name || 'Merchant terminal',
            sync_status: 'PENDING_RELAY',
            created_at: entry.created_at ?? isoNow(),
            mode: detectBundleMode(bundle),
          });
          added += 1;
        }
        return next;
      });
      return added;
    },
    [detectBundleMode],
  );

  const exportBatch = useCallback((): { json: string; count: number } => {
    const pending = outbox.filter((r) => r.sync_status === 'PENDING_RELAY');
    const json = JSON.stringify(
      {
        format: 'RIFT-BATCH-1',
        exported_at: isoNow(),
        merchant_id: identities.merchant.id,
        receipts: pending,
      },
      null,
      2,
    );
    setLastBatch(json);
    return { json, count: pending.length };
  }, [outbox, identities.merchant.id]);

  const reconcile = useCallback(async () => {
    if (!allocation) throw new Error('No active allocation to reconcile.');
    if (allocation.mode === 'live') {
      const res = await getAllocation(identities.customer.id, allocation.oac.oac_id);
      setAllocations((current) =>
        current.map((a) =>
          a.oac.oac_id === allocation.oac.oac_id
            ? {
                ...a,
                spent_amount_kobo: Math.max(a.spent_amount_kobo, res.spent_amount_kobo),
                status: res.status as AllocationRecord['status'],
              }
            : a,
        ),
      );
      setBank((current) => ({
        ...current,
        availableKobo: res.available_balance_kobo,
        reservedKobo: res.reserved_balance_kobo,
      }));
    } else {
      const spent = demoSpentFor(allocation.oac.oac_id);
      setAllocations((current) =>
        current.map((a) =>
          a.oac.oac_id === allocation.oac.oac_id
            ? {
                ...a,
                spent_amount_kobo: Math.max(a.spent_amount_kobo, spent),
                status:
                  spent >= a.oac.allocated_amount_kobo
                    ? 'EXHAUSTED'
                    : a.status,
              }
            : a,
        ),
      );
    }
    addActivity({
      title: 'Reconciled with Core',
      subtitle: `OAC ${shortId(allocation.oac.oac_id, 16, 4)}`,
      amount_kobo: allocation.oac.allocated_amount_kobo,
      kind: 'settle',
    });
    pushToast('Allocation reconciled.');
  }, [allocation, identities.customer.id, addActivity, pushToast]);

  const returnToOnline = useCallback(async () => {
    if (!allocation) throw new Error('No active allocation.');
    const remaining = allocation.oac.allocated_amount_kobo - allocation.spent_amount_kobo;
    setBank((current) => ({
      ...current,
      availableKobo: current.availableKobo + remaining,
      reservedKobo: Math.max(0, current.reservedKobo - remaining),
    }));
    setAllocations((current) =>
      current.map((a) =>
        a.oac.oac_id === allocation.oac.oac_id ? { ...a, status: 'REVOKED' } : a,
      ),
    );
    addActivity({
      title: 'Returned to online balance',
      subtitle: `OAC ${shortId(allocation.oac.oac_id, 16, 4)}`,
      amount_kobo: remaining,
      kind: 'return',
    });
    pushToast('Unspent allocation returned to online balance (local simulation).', 'info');
  }, [allocation, addActivity, pushToast]);

  const resetDemo = useCallback(() => {
    wipeDemo();
    removeLS(LS.role);
    window.location.reload();
  }, []);

  const refreshMode = useCallback(async () => {
    setMode('checking');
    const probed = await probe();
    setHealth(probed.health);
    setMode(probed.mode);
  }, [probe]);

  const value = useMemo<AppContextValue>(
    () => ({
      role,
      setRole,
      leaveRole,
      mode,
      health,
      ready,
      identity,
      identities,
      prefs,
      setPrefs,
      bank,
      allocations,
      allocation,
      invoices,
      outbox,
      activity,
      lastAuth,
      lastBatch,
      capRemainingKobo,
      offlineAvailableKobo,
      online,
      issuerPublicKeys,
      lockFunds,
      signPayment,
      createInvoice,
      acceptToken,
      relay,
      ingestBatch,
      exportBatch,
      reconcile,
      returnToOnline,
      resetDemo,
      refreshMode,
    }),
    [
      role,
      setRole,
      leaveRole,
      mode,
      health,
      ready,
      identity,
      identities,
      prefs,
      setPrefs,
      bank,
      allocations,
      allocation,
      invoices,
      outbox,
      activity,
      lastAuth,
      lastBatch,
      capRemainingKobo,
      offlineAvailableKobo,
      online,
      issuerPublicKeys,
      lockFunds,
      signPayment,
      createInvoice,
      acceptToken,
      relay,
      ingestBatch,
      exportBatch,
      reconcile,
      returnToOnline,
      resetDemo,
      refreshMode,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
