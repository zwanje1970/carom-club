import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_ADMIN_BASIC } from "@/lib/db-selects";
import { canManageTournament } from "@/lib/permissions";

function buildTvShareUrl(token: string, baseUrl?: string): string {
  if (!baseUrl) return `/tv/share/${token}`;
  return `${baseUrl.replace(/\/$/, "")}/tv/share/${token}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { organization: { select: ORGANIZATION_SELECT_ADMIN_BASIC } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const baseUrl = new URL(_request.url).origin;

  return NextResponse.json({
    token: tournament.tvAccessToken ?? null,
    shareUrl: tournament.tvAccessToken ? buildTvShareUrl(tournament.tvAccessToken, baseUrl) : null,
    issuedAt: tournament.tvAccessTokenIssuedAt?.toISOString() ?? null,
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { organization: { select: ORGANIZATION_SELECT_ADMIN_BASIC } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const baseUrl = new URL(_request.url).origin;

  const token = randomBytes(24).toString("base64url");
  const updated = await prisma.tournament.update({
    where: { id },
    data: {
      tvAccessToken: token,
      tvAccessTokenIssuedAt: new Date(),
    },
    select: { tvAccessToken: true, tvAccessTokenIssuedAt: true },
  });

  return NextResponse.json({
    token: updated.tvAccessToken,
    shareUrl: buildTvShareUrl(updated.tvAccessToken!, baseUrl),
    issuedAt: updated.tvAccessTokenIssuedAt?.toISOString() ?? null,
  });
}
