export const PUSH_MANAGEMENT_TOKEN_STORAGE_KEY = "skyquest.push-management-token.v1";

export function isValidPushManagementToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 43 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}
