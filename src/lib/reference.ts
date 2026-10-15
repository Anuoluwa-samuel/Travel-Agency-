/**
 * Public, non-guessable references (e.g. `BK-7K3M-Q9XP`). These are never primary keys and
 * never sequential (ARCHITECTURE.md §11). 8 Crockford base32 chars = 40 bits of randomness;
 * uniqueness is still enforced by a DB unique constraint and the caller retries on conflict.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford: no I, L, O, U

export const REFERENCE_PREFIXES = {
  booking: "BK",
  enquiry: "EQ",
  quote: "QT",
  invoice: "IN",
  payment: "PY",
  refund: "RF",
  consultation: "CN",
  visaCase: "VC",
  support: "SP",
  budget: "BG",
  tripPlan: "TP",
} as const;

export type ReferenceKind = keyof typeof REFERENCE_PREFIXES;

function randomChars(length: number): string {
  // Rejection sampling is unnecessary: 256 is divisible by 32, so `byte & 31` is unbiased.
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b & 31];
  return out;
}

export function generateReference(kind: ReferenceKind): string {
  const body = randomChars(8);
  return `${REFERENCE_PREFIXES[kind]}-${body.slice(0, 4)}-${body.slice(4)}`;
}

/**
 * Normalise user-typed references: case-insensitive, tolerant of missing dashes and of the
 * characters Crockford maps (I/L → 1, O → 0). Returns null when it cannot be a reference.
 */
export function normalizeReference(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, "");
  if (cleaned.length !== 10) return null;
  // Only the random body uses Crockford substitutions; prefixes like "IN" are literal.
  const prefix = cleaned.slice(0, 2);
  const body = cleaned.slice(2).replace(/[IL]/g, "1").replace(/O/g, "0");
  if (!/^[0-9A-HJKMNP-TV-Z]{8}$/.test(body)) return null;
  if (!Object.values(REFERENCE_PREFIXES).includes(prefix as never)) return null;
  return `${prefix}-${body.slice(0, 4)}-${body.slice(4)}`;
}
