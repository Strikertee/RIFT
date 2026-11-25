import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

// Pure-JS SHA-512 binding keeps signing/verification available on plain HTTP LAN origins,
// where window.crypto.subtle is unavailable.
(ed.etc as unknown as { sha512Sync: (...m: Uint8Array[]) => Uint8Array }).sha512Sync = (
  ...m: Uint8Array[]
) => sha512(concatBytes(...m));

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (clean.length % 2 !== 0) throw new Error('Invalid hex');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  // getRandomValues works in non-secure contexts; randomUUID does not.
  crypto.getRandomValues(out);
  return out;
}

export function randomHex(length: number): string {
  return bytesToHex(randomBytes(Math.ceil(length / 2))).slice(0, length);
}

/** RFC4122-shaped id that works on plain HTTP origins. */
export function randomId(prefix = ''): string {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = bytesToHex(b);
  const dashed = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  return `${prefix}${dashed}`;
}

export interface KeyPair {
  publicKeyHex: string;
  privateKeyHex: string;
}

export function generateKeyPair(): KeyPair {
  const priv = ed.utils.randomPrivateKey();
  const pub = ed.getPublicKey(priv);
  return { privateKeyHex: bytesToHex(priv), publicKeyHex: bytesToHex(pub) };
}

/** Sorted-key JSON with zero whitespace — the canonical form used by Core. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = sortDeep(source[key]);
    return out;
  }
  return value;
}

export function signCanonical(payload: unknown, privateKeyHex: string): string {
  const msg = new TextEncoder().encode(canonicalJson(payload));
  return bytesToHex(ed.sign(msg, hexToBytes(privateKeyHex)));
}

export function verifyCanonical(payload: unknown, signatureHex: string, publicKeyHex: string): boolean {
  try {
    const msg = new TextEncoder().encode(canonicalJson(payload));
    return ed.verify(hexToBytes(signatureHex), msg, hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}

export function sha256Hex(input: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(input)));
}

/** No fractional seconds: the issuer signature is bound to this exact string. */
export function isoNow(date: Date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function addHoursIso(hours: number, from: Date = new Date()): string {
  return isoNow(new Date(from.getTime() + hours * 60 * 60 * 1000));
}

/** tx_ + first 32 hex chars of SHA256(oac_id || seq_no || invoice_nonce), UUID dashed. */
export function deriveTransactionId(oacId: string, seqNo: number, invoiceNonce: string): string {
  const hash = sha256Hex(`${oacId}${seqNo}${invoiceNonce}`).slice(0, 32);
  const dashed = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  return `tx_${dashed}`;
}

export function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
