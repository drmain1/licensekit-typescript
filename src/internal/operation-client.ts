import { ApiError } from "../errors/api-error.js";
import {
  normalizeBaseUrl,
  type ClientOptions,
  type RequestOptions
} from "../client-options.js";
import { operationMetadata } from "../generated/operation-metadata.js";
import type {
  OperationId,
  OperationRawResult,
  OperationRequest,
  OperationResult
} from "../operations.js";

type AuthConfig =
  | { type: "none" }
  | { type: "bearer"; value: string }
  | { type: "license"; value: string };

const DEFAULT_RETRYABLE_METHODS = ["GET"] as const;

export class OperationClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: HeadersInit | undefined;
  private readonly defaultTimeoutMs: number | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly retry: ClientOptions["retry"];
  private readonly userAgent: string | undefined;
  private readonly auth: AuthConfig;

  constructor(options: ClientOptions, auth: AuthConfig) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.defaultHeaders = options.headers;
    this.defaultTimeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetch ?? fetch;
    this.retry = options.retry;
    this.userAgent = options.userAgent;
    this.auth = auth;
  }

  protected async request<Op extends OperationId>(
    operationId: Op,
    request?: OperationRequest<Op>,
    options?: RequestOptions
  ): Promise<OperationResult<Op>> {
    const response = await this.requestRaw(operationId, request, options);
    return response.data;
  }

  protected async requestRaw<Op extends OperationId>(
    operationId: Op,
    request?: OperationRequest<Op>,
    options?: RequestOptions
  ): Promise<OperationRawResult<Op>> {
    const metadata = operationMetadata[operationId];
    const normalizedRequest = (request ?? {}) as OperationRequest<Op>;
    const requestRecord = normalizedRequest as Record<string, unknown>;
    const url = new URL(
      buildPath(metadata.path, requestRecord),
      `${this.baseUrl}/`
    );

    applyQuery(url.searchParams, requestRecord);

    const headers = new Headers(this.defaultHeaders);
    mergeHeaders(headers, options?.headers);
    applyDefaultHeaders(headers, this.userAgent);
    applyAuth(headers, this.auth);
    applyIdempotencyKey(headers, requestRecord);

    const init: RequestInit = {
      method: metadata.method,
      headers
    };

    if ("body" in requestRecord) {
      headers.set("Content-Type", "application/json");
      init.body = JSON.stringify(requestRecord.body);
    }

    const response = await this.fetchWithRetry(url, init, options);
    const successKind = metadata.success[response.status as keyof typeof metadata.success];

    if (!successKind) {
      throw await createApiError(response);
    }

    const data = await parseSuccessBody(response, successKind);

    return {
      status: response.status as OperationRawResult<Op>["status"],
      headers: response.headers,
      data: data as OperationResult<Op>,
      response
    };
  }

  private async fetchWithRetry(
    url: URL,
    init: RequestInit,
    options?: RequestOptions
  ): Promise<Response> {
    const retries = this.retry?.retries ?? 0;
    const retryableMethods = new Set(
      (this.retry?.retryableMethods ?? DEFAULT_RETRYABLE_METHODS).map((method) =>
        method.toUpperCase()
      )
    );
    const method = (init.method ?? "GET").toUpperCase();
    const shouldRetryMethod = retryableMethods.has(method);

    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController();
      const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
      const cleanup = linkAbortSignals(controller, options?.signal, timeoutMs);

      try {
        return await this.fetchImpl(url, {
          ...init,
          signal: controller.signal
        });
      } catch (error) {
        if (attempt >= retries || !shouldRetryMethod || !isRetryableError(error)) {
          throw error;
        }

        await sleep(Math.min(100 * (attempt + 1), 500));
      } finally {
        cleanup();
      }
    }
  }
}

function applyDefaultHeaders(headers: Headers, userAgent: string | undefined): void {
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (userAgent && !headers.has("User-Agent")) {
    headers.set("User-Agent", userAgent);
  }
}

function applyAuth(headers: Headers, auth: AuthConfig): void {
  if (auth.type === "none") {
    return;
  }

  const scheme = auth.type === "bearer" ? "Bearer" : "License";
  headers.set("Authorization", `${scheme} ${auth.value}`);
}

function applyIdempotencyKey(headers: Headers, request: Record<string, unknown>): void {
  if ("idempotencyKey" in request) {
    headers.set("Idempotency-Key", String(request.idempotencyKey));
  }
}

function mergeHeaders(target: Headers, source: HeadersInit | undefined): void {
  if (!source) {
    return;
  }

  const headers = new Headers(source);
  headers.forEach((value, key) => {
    target.set(key, value);
  });
}

function buildPath(template: string, request: Record<string, unknown>): string {
  if (!("path" in request)) {
    return template;
  }

  const path = asRecord(request.path);

  return template.replaceAll(/\{([^}]+)\}/g, (_, rawKey: string) => {
    const value = path[rawKey];

    if (value === undefined || value === null) {
      throw new TypeError(`Missing path parameter: ${rawKey}`);
    }

    return encodeURIComponent(String(value));
  });
}

function applyQuery(
  searchParams: URLSearchParams,
  request: Record<string, unknown>
): void {
  if (!("query" in request) || !request.query) {
    return;
  }

  for (const [key, value] of Object.entries(asRecord(request.query))) {
    appendQueryValue(searchParams, key, value);
  }
}

function appendQueryValue(
  searchParams: URLSearchParams,
  key: string,
  value: unknown
): void {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendQueryValue(searchParams, key, item);
    }
    return;
  }

  if (value instanceof Date) {
    searchParams.append(key, value.toISOString());
    return;
  }

  searchParams.append(key, String(value));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
}

function linkAbortSignals(
  controller: AbortController,
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined
): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;

  if (signal) {
    abortHandler = () => controller.abort(signal.reason);

    if (signal.aborted) {
      abortHandler();
    } else {
      signal.addEventListener("abort", abortHandler, { once: true });
    }
  }

  if (timeoutMs !== undefined) {
    timeoutId = setTimeout(() => {
      controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  }

  return () => {
    if (abortHandler && signal) {
      signal.removeEventListener("abort", abortHandler);
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name !== "AbortError";
}

async function createApiError(response: Response): Promise<ApiError> {
  const body = await parseErrorBody(response);
  return ApiError.fromResponse(response.status, body);
}

async function parseErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  return await response.text();
}

async function parseSuccessBody(
  response: Response,
  kind: "json" | "text" | "empty"
): Promise<unknown> {
  if (kind === "empty") {
    return undefined;
  }

  if (kind === "text") {
    return await response.text();
  }

  return await response.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
