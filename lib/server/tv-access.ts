import { randomBytes } from "node:crypto";

/** TV 공개 URL에 쓸 토큰(충분한 엔트로피). */
export function generateTvAccessToken(): string {
  return randomBytes(24).toString("base64url");
}
