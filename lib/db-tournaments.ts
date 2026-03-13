/**
 * 토너먼트 목록 조회 — Prisma 스키마 불일치(P2022) 시에도 동작하도록 raw SQL 사용.
 * DB에 Tournament/Organization 테이블이 없으면 쿼리 실패 시 빈 배열 반환(콘솔에 prisma:error 가능).
 * 테이블 생성: npm run db:push 또는 npx prisma migrate dev
 */

import { prisma } from "@/lib/db";

export type TournamentListRow = {
  id: string;
  name: string;
  startAt: Date;
  endAt: Date | null;
  status: string;
  organizationId: string;
  venue: string | null;
  venueName: string | null;
  gameFormat: string | null;
  imageUrl: string | null;
  organization: { id: string; name: string; slug: string } | null;
};

/** 공개 토너먼트 목록 (DRAFT/HIDDEN 제외). 실패 시 빈 배열 반환. */
export async function getTournamentsListRaw(options?: {
  orderBy?: "asc" | "desc";
  take?: number;
}): Promise<TournamentListRow[]> {
  const order = options?.orderBy === "desc" ? "DESC" : "ASC";
  const limit = options?.take ?? 100;
  try {
    const rows = await prisma.$queryRawUnsafe<
      {
        id: string;
        name: string;
        startAt: Date;
        endAt: Date | null;
        status: string;
        organizationId: string;
        venue: string | null;
        venueName: string | null;
        gameFormat: string | null;
        imageUrl: string | null;
        orgId: string | null;
        orgName: string | null;
        orgSlug: string | null;
      }[]
    >(
      `SELECT t.id, t.name, t."startAt", t."endAt", t.status, t."organizationId",
              t.venue, t."venueName", t."gameFormat", t."imageUrl",
              o.id AS "orgId", o.name AS "orgName", o.slug AS "orgSlug"
       FROM "Tournament" t
       LEFT JOIN "Organization" o ON o.id = t."organizationId"
       WHERE t.status NOT IN ('DRAFT', 'HIDDEN')
       ORDER BY t."startAt" ${order === "DESC" ? "DESC" : "ASC"}
       LIMIT ?`,
      limit
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      startAt: r.startAt,
      endAt: r.endAt,
      status: r.status,
      organizationId: r.organizationId,
      venue: r.venue,
      venueName: r.venueName,
      gameFormat: r.gameFormat,
      imageUrl: r.imageUrl,
      organization:
        r.orgId && r.orgName
          ? { id: r.orgId, name: r.orgName, slug: r.orgSlug ?? "" }
          : null,
    }));
  } catch {
    return [];
  }
}

/** 관리자용: 전체 토너먼트 목록 (상태 무관). 실패 시 빈 배열. */
export async function getTournamentsListAdminRaw(): Promise<TournamentListRow[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      {
        id: string;
        name: string;
        startAt: Date;
        endAt: Date | null;
        status: string;
        organizationId: string;
        venue: string | null;
        venueName: string | null;
        gameFormat: string | null;
        imageUrl: string | null;
        orgId: string | null;
        orgName: string | null;
        orgSlug: string | null;
      }[]
    >(
      `SELECT t.id, t.name, t."startAt", t."endAt", t.status, t."organizationId",
              t.venue, t."venueName", t."gameFormat", t."imageUrl",
              o.id AS "orgId", o.name AS "orgName", o.slug AS "orgSlug"
       FROM "Tournament" t
       LEFT JOIN "Organization" o ON o.id = t."organizationId"
       ORDER BY t."startAt" DESC
       LIMIT ?`,
      500
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      startAt: r.startAt,
      endAt: r.endAt,
      status: r.status,
      organizationId: r.organizationId,
      venue: r.venue,
      venueName: r.venueName,
      gameFormat: r.gameFormat,
      imageUrl: r.imageUrl,
      organization:
        r.orgId && r.orgName
          ? { id: r.orgId, name: r.orgName, slug: r.orgSlug ?? "" }
          : null,
    }));
  } catch {
    return [];
  }
}

