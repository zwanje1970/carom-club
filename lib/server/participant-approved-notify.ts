import { appendUserNotificationFirestore } from "./firestore-user-notifications";
import {
  isManualParticipantUserId,
  tryClaimApplicationApprovedNotifiedAtFirestore,
  tryClaimProcessingApplicationApprovedNotifiedAtFirestore,
  tryClaimProcessingApprovalCanceledNotifiedAtFirestore,
} from "./firestore-tournament-applications";
import { isFirestoreUsersBackendConfigured } from "./firestore-users";

function buildParticipantApprovedNotificationCopy(
  tournamentDate: string,
  tournamentTitle: string
): { title: string; message: string } {
  const title = "참가 신청 완료";
  const raw = String(tournamentDate ?? "").trim();
  let md = "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    md = `${Number(iso[2])}/${Number(iso[3])}`;
  } else {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      md = `${d.getMonth() + 1}/${d.getDate()}`;
    }
  }
  const name = (tournamentTitle || "대회").trim();
  const message = md ? `${md} ${name} 참가신청이 완료되었습니다` : `${name} 참가신청이 완료되었습니다`;
  return { title, message };
}

function buildProcessingApprovalCanceledNotificationCopy(tournamentTitle: string): { title: string; message: string } {
  const title = "참가신청 취소";
  const name = (tournamentTitle || "대회").trim();
  const message = `${name} 참가신청이 취소되었습니다.`;
  return { title, message };
}

/**
 * 입금확인(APPROVED) 직후: 마이페이지 알림 + FCM 1회(신청 문서 `approvedNotifiedAt`으로 중복 방지).
 * Firestore 미사용 시 `notifyParticipantApprovedOnLocalStoreIfNeeded`로 위임.
 */
export async function notifyParticipantApprovedAfterDepositConfirm(params: {
  entryId: string;
  applicantUserId: string;
  tournamentId: string;
  tournamentTitle: string;
  tournamentDate: string;
}): Promise<void> {
  const applicantUserId = params.applicantUserId.trim();
  if (!applicantUserId || isManualParticipantUserId(applicantUserId)) return;

  const { title, message } = buildParticipantApprovedNotificationCopy(params.tournamentDate, params.tournamentTitle);

  if (isFirestoreUsersBackendConfigured()) {
    const claimed = await tryClaimApplicationApprovedNotifiedAtFirestore(params.entryId);
    if (!claimed) return;
    const appended = await appendUserNotificationFirestore({
      userId: applicantUserId,
      title,
      message,
      relatedTournamentId: params.tournamentId.trim(),
    });
    if (!appended.ok) {
      console.error("[participant-approved-notify] append notification failed", appended.error);
    }
    try {
      const { listFcmDeviceTokensForUserIds, resolveCanonicalUserIdForAuth } = await import("./platform-backing-store");
      const canonical = await resolveCanonicalUserIdForAuth(applicantUserId);
      const rows = await listFcmDeviceTokensForUserIds([canonical]);
      const tokens = rows.map((r) => r.token.trim()).filter(Boolean);
      if (tokens.length === 0) return;
      const { sendFcmToTokens } = await import("./fcm-send");
      await sendFcmToTokens({ title, body: message, url: null, tokens });
    } catch {
      /* 토큰 없음·FCM 미설정 — 조용히 무시 */
    }
    return;
  }

  const { notifyParticipantApprovedOnLocalStoreIfNeeded } = await import("./platform-backing-store");
  await notifyParticipantApprovedOnLocalStoreIfNeeded({
    tournamentId: params.tournamentId,
    entryId: params.entryId,
    applicantUserId,
    tournamentTitle: params.tournamentTitle,
    tournamentDate: params.tournamentDate,
  });
}

/**
 * 신청자관리 processing 에서 운영 승인(`clientApplicationApprovedAt` 설정) 직후 1회.
 * 참가 확정(`status === APPROVED`)·`approvedNotifiedAt`과 별개이며 `processingApprovedNotifiedAt`으로만 중복 방지.
 */
