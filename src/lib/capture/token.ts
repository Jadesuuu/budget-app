import { createHash, randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const TOKEN = /^cap_[a-z0-9]{32}$/;

/** A new capture link secret: "cap_" + 32 chars from a 32-letter alphabet (160 bits). Shown to the user once. */
export function generateCaptureToken(): string {
  const bytes = randomBytes(32);
  let out = "cap_";
  for (const b of bytes) out += ALPHABET[b % 32];
  return out;
}

export function isCaptureToken(value: string): boolean {
  return TOKEN.test(value);
}

/** Only this hash is stored, so a database leak doesn't reveal working links. */
export function hashCaptureToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