/** 당구장(Organization type=VENUE) 목록. 클라이언트 승인(APPROVED)된 당구장만 포함. 메인 당구장 소개용 이미지(coverImageUrl) 포함. */
export async function getVenuesListRaw(
  take = 6
): Promise<{ id: string; name: string; slug: string; coverImageUrl: string | null }[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      { id: string; name: string; slug: string; coverImageUrl: string | null }[]
    >(
      `SELECT t.id, t.name, t.slug, t."coverImageUrl" FROM (
         SELECT DISTINCT ON (o.id) o.id, o.name, o.slug, o."coverImageUrl"
         FROM "Organization" o
         INNER JOIN "ClientApplication" a ON a."applicantUserId" = o."ownerUserId" AND a.status = 'APPROVED'
         WHERE o.type = 'VENUE'
         ORDER BY o.id
       ) t
       ORDER BY t.name ASC
       LIMIT $1`,
      take
    );
    return rows;
  } catch {
    return [];
  }
}

/** 당구장 목록 + 위도/경도 (거리 정렬용). take 상한 50. */
export async function getVenuesListWithCoords(
  take = 50
): Promise<{ id: string; name: string; slug: string; coverImageUrl: string | null; latitude: number | null; longitude: number | null }[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      { id: string; name: string; slug: string; coverImageUrl: string | null; latitude: number | null; longitude: number | null }[]
    >(
      `SELECT t.id, t.name, t.slug, t."coverImageUrl", t.latitude, t.longitude FROM (
         SELECT DISTINCT ON (o.id) o.id, o.name, o.slug, o."coverImageUrl", o.latitude, o.longitude
         FROM "Organization" o
         INNER JOIN "ClientApplication" a ON a."applicantUserId" = o."ownerUserId" AND a.status = 'APPROVED'
         WHERE o.type = 'VENUE'
         ORDER BY o.id
       ) t
       ORDER BY t.name ASC
       LIMIT $1`,
      take
    );
    return rows;
  } catch {
    return [];
  }
}

/** 공개 토너먼트 목록 + 주최 조직 위도/경도 (거리 정렬용). take 상한 50. */
export async function getTournamentsListWithOrgCoords(
  take = 50
): Promise<
  (TournamentListRow & { orgLatitude: number | null; orgLongitude: number | null })[]
> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      {
        id: string;
        name: string;
        startAt: Date;
        endAt: Date | null;
        status: string;
        organizationId: string;
        venue: string | null;
        venueName: string | null;
        gameFormat: string | null;
        imageUrl: string | null;
        orgId: string | null;
        orgName: string | null;
        orgSlug: string | null;
        orgLatitude: number | null;
        orgLongitude: number | null;
      }[]
    >(
      `SELECT t.id, t.name, t."startAt", t."endAt", t.status, t."organizationId",
              t.venue, t."venueName", t."gameFormat", t."imageUrl",
              o.id AS "orgId", o.name AS "orgName", o.slug AS "orgSlug",
              o.latitude AS "orgLatitude", o.longitude AS "orgLongitude"
       FROM "Tournament" t
       LEFT JOIN "Organization" o ON o.id = t."organizationId"
       WHERE t.status NOT IN ('DRAFT', 'HIDDEN')
       ORDER BY t."startAt" ASC
       LIMIT $1`,
      take
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      startAt: r.startAt,
      endAt: r.endAt,
      status: r.status,
      organizationId: r.organizationId,
      venue: r.venue,
      venueName: r.venueName,
      gameFormat: r.gameFormat,
      imageUrl: r.imageUrl,
      organization:
        r.orgId && r.orgName
          ? { id: r.orgId, name: r.orgName, slug: r.orgSlug ?? "" }
          : null,
      orgLatitude: r.orgLatitude,
      orgLongitude: r.orgLongitude,
    }));
  } catch {
    return [];
  }
}
