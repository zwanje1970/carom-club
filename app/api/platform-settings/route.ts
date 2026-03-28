import { NextResponse } from "next/server";
import { getPlatformSettings } from "@/lib/platform-settings";
import { isAnnualMembershipVisible } from "@/lib/site-feature-flags";

/** 요금 정책 조회 (공개). 대회 생성·결제 화면에서 금액·billing_enabled 표시용 */
export async function GET() {
  try {
    const settings = await getPlatformSettings();
    const annualMembershipVisible = await isAnnualMembershipVisible();
    return NextResponse.json({
      billingEnabled: settings.billingEnabled,
      tournamentFee: settings.tournamentFee,
      clientMembershipFee: annualMembershipVisible ? settings.clientMembershipFee : null,
    });
  } catch (e) {
    console.error("[platform-settings] GET error:", e);
    return NextResponse.json(
      {
        billingEnabled: false,
        tournamentFee: 30000,
        clientMembershipFee: null,
      },
      { status: 200 }
    );
  }
}
