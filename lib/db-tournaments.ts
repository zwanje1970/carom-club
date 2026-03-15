/**
 * 토너먼트 목록 조회 — Prisma 스키마 불일치(P2022) 시에도 동작하도록 raw SQL 사용.
 * DB에 Tournament/Organization 테이블이 없으면 쿼리 실패 시 빈 배열 반환(콘솔에 prisma:error 가능).
 * 테이블 생성: npm run db:push 또는 npx prisma migrate dev
 */

import { prisma } from "@/lib/db";
import { haversineKm } from "@/lib/distance";

/** 대회 수정 페이지용 findUnique include 타입 (.tsx에서 제네릭 파싱 이슈 회피) */
export type TournamentForEdit = Awaited<
  ReturnType<
    typeof prisma.tournament.findUnique<{
      where: { id: string };
      include: { organization: true; rule: true; _count: { select: { entries: true } }; tournamentVenues: { include: { organization: { select: { id: true; name: true } } } } };
    }>
  >
>;

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
  prizeInfo: string | null;
  imageUrl: string | null;
  posterImageUrl: string | null;
  summary: string | null;
  maxParticipants: number | null;
  confirmedCount: number;
  organization: { id: string; name: string; slug: string } | null;
};

/** 공개 대회 목록 페이지용: 탭(예정/마감/종료) + 정렬(거리/마감임박/날짜) + 전국대회 필터. */
export type TournamentsListTab = "upcoming" | "closed" | "finished";
export type TournamentsListSort = "distance" | "deadline" | "date";

export async function getTournamentsListForPublicPage(options: {
  tab: TournamentsListTab;
  sortBy: TournamentsListSort;
  nationalOnly?: boolean;
  lat?: number;
  lng?: number;
  take?: number;
}): Promise<(TournamentListRow & { distanceKm?: number | null })[]> {
  const { tab, sortBy, nationalOnly = false, lat, lng, take = 200 } = options;
  const hasCoords = typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng);

  const tabWhere: string =
    tab === "upcoming"
      ? "t.status = 'OPEN' AND t.\"startAt\" >= CURRENT_DATE"
      : tab === "closed"
        ? "t.status IN ('CLOSED','BRACKET_GENERATED') AND t.\"startAt\" >= CURRENT_DATE"
        : "(t.status = 'FINISHED' OR t.\"startAt\" < CURRENT_DATE)";
  const nationalWhere = nationalOnly
    ? " AND (t.region = '전국' OR t.region ILIKE '%전국%')"
    : "";
  const dateOrder =
    tab === "finished"
      ? "t.\"startAt\" DESC"
      : "t.\"startAt\" ASC";

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
        prizeInfo: string | null;
        imageUrl: string | null;
        posterImageUrl: string | null;
        summary: string | null;
        maxParticipants: number | null;
        confirmedCount: bigint;
        orgId: string | null;
        orgName: string | null;
        orgSlug: string | null;
        orgLatitude: number | null;
        orgLongitude: number | null;
      }[]
    >(
      `SELECT t.id, t.name, t."startAt", t."endAt", t.status, t."organizationId",
              t.venue, t."venueName", t."gameFormat", t."prizeInfo", t."imageUrl", t."posterImageUrl", t.summary,
              t."maxParticipants",
              (SELECT COUNT(*) FROM "TournamentEntry" e WHERE e."tournamentId" = t.id AND e.status = 'CONFIRMED')::int AS "confirmedCount",
              o.id AS "orgId", o.name AS "orgName", o.slug AS "orgSlug",
              o.latitude AS "orgLatitude", o.longitude AS "orgLongitude"
       FROM "Tournament" t
       LEFT JOIN "Organization" o ON o.id = t."organizationId"
       WHERE t.status NOT IN ('DRAFT', 'HIDDEN') AND (${tabWhere})${nationalWhere}
       ORDER BY ${dateOrder}
       LIMIT $1`,
      take
    );

    const list = rows.map((r) => ({
      id: r.id,
      name: r.name,
      startAt: r.startAt,
      endAt: r.endAt,
      status: r.status,
      organizationId: r.organizationId,
      venue: r.venue,
      venueName: r.venueName,
      gameFormat: r.gameFormat,
      prizeInfo: r.prizeInfo ?? null,
      imageUrl: r.imageUrl,
      posterImageUrl: r.posterImageUrl ?? null,
      summary: r.summary,
      maxParticipants: r.maxParticipants,
      confirmedCount: Number(r.confirmedCount ?? 0),
      organization:
        r.orgId && r.orgName
          ? { id: r.orgId, name: r.orgName, slug: r.orgSlug ?? "" }
          : null,
      distanceKm: null as number | null,
    }));

    if (sortBy === "distance" && hasCoords && list.length > 0) {
      const withDist = list.map((t) => {
        const r = rows.find((x) => x.id === t.id)!;
        const km = haversineKm(lat!, lng!, r.orgLatitude, r.orgLongitude);
        return { ...t, distanceKm: km };
      });
      withDist.sort((a, b) => {
        const ka = a.distanceKm;
        const kb = b.distanceKm;
        if (ka == null && kb == null) return 0;
        if (ka == null) return 1;
        if (kb == null) return -1;
        return ka - kb;
      });
      return withDist;
    }

    return list;
  } catch {
    return [];
  }
}

