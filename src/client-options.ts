export interface RetryOptions {
  retries?: number;
  retryableMethods?: readonly string[];
}

export interface ClientOptions {
  baseUrl: string;
  headers?: HeadersInit;
  timeoutMs?: number;
  userAgent?: string;
  retry?: RetryOptions;
  fetch?: typeof fetch;
}

export interface ManagementClientOptions extends ClientOptions {
  token: string;
}

export interface RuntimeClientOptions extends ClientOptions {
  licenseKey: string;
}

export type SystemClientOptions = ClientOptions;

export interface RequestOptions {
  headers?: HeadersInit;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();

  if (!trimmed) {
    throw new TypeError("baseUrl is required");
  }

  return trimmed.replace(/\/+$/, "");
}
