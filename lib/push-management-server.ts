import "server-only";

import { createHash } from "node:crypto";
import { isValidPushManagementToken } from "./push-management.ts";

export function hashPushManagementToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function getPushManagementTokenHash(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);
  return isValidPushManagementToken(token) ? hashPushManagementToken(token) : null;
}
