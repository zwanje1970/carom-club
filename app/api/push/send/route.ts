import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { sendFcmToTokens } from "../../../../lib/server/fcm-send";
import {
  createReannounceNotifications,
  filterUserIdsWithMarketingPushConsent,
  getClientStatusByUserId,
  getUserById,
  listDeduplicatedApplicantsForClientOwner,
  listFcmDeviceTokensForUserIds,
  listUserIdsForPlatformPushAudience,
  removeFcmDeviceTokensByTokenValues,
} from "../../../../lib/server/dev-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  let body: { title?: unknown; body?: unknown; targetUserIds?: unknown; url?: unknown; audience?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : "";
  const messageBody = typeof body.body === "string" ? body.body : "";
  const urlRaw = body.url;
  const urlOptional = typeof urlRaw === "string" && urlRaw.trim() ? urlRaw.trim() : null;
  const audienceRaw = body.audience;
  const hasAudience = audienceRaw === "all" || audienceRaw === "client";

  if (!title.trim() || !messageBody.trim()) {
    return NextResponse.json({ error: "제목과 본문을 모두 입력해 주세요." }, { status: 400 });
  }

  if (hasAudience) {
    if (user.role !== "PLATFORM") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const audience = audienceRaw as "all" | "client";
    const normalizedTargets = await listUserIdsForPlatformPushAudience(audience);
    if (normalizedTargets.length === 0) {
      return NextResponse.json({ error: "발송 대상 사용자가 없습니다." }, { status: 400 });
    }
    const marketingTargets = await filterUserIdsWithMarketingPushConsent(normalizedTargets);
    if (marketingTargets.length === 0) {
      return NextResponse.json({ error: "마케팅 푸시 수신에 동의한 수신자가 없습니다." }, { status: 400 });
    }
    const notifResult = await createReannounceNotifications({
      targetUserIds: marketingTargets,
      title,
      message: messageBody,
    });
    if (!notifResult.ok) {
      return NextResponse.json({ error: notifResult.error }, { status: 400 });
    }
    const records = await listFcmDeviceTokensForUserIds(marketingTargets);
    const tokens = records.map((r) => r.token);
    console.log(
      "[api/push/send] platform audience",
      JSON.stringify({
        audience,
        normalizedTargetCount: normalizedTargets.length,
        marketingConsentCount: marketingTargets.length,
        fcmTokenRecordCount: records.length,
      })
    );
    if (tokens.length === 0) {
      return NextResponse.json({ error: "푸시 토큰이 있는 사용자가 없습니다." }, { status: 400 });
    }
    try {
      const result = await sendFcmToTokens({
        title,
        body: messageBody,
        url: urlOptional,
        tokens,
      });
      if (result.invalidTokens.length > 0) {
        await removeFcmDeviceTokensByTokenValues(result.invalidTokens);
      }
      return NextResponse.json({
        ok: true,
        sent: notifResult.count,
        successCount: result.successCount,
        failureCount: result.failureCount,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "FCM_CREDENTIALS_MISSING") {
        return NextResponse.json(
          {
            error:
              "FCM 서버 설정(FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)이 필요합니다. 내부 알림은 저장되었습니다.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "푸시 발송에 실패했습니다. 내부 알림은 저장되었습니다." }, { status: 500 });
    }
  }

  let scope: "creator" | "platform";
  if (user.role === "PLATFORM") {
    scope = "platform";
  } else if (user.role === "CLIENT") {
    const clientStatus = await getClientStatusByUserId(user.id);
    if (clientStatus !== "APPROVED") {
      return NextResponse.json({ error: "승인 완료된 CLIENT만 발송할 수 있습니다." }, { status: 403 });
    }
    scope = "creator";
  } else {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const targetUserIds = Array.isArray(body.targetUserIds)
    ? body.targetUserIds.map((x) => (typeof x === "string" ? x : String(x ?? "")))
    : [];

  if (targetUserIds.length === 0) {
    return NextResponse.json({ error: "targetUserIds가 필요합니다." }, { status: 400 });
  }

  const normalizedTargets = [...new Set(targetUserIds.map((id) => id.trim()).filter(Boolean))];

  const allowed = await listDeduplicatedApplicantsForClientOwner({
    ownerUserId: user.id,
    scope,
  });
  const allowedSet = new Set(allowed.map((r) => r.userId));
  for (const id of normalizedTargets) {
    if (!allowedSet.has(id)) {
      return NextResponse.json({ error: "선택한 수신자 중 허용되지 않은 대상이 포함되었습니다." }, { status: 403 });
    }
  }

  const marketingTargets = await filterUserIdsWithMarketingPushConsent(normalizedTargets);
  if (marketingTargets.length === 0) {
    return NextResponse.json({ error: "마케팅 푸시 수신에 동의한 수신자가 없습니다." }, { status: 400 });
  }

  const records = await listFcmDeviceTokensForUserIds(marketingTargets);
  const tokens = records.map((r) => r.token);
  console.log(
    "[api/push/send] scoped targetUserIds",
    JSON.stringify({
      normalizedTargetCount: normalizedTargets.length,
      marketingConsentCount: marketingTargets.length,
      fcmTokenRecordCount: records.length,
    })
  );
  if (tokens.length === 0) {
    return NextResponse.json({ error: "푸시 토큰이 있는 사용자가 없습니다." }, { status: 400 });
  }

  try {
    const result = await sendFcmToTokens({
      title,
      body: messageBody,
      url: urlOptional,
      tokens,
    });
    if (result.invalidTokens.length > 0) {
      await removeFcmDeviceTokensByTokenValues(result.invalidTokens);
    }
    return NextResponse.json({
      ok: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "FCM_CREDENTIALS_MISSING") {
      return NextResponse.json(
        { error: "FCM 서버 설정(FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)이 필요합니다." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "푸시 발송에 실패했습니다." }, { status: 500 });
  }
}
