import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import type { ClientOrganizationStored } from "../../../../lib/platform-api";
import {
  getClientOrganizationByUserId,
  getClientStatusByUserId,
  getLatestClientApplicationByUserId,
  getUserById,
  upsertClientOrganizationForUser,
} from "../../../../lib/platform-api";

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

function organizationToJson(org: ClientOrganizationStored) {
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    type: org.type,
    shortDescription: org.shortDescription,
    description: org.description,
    fullDescription: org.fullDescription,
    logoImageUrl: org.logoImageUrl,
    coverImageUrl: org.coverImageUrl,
    phone: org.phone,
    email: org.email,
    website: org.website,
    address: org.address,
    addressDetail: org.addressDetail,
    addressJibun: org.addressJibun,
    zipCode: org.zipCode,
    latitude: org.latitude,
    longitude: org.longitude,
    addressNaverMapEnabled: org.addressNaverMapEnabled,
    region: org.region,
    typeSpecificJson: org.typeSpecificJson,
    isPublished: org.isPublished,
    setupCompleted: org.setupCompleted,
    autoParticipantPushEnabled: org.autoParticipantPushEnabled !== false,
  };
}

function virtualOrgForGet(userId: string, defaultName: string): ClientOrganizationStored {
  const now = new Date().toISOString();
  return {
    clientUserId: userId,
    id: `client-org-${userId}`,
    slug: "",
    name: defaultName,
    type: "VENUE",
    shortDescription: null,
    description: null,
    fullDescription: null,
    logoImageUrl: null,
    coverImageUrl: null,
    phone: null,
    email: null,
    website: null,
    address: null,
    addressDetail: null,
    addressJibun: null,
    zipCode: null,
    latitude: null,
    longitude: null,
    addressNaverMapEnabled: false,
    region: null,
    typeSpecificJson: null,
    clientType: "GENERAL",
    approvalStatus: "APPROVED",
    status: "ACTIVE",
    adminRemarks: null,
    membershipType: "NONE",
    membershipExpireAt: null,
    isPublished: false,
    setupCompleted: false,
    autoParticipantPushEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** GET: 승인된 클라이언트의 사업장 설정 (없으면 신청서 조직명 등 기본값만 채운 가상 객체) */
export async function GET() {
  const auth = await getAuthorizedClientUser();
  if (!auth) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!auth.allowed) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { user } = auth;
  if (user.role === "PLATFORM") {
    return NextResponse.json({ error: "클라이언트 전용입니다." }, { status: 403 });
  }

  const stored = await getClientOrganizationByUserId(user.id);
  if (stored) {
    return NextResponse.json(organizationToJson(stored));
  }

  const app = await getLatestClientApplicationByUserId(user.id);
  const defaultName = app?.organizationName?.trim() ?? "";

  return NextResponse.json(organizationToJson(virtualOrgForGet(user.id, defaultName)));
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

function bodyHas(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

/** PATCH: 사업장 설정 저장 (업체 종류 type 은 변경하지 않음) */
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

  const stored = await getClientOrganizationByUserId(user.id);
  const app = await getLatestClientApplicationByUserId(user.id);
  const defaultNameFromApp = app?.organizationName?.trim() ?? "";

  const nameRaw = typeof body.name === "string" ? body.name.trim() : "";
  const name = nameRaw !== "" ? nameRaw : (stored?.name?.trim() || defaultNameFromApp);
  if (!name.trim()) {
    return NextResponse.json({ error: "업체명을 입력해 주세요." }, { status: 400 });
  }

  let typeSpecificJson: string | null;
  if (!bodyHas(body, "typeSpecificJson")) {
    typeSpecificJson = stored?.typeSpecificJson ?? null;
  } else if (body.typeSpecificJson === null || body.typeSpecificJson === undefined) {
    typeSpecificJson = null;
  } else if (typeof body.typeSpecificJson === "string") {
    const t = body.typeSpecificJson.trim();
    typeSpecificJson = t.length ? t : null;
  } else {
    typeSpecificJson = stored?.typeSpecificJson ?? null;
  }

  const pickTrim = (key: keyof ClientOrganizationStored): string | null => {
    if (bodyHas(body, key as string)) return trimOrNull(body[key as string]);
    if (!stored) return null;
    const v = stored[key];
    return typeof v === "string" ? v : null;
  };

  const addressNaverMapEnabled = bodyHas(body, "addressNaverMapEnabled")
    ? body.addressNaverMapEnabled === true
    : stored?.addressNaverMapEnabled === true;

  const isPublished = bodyHas(body, "isPublished") ? body.isPublished === true : (stored?.isPublished ?? false);

  const setupCompleted = bodyHas(body, "setupCompleted")
    ? body.setupCompleted === true
    : (stored?.setupCompleted ?? false);

  const autoParticipantPushEnabled = !bodyHas(body, "autoParticipantPushEnabled")
    ? stored?.autoParticipantPushEnabled !== false
    : typeof body.autoParticipantPushEnabled === "boolean"
      ? body.autoParticipantPushEnabled
      : stored?.autoParticipantPushEnabled !== false;

  const result = await upsertClientOrganizationForUser(user.id, {
    name,
    shortDescription: pickTrim("shortDescription"),
    description: pickTrim("description"),
    fullDescription: pickTrim("fullDescription"),
    logoImageUrl: pickTrim("logoImageUrl"),
    coverImageUrl: pickTrim("coverImageUrl"),
    phone: pickTrim("phone"),
    email: pickTrim("email"),
    website: pickTrim("website"),
    address: pickTrim("address"),
    addressDetail: pickTrim("addressDetail"),
    addressJibun: pickTrim("addressJibun"),
    zipCode: pickTrim("zipCode"),
    latitude: bodyHas(body, "latitude") ? finiteNumberOrNull(body.latitude) : (stored?.latitude ?? null),
    longitude: bodyHas(body, "longitude") ? finiteNumberOrNull(body.longitude) : (stored?.longitude ?? null),
    addressNaverMapEnabled,
    region: pickTrim("region"),
    typeSpecificJson,
    isPublished,
    setupCompleted,
    autoParticipantPushEnabled,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(organizationToJson(result.org));
}
