import {
  operationScopes,
  type ManagementOperationId,
  type ManagementScope
} from "../../generated/operation-scopes.js";

export { operationScopes, type ManagementOperationId, type ManagementScope };

export function getRequiredScopes(
  operationId: ManagementOperationId
): readonly ManagementScope[] {
  return operationScopes[operationId].scopes;
}

export function hasRequiredScopes(
  operationId: ManagementOperationId,
  scopes: readonly string[]
): boolean {
  const granted = new Set(scopes);
  const required = getRequiredScopes(operationId);

  if (granted.has("admin")) {
    return true;
  }

  return required.every((scope) => granted.has(scope));
}