export async function notifyParticipantAfterProcessingApplicationApproved(params: {
  entryId: string;
  applicantUserId: string;
  tournamentId: string;
  tournamentTitle: string;
  tournamentDate: string;
}): Promise<void> {
  const tournamentId = params.tournamentId.trim();
  const entryId = params.entryId.trim();
  const applicantUserId = params.applicantUserId.trim();
  const logBase = { tournamentId, entryId, applicantUserId };

  try {
    if (!applicantUserId || isManualParticipantUserId(applicantUserId)) return;
    if (!isFirestoreUsersBackendConfigured()) return;

    const { title, message } = buildParticipantApprovedNotificationCopy(params.tournamentDate, params.tournamentTitle);

    const claimed = await tryClaimProcessingApplicationApprovedNotifiedAtFirestore(entryId);
    if (!claimed) return;

    const appended = await appendUserNotificationFirestore({
      userId: applicantUserId,
      title,
      message,
      relatedTournamentId: tournamentId,
    });
    if (!appended.ok) {
      console.warn("[processing-approved-notify] append notification failed", {
        ...logBase,
        error: appended.error ?? "unknown",
      });
    }

    let tokenCount = 0;
    try {
      const { listFcmDeviceTokensForUserIds, resolveCanonicalUserIdForAuth } = await import("./platform-backing-store");
      const canonical = await resolveCanonicalUserIdForAuth(applicantUserId);
      const rows = await listFcmDeviceTokensForUserIds([canonical]);
      const tokens = rows.map((r) => r.token.trim()).filter(Boolean);
      tokenCount = tokens.length;
      if (tokens.length === 0) return;
      const { sendFcmToTokens } = await import("./fcm-send");
      await sendFcmToTokens({ title, body: message, url: null, tokens });
    } catch (e) {
      console.error("[processing-approved-notify] fcm", {
        ...logBase,
        tokenCount,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  } catch (e) {
    console.error("[processing-approved-notify] unexpected", {
      ...logBase,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * 신청자관리 processing 에서 운영 승인 취소(`clientApplicationApprovedAt` 해제) 직후 1회.
 */
export async function notifyParticipantAfterProcessingApplicationApprovalCanceled(params: {
  entryId: string;
  applicantUserId: string;
  tournamentId: string;
  tournamentTitle: string;
}): Promise<void> {
  const tournamentId = params.tournamentId.trim();
  const entryId = params.entryId.trim();
  const applicantUserId = params.applicantUserId.trim();
  const logBase = { tournamentId, entryId, applicantUserId };

  try {
    if (!applicantUserId || isManualParticipantUserId(applicantUserId)) return;
    if (!isFirestoreUsersBackendConfigured()) return;

    const { title, message } = buildProcessingApprovalCanceledNotificationCopy(params.tournamentTitle);

    const claimed = await tryClaimProcessingApprovalCanceledNotifiedAtFirestore(entryId);
    if (!claimed) return;

    const appended = await appendUserNotificationFirestore({
      userId: applicantUserId,
      title,
      message,
      relatedTournamentId: tournamentId,
    });
    if (!appended.ok) {
      console.warn("[processing-approval-canceled-notify] append notification failed", {
        ...logBase,
        error: appended.error ?? "unknown",
      });
    }

    let tokenCount = 0;
    try {
      const { listFcmDeviceTokensForUserIds, resolveCanonicalUserIdForAuth } = await import("./platform-backing-store");
      const canonical = await resolveCanonicalUserIdForAuth(applicantUserId);
      const rows = await listFcmDeviceTokensForUserIds([canonical]);
      const tokens = rows.map((r) => r.token.trim()).filter(Boolean);
      tokenCount = tokens.length;
      if (tokens.length === 0) return;
      const { sendFcmToTokens } = await import("./fcm-send");
      await sendFcmToTokens({ title, body: message, url: null, tokens });
    } catch (e) {
      console.error("[processing-approval-canceled-notify] fcm", {
        ...logBase,
        tokenCount,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  } catch (e) {
    console.error("[processing-approval-canceled-notify] unexpected", {
      ...logBase,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
