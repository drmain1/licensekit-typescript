import { ManagementClient } from "@licensekit/sdk";

const baseUrl = process.env.LICENSEKIT_BASE_URL ?? "https://api.licensekit.dev";
const token = process.env.LICENSEKIT_MANAGEMENT_TOKEN;

if (!token) {
  throw new Error("Set LICENSEKIT_MANAGEMENT_TOKEN");
}

const management = new ManagementClient({ baseUrl, token });
const suffix = Date.now().toString(36);

const product = await management.createProduct({
  body: {
    name: `Example App ${suffix}`,
    code: `example-app-${suffix}`
  }
});

const policy = await management.createPolicy({
  path: {
    id: product.data.id
  },
  body: {
    name: "Pro Subscription",
    code: `pro-${suffix}`,
    license_type: "subscription"
  }
});

console.log({
  productId: product.data.id,
  policyId: policy.data.id
});
