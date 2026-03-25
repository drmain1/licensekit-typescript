import type { operations } from "../generated/openapi.js";
import type { RequestOptions } from "./client-options.js";
import type { operationMetadata } from "./generated/operation-metadata.js";

type Simplify<T> = { [Key in keyof T]: T[Key] } & {};
type NonNever<T> = [T] extends [never] ? never : T;
type MaybeProp<Name extends string, Value, Required extends boolean = false> = [Value] extends [never]
  ? {}
  : Required extends true
    ? { [Key in Name]: Value }
    : { [Key in Name]?: Value };
type RequiredKeys<T extends object> = {
  [Key in keyof T]-?: {} extends Pick<T, Key> ? never : Key;
}[keyof T];

export type OperationId = keyof typeof operationMetadata;

type OpenAPIOperation<Op extends OperationId> = operations[Op];
type OperationParameters<Op extends OperationId> = OpenAPIOperation<Op> extends { parameters: infer Parameters }
  ? Parameters
  : never;
type OperationPath<Op extends OperationId> = NonNever<
  NonNullable<OperationParameters<Op> extends { path?: infer Path } ? Path : never>
>;
type OperationQuery<Op extends OperationId> = NonNever<
  NonNullable<OperationParameters<Op> extends { query?: infer Query } ? Query : never>
>;
type OperationHeaders<Op extends OperationId> = NonNever<
  NonNullable<OperationParameters<Op> extends { header?: infer Header } ? Header : never>
>;
type OperationBody<Op extends OperationId> = OpenAPIOperation<Op> extends {
  requestBody: { content: { "application/json": infer Body } };
}
  ? Body
  : never;
type HasIdempotencyHeader<Op extends OperationId> = OperationHeaders<Op> extends {
  "Idempotency-Key": string;
}
  ? true
  : false;

export type OperationRequest<Op extends OperationId> = Simplify<
  MaybeProp<"path", OperationPath<Op>, true> &
    MaybeProp<"query", OperationQuery<Op>> &
    MaybeProp<"body", OperationBody<Op>, true> &
    (HasIdempotencyHeader<Op> extends true ? { idempotencyKey: string } : {})
>;

export type OperationRequestArgs<Op extends OperationId> = RequiredKeys<OperationRequest<Op>> extends never
  ? [request?: OperationRequest<Op>, options?: RequestOptions]
  : [request: OperationRequest<Op>, options?: RequestOptions];

type SuccessMap<Op extends OperationId> = (typeof operationMetadata)[Op]["success"];
type SuccessStatus<Op extends OperationId> = keyof SuccessMap<Op> & number;
type SuccessResponse<
  Op extends OperationId,
  Status extends number
> = Status extends keyof OpenAPIOperation<Op>["responses"]
  ? OpenAPIOperation<Op>["responses"][Status]
  : never;
type JsonResponseBody<Response> = Response extends { content: { "application/json": infer Body } }
  ? Body
  : never;
type TextResponseBody<Response> = Response extends { content: { "text/plain": infer Body } }
  ? Body
  : never;
type ResponseData<Response> = [JsonResponseBody<Response>] extends [never]
  ? [TextResponseBody<Response>] extends [never]
    ? undefined
    : TextResponseBody<Response>
  : JsonResponseBody<Response>;

export type OperationResult<Op extends OperationId> = ResponseData<
  SuccessResponse<Op, SuccessStatus<Op>>
>;

export interface OperationRawResult<Op extends OperationId> {
  status: SuccessStatus<Op>;
  headers: Headers;
  data: OperationResult<Op>;
  response: Response;
}

