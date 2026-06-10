import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

// AES-256-GCM for BYOK keys at rest. ENCRYPTION_KEY can be any string;
// it is hashed to a 32-byte key.
function key(): Buffer {
  const secret = process.env.ENCRYPTION_KEY ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("ENCRYPTION_KEY (or BETTER_AUTH_SECRET) is not set");
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), enc.toString("base64"), cipher.getAuthTag().toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const [iv, enc, tag] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
