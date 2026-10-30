import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";

/*
 * Field-level encryption for sensitive personal data (passport numbers, dates of birth).
 * AES-256-GCM with a random 96-bit IV per value. Envelope: `v1:<iv>:<tag>:<ciphertext>` (base64url).
 * The version prefix allows key rotation later without ambiguity.
 */

const VERSION = "v1";

function key(): Buffer {
  return Buffer.from(env.DATA_ENCRYPTION_KEY, "base64");
}

export function encryptField(plaintext: string, aad = ""): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(":");
}

export function decryptField(envelope: string, aad = ""): string {
  const [version, iv, tag, ct] = envelope.split(":");
  if (version !== VERSION || !iv || !tag || ct === undefined) throw new Error("Unrecognised encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  if (aad) decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

/** HMAC-SHA256 with the auth secret, hex. For one-time codes and signed guest tokens. */
export function hmac(value: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
