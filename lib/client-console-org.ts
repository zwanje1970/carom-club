/**
 * 클라이언트(/client) 운영 콘솔 — 조직 컨텍스트.
 * - DB: Organization + OrganizationMember 재사용
 * - 활성 조직: HttpOnly 쿠키 `client_console_org_id` (Path=/client)
 */
import { cache } from "react";
import { prisma } from "@/lib/db";
import type {
  ClientOrganization,
  ClientOrganizationAccessRole,
} from "@/types/client-organization";

export const CLIENT_CONSOLE_ORG_COOKIE = "client_console_org_id";

const ROLE_ORDER: Record<ClientOrganizationAccessRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

function higherRole(
  a: ClientOrganizationAccessRole,
  b: ClientOrganizationAccessRole
): ClientOrganizationAccessRole {
  return ROLE_ORDER[a] >= ROLE_ORDER[b] ? a : b;
}

function mapMemberRoleToAccess(role: string): ClientOrganizationAccessRole {
  if (role === "OWNER") return "OWNER";
  if (role === "ADMIN") return "ADMIN";
  return "MEMBER";
}

/** 콘솔 접근 가능한 멤버 역할 (GUEST 등은 제외 — 추후 ‘조회 전용’으로 열 수 있음) */
const CONSOLE_MEMBER_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;

/**
 * 사용자가 운영 콘솔에서 선택할 수 있는 모든 조직.
 * - 소유 조직: Organization.ownerUserId
 * - 소속 조직: OrganizationMember(status=ACTIVE, 허용 role)
 */
export async function listAccessibleClientOrganizations(
  userId: string
): Promise<ClientOrganization[]> {
  const [owned, memberships] = await Promise.all([
    prisma.organization.findMany({
      where: {
        ownerUserId: userId,
        status: { not: "EXPELLED" },
      },
      select: { id: true, name: true, slug: true, type: true, status: true },
    }),
    prisma.organizationMember.findMany({
      where: {
        userId,
        status: "ACTIVE",
        role: { in: [...CONSOLE_MEMBER_ROLES] },
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, type: true, status: true },
        },
      },
    }),
  ]);

  const map = new Map<string, ClientOrganization>();

  for (const o of owned) {
    if (o.status === "EXPELLED") continue;
    map.set(o.id, {
      id: o.id,
      name: o.name,
      slug: o.slug,
      type: o.type,
      accessRole: "OWNER",
    });
  }

  for (const m of memberships) {
    const o = m.organization;
    if (o.status === "EXPELLED") continue;
    const accessFromMember = mapMemberRoleToAccess(m.role);
    const existing = map.get(o.id);
    if (!existing) {
      map.set(o.id, {
        id: o.id,
        name: o.name,
        slug: o.slug,
        type: o.type,
        accessRole: accessFromMember,
      });
    } else {
      existing.accessRole = higherRole(existing.accessRole, accessFromMember);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "ko", { sensitivity: "base" })
  );
}

/** 요청당 1회 조회 (레이아웃·getClientAdminOrganizationId 등 동일 렌더에서 공유) */
export const getAccessibleClientOrganizationsCached = cache(async (userId: string) =>
  listAccessibleClientOrganizations(userId)
);

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

export async function userCanAccessOrganizationForClientConsole(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const orgs = await getAccessibleClientOrganizationsCached(userId);
  return orgs.some((o) => o.id === organizationId);
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

export async function clearClientConsoleOrgCookie(): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(CLIENT_CONSOLE_ORG_COOKIE, "", {
    ...getClientConsoleOrgCookieOptions(0),
    maxAge: 0,
  });
}
