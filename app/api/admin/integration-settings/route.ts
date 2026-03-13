import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateIntegrationSettings } from "@/lib/integration-settings";

/**
 * 연동 설정 저장. 키 값은 요청으로만 받고, 응답에는 절대 포함하지 않습니다.
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { naverMapClientId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다." },
      { status: 400 }
    );
  }

  try {
    await updateIntegrationSettings({
      naverMapClientId: body.naverMapClientId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[integration-settings] PUT error:", e);
    const err = e as Error & { code?: string };
    const msg = err?.message ?? "";
    const needMigration =
      /does not exist|Unknown table|relation.*does not exist/i.test(msg) ||
      err?.code === "P2021";
    const devHint =
      process.env.NODE_ENV === "development" && msg ? ` (${msg})` : "";
    return NextResponse.json(
      {
        error: needMigration
          ? "연동 설정 테이블이 없습니다. 터미널에서 'npx prisma db push' 또는 'npx prisma migrate dev'를 실행한 뒤 다시 시도해 주세요."
          : `설정 저장에 실패했습니다.${devHint}`,
      },
      { status: 500 }
    );
  }
}
