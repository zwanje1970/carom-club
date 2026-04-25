import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
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

function organizationToJson(org: {
  id: string;
  slug: string;
  name: string;
  type: string;
  shortDescription: string | null;
  description: string | null;
  fullDescription: string | null;
  logoImageUrl: string | null;
  coverImageUrl: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  addressDetail: string | null;
  addressJibun: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  addressNaverMapEnabled: boolean | null;
  region: string | null;
  typeSpecificJson: string | null;
  isPublished: boolean;
  setupCompleted: boolean;
}) {
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

  return NextResponse.json(
    organizationToJson({
      id: `client-org-${user.id}`,
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
      isPublished: false,
      setupCompleted: false,
    })
  );
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

  const name = typeof body.name === "string" ? body.name : "";

  let typeSpecificJson: string | null = null;
  if (body.typeSpecificJson === null || body.typeSpecificJson === undefined) {
    typeSpecificJson = null;
  } else if (typeof body.typeSpecificJson === "string") {
    const t = body.typeSpecificJson.trim();
    typeSpecificJson = t.length ? t : null;
  }

  const result = await upsertClientOrganizationForUser(user.id, {
    name,
    shortDescription: trimOrNull(body.shortDescription),
    description: trimOrNull(body.description),
    fullDescription: trimOrNull(body.fullDescription),
    logoImageUrl: trimOrNull(body.logoImageUrl),
    coverImageUrl: trimOrNull(body.coverImageUrl),
    phone: trimOrNull(body.phone),
    email: trimOrNull(body.email),
    website: trimOrNull(body.website),
    address: trimOrNull(body.address),
    addressDetail: trimOrNull(body.addressDetail),
    addressJibun: trimOrNull(body.addressJibun),
    zipCode: trimOrNull(body.zipCode),
    latitude: finiteNumberOrNull(body.latitude),
    longitude: finiteNumberOrNull(body.longitude),
    addressNaverMapEnabled: body.addressNaverMapEnabled === true,
    region: trimOrNull(body.region),
    typeSpecificJson,
    isPublished: body.isPublished === true,
    setupCompleted: body.setupCompleted === true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(organizationToJson(result.org));
}
