import { appendUserNotificationFirestore } from "./firestore-user-notifications";
import {
  isManualParticipantUserId,
  tryClaimApplicationApprovedNotifiedAtFirestore,
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
