export interface ResponseMeta {
  request_id: string;
  timestamp: string;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    detail?: string;
  };
  meta?: Partial<ResponseMeta>;
}

export interface ApiErrorOptions {
  status: number;
  code: string;
  message: string;
  detail?: string;
  requestId?: string;
  timestamp?: string;
  body?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
  readonly requestId?: string;
  readonly timestamp?: string;
  readonly body?: unknown;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.detail = options.detail;
    this.requestId = options.requestId;
    this.timestamp = options.timestamp;
    this.body = options.body;
  }

  static fromResponse(status: number, body: unknown): ApiError {
    const envelope = parseErrorEnvelope(body);

    if (!envelope) {
      return new ApiError({
        status,
        code: "UNKNOWN_ERROR",
        message: `Request failed with status ${status}`,
        body
      });
    }

    return new ApiError({
      status,
      code: envelope.error.code,
      message: envelope.error.message,
      detail: envelope.error.detail,
      requestId: envelope.meta?.request_id,
      timestamp: envelope.meta?.timestamp,
      body
    });
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

function parseErrorEnvelope(body: unknown): ErrorEnvelope | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const error = candidate.error;

  if (!error || typeof error !== "object") {
    return null;
  }

  const errorObject = error as Record<string, unknown>;
  const code = errorObject.code;
  const message = errorObject.message;

  if (typeof code !== "string" || typeof message !== "string") {
    return null;
  }

  const detail = typeof errorObject.detail === "string" ? errorObject.detail : undefined;
  const meta = isResponseMeta(candidate.meta) ? candidate.meta : undefined;

  return {
    error: {
      code,
      message,
      detail
    },
    meta
  };
}

function isResponseMeta(value: unknown): value is ResponseMeta {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.request_id === "string" &&
    typeof candidate.timestamp === "string"
  );
}
