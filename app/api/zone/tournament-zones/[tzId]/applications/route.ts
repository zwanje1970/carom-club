import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { submitZoneManagerApplication } from "@/lib/tournaments/national";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tzId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { tzId } = await params;
  const zone = await prisma.tournamentZone.findUnique({
    where: { id: tzId },
    select: { id: true, tournamentId: true },
  });
  if (!zone) return NextResponse.json({ error: "권역을 찾을 수 없습니다." }, { status: 404 });

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const application = await submitZoneManagerApplication({
    tournamentId: zone.tournamentId,
    userId: session.id,
    zoneId: zone.id,
    message: typeof body.message === "string" ? body.message.trim() || null : null,
  });

  return NextResponse.json({ ok: true, application });
}