/**
 * 공개 토너먼트 목록 (DRAFT/HIDDEN 제외). 실패 시 빈 배열 반환.
 * [확장] 유료화 시: Tournament.isPromoted, promotionLevel, promotionEndDate 로 홍보 상품 노출·정렬 추가 가능. 현재는 미사용.
 */
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
        prizeInfo: string | null;
        imageUrl: string | null;
        posterImageUrl: string | null;
        summary: string | null;
        maxParticipants: number | null;
        confirmedCount: bigint;
        orgId: string | null;
        orgName: string | null;
        orgSlug: string | null;
      }[]
    >(
      `SELECT t.id, t.name, t."startAt", t."endAt", t.status, t."organizationId",
              t.venue, t."venueName", t."gameFormat", t."prizeInfo", t."imageUrl", t."posterImageUrl", t.summary,
              t."maxParticipants",
              (SELECT COUNT(*) FROM "TournamentEntry" e WHERE e."tournamentId" = t.id AND e.status = 'CONFIRMED')::int AS "confirmedCount",
              o.id AS "orgId", o.name AS "orgName", o.slug AS "orgSlug"
       FROM "Tournament" t
       LEFT JOIN "Organization" o ON o.id = t."organizationId"
       WHERE t.status NOT IN ('DRAFT', 'HIDDEN')
       ORDER BY t."startAt" ${order === "DESC" ? "DESC" : "ASC"}
       LIMIT $1`,
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
      prizeInfo: r.prizeInfo ?? null,
      imageUrl: r.imageUrl,
      posterImageUrl: r.posterImageUrl,
      summary: r.summary,
      maxParticipants: r.maxParticipants,
      confirmedCount: Number(r.confirmedCount ?? 0),
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
        prizeInfo: string | null;
        imageUrl: string | null;
        posterImageUrl: string | null;
        summary: string | null;
        maxParticipants: number | null;
        confirmedCount: bigint;
        orgId: string | null;
        orgName: string | null;
        orgSlug: string | null;
      }[]
    >(
      `SELECT t.id, t.name, t."startAt", t."endAt", t.status, t."organizationId",
              t.venue, t."venueName", t."gameFormat", t."prizeInfo", t."imageUrl", t."posterImageUrl", t.summary, t."maxParticipants",
              (SELECT COUNT(*)::int FROM "TournamentEntry" e WHERE e."tournamentId" = t.id AND e.status = 'CONFIRMED') AS "confirmedCount",
              o.id AS "orgId", o.name AS "orgName", o.slug AS "orgSlug"
       FROM "Tournament" t
       LEFT JOIN "Organization" o ON o.id = t."organizationId"
       ORDER BY t."startAt" DESC
       LIMIT $1`,
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
      prizeInfo: r.prizeInfo ?? null,
      imageUrl: r.imageUrl,
      posterImageUrl: r.posterImageUrl ?? null,
      summary: r.summary ?? null,
      maxParticipants: r.maxParticipants ?? null,
      confirmedCount: Number(r.confirmedCount) ?? 0,
      organization:
        r.orgId && r.orgName
          ? { id: r.orgId, name: r.orgName, slug: r.orgSlug ?? "" }
          : null,
    }));
  } catch {
    return [];
  }
}

