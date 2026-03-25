import { ManagementClient } from "@licensekit/sdk";

const baseUrl = process.env.LICENSEKIT_BASE_URL ?? "https://api.licensekit.dev";
const token = process.env.LICENSEKIT_MANAGEMENT_TOKEN;
const licenseId = process.env.LICENSEKIT_LICENSE_ID;

if (!token || !licenseId) {
  throw new Error("Set LICENSEKIT_MANAGEMENT_TOKEN and LICENSEKIT_LICENSE_ID");
}

const management = new ManagementClient({ baseUrl, token });

const renewed = await management.renewLicense({
  path: {
    id: licenseId
  },
  idempotencyKey: `renew-${Date.now()}`,
  body: {
    extend_by_days: 30
  }
});

console.log({
  licenseId: renewed.data.id,
  expiresAt: renewed.data.expires_at
});
