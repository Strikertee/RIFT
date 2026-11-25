export const LS = {
  role: 'devions-role-v1',
  prefs: 'devions-bank-prefs-v1',
  bank: 'devions-bank-state-v1',
  demoIssuer: 'devions-demo-issuer-v1',
  demoCore: 'devions-demo-core-v1',
  identities: 'devions-identities-v1',
  allocations: 'devions-allocations-v1',
  invoices: 'devions-invoices-v1',
  outbox: 'devions-outbox-v1',
  activity: 'devions-rift-activity-v1',
  lastAuth: 'devions-last-auth-v1',
  lastBatch: 'devions-last-batch-v1',
  mode: 'devions-mode-v1',
  modeAt: 'devions-mode-at-v1',
  liveIssuerPub: 'devions-live-issuer-pub-v1',
} as const;

export function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveLS(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / private mode — non-fatal */
  }
}

export function removeLS(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* non-fatal */
  }
}

export function wipeDemo(): void {
  for (const key of Object.values(LS)) {
    if (key === LS.role || key === LS.prefs) continue;
    removeLS(key);
  }
}
