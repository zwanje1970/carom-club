import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isPlatformAdmin } from "@/types/auth";

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다. .env에 DATABASE_URL을 설정해 주세요." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "PLATFORM_ADMIN" && session.role !== "CLIENT_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json();
  const {
    organizationId: bodyOrgId,
    name,
    startAt,
    venue,
    status,
    gameFormat,
    entryFee,
    maxParticipants,
    entryCondition,
    prizeInfo,
    rules,
    promoContent,
  } = body as {
    organizationId?: string;
    name?: string;
    startAt?: string;
    venue?: string;
    status?: string;
    gameFormat?: string;
    entryFee?: number | null;
    maxParticipants?: number | null;
    entryCondition?: string | null;
    prizeInfo?: string | null;
    rules?: string | null;
    promoContent?: string | null;
  };

  let organizationId: string;
  if (isPlatformAdmin(session)) {
    if (!bodyOrgId || !name?.trim() || !startAt) {
      return NextResponse.json(
        { error: "업체, 대회명, 일시를 입력해주세요." },
        { status: 400 }
      );
    }
    organizationId = bodyOrgId;
  } else {
    const myOrgId = await getClientAdminOrganizationId(session);
    if (!myOrgId) {
      return NextResponse.json(
        { error: "소속된 업체가 없습니다. 먼저 업체 설정을 완료해 주세요." },
        { status: 403 }
      );
    }
    organizationId = myOrgId;
    if (!name?.trim() || !startAt) {
      return NextResponse.json(
        { error: "대회명, 일시를 입력해주세요." },
        { status: 400 }
      );
    }
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) {
    return NextResponse.json(
      { error: "업체를 찾을 수 없습니다." },
      { status: 400 }
    );
  }

  const validStatus =
    typeof status === "string" && ["DRAFT", "OPEN", "CLOSED", "FINISHED", "HIDDEN"].includes(status)
      ? status
      : "OPEN";
  try {
    const tournament = await prisma.tournament.create({
      data: {
        organizationId,
        name: name.trim(),
        startAt: new Date(startAt),
        venue: venue?.trim() || null,
        status: validStatus as "DRAFT" | "OPEN" | "CLOSED" | "FINISHED" | "HIDDEN",
        gameFormat: gameFormat?.trim() || null,
        entryFee: entryFee != null && Number.isFinite(Number(entryFee)) ? Number(entryFee) : null,
        maxParticipants: maxParticipants != null && Number.isFinite(Number(maxParticipants)) ? Number(maxParticipants) : null,
        entryCondition: entryCondition?.trim() || null,
        prizeInfo: prizeInfo?.trim() || null,
        rules: rules?.trim() || null,
        promoContent: promoContent?.trim() || null,
      },
    });
    return NextResponse.json({ ok: true, id: tournament.id });
  } catch (e) {
    console.error("tournament create error", e);
    return NextResponse.json(
      { error: "대회 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
