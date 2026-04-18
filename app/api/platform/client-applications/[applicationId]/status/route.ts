import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import { getUserById, updateClientApplicationStatus } from "../../../../../../lib/server/dev-store";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> }
) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다.", step: "auth" }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user || user.role !== "PLATFORM") {
    return NextResponse.json({ ok: false, error: "플랫폼 관리자만 변경할 수 있습니다.", step: "permission" }, { status: 403 });
  }

  const { applicationId } = await context.params;
  if (!applicationId?.trim()) {
    return NextResponse.json({ ok: false, error: "신청 id가 없습니다.", step: "validation" }, { status: 400 });
  }

  const formData = await request.formData();
  const statusRaw = formData.get("status");
  if (statusRaw !== "APPROVED" && statusRaw !== "REJECTED" && statusRaw !== "PENDING") {
    return NextResponse.json(
      { ok: false, error: "유효하지 않은 상태값입니다.", step: "validation" },
      { status: 400 }
    );
  }
  const status = statusRaw;
  const rejectedReasonRaw = formData.get("rejectedReason");
  const rejectedReason =
    typeof rejectedReasonRaw === "string" && rejectedReasonRaw.trim() !== "" ? rejectedReasonRaw.trim() : null;

  try {
    const updated = await updateClientApplicationStatus(applicationId.trim(), {
      status,
      reviewedByUserId: user.id,
      rejectedReason,
    });
    if (!updated) {
      return NextResponse.json(
        {
          ok: false,
          error: "해당 신청 건을 찾을 수 없습니다. 목록을 새로고침 후 다시 시도해 주세요.",
          step: "application-not-found",
        },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[client-applications/status] 저장 실패", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        error: `저장소에 반영하지 못했습니다: ${message}`,
        step: "dev-store-write",
      },
      { status: 500 }
    );
  }
}
