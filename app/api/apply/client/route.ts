import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureDatabaseUrlForDevelopment, isDatabaseConfigured } from "@/lib/db-mode";
import { getSession } from "@/lib/auth";
import { isAnnualMembershipVisible } from "@/lib/site-feature-flags";

/** Prisma 연결 실패 전용 코드 (네트워크/연결 불가). 스키마·제약조건 오류(P2002 등)는 제외 */
const DB_CONNECTION_ERROR_CODES = ["P1001", "P1002", "P1017", "P1033"];

function isDbConnectionError(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  if (typeof err?.code === "string" && DB_CONNECTION_ERROR_CODES.includes(err.code)) return true;
  const msg = typeof err?.message === "string" ? err.message : "";
  return (
    /can't reach database server|connection refused|ECONNREFUSED|connection.*timeout|timed out|connect ENOENT/i.test(msg)
  );
}

const VALID_TYPES = ["VENUE", "CLUB", "FEDERATION", "HOST", "INSTRUCTOR"] as const;
const VALID_CLIENT_TYPES = ["GENERAL", "REGISTERED"] as const;

/** POST: 클라이언트 신청 생성 (로그인 시 applicantUserId 저장). 저장은 raw SQL 우선으로 스키마 오류 회피 */
export async function POST(request: Request) {
  ensureDatabaseUrlForDevelopment();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const type = typeof body?.type === "string" ? body.type : "";
  const requestedClientType =
    typeof body?.requestedClientType === "string" && VALID_CLIENT_TYPES.includes(body.requestedClientType as (typeof VALID_CLIENT_TYPES)[number])
      ? (body.requestedClientType as (typeof VALID_CLIENT_TYPES)[number])
      : "GENERAL";
  const annualMembershipVisible = await isAnnualMembershipVisible();
  if (requestedClientType === "REGISTERED" && !annualMembershipVisible) {
    return NextResponse.json({ error: "페이지를 찾을 수 없습니다." }, { status: 404 });
  }
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

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: true, id: "demo", demo: true });
  }

  let applicantUserId: string | null = null;
  try {
    const session = await getSession();
    if (session?.role && session.role !== "USER") {
      return NextResponse.json(
        { error: "클라이언트 신청은 일반 회원(USER)만 가능합니다." },
        { status: 403 }
      );
    }
    applicantUserId = session?.id ?? null;
  } catch {
    applicantUserId = null;
  }

  try {
    const app = await prisma.clientApplication.create({
      data: {
        type: type as (typeof VALID_TYPES)[number],
        requestedClientType,
        organizationName: organizationName.trim(),
        applicantName: applicantName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        region,
        shortDescription,
        referenceLink,
        applicantUserId,
      },
    });
    return NextResponse.json({ ok: true, id: app.id });
  } catch (err) {
    const prismaErr = err as { code?: string; message?: string };
    const code = prismaErr?.code ?? "";
    const message = typeof prismaErr?.message === "string" ? prismaErr.message : String(err);
    console.error("[apply/client] create error — code:", code, "message:", message);
    if (process.env.NODE_ENV === "development") {
      console.error("[apply/client] full error:", err);
    }

    if (isDbConnectionError(err)) {
      return NextResponse.json(
        {
          error:
            "데이터베이스에 연결할 수 없습니다. .env의 DATABASE_URL, DIRECT_URL과 네트워크를 확인한 뒤, npx prisma generate 및 npx prisma migrate dev 를 실행해 주세요.",
        },
        { status: 503 }
      );
    }
    if (typeof code === "string" && code.startsWith("P")) {
      return NextResponse.json(
        {
          error:
            "DB 처리 중 오류가 발생했습니다. 터미널 로그의 [apply/client] 메시지를 확인하고, 필요 시 npx prisma generate 및 npx prisma migrate dev 를 실행해 주세요.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "신청 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }
}
