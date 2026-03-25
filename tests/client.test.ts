import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../src/errors/api-error.js";
import {
  ManagementClient,
  RuntimeClient,
  SystemClient
} from "../src/generated/index.js";

describe("SDK clients", () => {
  it("normalizes the base URL and injects bearer auth for management requests", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe("https://api.licensekit.dev/api/v1/products?limit=25");

      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer mgmt_test_token");
      expect(headers.get("Accept")).toBe("application/json");

      return jsonResponse(
        {
          data: [],
          meta: {
            request_id: "req_123",
            timestamp: "2026-03-24T00:00:00Z"
          }
        },
        200
      );
    });

    const client = new ManagementClient({
      baseUrl: "https://api.licensekit.dev///",
      token: "mgmt_test_token",
      fetch: fetchMock
    });

    const response = await client.listProducts({ query: { limit: 25 } });

    expect(response.data).toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("injects license auth and idempotency keys for runtime requests", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      const headers = new Headers(init?.headers);

      expect(headers.get("Authorization")).toBe("License lic_test_key");
      expect(headers.get("Idempotency-Key")).toBe("idem_123");
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(
        JSON.stringify({
          fingerprint: "host-123"
        })
      );

      return jsonResponse(
        {
          data: {
            license_id: "lic_1",
            status: "active",
            license_type: "subscription",
            entitlement_version: 1,
            issued_at: "2026-03-24T00:00:00Z",
            next_check_at: "2026-03-25T00:00:00Z",
            device_id: "dev_1",
            features: []
          },
          signature: {
            alg: "Ed25519",
            kid: "kid_1",
            value: "AQID"
          },
          meta: {
            request_id: "req_runtime",
            timestamp: "2026-03-24T00:00:00Z"
          }
        },
        200
      );
    });

    const client = new RuntimeClient({
      baseUrl: "https://api.licensekit.dev",
      licenseKey: "lic_test_key",
      fetch: fetchMock
    });

    const response = await client.activateLicense({
      body: {
        fingerprint: "host-123"
      },
      idempotencyKey: "idem_123"
    });

    expect(response.data.license_id).toBe("lic_1");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uses the hosted-safe /health alias and treats readyz 503 as a parsed result", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.endsWith("/health")) {
        return jsonResponse(
          {
            data: { status: "ok" },
            meta: {
              request_id: "req_health",
              timestamp: "2026-03-24T00:00:00Z"
            }
          },
          200
        );
      }

      if (url.endsWith("/readyz")) {
        return jsonResponse(
          {
            data: { status: "not_ready", db: "down" },
            meta: {
              request_id: "req_ready",
              timestamp: "2026-03-24T00:00:00Z"
            }
          },
          503
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new SystemClient({
      baseUrl: "https://api.licensekit.dev",
      fetch: fetchMock
    });

    const health = await client.health();
    const ready = await client.raw.readyz();

    expect(health.data.status).toBe("ok");
    expect(ready.status).toBe(503);
    expect(ready.data.data.status).toBe("not_ready");
  });

  it("parses error envelopes into ApiError instances", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        {
          error: {
            code: "TOKEN_SCOPE_DENIED",
            message: "scope denied"
          },
          meta: {
            request_id: "req_forbidden",
            timestamp: "2026-03-24T00:00:00Z"
          }
        },
        403
      )
    );

    const client = new ManagementClient({
      baseUrl: "https://api.licensekit.dev",
      token: "mgmt_test_token",
      fetch: fetchMock
    });

    await expect(client.listProducts()).rejects.toMatchObject<ApiError>({
      name: "ApiError",
      status: 403,
      code: "TOKEN_SCOPE_DENIED",
      requestId: "req_forbidden"
    });
  });
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
