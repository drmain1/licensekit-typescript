import type { components } from "../../generated/openapi.js";

export type PublicKeyRecord = components["schemas"]["PublicKey"];
export type RuntimeSignature = components["schemas"]["Signature"];
export type PublicKeyInput =
  | PublicKeyStore
  | readonly PublicKeyRecord[]
  | Iterable<PublicKeyRecord>;

export interface VerificationResult {
  ok: boolean;
  key: PublicKeyRecord;
}

export class PublicKeyStore {
  private readonly keys = new Map<string, PublicKeyRecord>();
  private readonly imported = new Map<string, Promise<CryptoKey>>();

  constructor(keys: PublicKeyInput = []) {
    for (const key of toIterable(keys)) {
      this.keys.set(key.kid, key);
    }
  }

  add(key: PublicKeyRecord): void {
    this.keys.set(key.kid, key);
    this.imported.delete(key.kid);
  }

  addAll(keys: Iterable<PublicKeyRecord>): void {
    for (const key of keys) {
      this.add(key);
    }
  }

  get(kid: string): PublicKeyRecord | undefined {
    return this.keys.get(kid);
  }

  has(kid: string): boolean {
    return this.keys.has(kid);
  }

  values(): PublicKeyRecord[] {
    return [...this.keys.values()];
  }

  async import(kid: string): Promise<CryptoKey> {
    const key = this.keys.get(kid);

    if (!key) {
      throw new TypeError(`Unknown public key kid: ${kid}`);
    }

    let imported = this.imported.get(kid);

    if (!imported) {
      imported = importPublicKey(key);
      this.imported.set(kid, imported);
    }

    return imported;
  }
}

export function findPublicKey(
  keys: PublicKeyInput,
  kid: string
): PublicKeyRecord | undefined {
  if (keys instanceof PublicKeyStore) {
    return keys.get(kid);
  }

  for (const key of keys) {
    if (key.kid === kid) {
      return key;
    }
  }

  return undefined;
}

export async function verifyRuntimePayload(
  data: unknown,
  signature: RuntimeSignature,
  keys: PublicKeyInput
): Promise<VerificationResult> {
  const publicKey = findPublicKey(keys, signature.kid);

  if (!publicKey) {
    throw new TypeError(`Unknown public key kid: ${signature.kid}`);
  }

  if (publicKey.algorithm !== "Ed25519" || signature.alg !== "Ed25519") {
    throw new TypeError(
      `Unsupported signature algorithm: expected Ed25519, received key=${publicKey.algorithm}, signature=${signature.alg}`
    );
  }

  const subtle = getSubtleCrypto();
  const key =
    keys instanceof PublicKeyStore
      ? await keys.import(signature.kid)
      : await importPublicKey(publicKey);
  const payloadBytes = toArrayBuffer(new TextEncoder().encode(JSON.stringify(data)));
  const signatureBytes = decodeBase64(signature.value);
  const ok = await subtle.verify("Ed25519", key, signatureBytes, payloadBytes);

  return { ok, key: publicKey };
}

export async function verifyRuntimeResult(
  result: { data: unknown; signature: RuntimeSignature },
  keys: PublicKeyInput
): Promise<VerificationResult> {
  return verifyRuntimePayload(result.data, result.signature, keys);
}

async function importPublicKey(key: PublicKeyRecord): Promise<CryptoKey> {
  return getSubtleCrypto().importKey(
    "raw",
    decodeBase64(key.public_key),
    "Ed25519",
    false,
    ["verify"]
  );
}

function toIterable(keys: PublicKeyInput): Iterable<PublicKeyRecord> {
  if (keys instanceof PublicKeyStore) {
    return keys.values();
  }

  return keys;
}

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw new TypeError("Web Crypto is required to verify runtime signatures");
  }

  return subtle;
}

function decodeBase64(value: string): ArrayBuffer {
  const decoded = globalThis.atob(value);
  const bytes = new Uint8Array(decoded.length);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return toArrayBuffer(bytes);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}
