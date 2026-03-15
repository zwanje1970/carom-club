import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type MemberRow = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  status: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
  orgClientType?: string | null;
  orgApprovalStatus?: string | null;
  orgStatus?: string | null;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SORT: "name" | "role" | "createdAt" = "createdAt";
const DEFAULT_ORDER: "asc" | "desc" = "desc";

type RoleTypeFilter = "all" | "user" | "client_general" | "client_registered" | "admin";
type StatusFilter = "all" | "active" | "pending" | "suspended" | "withdrawn";

type UserWhere = {
  AND?: Array<Record<string, unknown>>;
  OR?: Array<Record<string, unknown>>;
  id?: { in?: string[]; notIn?: string[] };
  role?: string | { in: string[] };
  withdrawnAt?: null | { not: null };
  status?: string | null | { in: (string | null)[] };
};

/**
 * GET: 플랫폼 관리자 — 회원 목록
 * query: search, roleType, status, sortBy, sortOrder, page, pageSize
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const roleType = (searchParams.get("roleType") ?? "all") as RoleTypeFilter;
    const status = (searchParams.get("status") ?? "all") as StatusFilter;
    const sortBy = (searchParams.get("sortBy") ?? DEFAULT_SORT) as "name" | "role" | "createdAt";
    const sortOrder = (searchParams.get("sortOrder") ?? DEFAULT_ORDER) as "asc" | "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSizeParam = parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10);
    const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam as (typeof PAGE_SIZE_OPTIONS)[number])
      ? pageSizeParam
      : DEFAULT_PAGE_SIZE;

    const where = await buildWhere({ search, roleType, status });
    const total = await prisma.user.count({ where: where as never });

    const order = sortOrder;

    if (sortBy === "role") {
      const ids = await fetchUserIdsOrderedByRole(where, order, page, pageSize);
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          status: true,
          withdrawnAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      const orgMap = await getOrgMapByOwnerUserId(users.map((u) => u.id));
      const orderMap = new Map(ids.map((id, i) => [id, i]));
      users.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
      const items = users.map((u) => toMemberRow(u, orgMap.get(u.id)));
      return NextResponse.json({ items, total, page, pageSize });
    }

    const orderBy: { name?: "asc" | "desc"; username?: "asc" | "desc"; createdAt?: "asc" | "desc" }[] =
      sortBy === "name"
        ? [{ name: order }, { username: order }]
        : [{ createdAt: order }];

    const rows = await prisma.user.findMany({
      where: where as never,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        status: true,
        withdrawnAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const orgMap = await getOrgMapByOwnerUserId(rows.map((u) => u.id));
    const items = rows.map((u) => toMemberRow(u, orgMap.get(u.id)));
    return NextResponse.json({ items, total, page, pageSize });
  } catch (e) {
    console.error("[admin/members] GET error:", e);
    return NextResponse.json(
      { error: "회원 목록을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}

async function getOrgMapByOwnerUserId(ownerUserIds: string[]): Promise<Map<string, { clientType: string | null; approvalStatus: string | null; status: string | null }>> {
  if (ownerUserIds.length === 0) return new Map();
  const orgs = await prisma.organization.findMany({
    where: { ownerUserId: { in: ownerUserIds } },
    select: { ownerUserId: true, clientType: true, approvalStatus: true, status: true },
  });
  const map = new Map<string, { clientType: string | null; approvalStatus: string | null; status: string | null }>();
  for (const o of orgs) {
    if (o.ownerUserId) map.set(o.ownerUserId, { clientType: o.clientType ?? null, approvalStatus: o.approvalStatus ?? null, status: o.status ?? null });
  }
  return map;
}

async function buildWhere(params: {
  search: string;
  roleType: RoleTypeFilter;
  status: StatusFilter;
}): Promise<UserWhere> {
  const { search, roleType, status } = params;
  const and: UserWhere["AND"] = [];

  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    } as never);
  }

  if (roleType !== "all") {
    if (roleType === "user") {
      and.push({ role: "USER" });
    } else if (roleType === "admin") {
      and.push({ role: { in: ["PLATFORM_ADMIN", "ZONE_MANAGER"] } });
    } else {
      const regOrg = await prisma.organization.findMany({
        where: { clientType: "REGISTERED" },
        select: { ownerUserId: true },
      });
      const regIds = regOrg.map((o) => o.ownerUserId).filter((id): id is string => id != null);
      const allClientOrg = await prisma.organization.findMany({
        select: { ownerUserId: true },
      });
      const allOwnerIds = allClientOrg.map((o) => o.ownerUserId).filter((id): id is string => id != null);
      if (roleType === "client_registered") {
        if (regIds.length) and.push({ role: "CLIENT_ADMIN", id: { in: regIds } });
        else and.push({ role: "CLIENT_ADMIN", id: { in: [] } });
      } else {
        const generalOrgs = await prisma.organization.findMany({
          where: { clientType: "GENERAL" },
          select: { ownerUserId: true },
        });
        const generalIds = generalOrgs.map((o) => o.ownerUserId).filter((id): id is string => id != null);
        const orClauses: UserWhere["OR"] = [];
        if (generalIds.length) orClauses.push({ id: { in: generalIds } } as never);
        if (allOwnerIds.length) orClauses.push({ id: { notIn: allOwnerIds } } as never);
        if (orClauses.length) and.push({ role: "CLIENT_ADMIN", OR: orClauses } as never);
        else and.push({ role: "CLIENT_ADMIN", id: { in: [] } });
      }
    }
  }

  if (status !== "all") {
    if (status === "active") {
      and.push({ withdrawnAt: null });
      and.push({ OR: [{ status: "ACTIVE" }, { status: null }] } as never);
    } else if (status === "withdrawn") {
      and.push({ withdrawnAt: { not: null } } as never);
    } else if (status === "pending") {
      const pending = await prisma.organization.findMany({
        where: { approvalStatus: "PENDING" },
        select: { ownerUserId: true },
      });
      const ids = pending.map((o) => o.ownerUserId).filter((id): id is string => id != null);
      if (ids.length) and.push({ id: { in: ids } });
      else and.push({ id: { in: [] } });
    } else if (status === "suspended") {
      const suspendedOrg = await prisma.organization.findMany({
        where: { status: "SUSPENDED" },
        select: { ownerUserId: true },
      });
      const suspendedIds = suspendedOrg.map((o) => o.ownerUserId).filter((id): id is string => id != null);
      and.push({
        OR: [
          { status: "SUSPENDED" },
          ...(suspendedIds.length ? [{ id: { in: suspendedIds } }] : []),
        ],
      } as never);
    }
  }

  return and.length ? { AND: and } : {};
}

function toMemberRow(
  u: {
    id: string;
    name: string;
    username: string;
    email: string;
    role: string;
    status: string | null;
    withdrawnAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  org?: { clientType: string | null; approvalStatus: string | null; status: string | null } | null
): MemberRow {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    role: u.role,
    status: u.status ?? null,
    withdrawnAt: u.withdrawnAt ? u.withdrawnAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    orgClientType: org?.clientType ?? null,
    orgApprovalStatus: org?.approvalStatus ?? null,
    orgStatus: org?.status ?? null,
  };
}

const MAX_ROLE_SORT_FETCH = 10000;

async function fetchUserIdsOrderedByRole(
  where: UserWhere,
  order: "asc" | "desc",
  page: number,
  pageSize: number
): Promise<string[]> {
  const matching = await prisma.user.findMany({
    where: where as never,
    select: { id: true },
    take: MAX_ROLE_SORT_FETCH,
  });
  const idList = matching.map((m) => m.id);
  if (idList.length === 0) return [];

  const roleOrderAsc = `(CASE 
    WHEN u.role IN ('PLATFORM_ADMIN','ZONE_MANAGER') THEN 1 
    WHEN u.role = 'CLIENT_ADMIN' AND o."clientType" = 'REGISTERED' THEN 2 
    WHEN u.role = 'CLIENT_ADMIN' THEN 3 
    ELSE 4 
  END)`;
  const roleOrderDesc = `(CASE 
    WHEN u.role IN ('PLATFORM_ADMIN','ZONE_MANAGER') THEN 4 
    WHEN u.role = 'CLIENT_ADMIN' AND o."clientType" = 'REGISTERED' THEN 3 
    WHEN u.role = 'CLIENT_ADMIN' THEN 2 
    ELSE 1 
  END)`;
  const orderExpr = order === "asc" ? roleOrderAsc : roleOrderDesc;
  const offset = (page - 1) * pageSize;

  const ids = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `
    SELECT u.id FROM "User" u
    LEFT JOIN "Organization" o ON o."ownerUserId" = u.id
    WHERE u.id = ANY($1::text[])
    ORDER BY ${orderExpr}, u."createdAt" ${order === "asc" ? "ASC" : "DESC"}
    LIMIT $2 OFFSET $3
    `,
    idList,
    pageSize,
    offset
  );
  return ids.map((r) => r.id);
}