/** 당구장 소개 캐러셀용: type=VENUE, 등록 클라이언트 우선 → 일반 클라이언트 순. logoImageUrl 사용(없으면 coverImageUrl). */
/** typeSpecificJson에서 대대전용/복합구장 구분. 설정에서 지정한 값 우선, 없으면 대대/중대/포켓으로 추론 */
function venueCategoryFromTypeSpecific(json: string | null): "daedae_only" | "mixed" | null {
  if (!json?.trim()) return null;
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    if (o.venueCategory === "daedae_only" || o.venueCategory === "mixed") return o.venueCategory as "daedae_only" | "mixed";
    const has = (t: unknown) =>
      t && typeof t === "object" && ("kind" in t || "count" in t || "fee" in t);
    const hasJungdae = has(o.jungdae);
    const hasPocket = has(o.pocket);
    const hasDaedae = has(o.daedae);
    if (hasJungdae || hasPocket) return "mixed";
    if (hasDaedae) return "daedae_only";
    return null;
  } catch {
    return null;
  }
}

export type VenueCarouselRow = {
  id: string;
  name: string;
  slug: string;
  logoImageUrl: string | null;
  coverImageUrl: string | null;
  venueCategory: "daedae_only" | "mixed" | null;
};

export async function getVenuesForCarousel(take = 50): Promise<VenueCarouselRow[]> {
  try {
    const rows = await prisma.organization.findMany({
      where: { type: "VENUE", slug: { not: null } },
      select: {
        id: true,
        name: true,
        slug: true,
        logoImageUrl: true,
        coverImageUrl: true,
        clientType: true,
        typeSpecificJson: true,
      },
      take: take * 2,
    });
    const withCategory = rows.map((r) => ({
      ...r,
      venueCategory: venueCategoryFromTypeSpecific(r.typeSpecificJson),
    }));
    const sorted = [...withCategory].sort((a, b) => {
      const order = (c: string | null) => (c === "REGISTERED" ? 0 : 1);
      const clientOrder = order(a.clientType) - order(b.clientType);
      if (clientOrder !== 0) return clientOrder;
      const catOrder = (x: "daedae_only" | "mixed" | null) =>
        x === "daedae_only" ? 0 : x === "mixed" ? 1 : 2;
      return catOrder(a.venueCategory) - catOrder(b.venueCategory) || a.name.localeCompare(b.name);
    });
    return sorted.slice(0, take).map(({ id, name, slug, logoImageUrl, coverImageUrl, venueCategory }) => ({
      id,
      name,
      slug: slug!,
      logoImageUrl: logoImageUrl ?? null,
      coverImageUrl: coverImageUrl ?? null,
      venueCategory,
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
         WHERE o.type = 'VENUE' AND o.slug IS NOT NULL
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
         WHERE o.type = 'VENUE' AND o.slug IS NOT NULL
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

/** 대회 상세 첫 화면용: organization, rule, matchVenues, tournamentVenues, _count만. entries 제외로 첫 응답 경량화. */
export async function getTournamentBasic(id: string) {
  return prisma.tournament.findUnique({
    where: { id },
    include: {
      organization: true,
      rule: true,
      _count: { select: { tournamentZones: true, finalMatches: true } },
      matchVenues: { orderBy: { sortOrder: "asc" } },
      tournamentVenues: {
        orderBy: { sortOrder: "asc" },
        include: { organization: { select: { id: true, name: true, slug: true } } },
      },
    },
  });
}

/** 대회 상세 후속 로딩용: 엔트리 목록만 (참가자 명단/참가신청 탭). */
export async function getTournamentEntries(id: string) {
  return prisma.tournamentEntry.findMany({
    where: { tournamentId: id },
    include: {
      user: { include: { memberProfile: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
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
        posterImageUrl: string | null;
        summary: string | null;
        maxParticipants: number | null;
        confirmedCount: bigint;
        orgId: string | null;
        orgName: string | null;
        orgSlug: string | null;
        orgLatitude: number | null;
        orgLongitude: number | null;
      }[]
    >(
      `SELECT t.id, t.name, t."startAt", t."endAt", t.status, t."organizationId",
              t.venue, t."venueName", t."gameFormat", t."imageUrl", t."posterImageUrl", t.summary,
              t."maxParticipants",
              (SELECT COUNT(*) FROM "TournamentEntry" e WHERE e."tournamentId" = t.id AND e.status = 'CONFIRMED')::bigint AS "confirmedCount",
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
      posterImageUrl: r.posterImageUrl ?? null,
      summary: r.summary ?? null,
      maxParticipants: r.maxParticipants ?? null,
      confirmedCount: Number(r.confirmedCount ?? 0),
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
