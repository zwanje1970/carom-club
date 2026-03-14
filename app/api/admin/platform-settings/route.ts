import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platform-settings";
import { isPlatformAdmin } from "@/types/auth";

/** 관리자: 요금 정책 조회 */
export async function GET() {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const settings = await getPlatformSettings();
    return NextResponse.json({
      billingEnabled: settings.billingEnabled,
      tournamentFee: settings.tournamentFee,
      clientMembershipFee: settings.clientMembershipFee,
      updatedAt: settings.updatedAt,
    });
  } catch (e) {
    console.error("[admin/platform-settings] GET error:", e);
    return NextResponse.json(
      { error: "요금 정책 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

/** 관리자: 요금 정책 수정 (billing_enabled, tournament_fee, client_membership_fee) */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: {
    billingEnabled?: boolean;
    tournamentFee?: number;
    clientMembershipFee?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const updated = await updatePlatformSettings({
      billingEnabled: body.billingEnabled,
      tournamentFee: body.tournamentFee,
      clientMembershipFee: body.clientMembershipFee,
    });
    return NextResponse.json({
      ok: true,
      billingEnabled: updated.billingEnabled,
      tournamentFee: updated.tournamentFee,
      clientMembershipFee: updated.clientMembershipFee,
      updatedAt: updated.updatedAt,
    });
  } catch (e) {
    console.error("[admin/platform-settings] PATCH error:", e);
    return NextResponse.json(
      { error: "요금 정책 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
