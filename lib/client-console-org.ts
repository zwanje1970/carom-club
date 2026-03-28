/**
 * 클라이언트(/client) 운영 콘솔 shared 경계.
 * - 활성 조직 쿠키 키와 pure helper만 둡니다.
 * - DB 접근과 쿠키 변경은 `client-console-org.server.ts`로 분리합니다.
 */
import type { ClientOrganization } from "@/types/client-organization";

export const CLIENT_CONSOLE_ORG_COOKIE = "client_console_org_id";

export function pickActiveOrganizationId(
  organizations: ClientOrganization[],
  preferredId: string | null | undefined
): string | null {
  if (organizations.length === 0) return null;
  if (preferredId && organizations.some((o) => o.id === preferredId)) {
    return preferredId;
  }
  return organizations[0]!.id;
}

export function getClientConsoleOrgCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/client",
    maxAge: maxAgeSeconds,
  };
}
