import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureDatabaseUrlForDevelopment, isDatabaseConfigured } from "@/lib/db-mode";

/** GET: 현재 로그인 사용자의 클라이언트 신청 내역 (가장 최근 1건). Prisma 스키마 오류 회피를 위해 raw SQL만 사용 */
export async function GET() {
  ensureDatabaseUrlForDevelopment();
  let session;
  try {
    session = await getSession();
  } catch (e) {
    console.error("[mypage/client-application] getSession error:", e);
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ application: null }, { status: 200 });
  }

  try {
    const rows = await prisma.$queryRawUnsafe<
      {
        id: string;
        type: string;
        status: string;
        organizationName: string;
        applicantName: string;
        phone: string;
        email: string;
        region: string | null;
        shortDescription: string | null;
        referenceLink: string | null;
        createdAt: Date;
        reviewedAt: Date | null;
        rejectedReason: string | null;
      }[]
    >(
      `SELECT id, type, status, "organizationName", "applicantName", phone, email, region, "shortDescription", "referenceLink", "createdAt", "reviewedAt", "rejectedReason"
       FROM "ClientApplication"
       WHERE "applicantUserId" = $1 OR email = $2
       ORDER BY "createdAt" DESC
       LIMIT 1`,
      session.id,
      session.email ?? ""
    );
    const application = rows[0]
      ? {
          id: rows[0].id,
          type: rows[0].type,
          status: rows[0].status,
          organizationName: rows[0].organizationName,
          applicantName: rows[0].applicantName,
          phone: rows[0].phone,
          email: rows[0].email,
          region: rows[0].region,
          shortDescription: rows[0].shortDescription,
          referenceLink: rows[0].referenceLink,
          createdAt: rows[0].createdAt,
          reviewedAt: rows[0].reviewedAt,
          rejectedReason: rows[0].rejectedReason,
          rejectReason: rows[0].rejectedReason,
        }
      : null;
    return NextResponse.json({ application });
  } catch (e) {
    console.error("[mypage/client-application] GET error:", e);
    return NextResponse.json({ application: null }, { status: 200 });
  }
}

const VALID_TYPES = ["VENUE", "CLUB", "FEDERATION", "HOST", "INSTRUCTOR"] as const;

/** PATCH: 현재 사용자의 PENDING 신청 1건 수정 (신청내역 확인 후 수정용) */
export async function PATCH(request: Request) {
  ensureDatabaseUrlForDevelopment();
  let session;
  try {
    session = await getSession();
  } catch (e) {
    console.error("[mypage/client-application] getSession error:", e);
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스를 사용할 수 없습니다." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const type = typeof body?.type === "string" ? body.type : "";
  const organizationName = typeof body?.organizationName === "string" ? body.organizationName : "";
  const applicantName = typeof body?.applicantName === "string" ? body.applicantName : "";
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const email = typeof body?.email === "string" ? body.email : "";
  const region = (typeof body?.region === "string" ? body.region : "")?.trim() || null;
  const shortDescription = (typeof body?.shortDescription === "string" ? body.shortDescription : "")?.trim() || null;
  const referenceLink = (typeof body?.referenceLink === "string" ? body.referenceLink : "")?.trim() || null;

  if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json({ error: "신청 유형을 선택해 주세요." }, { status: 400 });
  }
  if (!organizationName.trim() || !applicantName.trim() || !phone.trim() || !email.trim()) {
    return NextResponse.json(
      { error: "업체명, 신청자 이름, 연락처, 이메일을 입력해 주세요." },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.clientApplication.findFirst({
      where: {
        OR: [{ applicantUserId: session.id }, { email: session.email ?? "" }],
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });
    if (!existing) {
      return NextResponse.json({ error: "수정 가능한 신청 내역이 없습니다." }, { status: 404 });
    }

    await prisma.clientApplication.update({
      where: { id: existing.id },
      data: {
        type: type as (typeof VALID_TYPES)[number],
        organizationName: organizationName.trim(),
        applicantName: applicantName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        region,
        shortDescription,
        referenceLink,
      },
    });
    return NextResponse.json({ ok: true, id: existing.id });
  } catch (e) {
    console.error("[mypage/client-application] PATCH error:", e);
    return NextResponse.json(
      { error: "수정 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }
}
