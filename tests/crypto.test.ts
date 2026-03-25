import { describe, expect, it } from "vitest";

import {
  PublicKeyStore,
  verifyRuntimePayload,
  verifyRuntimeResult
} from "../src/crypto/verification.js";

describe("runtime verification", () => {
  it("verifies Ed25519-signed runtime payloads against published public keys", async () => {
    const { publicKey, privateKey } = await crypto.subtle.generateKey(
      "Ed25519",
      true,
      ["sign", "verify"]
    );
    const payload = {
      license_id: "lic_1",
      status: "active"
    };
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const signatureBytes = await crypto.subtle.sign(
      "Ed25519",
      privateKey,
      payloadBytes
    );
    const publicKeyBytes = await crypto.subtle.exportKey("raw", publicKey);
    const keyStore = new PublicKeyStore([
      {
        kid: "kid_live",
        algorithm: "Ed25519",
        public_key: toBase64(publicKeyBytes),
        status: "active",
        created_at: "2026-03-24T00:00:00Z"
      }
    ]);
    const signature = {
      alg: "Ed25519",
      kid: "kid_live",
      value: toBase64(signatureBytes)
    };

    const verified = await verifyRuntimePayload(payload, signature, keyStore);
    const tampered = await verifyRuntimeResult(
      {
        data: {
          ...payload,
          status: "revoked"
        },
        signature
      },
      keyStore
    );

    expect(verified.ok).toBe(true);
    expect(verified.key.kid).toBe("kid_live");
    expect(tampered.ok).toBe(false);
  });
});

function toBase64(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64");
}
