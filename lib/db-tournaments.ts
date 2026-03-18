/**
 * 토너먼트 목록 조회 — Prisma 스키마 불일치(P2022) 시에도 동작하도록 raw SQL 사용.
 * DB에 Tournament/Organization 테이블이 없으면 쿼리 실패 시 빈 배열 반환(콘솔에 prisma:error 가능).
 * 테이블 생성: npm run db:push 또는 npx prisma migrate dev
 */

import { prisma } from "@/lib/db";
import {
  ORGANIZATION_SELECT_PUBLIC,
  ORGANIZATION_SELECT_ADMIN_EDIT,
  TOURNAMENT_SELECT_BASIC,
} from "@/lib/db-selects";
import { haversineKm } from "@/lib/distance";
import { normalizeSlug } from "@/lib/normalize-slug";

/** 대회 수정 페이지용: organization은 select만 사용 (promo/venue 등 불필요 컬럼 미조회) */
export type TournamentForEdit = Awaited<
  ReturnType<
    typeof prisma.tournament.findUnique<{
      where: { id: string };
      include: {
        organization: { select: typeof ORGANIZATION_SELECT_ADMIN_EDIT };
        rule: true;
        _count: { select: { entries: true } };
        tournamentVenues: {
          orderBy: { sortOrder: "asc" };
          include: { organization: { select: typeof ORGANIZATION_SELECT_PUBLIC } };
        };
      };
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
          ? normalizeSlug({ id: r.orgId, name: r.orgName, slug: r.orgSlug })
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
          ? normalizeSlug({ id: r.orgId, name: r.orgName, slug: r.orgSlug })
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
          ? normalizeSlug({ id: r.orgId, name: r.orgName, slug: r.orgSlug })
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

/** 당구장 목록 + 위도/경도 + 대대전용/복합구장 구분. take 상한 150. */
export type VenueListRow = {
  id: string;
  name: string;
  slug: string;
  coverImageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  venueCategory: "daedae_only" | "mixed" | null;
};

export async function getVenuesListWithCoords(
  take = 50
): Promise<VenueListRow[]> {
  try {
    const rows = await prisma.organization.findMany({
      where: {
        type: "VENUE",
        slug: { not: null },
        ownerUserId: { in: await getApprovedApplicantUserIds() },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        coverImageUrl: true,
        latitude: true,
        longitude: true,
        typeSpecificJson: true,
      },
      orderBy: { name: "asc" },
      take: Math.min(take, 150),
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug!,
      coverImageUrl: r.coverImageUrl ?? null,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      venueCategory: venueCategoryFromTypeSpecific(r.typeSpecificJson),
    }));
  } catch {
    return [];
  }
}

async function getApprovedApplicantUserIds(): Promise<string[]> {
  const rows = await prisma.clientApplication.findMany({
    where: { status: "APPROVED" },
    select: { applicantUserId: true },
    distinct: ["applicantUserId"],
  });
  return rows.map((r) => r.applicantUserId).filter((id): id is string => id != null);
}

/** 공개 상세용 경량 relation select (무거운 entries/rounds/brackets 제외) */
const TOURNAMENT_BASIC_RELATIONS = {
  organization: { select: ORGANIZATION_SELECT_PUBLIC },
  rule: true,
  _count: { select: { tournamentZones: true, finalMatches: true } },
  matchVenues: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      tournamentId: true,
      venueNumber: true,
      displayLabel: true,
      venueName: true,
      address: true,
      phone: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  tournamentVenues: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      tournamentId: true,
      organizationId: true,
      sortOrder: true,
      createdAt: true,
      organization: { select: ORGANIZATION_SELECT_PUBLIC },
    },
  },
} as const;

/** 대회 상세 첫 화면: TOURNAMENT_SELECT_BASIC + organization, rule, matchVenues, tournamentVenues, _count만. entries/rounds/brackets 별도 조회. */
/** outlinePdfUrl·promoPdfUrl 미존재 DB 호환: 실패 시 해당 컬럼 제외 select로 재시도 후 null 보정. */
export async function getTournamentBasic(id: string) {
  try {
    return await prisma.tournament.findUnique({
      where: { id },
      select: {
        ...TOURNAMENT_SELECT_BASIC,
        ...TOURNAMENT_BASIC_RELATIONS,
      },
    });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    const isMissingColumn =
      err?.message?.includes("outlinePdfUrl") || err?.message?.includes("promoPdfUrl") || err?.code === "P2010";
    if (!isMissingColumn) throw e;

    const { outlinePdfUrl: _omit, ...basicWithoutPdf } = TOURNAMENT_SELECT_BASIC;
    const row = await prisma.tournament.findUnique({
      where: { id },
      select: {
        ...basicWithoutPdf,
        ...TOURNAMENT_BASIC_RELATIONS,
      },
    });
    if (!row) return null;
    return { ...row, outlinePdfUrl: null as string | null };
  }
}

/** 대회 상세 후속 로딩용: 엔트리 목록만 (참가자 명단/참가신청 탭). 무거운 relation이므로 첫 렌더에서 호출 금지. */
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
      prizeInfo: r.prizeInfo ?? null,
      imageUrl: r.imageUrl,
      posterImageUrl: r.posterImageUrl ?? null,
      summary: r.summary ?? null,
      maxParticipants: r.maxParticipants ?? null,
      confirmedCount: Number(r.confirmedCount ?? 0),
      organization:
        r.orgId && r.orgName
          ? normalizeSlug({ id: r.orgId, name: r.orgName, slug: r.orgSlug })
          : null,
      orgLatitude: r.orgLatitude,
      orgLongitude: r.orgLongitude,
    }));
  } catch {
    return [];
  }
}
