export type Role = 'customer' | 'merchant' | 'gateway';
export type Mode = 'live' | 'demo' | 'checking';

export interface Identity {
  role: Role;
  id: string;
  displayName: string;
  phone: string;
  publicKeyHex: string;
  privateKeyHex: string;
  merchantCode?: string;
  backendUserId?: string;
  accountNumber?: string;
  businessName?: string;
  mockBalanceKobo?: number;
}

export interface OacToken {
  oac_id: string;
  customer_id: string;
  customer_pubkey_hex: string;
  allocated_amount_kobo: number;
  currency: 'NGN';
  issued_at: string;
  expires_at: string;
  issuer_key_version: string;
  issuer_signature_hex: string;
}

export type AllocationStatus = 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'REVOKED';

export interface AllocationRecord {
  oac: OacToken;
  spent_amount_kobo: number;
  seq_no_counter: number;
  status: AllocationStatus;
  created_at: string;
  mode: 'live' | 'demo';
}

export interface Invoice {
  t: 'INV';
  m: string;
  a: number;
  c: 'NGN';
  n: string;
  ts: number;
}

export interface StoredInvoice extends Invoice {
  consumed_at?: string;
  merchant_name: string;
}

export interface TxPayload {
  amount_kobo: number;
  currency: 'NGN';
  customer_timestamp: number;
  invoice_nonce: string;
  merchant_id: string;
  oac_id: string;
  seq_no: number;
}

export interface AuthBundle {
  v: 1;
  tx: TxPayload;
  customer_pubkey_hex: string;
  customer_signature_hex: string;
  transaction_id: string;
  oac_token: OacToken;
}

export type SyncStatus =
  | 'PENDING_RELAY'
  | 'CRYPTO_VALIDATED'
  | 'RELAYED'
  | 'SETTLED (SIMULATED)'
  | 'QUARANTINED_COLLISION'
  | 'REJECTED_INVALID_SIG'
  | 'REJECTED_OVERSPEND'
  | 'REJECTED_DUPLICATE'
  | 'IDEMPOTENT_REPLAY'
  | 'FAILED';

export interface Receipt {
  transaction_id: string;
  merchant_id: string;
  merchant_name: string;
  amount_kobo: number;
  currency: 'NGN';
  seq_no: number;
  oac_id: string;
  invoice_nonce: string;
  customer_timestamp: number;
  customer_pubkey_hex: string;
  customer_signature_hex: string;
  oac_token: OacToken;
  sync_status: SyncStatus;
  created_at: string;
  settled_at?: string;
  clearing_ref?: string;
  rejection_reason?: string;
  validation_result?: string;
  mode: 'live' | 'demo';
}

export interface BankTx {
  id: string;
  title: string;
  subtitle: string;
  amount_kobo: number;
  kind: 'in' | 'out' | 'rift';
  icon?: string;
}

export interface RiftActivity {
  id: string;
  title: string;
  subtitle: string;
  amount_kobo: number;
  kind: 'lock' | 'spend' | 'settle' | 'return';
  at: string;
}

export interface BankState {
  availableKobo: number;
  reservedKobo: number;
  transactions: BankTx[];
  riftActivity: RiftActivity[];
}

export interface Prefs {
  theme: 'dark' | 'light';
  hideBalance: boolean;
  sound: boolean;
  notifications: boolean;
}

export interface RelayResult {
  transaction_id: string;
  status: SyncStatus;
  validation_result: string;
  simulated_clearing_reference?: string;
  settled_at?: string;
  rejection_reason?: string;
}

export interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info' | 'rift';
  message: string;
}

export interface HealthResponse {
  status: string;
  environment: string;
  version: string;
  timestamp: string;
  database: string;
  issuer_key_loaded: boolean;
  issuer_pubkey_hex: string;
}
