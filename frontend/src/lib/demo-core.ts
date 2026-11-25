import { randomHex, isoNow, generateKeyPair } from './crypto';
import { newOac, verifyAuthorisation } from './qr';
import type { Identity, OacToken, Receipt, RelayResult, SyncStatus } from '../types';
import { LS, loadLS, saveLS } from './storage';

export interface DemoIssuer {
  publicKeyHex: string;
  privateKeyHex: string;
  keyVersion: string;
}

interface DemoLedger {
  spent: Record<string, number>;
  seqs: Record<string, number[]>;
  txids: string[];
  nonces: string[];
}

const EMPTY_LEDGER: DemoLedger = { spent: {}, seqs: {}, txids: [], nonces: [] };

export function getDemoIssuer(): DemoIssuer {
  const existing = loadLS<DemoIssuer | null>(LS.demoIssuer, null);
  if (existing?.publicKeyHex && existing?.privateKeyHex) return existing;
  const pair = generateKeyPair();
  const issuer: DemoIssuer = { ...pair, keyVersion: 'v1' };
  saveLS(LS.demoIssuer, issuer);
  return issuer;
}

export function getDemoLedger(): DemoLedger {
  return loadLS<DemoLedger>(LS.demoCore, EMPTY_LEDGER);
}

function saveDemoLedger(ledger: DemoLedger) {
  saveLS(LS.demoCore, ledger);
}

export function demoIssueOac(
  customer: Identity,
  amountKobo: number,
  availableKobo: number,
  capRemainingKobo: number,
): OacToken {
  if (amountKobo <= 0) throw new Error('Enter an amount to lock.');
  if (amountKobo > availableKobo) throw new Error('Amount exceeds your available online balance.');
  if (amountKobo > capRemainingKobo) throw new Error('Amount exceeds your remaining offline allocation limit.');
  const issuer = getDemoIssuer();
  const oacId = `oac_${randomHex(24)}`;
  return newOac({
    oacId,
    customerId: customer.id,
    customerPubkeyHex: customer.publicKeyHex,
    amountKobo,
    issuerPrivateKeyHex: issuer.privateKeyHex,
    keyVersion: issuer.keyVersion,
  });
}

export function demoRelay(receipts: Receipt[], issuerPublicKeyHex: string): RelayResult[] {
  const ledger = getDemoLedger();
  const sorted = [...receipts].sort((a, b) => a.seq_no - b.seq_no);
  const results: RelayResult[] = [];

  for (const receipt of sorted) {
    const base = {
      transaction_id: receipt.transaction_id,
      settled_at: undefined as string | undefined,
      simulated_clearing_reference: undefined as string | undefined,
      rejection_reason: undefined as string | undefined,
    };

    if (ledger.txids.includes(receipt.transaction_id)) {
      results.push({ ...base, status: 'IDEMPOTENT_REPLAY', validation_result: 'IDEMPOTENT_REPLAY' });
      continue;
    }

    const bundle = {
      v: 1 as const,
      tx: {
        amount_kobo: receipt.amount_kobo,
        currency: receipt.currency,
        customer_timestamp: receipt.customer_timestamp,
        invoice_nonce: receipt.invoice_nonce,
        merchant_id: receipt.merchant_id,
        oac_id: receipt.oac_id,
        seq_no: receipt.seq_no,
      },
      customer_pubkey_hex: receipt.customer_pubkey_hex,
      customer_signature_hex: receipt.customer_signature_hex,
      transaction_id: receipt.transaction_id,
      oac_token: receipt.oac_token,
    };

    const verification = verifyAuthorisation({ bundle, issuerPublicKeyHex });
    if (!verification.ok) {
      const status: SyncStatus =
        verification.reason === 'OAC_EXPIRED' ? 'REJECTED_OVERSPEND' : 'REJECTED_INVALID_SIG';
      results.push({
        ...base,
        status,
        validation_result: 'INVALID_SIGNATURE',
        rejection_reason: verification.reason,
      });
      continue;
    }

    if ((ledger.seqs[receipt.oac_id] ?? []).includes(receipt.seq_no)) {
      results.push({ ...base, status: 'QUARANTINED_COLLISION', validation_result: 'DUPLICATE_SEQUENCE', rejection_reason: 'OAC_SEQUENCE_CONFLICT' });
      continue;
    }
    if (ledger.nonces.includes(receipt.invoice_nonce)) {
      results.push({ ...base, status: 'REJECTED_DUPLICATE', validation_result: 'DUPLICATE', rejection_reason: 'DUPLICATE_INVOICE_NONCE' });
      continue;
    }
    const spent = ledger.spent[receipt.oac_id] ?? 0;
    if (spent + receipt.amount_kobo > receipt.oac_token.allocated_amount_kobo) {
      results.push({ ...base, status: 'REJECTED_OVERSPEND', validation_result: 'OVERSPEND', rejection_reason: 'OAC_BALANCE_EXHAUSTED' });
      continue;
    }

    const settledAt = isoNow();
    const clearingRef = `SIM-${Date.now().toString(36).toUpperCase()}${randomHex(4).toUpperCase()}`;
    ledger.spent[receipt.oac_id] = spent + receipt.amount_kobo;
    ledger.seqs[receipt.oac_id] = [...(ledger.seqs[receipt.oac_id] ?? []), receipt.seq_no];
    ledger.txids.push(receipt.transaction_id);
    ledger.nonces.push(receipt.invoice_nonce);

    results.push({
      transaction_id: receipt.transaction_id,
      status: 'SETTLED (SIMULATED)',
      validation_result: 'VALID',
      simulated_clearing_reference: clearingRef,
      settled_at: settledAt,
    });
  }

  saveDemoLedger(ledger);
  return results;
}

export function demoSpentFor(oacId: string): number {
  return getDemoLedger().spent[oacId] ?? 0;
}
