import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** GET: CLIENT_ADMIN 본인 소유 업체 1개 반환 */
export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return NextResponse.json({ error: "소속된 업체가 없습니다." }, { status: 404 });
  }
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });
  if (!org) {
    return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(org);
}

/** PATCH: CLIENT_ADMIN 본인 소유 업체 프로필 보완 (slug, 로고, 커버, 설명, 주소, 공개 여부, setupCompleted) */
export async function PATCH(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return NextResponse.json({ error: "소속된 업체가 없습니다." }, { status: 403 });
  }

  const body = await request.json();
  const {
    slug,
    name,
    shortDescription,
    description,
    fullDescription,
    logoImageUrl,
    coverImageUrl,
    phone,
    email,
    website,
    address,
    addressNaverMapEnabled,
    region,
    latitude,
    longitude,
    typeSpecificJson,
    isPublished,
    setupCompleted,
  } = body as {
    slug?: string;
    name?: string;
    shortDescription?: string;
    description?: string;
    fullDescription?: string;
    logoImageUrl?: string;
    coverImageUrl?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    addressNaverMapEnabled?: boolean;
    region?: string;
    latitude?: number;
    longitude?: number;
    typeSpecificJson?: string | null;
    isPublished?: boolean;
    setupCompleted?: boolean;
  };

  let slugValue: string | undefined;
  if (slug !== undefined) {
    slugValue = slug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9가-힣-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "") || undefined;
    if (!slugValue) {
      return NextResponse.json({ error: "slug를 입력해 주세요." }, { status: 400 });
    }
    const existing = await prisma.organization.findUnique({
      where: { slug: slugValue },
    });
    if (existing && existing.id !== orgId) {
      return NextResponse.json({ error: "이미 사용 중인 주소(slug)입니다." }, { status: 400 });
    }
  }

  try {
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(slugValue !== undefined && { slug: slugValue }),
        ...(name !== undefined && { name: name.trim() || undefined }),
        // type(업체 종류)는 클라이언트 신청 시 지정된 값으로 고정. PATCH에서 변경 불가.
        ...(shortDescription !== undefined && { shortDescription: shortDescription.trim() || null }),
        ...(description !== undefined && { description: description.trim() || null }),
        ...(fullDescription !== undefined && { fullDescription: fullDescription.trim() || null }),
        ...(logoImageUrl !== undefined && { logoImageUrl: logoImageUrl?.trim() || null }),
        ...(coverImageUrl !== undefined && { coverImageUrl: coverImageUrl?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(website !== undefined && { website: website?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(addressNaverMapEnabled !== undefined && { addressNaverMapEnabled: !!addressNaverMapEnabled }),
        ...(region !== undefined && { region: region?.trim() || null }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(typeSpecificJson !== undefined && { typeSpecificJson: typeSpecificJson ?? null }),
        ...(isPublished !== undefined && { isPublished: !!isPublished }),
        ...(setupCompleted !== undefined && { setupCompleted: !!setupCompleted }),
      },
    });
    return NextResponse.json(org);
  } catch (e) {
    console.error("[client/organization] PATCH error:", e);
    return NextResponse.json(
      { error: "저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
