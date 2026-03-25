import { ManagementClient } from "@licensekit/sdk";

const baseUrl = process.env.LICENSEKIT_BASE_URL ?? "https://api.licensekit.dev";
const token = process.env.LICENSEKIT_MANAGEMENT_TOKEN;
const licenseId = process.env.LICENSEKIT_LICENSE_ID;
const deviceId = process.env.LICENSEKIT_DEVICE_ID;

if (!token || !licenseId || !deviceId) {
  throw new Error(
    "Set LICENSEKIT_MANAGEMENT_TOKEN, LICENSEKIT_LICENSE_ID, and LICENSEKIT_DEVICE_ID"
  );
}

const management = new ManagementClient({ baseUrl, token });

const reset = await management.resetLicenseDevice({
  path: {
    id: licenseId,
    device_id: deviceId
  }
});

console.log({
  deviceId: reset.data.id,
  status: reset.data.status
});
