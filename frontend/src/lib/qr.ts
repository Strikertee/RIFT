import { base64UrlDecode, base64UrlEncode, deriveTransactionId, isoNow, randomHex, signCanonical, verifyCanonical } from './crypto';
import type { AllocationRecord, AuthBundle, Invoice, OacToken, TxPayload } from '../types';

export const AUTH_PREFIX = 'R1.';

export function makeInvoice(merchantId: string, amountKobo: number): Invoice {
  return {
    t: 'INV',
    m: merchantId,
    a: amountKobo,
    c: 'NGN',
    n: `inv_${randomHex(10)}`,
    ts: Math.floor(Date.now() / 1000),
  };
}

export function encodeInvoice(invoice: Invoice): string {
  return JSON.stringify(invoice);
}

export function decodeInvoice(token: string): Invoice {
  const parsed = JSON.parse(token) as Partial<Invoice>;
  if (parsed.t !== 'INV') throw new Error('Not an invoice token');
  if (!parsed.m || typeof parsed.a !== 'number' || !parsed.n) throw new Error('Malformed invoice');
  return parsed as Invoice;
}

export function isInvoiceToken(token: string): boolean {
  try {
    return (JSON.parse(token) as { t?: string }).t === 'INV';
  } catch {
    return false;
  }
}

export function oacPayload(oac: Omit<OacToken, 'issuer_signature_hex'>) {
  return {
    allocated_amount_kobo: oac.allocated_amount_kobo,
    currency: oac.currency,
    customer_id: oac.customer_id,
    customer_pubkey_hex: oac.customer_pubkey_hex,
    expires_at: oac.expires_at,
    issued_at: oac.issued_at,
    issuer_key_version: oac.issuer_key_version,
    oac_id: oac.oac_id,
  };
}

export function txPayload(input: Omit<TxPayload, 'currency'> & { currency?: 'NGN' }): TxPayload {
  return {
    amount_kobo: input.amount_kobo,
    currency: input.currency ?? 'NGN',
    customer_timestamp: input.customer_timestamp,
    invoice_nonce: input.invoice_nonce,
    merchant_id: input.merchant_id,
    oac_id: input.oac_id,
    seq_no: input.seq_no,
  };
}

export function createAuthBundle(
  allocation: AllocationRecord,
  invoice: Invoice,
  amountKobo: number,
  customerId: string,
  customerPrivateKeyHex: string,
): AuthBundle {
  const seqNo = allocation.seq_no_counter + 1;
  const tx = txPayload({
    amount_kobo: amountKobo,
    customer_timestamp: Math.floor(Date.now() / 1000),
    invoice_nonce: invoice.n,
    merchant_id: invoice.m,
    oac_id: allocation.oac.oac_id,
    seq_no: seqNo,
  });
  const signature = signCanonical(tx, customerPrivateKeyHex);
  return {
    v: 1,
    tx,
    customer_pubkey_hex: allocation.oac.customer_pubkey_hex,
    customer_signature_hex: signature,
    transaction_id: deriveTransactionId(allocation.oac.oac_id, seqNo, invoice.n),
    oac_token: allocation.oac,
  };
}

export function encodeAuth(bundle: AuthBundle): string {
  return AUTH_PREFIX + base64UrlEncode(JSON.stringify(bundle));
}

export function decodeAuth(token: string): AuthBundle {
  const trimmed = token.trim();
  let json: string;
  if (trimmed.startsWith(AUTH_PREFIX)) json = base64UrlDecode(trimmed.slice(AUTH_PREFIX.length));
  else if (trimmed.startsWith('{')) json = trimmed;
  else throw new Error('MALFORMED_TOKEN');
  const bundle = JSON.parse(json) as AuthBundle;
  if (!bundle?.tx || !bundle?.oac_token || !bundle.customer_signature_hex) {
    throw new Error('MALFORMED_TOKEN');
  }
  return bundle;
}

export function isAuthToken(token: string): boolean {
  const trimmed = token.trim();
  return trimmed.startsWith(AUTH_PREFIX) || (trimmed.startsWith('{') && trimmed.includes('oac_token'));
}

