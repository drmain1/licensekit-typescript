import {
  PublicKeyStore,
  RuntimeClient,
  SystemClient,
  verifyRuntimeResult
} from "@licensekit/sdk";

const baseUrl = process.env.LICENSEKIT_BASE_URL ?? "https://api.licensekit.dev";
const licenseKey = process.env.LICENSEKIT_LICENSE_KEY;

if (!licenseKey) {
  throw new Error("Set LICENSEKIT_LICENSE_KEY");
}

const runtime = new RuntimeClient({ baseUrl, licenseKey });
const system = new SystemClient({ baseUrl });

const result = await runtime.validateLicense({
  body: {
    fingerprint: "sdk-example-host"
  }
});

const publicKeys = await system.listPublicKeys();
const verification = await verifyRuntimeResult(
  result,
  new PublicKeyStore(publicKeys.data)
);

console.log({
  licenseId: result.data.license_id,
  verified: verification.ok,
  kid: result.signature.kid
});
