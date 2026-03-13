import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** GET: 현재 로그인 사용자의 이름·이메일·연락처 (클라이언트 신청 폼 자동 채움용) */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ name: null, email: null, phone: null }, { status: 200 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
        { name: session.name ?? "", email: session.email ?? "", phone: "", address: "", addressDetail: "" },
        { status: 200 }
      );
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { name: true, email: true, phone: true, address: true, addressDetail: true },
    });
    if (!user) {
      return NextResponse.json(
        { name: session.name ?? "", email: session.email ?? "", phone: "", address: "", addressDetail: "" },
        { status: 200 }
      );
    }
    return NextResponse.json({
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      address: (user as { address?: string | null }).address ?? "",
      addressDetail: (user as { addressDetail?: string | null }).addressDetail ?? "",
    });
  } catch {
    return NextResponse.json(
      { name: session.name ?? "", email: session.email ?? "", phone: "", address: "", addressDetail: "" },
      { status: 200 }
    );
  }
}

/** PATCH: 회원 위치 좌표 저장 (GPS 허용 시 메인 가까운 순 정렬 폴백용) */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB를 사용할 수 없습니다." }, { status: 503 });
  }
  try {
    const body = await request.json();
    const lat = body?.latitude != null ? Number(body.latitude) : undefined;
    const lng = body?.longitude != null ? Number(body.longitude) : undefined;
    if (lat !== undefined && !Number.isFinite(lat)) {
      return NextResponse.json({ error: "유효한 latitude가 필요합니다." }, { status: 400 });
    }
    if (lng !== undefined && !Number.isFinite(lng)) {
      return NextResponse.json({ error: "유효한 longitude가 필요합니다." }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: session.id },
      data: {
        ...(lat !== undefined && { latitude: lat }),
        ...(lng !== undefined && { longitude: lng }),
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}
