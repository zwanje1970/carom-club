import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canManageTournament } from "@/lib/permissions";

/** 대회 개요 저장/발행. PATCH → canManageTournament */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회를 수정할 권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json();
  const { draft, publish, outlinePdfUrl, posterImageUrl } = body as {
    draft?: string;
    publish?: string;
    outlinePdfUrl?: string | null;
    posterImageUrl?: string | null;
  };

  try {
    if (publish !== undefined) {
      const updateData: Record<string, unknown> = {
        outlinePublished: publish,
        outlinePublishedAt: new Date(),
        outlineDraft: publish,
      };
      if (outlinePdfUrl !== undefined) updateData.outlinePdfUrl = outlinePdfUrl;
      if (posterImageUrl !== undefined) updateData.posterImageUrl = posterImageUrl;
      await prisma.tournament.update({
        where: { id },
        data: updateData as Parameters<typeof prisma.tournament.update>[0]["data"],
      });
      return NextResponse.json({ ok: true, published: true });
    }
    if (draft !== undefined || outlinePdfUrl !== undefined || posterImageUrl !== undefined) {
      const updateData: Record<string, unknown> = {};
      if (draft !== undefined) updateData.outlineDraft = draft;
      if (outlinePdfUrl !== undefined) updateData.outlinePdfUrl = outlinePdfUrl;
      if (posterImageUrl !== undefined) updateData.posterImageUrl = posterImageUrl;
      await prisma.tournament.update({
        where: { id },
        data: updateData as Parameters<typeof prisma.tournament.update>[0]["data"],
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: "draft, publish, outlinePdfUrl, posterImageUrl 중 하나 이상을 보내주세요." },
      { status: 400 }
    );
  } catch (e) {
    console.error("outline update error", e);
    return NextResponse.json(
      { error: "저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
