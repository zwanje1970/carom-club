import webPush from "web-push";
import { prisma } from "@/lib/db";
import { getVapidPublicKey, getVapidPrivateKey, isPushConfigured } from "./vapid";

export type NotificationType =
  | "ENTRY_APPROVED"
  | "BRACKET_GENERATED"
  | "VENUE_REMINDER"
  | "PRIZE"
  | "CLIENT_CUSTOM";

export type SendPushOptions = {
  userId: string;
  tournamentId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  url?: string | null;
};

function getPushOptions() {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

/**
 * 단일 사용자에게 Web Push 발송. 활성 구독이 있으면 모두 전송.
 * NotificationLog 기록, 실패한 subscription은 isActive=false 처리.
 */
export async function sendPushToUser(options: SendPushOptions): Promise<{ sent: number; failed: number }> {
  const pushOpts = getPushOptions();
  if (!pushOpts) {
    await logNotification({ ...options, status: "FAILED", errorMessage: "VAPID not configured" });
    return { sent: 0, failed: 0 };
  }

  webPush.setVapidDetails(
    "mailto:support@carom.club",
    pushOpts.publicKey,
    pushOpts.privateKey
  );

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: options.userId, isActive: true },
  });

  if (subs.length === 0) {
    await logNotification({ ...options, status: "PENDING", errorMessage: "No active subscription" });
    return { sent: 0, failed: 0 };
  }

  const payload = JSON.stringify({
    title: options.title,
    body: options.body ?? "",
    url: options.url ?? "",
  });

  // 발송 기록 1건 (사용자당)
  const log = await prisma.notificationLog.create({
    data: {
      userId: options.userId,
      tournamentId: options.tournamentId ?? undefined,
      type: options.type,
      title: options.title,
      body: options.body ?? undefined,
      url: options.url ?? undefined,
      status: "PENDING",
    },
  });

  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
        { TTL: 60 * 60 * 24 } // 24h
      );
      sent++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = message;
      failed++;
      const status = err && typeof err === "object" && "statusCode" in err ? (err as { statusCode?: number }).statusCode : 0;
      if (status === 410 || status === 404 || status === 403) {
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { isActive: false },
        });
      }
    }
  }

  await prisma.notificationLog.update({
    where: { id: log.id },
    data: {
      status: sent > 0 ? "SENT" : "FAILED",
      sentAt: sent > 0 ? new Date() : undefined,
      errorMessage: sent > 0 ? undefined : lastError ?? undefined,
    },
  });

  return { sent, failed };
}

/**
 * 여러 사용자에게 동일 내용 발송 (대진표 생성, 경기장 안내 등).
 */
export async function sendPushToUsers(
  userIds: string[],
  options: Omit<SendPushOptions, "userId">
): Promise<{ sent: number; failed: number }> {
  const unique = [...new Set(userIds)];
  let totalSent = 0;
  let totalFailed = 0;
  for (const userId of unique) {
    const result = await sendPushToUser({ ...options, userId });
    totalSent += result.sent;
    totalFailed += result.failed;
  }
  return { sent: totalSent, failed: totalFailed };
}

async function logNotification(params: SendPushOptions & { status: string; errorMessage?: string | null }) {
  await prisma.notificationLog.create({
    data: {
      userId: params.userId,
      tournamentId: params.tournamentId ?? undefined,
      type: params.type,
      title: params.title,
      body: params.body ?? undefined,
      url: params.url ?? undefined,
      status: params.status,
      errorMessage: params.errorMessage ?? undefined,
      sentAt: params.status === "SENT" ? new Date() : undefined,
    },
  });
}

export { isPushConfigured };
