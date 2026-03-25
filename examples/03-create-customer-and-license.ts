import { ManagementClient } from "@licensekit/sdk";

const baseUrl = process.env.LICENSEKIT_BASE_URL ?? "https://api.licensekit.dev";
const token = process.env.LICENSEKIT_MANAGEMENT_TOKEN;
const productId = process.env.LICENSEKIT_PRODUCT_ID;
const policyId = process.env.LICENSEKIT_POLICY_ID;

if (!token || !productId || !policyId) {
  throw new Error(
    "Set LICENSEKIT_MANAGEMENT_TOKEN, LICENSEKIT_PRODUCT_ID, and LICENSEKIT_POLICY_ID"
  );
}

const management = new ManagementClient({ baseUrl, token });
const suffix = Date.now().toString(36);

const customer = await management.createCustomer({
  body: {
    name: `SDK Example ${suffix}`,
    code: `sdk-example-${suffix}`,
    email: `sdk-example-${suffix}@example.com`
  }
});

const license = await management.createLicense({
  body: {
    product_id: productId,
    policy_id: policyId,
    customer_id: customer.data.id
  }
});

console.log({
  customerId: customer.data.id,
  licenseId: license.data.license.id,
  licenseKey: license.data.license_key
});