export interface VerificationInput {
  bundle: AuthBundle;
  expectedMerchantId?: string;
  expectedAmountKobo?: number;
  expectedNonce?: string;
  issuerPublicKeyHex: string;
  invoiceConsumed?: boolean;
  lastSeqNo?: number;
}

export type VerificationResult =
  | { ok: true; transactionId: string }
  | { ok: false; reason: string };

export function verifyAuthorisation(input: VerificationInput): VerificationResult {
  const { bundle, issuerPublicKeyHex } = input;
  const oac = bundle.oac_token;
  const tx = bundle.tx;

  if (!oac?.oac_id || !oac.customer_pubkey_hex || !bundle.customer_signature_hex) {
    return { ok: false, reason: 'MALFORMED_TOKEN' };
  }
  if (oac.customer_pubkey_hex !== bundle.customer_pubkey_hex) {
    return { ok: false, reason: 'CUSTOMER_PUBKEY_MISMATCH' };
  }
  if (!verifyCanonical(oacPayload(oac), oac.issuer_signature_hex, issuerPublicKeyHex)) {
    return { ok: false, reason: 'INVALID_ISSUER_OAC_SIGNATURE' };
  }
  if (new Date(oac.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: 'OAC_EXPIRED' };
  }
  if (input.expectedMerchantId && tx.merchant_id !== input.expectedMerchantId) {
    return { ok: false, reason: 'MERCHANT_MISMATCH' };
  }
  if (typeof input.expectedAmountKobo === 'number' && tx.amount_kobo !== input.expectedAmountKobo) {
    return { ok: false, reason: 'AMOUNT_MISMATCH' };
  }
  if (input.expectedNonce && tx.invoice_nonce !== input.expectedNonce) {
    return { ok: false, reason: 'NONCE_MISMATCH' };
  }
  const expectedId = deriveTransactionId(tx.oac_id, tx.seq_no, tx.invoice_nonce);
  if (expectedId !== bundle.transaction_id) {
    return { ok: false, reason: 'TRANSACTION_ID_MISMATCH' };
  }
  if (tx.amount_kobo <= 0 || tx.amount_kobo > oac.allocated_amount_kobo) {
    return { ok: false, reason: 'AMOUNT_EXCEEDS_OAC' };
  }
  if (!Number.isInteger(tx.customer_timestamp) || tx.customer_timestamp <= 0) {
    return { ok: false, reason: 'INVALID_CUSTOMER_TIMESTAMP' };
  }
  if (tx.customer_timestamp > Math.floor(Date.now() / 1000) + 300) {
    return { ok: false, reason: 'INVALID_CUSTOMER_TIMESTAMP' };
  }
  if (input.invoiceConsumed) return { ok: false, reason: 'INVOICE_ALREADY_CONSUMED' };
  if (typeof input.lastSeqNo === 'number' && tx.seq_no <= input.lastSeqNo) {
    return { ok: false, reason: 'SEQ_ROLLBACK' };
  }
  if (!verifyCanonical(tx, bundle.customer_signature_hex, bundle.customer_pubkey_hex)) {
    return { ok: false, reason: 'INVALID_CUSTOMER_SIGNATURE' };
  }
  return { ok: true, transactionId: bundle.transaction_id };
}

export function newOac(input: {
  oacId: string;
  customerId: string;
  customerPubkeyHex: string;
  amountKobo: number;
  issuerPrivateKeyHex: string;
  keyVersion?: string;
  issuedAt?: string;
  expiresAt?: string;
}): OacToken {
  const issuedAt = input.issuedAt ?? isoNow();
  const expiresAt = input.expiresAt ?? isoNow(new Date(Date.now() + 6 * 60 * 60 * 1000));
  const unsigned = {
    oac_id: input.oacId,
    customer_id: input.customerId,
    customer_pubkey_hex: input.customerPubkeyHex,
    allocated_amount_kobo: input.amountKobo,
    currency: 'NGN' as const,
    issued_at: issuedAt,
    expires_at: expiresAt,
    issuer_key_version: input.keyVersion ?? 'v1',
  };
  return {
    ...unsigned,
    issuer_signature_hex: signCanonical(oacPayload(unsigned), input.issuerPrivateKeyHex),
  };
}
