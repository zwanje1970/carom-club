import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { isEmptyOutlineHtml } from "../../../../lib/outline-content-helpers";
import type { OutlineDisplayMode } from "../../../../lib/outline-content-types";
import {
  getClientOrganizationByUserId,
  getClientStatusByUserId,
  getClientVenueIntroByUserId,
  getUserById,
  upsertClientOrganizationForUser,
  upsertClientVenueIntroForUser,
} from "../../../../lib/platform-api";
import {
  isOrgType,
  normalizeRepresentativeImageUrls,
  parseTypeSpecific,
} from "../../../../lib/client-organization-setup-parse";
import type { OrgType, VenueSpecific } from "../../../../lib/client-organization-setup-types";

export const runtime = "nodejs";

async function getAuthorizedClientUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return null;

  const user = await getUserById(session.userId);
  if (!user) return null;

  if (user.role === "PLATFORM") {
    return { user, allowed: true as const };
  }

  if (user.role !== "CLIENT") {
    return { user, allowed: false as const };
  }

  const clientStatus = await getClientStatusByUserId(user.id);
  if (clientStatus !== "APPROVED") {
    return { user, allowed: false as const };
  }

  return { user, allowed: true as const };
}

function parseOutlineDisplayMode(v: unknown): OutlineDisplayMode | null {
  if (v === "TEXT" || v === "IMAGE" || v === "PDF") return v;
  return null;
}

function trimOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function finiteNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function introToJson(row: {
  outlineDisplayMode: OutlineDisplayMode | null;
  outlineHtml: string | null;
  outlineImageUrl: string | null;
  outlinePdfUrl: string | null;
}) {
  return {
    outlineDisplayMode: row.outlineDisplayMode,
    outlineHtml: row.outlineHtml,
    outlineImageUrl: row.outlineImageUrl,
    outlinePdfUrl: row.outlinePdfUrl,
  };
}

export async function GET() {
  const auth = await getAuthorizedClientUser();
  if (!auth || !auth.allowed) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { user } = auth;
  if (user.role === "PLATFORM") {
    return NextResponse.json({ error: "클라이언트 전용입니다." }, { status: 403 });
  }

  const stored = await getClientVenueIntroByUserId(user.id);
  if (stored) {
    return NextResponse.json(introToJson(stored));
  }

  return NextResponse.json({
    outlineDisplayMode: null,
    outlineHtml: null,
    outlineImageUrl: null,
    outlinePdfUrl: null,
  });
}

export async function PATCH(request: Request) {
  const auth = await getAuthorizedClientUser();
  if (!auth || !auth.allowed) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { user } = auth;
  if (user.role === "PLATFORM") {
    return NextResponse.json({ error: "클라이언트 전용입니다." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const outlineHtmlRaw = body.outlineHtml;
  const outlineHtmlCandidate = typeof outlineHtmlRaw === "string" ? outlineHtmlRaw : "";
  const outlineHtml =
    outlineHtmlCandidate !== "" && !isEmptyOutlineHtml(outlineHtmlCandidate) ? outlineHtmlCandidate : null;

  const outlineImageUrlRaw = body.outlineImageUrl;
  const outlineImageUrl =
    typeof outlineImageUrlRaw === "string" && outlineImageUrlRaw.trim() !== ""
      ? outlineImageUrlRaw.trim()
      : null;

  const outlinePdfUrlRaw = body.outlinePdfUrl;
  const outlinePdfUrl =
    typeof outlinePdfUrlRaw === "string" && outlinePdfUrlRaw.trim() !== "" ? outlinePdfUrlRaw.trim() : null;

  const outlineModeParsed = parseOutlineDisplayMode(body.outlineDisplayMode);
  const hasAnyOutline = Boolean(outlineHtml || outlineImageUrl || outlinePdfUrl);
  const outlineDisplayMode: OutlineDisplayMode | null = hasAnyOutline ? outlineModeParsed ?? "TEXT" : null;

  const saved = await upsertClientVenueIntroForUser(user.id, {
    outlineDisplayMode,
    outlineHtml,
    outlineImageUrl,
    outlinePdfUrl,
  });

  const wantsOrgImages =
    body.logoImageUrl !== undefined ||
    body.coverImageUrl !== undefined ||
    body.representativeImageUrls !== undefined;

  if (wantsOrgImages) {
    const existing = await getClientOrganizationByUserId(user.id);
    if (existing) {
      const orgType: OrgType = isOrgType(existing.type) ? existing.type : "VENUE";

      let logoImageUrl = existing.logoImageUrl;
      if (body.logoImageUrl !== undefined) {
        logoImageUrl = trimOrNull(body.logoImageUrl);
      }

      let coverImageUrl = existing.coverImageUrl;
      let typeSpecificJson = existing.typeSpecificJson;

      if (orgType === "VENUE" && body.representativeImageUrls !== undefined) {
        const ts = parseTypeSpecific("VENUE", existing.typeSpecificJson) as VenueSpecific;
        ts.representativeImageUrls = normalizeRepresentativeImageUrls(body.representativeImageUrls);
        typeSpecificJson = Object.keys(ts as object).length === 0 ? null : JSON.stringify(ts);
        coverImageUrl = (ts.representativeImageUrls ?? [])[0] ?? null;
      } else if (body.coverImageUrl !== undefined) {
        coverImageUrl = trimOrNull(body.coverImageUrl);
      }

      await upsertClientOrganizationForUser(user.id, {
        name: existing.name,
        shortDescription: existing.shortDescription,
        description: existing.description,
        fullDescription: existing.fullDescription,
        logoImageUrl,
        coverImageUrl,
        phone: existing.phone,
        email: existing.email,
        website: existing.website,
        address: existing.address,
        addressDetail: existing.addressDetail,
        addressJibun: existing.addressJibun,
        zipCode: existing.zipCode,
        latitude: finiteNumberOrNull(existing.latitude),
        longitude: finiteNumberOrNull(existing.longitude),
        addressNaverMapEnabled: existing.addressNaverMapEnabled === true,
        region: existing.region,
        typeSpecificJson,
        isPublished: existing.isPublished,
        setupCompleted: existing.setupCompleted,
        autoParticipantPushEnabled: existing.autoParticipantPushEnabled !== false,
      });
    }
  }

  return NextResponse.json(introToJson(saved));
}
