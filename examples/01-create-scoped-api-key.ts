import {
  ManagementClient,
  getRequiredScopes
} from "@licensekit/sdk";

const baseUrl = process.env.LICENSEKIT_BASE_URL ?? "https://api.licensekit.dev";
const bootstrapToken = process.env.LICENSEKIT_MANAGEMENT_TOKEN;

if (!bootstrapToken) {
  throw new Error("Set LICENSEKIT_MANAGEMENT_TOKEN");
}

const management = new ManagementClient({
  baseUrl,
  token: bootstrapToken
});

const response = await management.createAPIKey({
  body: {
    name: "catalog-bot",
    scopes: [...getRequiredScopes("createProduct")]
  }
});

console.log(response.data.token);
