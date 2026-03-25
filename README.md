# `@licensekit/sdk`

Public TypeScript SDK source for `licensekit.dev`.

This repository is the standalone home of the npm package `@licensekit/sdk`. It contains the published client source, examples, tests, and the OpenAPI snapshot used to generate the typed surface.

Links:

- npm package: `https://www.npmjs.com/package/@licensekit/sdk`
- product site: `https://licensekit.dev`
- hosted API: `https://api.licensekit.dev`

## Install

```bash
npm install @licensekit/sdk
```

## Quick Start

```ts
import {
  ManagementClient,
  PublicKeyStore,
  RuntimeClient,
  SystemClient,
  verifyRuntimeResult
} from "@licensekit/sdk";

const baseUrl = "https://api.licensekit.dev";

const system = new SystemClient({ baseUrl });
const health = await system.health();
console.log(health.data.status);

const management = new ManagementClient({
  baseUrl,
  token: process.env.LICENSEKIT_MANAGEMENT_TOKEN!
});

const product = await management.createProduct({
  body: {
    name: "Example App",
    code: "example-app"
  }
});

const runtime = new RuntimeClient({
  baseUrl,
  licenseKey: process.env.LICENSEKIT_LICENSE_KEY!
});

const result = await runtime.validateLicense({
  body: {
    fingerprint: "host-123"
  }
});

const publicKeys = await system.listPublicKeys();
const keyStore = new PublicKeyStore(publicKeys.data);
const verification = await verifyRuntimeResult(result, keyStore);

console.log(product.data.id, verification.ok);
```

## What This Repo Contains

- typed `ManagementClient`, `RuntimeClient`, and `SystemClient`
- raw-response access for status/header aware integrations
- least-privilege management scope metadata from OpenAPI `x-required-scopes`
- Ed25519 runtime signature verification helpers
- task-oriented examples aimed at application and automation integrations

Hosted deployments should prefer `/health` for liveness checks behind `api.licensekit.dev`.
`/healthz` remains available for local and self-hosted compatibility.

## Examples

Examples live in [`examples/`](./examples):

- `01-create-scoped-api-key.ts`
- `02-create-product-and-policy.ts`
- `03-create-customer-and-license.ts`
- `04-runtime-validate-and-verify.ts`
- `05-renew-license.ts`
- `06-reset-device.ts`

All examples default to `https://api.licensekit.dev` and can be redirected with `LICENSEKIT_BASE_URL`.

## Development

```bash
npm install
npm run generate
npm run typecheck
npm test
npm run build
```

Generation uses the checked-in OpenAPI snapshot at [`openapi/openapi.yaml`](./openapi/openapi.yaml).
