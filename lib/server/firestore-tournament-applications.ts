import { randomUUID } from "crypto";
import { DEPOSIT_UNCONFIRM_REQUIRES_APPROVAL_REVOKED_FIRST } from "../tournament-application-processing-guards";
import { assertClientFirestorePersistenceConfigured } from "./firestore-client-applications";
import { getTournamentZoneById } from "./firestore-tournament-zones";
import { getTournamentByIdFirestore, listAllTournamentsFirestore, listTournamentsByCreatorFirestore } from "./firestore-tournaments";
import { firestoreGetUserById, getSharedFirestoreDb } from "./firestore-users";
import type {
  DeduplicatedApplicantRow,
  TournamentApplication,
  TournamentApplicationListItem,
  TournamentApplicationStatus,
} from "./platform-backing-store";
import {
  buildProtectedProofImageUrl,
  getAllowedTournamentApplicationNextStatuses,
  getProofImageAssetById,
  normalizeTournamentStatusBadge,
  resolveCanonicalUserIdForAuth,
} from "./platform-backing-store";

const COLLECTION = "v3_tournament_applications";

const TOURNAMENT_APPLICATION_LIST_FIRESTORE_FIELDS = [
  "createdAt",
  "userId",
  "applicantName",
  "phone",
  "depositorName",
  "status",
  "registrationSource",
  "participantAverage",
  "handicap",
  "adminNote",
  "statusChangedAt",
  "attendanceChecked",
  "zoneId",
  "affiliation",
  "clientDepositConfirmedAt",
  "clientApplicationApprovedAt",
  "clientApplicationCancelledAt",
] as const;

function hasNonEmptyIsoAt(v: unknown): boolean {
  return typeof v === "string" && v.trim() !== "";
}

function parseOptionalIsoAt(v: unknown): string | null | undefined {
  if (hasNonEmptyIsoAt(v)) return (v as string).trim();
  if (v === null) return null;
  return undefined;
}

/** 신청자관리 processing 취소 토글 O — 입금·승인 버튼 비활성·정원·승인 수 제외 */
export function isTournamentApplicationProcessingCancelled(app: {
  status?: string;
  clientApplicationCancelledAt?: string | null;
}): boolean {
  return hasNonEmptyIsoAt(app.clientApplicationCancelledAt);
}

function isTournamentApplicationSoftDeletedData(data: Record<string, unknown>): boolean {
  return hasNonEmptyIsoAt(data.deletedAt);
}

/** 신청자관리 삭제 가능 — 입금·승인·취소 모두 X, 참가확정·거절·대기자 제외 */
export function canSoftDeleteTournamentApplication(application: TournamentApplication): boolean {
  if (isTournamentApplicationSoftDeletedData(application as unknown as Record<string, unknown>)) return false;
  const st = application.status;
  if (st === "APPROVED" || st === "REJECTED" || st === "WAITING") return false;
  if (isTournamentApplicationProcessingCancelled(application)) return false;
  if (hasNonEmptyIsoAt(application.clientDepositConfirmedAt)) return false;
  if (hasNonEmptyIsoAt(application.clientApplicationApprovedAt)) return false;
  return true;
}

/** `select` 결과만 — `tournamentApplicationFromFirestore`와 동일 규칙으로 목록 필드만 파싱 */
function tournamentApplicationToListItem(
  id: string,
  data: Record<string, unknown> | undefined
): TournamentApplicationListItem {
  const item: Record<string, unknown> = data && typeof data === "object" ? { id, ...data } : { id };
  const createdAt =
    typeof item.createdAt === "string" && item.createdAt !== "" ? item.createdAt : new Date().toISOString();
  const st = item.status;
  const status: TournamentApplicationStatus =
    st === "APPLIED" ||
    st === "VERIFYING" ||
    st === "WAITING_PAYMENT" ||
    st === "WAITING" ||
    st === "APPROVED" ||
    st === "REJECTED"
      ? st
      : "APPLIED";
  const regSrc = item.registrationSource;
  const registrationSource = regSrc === "admin" ? ("admin" as const) : null;
  const pa = item.participantAverage;
  const participantAverage =
    typeof pa === "number" && Number.isFinite(pa)
      ? pa
      : pa != null && typeof pa === "string" && pa.trim() !== "" && Number.isFinite(Number(pa))
        ? Number(pa)
        : null;
  const hc = item.handicap;
  const handicap =
    typeof hc === "number" && Number.isFinite(hc)
      ? hc
      : hc != null && typeof hc === "string" && hc.trim() !== "" && Number.isFinite(Number(hc))
        ? Number(hc)
        : null;
  const adminNoteRaw = item.adminNote;
  const adminNote =
    adminNoteRaw === null || adminNoteRaw === undefined
      ? null
      : typeof adminNoteRaw === "string"
        ? adminNoteRaw.trim() || null
        : null;
  const statusChangedAtRaw = item.statusChangedAt;
  const statusChangedAt =
    typeof statusChangedAtRaw === "string" && statusChangedAtRaw.trim() !== "" ? statusChangedAtRaw.trim() : undefined;
  const ac = item.attendanceChecked;
  const attendanceChecked = ac === true;
  const zr = item.zoneId;
  const zoneId =
    typeof zr === "string" && zr.trim() !== ""
      ? zr.trim()
      : zr === null
        ? null
        : undefined;
  const depositorNameRaw = item.depositorName;
  const depositorName =
    typeof depositorNameRaw === "string" && depositorNameRaw.trim() !== "" ? depositorNameRaw.trim() : null;

  const affRaw = item.affiliation;
  const affiliation =
    typeof affRaw === "string" && affRaw.trim() !== "" ? affRaw.trim() : affRaw === null ? null : undefined;

  const cdc = item.clientDepositConfirmedAt;
  const clientDepositConfirmedAt =
    typeof cdc === "string" && cdc.trim() !== "" ? cdc.trim() : cdc === null ? null : undefined;

  const caa = item.clientApplicationApprovedAt;
  const clientApplicationApprovedAt =
    typeof caa === "string" && caa.trim() !== "" ? caa.trim() : caa === null ? null : undefined;

  const cac = item.clientApplicationCancelledAt;
  const clientApplicationCancelledAt =
    typeof cac === "string" && cac.trim() !== "" ? cac.trim() : cac === null ? null : undefined;

  const userIdRaw = item.userId;
  const userId = typeof userIdRaw === "string" && userIdRaw.trim() !== "" ? userIdRaw.trim() : undefined;

  return {
    id,
    ...(userId ? { userId } : {}),
    applicantName: typeof item.applicantName === "string" ? item.applicantName : "",
    phone: typeof item.phone === "string" ? item.phone : "",
    ...(depositorName ? { depositorName } : {}),
    status,
    createdAt,
    registrationSource,
    participantAverage,
    handicap,
    adminNote,
    ...(statusChangedAt ? { statusChangedAt } : {}),
    attendanceChecked,
    ...(zoneId !== undefined ? { zoneId } : {}),
    ...(affiliation !== undefined ? { affiliation } : {}),
    ...(clientDepositConfirmedAt !== undefined ? { clientDepositConfirmedAt } : {}),
    ...(clientApplicationApprovedAt !== undefined ? { clientApplicationApprovedAt } : {}),
    ...(clientApplicationCancelledAt !== undefined ? { clientApplicationCancelledAt } : {}),
  };
}

function tournamentApplicationFromFirestore(id: string, data: Record<string, unknown> | undefined): TournamentApplication {
  const item: Record<string, unknown> = data && typeof data === "object" ? { id, ...data } : { id };
  const createdAt =
    typeof item.createdAt === "string" && item.createdAt !== "" ? item.createdAt : new Date().toISOString();
  const ocrS = item.ocrStatus;
  const ocrStatus: TournamentApplication["ocrStatus"] =
    ocrS === "NOT_REQUESTED" || ocrS === "PROCESSING" || ocrS === "COMPLETED" || ocrS === "FAILED" ? ocrS : "NOT_REQUESTED";
  const st = item.status;
  const status: TournamentApplicationStatus =
    st === "APPLIED" ||
    st === "VERIFYING" ||
    st === "WAITING_PAYMENT" ||
    st === "WAITING" ||
    st === "APPROVED" ||
    st === "REJECTED"
      ? st
      : "APPLIED";
  const regSrc = item.registrationSource;
  const registrationSource = regSrc === "admin" ? ("admin" as const) : null;
  const pa = item.participantAverage;
  const participantAverage =
    typeof pa === "number" && Number.isFinite(pa)
      ? pa
      : pa != null && typeof pa === "string" && pa.trim() !== "" && Number.isFinite(Number(pa))
        ? Number(pa)
        : null;
  const hc = item.handicap;
  const handicap =
    typeof hc === "number" && Number.isFinite(hc)
      ? hc
      : hc != null && typeof hc === "string" && hc.trim() !== "" && Number.isFinite(Number(hc))
        ? Number(hc)
        : null;
  const adminNoteRaw = item.adminNote;
  const adminNote =
    adminNoteRaw === null || adminNoteRaw === undefined
      ? null
      : typeof adminNoteRaw === "string"
        ? adminNoteRaw.trim() || null
        : null;
  const ac = item.attendanceChecked;
  const attendanceChecked = ac === true ? true : ac === false ? false : null;
  const approvedRaw = item.approvedNotifiedAt;
  const approvedNotifiedAt =
    typeof approvedRaw === "string" && approvedRaw.trim() ? approvedRaw.trim() : null;

  const panRaw = item.processingApprovedNotifiedAt;
  const processingApprovedNotifiedAt =
    typeof panRaw === "string" && panRaw.trim() ? panRaw.trim() : null;

  const pacnRaw = item.processingApprovalCanceledNotifiedAt;
  const processingApprovalCanceledNotifiedAt =
    typeof pacnRaw === "string" && pacnRaw.trim() ? pacnRaw.trim() : null;

  const zr = item.zoneId;
  const zoneId =
    typeof zr === "string" && zr.trim() !== ""
      ? zr.trim()
      : zr === null
        ? null
        : undefined;

  const affRaw = item.affiliation;
  const affiliation =
    typeof affRaw === "string" && affRaw.trim() !== "" ? affRaw.trim() : affRaw === null ? null : undefined;

  const cdc = item.clientDepositConfirmedAt;
  const clientDepositConfirmedAt =
    typeof cdc === "string" && cdc.trim() !== "" ? cdc.trim() : cdc === null ? null : undefined;

  const caa = item.clientApplicationApprovedAt;
  const clientApplicationApprovedAt =
    typeof caa === "string" && caa.trim() !== "" ? caa.trim() : caa === null ? null : undefined;

  const cac = item.clientApplicationCancelledAt;
  const clientApplicationCancelledAt = parseOptionalIsoAt(cac);

  const cdbc = item.clientDepositBeforeCancelAt;
  const clientDepositBeforeCancelAt = parseOptionalIsoAt(cdbc);

  const caabc = item.clientApplicationApprovedBeforeCancelAt;
  const clientApplicationApprovedBeforeCancelAt = parseOptionalIsoAt(caabc);

  const delAt = item.deletedAt;
  const deletedAt = parseOptionalIsoAt(delAt);

  return {
    id,
    tournamentId: typeof item.tournamentId === "string" ? item.tournamentId : "",
    userId: typeof item.userId === "string" ? item.userId : "",
    applicantName: typeof item.applicantName === "string" ? item.applicantName : "",
    phone: typeof item.phone === "string" ? item.phone : "",
    depositorName: typeof item.depositorName === "string" ? item.depositorName : "",
    proofImageId: typeof item.proofImageId === "string" ? item.proofImageId : "",
    proofImage320Url: typeof item.proofImage320Url === "string" ? item.proofImage320Url : "",
    proofImage640Url: typeof item.proofImage640Url === "string" ? item.proofImage640Url : "",
    proofOriginalUrl: typeof item.proofOriginalUrl === "string" ? item.proofOriginalUrl : "",
    ocrStatus,
    ocrText: typeof item.ocrText === "string" ? item.ocrText : "",
    ocrRawResult: typeof item.ocrRawResult === "string" ? item.ocrRawResult : "",
    ocrRequestedAt: item.ocrRequestedAt === null || typeof item.ocrRequestedAt === "string" ? (item.ocrRequestedAt as string | null) : null,
    ocrCompletedAt: item.ocrCompletedAt === null || typeof item.ocrCompletedAt === "string" ? (item.ocrCompletedAt as string | null) : null,
    status,
    createdAt,
    updatedAt: typeof item.updatedAt === "string" && item.updatedAt !== "" ? item.updatedAt : createdAt,
    statusChangedAt:
      typeof item.statusChangedAt === "string" && item.statusChangedAt !== ""
        ? item.statusChangedAt
        : typeof item.updatedAt === "string" && item.updatedAt !== ""
          ? item.updatedAt
          : createdAt,
    registrationSource,
    participantAverage,
    handicap,
    adminNote,
    attendanceChecked,
    ...(approvedNotifiedAt ? { approvedNotifiedAt } : {}),
    ...(processingApprovedNotifiedAt ? { processingApprovedNotifiedAt } : {}),
    ...(processingApprovalCanceledNotifiedAt ? { processingApprovalCanceledNotifiedAt } : {}),
    ...(zoneId !== undefined ? { zoneId } : {}),
    ...(affiliation !== undefined ? { affiliation } : {}),
    ...(clientDepositConfirmedAt !== undefined ? { clientDepositConfirmedAt } : {}),
    ...(clientApplicationApprovedAt !== undefined ? { clientApplicationApprovedAt } : {}),
    ...(clientApplicationCancelledAt !== undefined ? { clientApplicationCancelledAt } : {}),
    ...(clientDepositBeforeCancelAt !== undefined ? { clientDepositBeforeCancelAt } : {}),
    ...(clientApplicationApprovedBeforeCancelAt !== undefined ? { clientApplicationApprovedBeforeCancelAt } : {}),
    ...(deletedAt !== undefined ? { deletedAt } : {}),
  };
}

/** APPROVED 상태에서 `approvedNotifiedAt` 미기록일 때만 1회 설정(알림 중복 방지). */
export async function tryClaimApplicationApprovedNotifiedAtFirestore(entryId: string): Promise<boolean> {
  assertClientFirestorePersistenceConfigured();
  const eid = entryId.trim();
  if (!eid) return false;
  const db = getSharedFirestoreDb();
  const ref = db.collection(COLLECTION).doc(eid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const d = snap.data() as Record<string, unknown>;
    if (d.status !== "APPROVED") return false;
    const existing = d.approvedNotifiedAt;
    if (typeof existing === "string" && existing.trim()) return false;
    const now = new Date().toISOString();
    tx.set(ref, { approvedNotifiedAt: now, updatedAt: now }, { merge: true });
    return true;
  });
}

/**
 * 신청자관리 processing 승인(`clientApplicationApprovedAt`) 직후 알림 1회 —
 * `processingApprovedNotifiedAt` 미기록이고 승인 시각이 있을 때만 설정.
 */
export async function tryClaimProcessingApplicationApprovedNotifiedAtFirestore(entryId: string): Promise<boolean> {
  assertClientFirestorePersistenceConfigured();
  const eid = entryId.trim();
  if (!eid) return false;
  const db = getSharedFirestoreDb();
  const ref = db.collection(COLLECTION).doc(eid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const d = snap.data() as Record<string, unknown>;
    const existingPan = d.processingApprovedNotifiedAt;
    if (typeof existingPan === "string" && existingPan.trim()) return false;
    const caa = d.clientApplicationApprovedAt;
    if (typeof caa !== "string" || !caa.trim()) return false;
    const now = new Date().toISOString();
    tx.set(ref, { processingApprovedNotifiedAt: now, updatedAt: now }, { merge: true });
    return true;
  });
}

/**
 * processing 승인 취소(`clientApplicationApprovedAt` 해제) 직후 알림 1회 —
 * `processingApprovalCanceledNotifiedAt` 미기록이고 승인 시각이 비어 있을 때만 설정.
 */
export async function tryClaimProcessingApprovalCanceledNotifiedAtFirestore(entryId: string): Promise<boolean> {
  assertClientFirestorePersistenceConfigured();
  const eid = entryId.trim();
  if (!eid) return false;
  const db = getSharedFirestoreDb();
  const ref = db.collection(COLLECTION).doc(eid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const d = snap.data() as Record<string, unknown>;
    const existingCan = d.processingApprovalCanceledNotifiedAt;
    if (typeof existingCan === "string" && existingCan.trim()) return false;
    const caa = d.clientApplicationApprovedAt;
    if (typeof caa === "string" && caa.trim()) return false;
    const now = new Date().toISOString();
    tx.set(ref, { processingApprovalCanceledNotifiedAt: now, updatedAt: now }, { merge: true });
    return true;
  });
}

export async function getTournamentApplicationByIdFirestore(
  tournamentId: string,
  entryId: string
): Promise<TournamentApplication | null> {
  assertClientFirestorePersistenceConfigured();
  const tid = tournamentId.trim();
  const eid = entryId.trim();
  if (!tid || !eid) return null;
  const db = getSharedFirestoreDb();
  const ref = db.collection(COLLECTION).doc(eid);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown> | undefined;
  if (data?.tournamentId !== tid) return null;
  if (isTournamentApplicationSoftDeletedData(data)) return null;
  return tournamentApplicationFromFirestore(snap.id, data);
}

export { hasAnyTournamentApplicationForTournamentFirestore } from "./firestore-tournament-application-count";

export async function listTournamentApplicationsByTournamentIdFirestore(
  tournamentId: string
): Promise<TournamentApplication[]> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return [];
  const db = getSharedFirestoreDb();
  const q = await db
    .collection(COLLECTION)
    .where("tournamentId", "==", id)
    .orderBy("createdAt", "desc")
    .get();
  return q.docs
    .filter((doc) => !isTournamentApplicationSoftDeletedData(doc.data() as Record<string, unknown>))
    .map((doc) => tournamentApplicationFromFirestore(doc.id, doc.data() as Record<string, unknown>));
}

/** 참가자 목록 RSC 전용 — 증빙·OCR 등 대용량 필드 미조회 */
export async function listTournamentApplicationsListItemsByTournamentIdFirestore(
  tournamentId: string,
  options?: { limit?: number }
): Promise<TournamentApplicationListItem[]> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return [];
  const db = getSharedFirestoreDb();
  const base = db
    .collection(COLLECTION)
    .where("tournamentId", "==", id)
    .orderBy("createdAt", "desc")
    .select(...TOURNAMENT_APPLICATION_LIST_FIRESTORE_FIELDS);
  const lim = options?.limit;
  const q =
    lim != null && Number.isFinite(lim)
      ? await base.limit(Math.max(1, Math.min(500, Math.floor(lim)))).get()
      : await base.get();
  return q.docs
    .filter((doc) => !isTournamentApplicationSoftDeletedData(doc.data() as Record<string, unknown>))
    .map((doc) => tournamentApplicationToListItem(doc.id, doc.data() as Record<string, unknown>));
}

/** 필터 탭·헤더 건수용 — soft delete 제외, 경량 select */
export async function getTournamentApplicationListCountsFirestore(tournamentId: string): Promise<{
  total: number;
  approved: number;
  wait: number;
  reject: number;
  waitingList: number;
}> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return { total: 0, approved: 0, wait: 0, reject: 0, waitingList: 0 };
  const db = getSharedFirestoreDb();
  const snap = await db
    .collection(COLLECTION)
    .where("tournamentId", "==", id)
    .select("status", "deletedAt", "clientApplicationCancelledAt")
    .get();
  let total = 0;
  let approved = 0;
  let wait = 0;
  let reject = 0;
  let waitingList = 0;
  for (const doc of snap.docs) {
    const d = doc.data() as Record<string, unknown>;
    if (isTournamentApplicationSoftDeletedData(d)) continue;
    total += 1;
    const st = d.status;
    if (st === "APPROVED") approved += 1;
    else if (st === "REJECTED") reject += 1;
    else if (st === "WAITING") waitingList += 1;
    else if (st === "APPLIED" || st === "VERIFYING" || st === "WAITING_PAYMENT") wait += 1;
    if (st !== "REJECTED" && isTournamentApplicationProcessingCancelled(d)) reject += 1;
  }
  return { total, approved, wait, reject, waitingList };
}

export const PARTICIPANT_APPROVAL_CAPACITY_FULL_ERROR =
  "모집인원이 가득 찼습니다.\n기존 승인자를 취소 후 추가해주세요.";

function applicationOccupiesApprovalCapacity(app: {
  status?: string;
  clientApplicationApprovedAt?: string | null;
  clientApplicationCancelledAt?: string | null;
}): boolean {
  if (isTournamentApplicationProcessingCancelled(app)) return false;
  const st = app.status;
  if (st === "REJECTED" || st === "WAITING") return false;
  if (st === "APPROVED") return true;
  return typeof app.clientApplicationApprovedAt === "string" && app.clientApplicationApprovedAt.trim() !== "";
}

/** 승인 직전 정원 검사 — `현재 승인인원 < 모집인원` */
async function assertParticipantApprovalCapacityFirestore(params: {
  tournamentId: string;
  maxParticipants: number;
  excludeEntryId?: string;
  excludeApplication?: Pick<TournamentApplication, "id" | "status" | "clientApplicationApprovedAt">;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const maxP = Math.floor(Number(params.maxParticipants));
  if (!Number.isFinite(maxP) || maxP <= 0) return { ok: true };

  let occupied = await countCapacityOccupiedApplicationsForTournamentFirestore(params.tournamentId);
  if (
    params.excludeEntryId &&
    params.excludeApplication &&
    params.excludeApplication.id === params.excludeEntryId &&
    applicationOccupiesApprovalCapacity(params.excludeApplication)
  ) {
    occupied -= 1;
  }
  if (occupied >= maxP) {
    return { ok: false, error: PARTICIPANT_APPROVAL_CAPACITY_FULL_ERROR };
  }
  return { ok: true };
}

/** 모집 정원 충족 판단용 — `WAITING`(대기자)·`REJECTED` 제외, 승인 처리된 건·참가 확정 건 포함 */
export async function countCapacityOccupiedApplicationsForTournamentFirestore(tournamentId: string): Promise<number> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return 0;
  const db = getSharedFirestoreDb();
  const q = await db
    .collection(COLLECTION)
    .where("tournamentId", "==", id)
    .select("status", "clientApplicationApprovedAt", "clientApplicationCancelledAt", "deletedAt")
    .get();
  let n = 0;
  for (const doc of q.docs) {
    const d = doc.data() as Record<string, unknown>;
    if (isTournamentApplicationSoftDeletedData(d)) continue;
    if (isTournamentApplicationProcessingCancelled(d)) continue;
    const st = d.status;
    if (st === "REJECTED" || st === "WAITING") continue;
    if (st === "APPROVED") {
      n++;
      continue;
    }
    const caa = d.clientApplicationApprovedAt;
    if (typeof caa === "string" && caa.trim() !== "") n++;
  }
  return n;
}

/** 공개 상세·신청 화면 전용 — 승인(APPROVED) 건수만 aggregate (목록 스냅샷에는 포함하지 않음) */
export async function countApprovedApplicationsByTournamentIdFirestore(tournamentId: string): Promise<number> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return 0;
  const db = getSharedFirestoreDb();
  const snap = await db
    .collection(COLLECTION)
    .where("tournamentId", "==", id)
    .where("status", "==", "APPROVED")
    .count()
    .get();
  return snap.data().count;
}

export async function listTournamentApplicationsByUserIdFirestore(userId: string): Promise<TournamentApplication[]> {
  assertClientFirestorePersistenceConfigured();
  const uid = userId.trim();
  if (!uid) return [];
  const db = getSharedFirestoreDb();
  const canonicalUserId = await resolveCanonicalUserIdForAuth(uid);
  const q = await db
    .collection(COLLECTION)
    .where("userId", "==", canonicalUserId)
    .orderBy("createdAt", "desc")
    .get();
  return q.docs.map((doc) => tournamentApplicationFromFirestore(doc.id, doc.data() as Record<string, unknown>));
}

export async function getTournamentApplicationByProofImageIdFirestore(
  imageId: string,
): Promise<TournamentApplication | null> {
  assertClientFirestorePersistenceConfigured();
  const norm = imageId.trim();
  if (!norm) return null;
  const db = getSharedFirestoreDb();
  const q = await db.collection(COLLECTION).where("proofImageId", "==", norm).limit(1).get();
  if (q.empty) return null;
  const doc = q.docs[0]!;
  return tournamentApplicationFromFirestore(doc.id, doc.data() as Record<string, unknown>);
}

export async function listApprovedParticipantsByTournamentIdFirestore(
  tournamentId: string
): Promise<TournamentApplication[]> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return [];
  const db = getSharedFirestoreDb();
  const q = await db
    .collection(COLLECTION)
    .where("tournamentId", "==", id)
    .where("status", "==", "APPROVED")
    .get();
  const rows = q.docs.map((doc) => tournamentApplicationFromFirestore(doc.id, doc.data() as Record<string, unknown>));
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createTournamentApplicationFirestore(params: {
  tournamentId: string;
  userId: string;
  applicantName: string;
  phone: string;
  depositorName: string;
  affiliation?: string;
  handicap?: number;
  participantAverage?: number;
  proofImageId: string;
  proofImage320Url: string;
  proofImage640Url: string;
  proofOriginalUrl: string;
  /** 정원 초과 시 대기자 행으로 저장. 일반 신청과 동일 증빙·중복 규칙 */
  waitlist?: boolean;
}): Promise<{ ok: true; application: TournamentApplication } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const applicantName = params.applicantName.trim();
  const phone = params.phone.trim();
  const depositorName = params.depositorName.trim();
  const affiliation = typeof params.affiliation === "string" ? params.affiliation.trim() : "";
  const proofImageId = params.proofImageId.trim();
  const waitlist = params.waitlist === true;
  const handicap =
    typeof params.handicap === "number" && Number.isFinite(params.handicap) ? params.handicap : null;
  const participantAverage =
    typeof params.participantAverage === "number" && Number.isFinite(params.participantAverage)
      ? params.participantAverage
      : null;

  if (!applicantName) return { ok: false, error: "이름을 입력해 주세요." };
  if (!phone) return { ok: false, error: "전화번호를 입력해 주세요." };
  if (!depositorName) return { ok: false, error: "입금자명을 입력해 주세요." };
  if (handicap == null) return { ok: false, error: "핸디를 입력해 주세요." };
  if (participantAverage == null) return { ok: false, error: "AVG를 입력해 주세요." };

  const canonicalUserId = await resolveCanonicalUserIdForAuth(params.userId.trim());
  const tournament = await getTournamentByIdFirestore(params.tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };

  const requiresProof = tournament.rule.verificationMode !== "NONE";
  if (requiresProof && !proofImageId) {
    return { ok: false, error: "증빙 이미지를 업로드해 주세요." };
  }

  const recruitClosed = normalizeTournamentStatusBadge(tournament.statusBadge);
  if (recruitClosed === "마감" || recruitClosed === "진행중" || recruitClosed === "종료") {
    return { ok: false, error: "신청이 마감된 대회입니다." };
  }

  const maxParticipants = Number(tournament.maxParticipants);
  if (!waitlist && Number.isFinite(maxParticipants) && maxParticipants > 0) {
    const occupied = await countCapacityOccupiedApplicationsForTournamentFirestore(params.tournamentId);
    if (occupied >= maxParticipants) {
      return { ok: false, error: "참가정원이 되어 신청이 안됩니다." };
    }
  }

  const db = getSharedFirestoreDb();
  const dup = await db
    .collection(COLLECTION)
    .where("tournamentId", "==", params.tournamentId)
    .where("userId", "==", canonicalUserId)
    .limit(1)
    .get();
  if (!dup.empty) {
    return { ok: false, error: "이미 신청한 대회입니다." };
  }

  let resolvedProofImageId = "";
  let proofImage320Url = "";
  let proofImage640Url = "";
  let proofOriginalUrl = "";
  if (requiresProof) {
    const proofImage = await getProofImageAssetById(proofImageId);
    if (!proofImage) {
      return { ok: false, error: "증빙 이미지를 다시 업로드해 주세요." };
    }
    if (proofImage.uploaderUserId !== canonicalUserId) {
      return { ok: false, error: "잘못된 요청입니다." };
    }
    resolvedProofImageId = proofImageId;
    proofImage320Url = buildProtectedProofImageUrl(proofImageId, "w320");
    proofImage640Url = buildProtectedProofImageUrl(proofImageId, "w640");
    proofOriginalUrl = buildProtectedProofImageUrl(proofImageId, "original");
  }

  const now = new Date().toISOString();
  const initialStatus: TournamentApplicationStatus = waitlist ? "WAITING" : "APPLIED";
  const application: TournamentApplication = {
    id: randomUUID(),
    tournamentId: params.tournamentId,
    userId: canonicalUserId,
    applicantName,
    phone,
    depositorName,
    proofImageId: resolvedProofImageId,
    proofImage320Url,
    proofImage640Url,
    proofOriginalUrl,
    ocrStatus: "NOT_REQUESTED",
    ocrText: "",
    ocrRawResult: "",
    ocrRequestedAt: null,
    ocrCompletedAt: null,
    status: initialStatus,
    createdAt: now,
    updatedAt: now,
    statusChangedAt: now,
    ...(affiliation ? { affiliation } : {}),
    handicap,
    participantAverage,
  };

  const plain: Record<string, unknown> = {
    id: application.id,
    tournamentId: application.tournamentId,
    userId: application.userId,
    applicantName: application.applicantName,
    phone: application.phone,
    depositorName: application.depositorName,
    proofImageId: application.proofImageId,
    proofImage320Url: application.proofImage320Url,
    proofImage640Url: application.proofImage640Url,
    proofOriginalUrl: application.proofOriginalUrl,
    ocrStatus: application.ocrStatus,
    ocrText: application.ocrText,
    ocrRawResult: application.ocrRawResult,
    ocrRequestedAt: application.ocrRequestedAt,
    ocrCompletedAt: application.ocrCompletedAt,
    status: application.status,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    statusChangedAt: application.statusChangedAt,
    affiliation: application.affiliation ?? null,
    handicap: application.handicap ?? null,
    participantAverage: application.participantAverage ?? null,
  };
  await db.collection(COLLECTION).doc(application.id).set(plain);
  return { ok: true, application };
}

export async function updateTournamentApplicationStatusFirestore(params: {
  tournamentId: string;
  entryId: string;
  nextStatus: TournamentApplicationStatus;
  actorUserId?: string;
  /** 거절 시 운영자 입력 사유 — adminNote에 병합 */
  rejectReason?: string | null;
}): Promise<{ ok: true; application: TournamentApplication } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  const entryId = params.entryId.trim();
  if (!tournamentId || !entryId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }
  const application = await getTournamentApplicationByIdFirestore(tournamentId, entryId);
  if (!application) {
    return { ok: false, error: "참가신청을 찾을 수 없습니다." };
  }

  const currentStatus = application.status || "APPLIED";
  if (currentStatus === params.nextStatus) {
    return { ok: false, error: "이미 처리된 상태입니다." };
  }
  const allowedNext = getAllowedTournamentApplicationNextStatuses(currentStatus);
  if (!allowedNext.includes(params.nextStatus)) {
    return { ok: false, error: "허용되지 않은 상태 전이입니다." };
  }

  const now = new Date().toISOString();
  const db = getSharedFirestoreDb();
  const ref = db.collection(COLLECTION).doc(entryId);
  const reasonRaw = typeof params.rejectReason === "string" ? params.rejectReason.trim() : "";
  const patch: Record<string, unknown> = {
    status: params.nextStatus,
    updatedAt: now,
    statusChangedAt: now,
  };
  if (params.nextStatus === "REJECTED" && reasonRaw) {
    const prev = (application.adminNote ?? "").trim();
    patch.adminNote = prev ? `${prev}\n거절 사유: ${reasonRaw}` : `거절 사유: ${reasonRaw}`;
  }
  await ref.set(patch, { merge: true });

  const after = await getTournamentApplicationByIdFirestore(tournamentId, entryId);
  if (!after) {
    return { ok: false, error: "참가신청을 찾을 수 없습니다." };
  }
  return { ok: true, application: after };
}

export async function patchTournamentApplicationProcessingFirestore(params: {
  tournamentId: string;
  entryId: string;
  depositConfirmed?: boolean;
  applicationApproved?: boolean;
  applicationCancelled?: boolean;
}): Promise<{ ok: true; application: TournamentApplication } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  const entryId = params.entryId.trim();
  if (!tournamentId || !entryId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const hasDeposit = typeof params.depositConfirmed === "boolean";
  const hasApprove = typeof params.applicationApproved === "boolean";
  const hasCancel = typeof params.applicationCancelled === "boolean";
  const opCount = [hasDeposit, hasApprove, hasCancel].filter(Boolean).length;
  if (opCount !== 1) {
    return { ok: false, error: "요청 값이 올바르지 않습니다." };
  }

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }

  const application = await getTournamentApplicationByIdFirestore(tournamentId, entryId);
  if (!application) {
    return { ok: false, error: "참가신청을 찾을 수 없습니다." };
  }

  const hadApplicationApprovedAtBefore =
    typeof application.clientApplicationApprovedAt === "string" &&
    application.clientApplicationApprovedAt.trim() !== "";

  const st = application.status;
  if (st === "REJECTED") {
    return { ok: false, error: "종료된 신청입니다." };
  }
  if (st === "APPROVED") {
    return { ok: false, error: "참가 확정된 신청은 여기서 변경할 수 없습니다." };
  }
  if (st === "WAITING") {
    return {
      ok: false,
      error: "대기자 신청은 상세에서 「정식 신청 전환」 후 입금·승인할 수 있습니다.",
    };
  }

  const now = new Date().toISOString();
  const db = getSharedFirestoreDb();
  const ref = db.collection(COLLECTION).doc(entryId);
  const patch: Record<string, unknown> = { updatedAt: now };
  const isCancelled = isTournamentApplicationProcessingCancelled(application);

  if (hasCancel) {
    if (params.applicationCancelled === true) {
      if (isCancelled) {
        return { ok: false, error: "이미 취소된 신청입니다." };
      }
      const depBefore = hasNonEmptyIsoAt(application.clientDepositConfirmedAt)
        ? application.clientDepositConfirmedAt!.trim()
        : null;
      const appBefore = hasNonEmptyIsoAt(application.clientApplicationApprovedAt)
        ? application.clientApplicationApprovedAt!.trim()
        : null;
      patch.clientDepositBeforeCancelAt = depBefore;
      patch.clientApplicationApprovedBeforeCancelAt = appBefore;
      patch.clientDepositConfirmedAt = null;
      patch.clientApplicationApprovedAt = null;
      patch.processingApprovedNotifiedAt = null;
      patch.clientApplicationCancelledAt = now;
    } else {
      if (!isCancelled) {
        return { ok: false, error: "취소 상태가 아닙니다." };
      }
      const depBefore = application.clientDepositBeforeCancelAt;
      const appBefore = application.clientApplicationApprovedBeforeCancelAt;
      const willRestoreApproval = hasNonEmptyIsoAt(appBefore);
      if (willRestoreApproval) {
        const cap = await assertParticipantApprovalCapacityFirestore({
          tournamentId,
          maxParticipants: tournament.maxParticipants,
          excludeEntryId: entryId,
          excludeApplication: application,
        });
        if (!cap.ok) return cap;
      }
      patch.clientDepositConfirmedAt = hasNonEmptyIsoAt(depBefore) ? depBefore!.trim() : null;
      patch.clientApplicationApprovedAt = hasNonEmptyIsoAt(appBefore) ? appBefore!.trim() : null;
      patch.clientApplicationCancelledAt = null;
      patch.clientDepositBeforeCancelAt = null;
      patch.clientApplicationApprovedBeforeCancelAt = null;
      patch.processingApprovalCanceledNotifiedAt = null;
    }
  } else if (isCancelled) {
    return { ok: false, error: "취소된 신청입니다." };
  } else if (hasDeposit) {
    if (params.depositConfirmed === true) {
      patch.clientDepositConfirmedAt = now;
    } else {
      if (hasNonEmptyIsoAt(application.clientApplicationApprovedAt)) {
        return { ok: false, error: DEPOSIT_UNCONFIRM_REQUIRES_APPROVAL_REVOKED_FIRST };
      }
      patch.clientDepositConfirmedAt = null;
    }
  } else if (params.applicationApproved === true) {
    const dep =
      typeof application.clientDepositConfirmedAt === "string" && application.clientDepositConfirmedAt.trim() !== "";
    if (!dep) {
      return { ok: false, error: "입금확인 후 승인할 수 있습니다." };
    }
    if (!hadApplicationApprovedAtBefore) {
      const cap = await assertParticipantApprovalCapacityFirestore({
        tournamentId,
        maxParticipants: tournament.maxParticipants,
        excludeEntryId: entryId,
        excludeApplication: application,
      });
      if (!cap.ok) return cap;
    }
    patch.clientApplicationApprovedAt = now;
    patch.processingApprovalCanceledNotifiedAt = null;
  } else {
    patch.clientApplicationApprovedAt = null;
    patch.processingApprovedNotifiedAt = null;
  }

  await ref.set(patch, { merge: true });

  const after = await getTournamentApplicationByIdFirestore(tournamentId, entryId);
  if (!after) {
    return { ok: false, error: "참가신청을 찾을 수 없습니다." };
  }

  if (hasApprove && params.applicationApproved === true && !hadApplicationApprovedAtBefore) {
    const uid = String(after.userId ?? "").trim();
    if (uid && !isManualParticipantUserId(uid)) {
      void getTournamentByIdFirestore(tournamentId)
        .then((tournament) => {
          if (!tournament) return;
          return import("./participant-approved-notify").then(({ notifyParticipantAfterProcessingApplicationApproved }) =>
            notifyParticipantAfterProcessingApplicationApproved({
              entryId,
              applicantUserId: uid,
              tournamentId,
              tournamentTitle: tournament.title,
              tournamentDate: tournament.date,
            })
          );
        })
        .catch((e) => {
          console.error("[processing-approved-notify:schedule]", {
            tournamentId,
            entryId,
            applicantUserId: uid,
            error: e instanceof Error ? e.message : String(e),
          });
        });
    }
  }

  if (hasApprove && params.applicationApproved === false && hadApplicationApprovedAtBefore) {
    const uid = String(after.userId ?? "").trim();
    if (uid && !isManualParticipantUserId(uid)) {
      void getTournamentByIdFirestore(tournamentId)
        .then((tournament) => {
          if (!tournament) return;
          return import("./participant-approved-notify").then(
            ({ notifyParticipantAfterProcessingApplicationApprovalCanceled }) =>
              notifyParticipantAfterProcessingApplicationApprovalCanceled({
                entryId,
                applicantUserId: uid,
                tournamentId,
                tournamentTitle: tournament.title,
              })
          );
        })
        .catch((e) => {
          console.error("[processing-approval-canceled-notify:schedule]", {
            tournamentId,
            entryId,
            applicantUserId: uid,
            error: e instanceof Error ? e.message : String(e),
          });
        });
    }
  }

  return { ok: true, application: after };
}

/** 신청자관리 soft delete — 입금·승인·취소 모두 해제된 일반 대기 상태만 */
export async function softDeleteTournamentApplicationFirestore(params: {
  tournamentId: string;
  entryId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  const entryId = params.entryId.trim();
  if (!tournamentId || !entryId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const db = getSharedFirestoreDb();
  const ref = db.collection(COLLECTION).doc(entryId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, error: "참가신청을 찾을 수 없습니다." };
  }
  const data = snap.data() as Record<string, unknown>;
  if (data.tournamentId !== tournamentId) {
    return { ok: false, error: "참가신청을 찾을 수 없습니다." };
  }
  if (isTournamentApplicationSoftDeletedData(data)) {
    return { ok: false, error: "이미 삭제된 신청입니다." };
  }

  const application = tournamentApplicationFromFirestore(snap.id, data);
  if (!canSoftDeleteTournamentApplication(application)) {
    return { ok: false, error: "삭제하려면 먼저 입금확인, 승인, 취소를 모두 해제하세요." };
  }

  const now = new Date().toISOString();
  await ref.set({ deletedAt: now, updatedAt: now }, { merge: true });
  return { ok: true };
}

/**
 * 신청 승인(`clientApplicationApprovedAt`)된 건만 `APPROVED`(참가 확정)로 승격. 알림은 기존 입금확정 흐름 재사용.
 * 권역 관리자는 `zoneIdsFilter`로 해당 권역 배정 건만 처리.
 */
export async function promoteOperatorApprovedApplicationsFirestore(params: {
  tournamentId: string;
  zoneIdsFilter?: string[] | null;
}): Promise<{ ok: true; promoted: number } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  if (!tournamentId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }

  const all = await listTournamentApplicationsByTournamentIdFirestore(tournamentId);
  const managed =
    params.zoneIdsFilter != null
      ? new Set(params.zoneIdsFilter.map((z) => z.trim()).filter(Boolean))
      : null;

  let targets = all.filter(
    (a) =>
      !isTournamentApplicationProcessingCancelled(a) &&
      a.status !== "APPROVED" &&
      a.status !== "REJECTED" &&
      a.status !== "WAITING" &&
      typeof a.clientApplicationApprovedAt === "string" &&
      a.clientApplicationApprovedAt.trim() !== ""
  );

  if (managed && managed.size > 0) {
    targets = targets.filter((a) => {
      const zid = typeof a.zoneId === "string" ? a.zoneId.trim() : "";
      return zid && managed.has(zid);
    });
  } else if (managed && managed.size === 0) {
    targets = [];
  }

  if (targets.length === 0) {
    return { ok: true, promoted: 0 };
  }

  const now = new Date().toISOString();
  const db = getSharedFirestoreDb();
  const chunkSize = 400;
  for (let i = 0; i < targets.length; i += chunkSize) {
    const slice = targets.slice(i, i + chunkSize);
    const batch = db.batch();
    for (const t of slice) {
      batch.set(
        db.collection(COLLECTION).doc(t.id),
        { status: "APPROVED" as const, updatedAt: now, statusChangedAt: now },
        { merge: true }
      );
    }
    await batch.commit();
  }

  const { notifyParticipantApprovedAfterDepositConfirm } = await import("./participant-approved-notify");
  for (const t of targets) {
    const uid = String(t.userId ?? "").trim();
    if (!uid || isManualParticipantUserId(uid)) continue;
    const pan =
      typeof t.processingApprovedNotifiedAt === "string" ? t.processingApprovedNotifiedAt.trim() : "";
    if (pan) continue;
    void notifyParticipantApprovedAfterDepositConfirm({
      entryId: t.id,
      applicantUserId: uid,
      tournamentId,
      tournamentTitle: tournament.title,
      tournamentDate: tournament.date,
    });
  }

  return { ok: true, promoted: targets.length };
}

function demoteApprovedApplicationStatus(app: TournamentApplication): TournamentApplicationStatus {
  const dep =
    typeof app.clientDepositConfirmedAt === "string" && app.clientDepositConfirmedAt.trim() !== "";
  return dep ? "WAITING_PAYMENT" : "VERIFYING";
}

/** 참가 확정(마감) 취소 — `APPROVED` 참가자를 확정 전 상태로 되돌림. 알림 재발송 없음. */
export async function demoteParticipantConfirmationFirestore(params: {
  tournamentId: string;
  zoneIdsFilter?: string[] | null;
}): Promise<{ ok: true; demoted: number } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  if (!tournamentId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }

  const all = await listTournamentApplicationsByTournamentIdFirestore(tournamentId);
  const managed =
    params.zoneIdsFilter != null
      ? new Set(params.zoneIdsFilter.map((z) => z.trim()).filter(Boolean))
      : null;

  let targets = all.filter((a) => a.status === "APPROVED");
  if (managed && managed.size > 0) {
    targets = targets.filter((a) => {
      const zid = typeof a.zoneId === "string" ? a.zoneId.trim() : "";
      return zid && managed.has(zid);
    });
  } else if (managed && managed.size === 0) {
    targets = [];
  }

  if (targets.length === 0) {
    return { ok: true, demoted: 0 };
  }

  const now = new Date().toISOString();
  const db = getSharedFirestoreDb();
  const chunkSize = 400;
  for (let i = 0; i < targets.length; i += chunkSize) {
    const slice = targets.slice(i, i + chunkSize);
    const batch = db.batch();
    for (const t of slice) {
      const nextSt = demoteApprovedApplicationStatus(t);
      batch.set(
        db.collection(COLLECTION).doc(t.id),
        { status: nextSt, updatedAt: now, statusChangedAt: now },
        { merge: true },
      );
    }
    await batch.commit();
  }

  return { ok: true, demoted: targets.length };
}

export async function updateTournamentApplicationZoneIdFirestore(params: {
  tournamentId: string;
  entryId: string;
  zoneId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  const entryId = params.entryId.trim();
  if (!tournamentId || !entryId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const application = await getTournamentApplicationByIdFirestore(tournamentId, entryId);
  if (!application || application.tournamentId.trim() !== tournamentId) {
    return { ok: false, error: "참가신청을 찾을 수 없습니다." };
  }

  if (params.zoneId !== null) {
    const zid = params.zoneId.trim();
    if (!zid) {
      return { ok: false, error: "잘못된 권역입니다." };
    }
    const zone = await getTournamentZoneById(tournamentId, zid);
    if (!zone || zone.status !== "ACTIVE") {
      return { ok: false, error: "권역을 찾을 수 없습니다." };
    }
  }

  const now = new Date().toISOString();
  const db = getSharedFirestoreDb();
  const ref = db.collection(COLLECTION).doc(entryId);
  await ref.set(
    {
      zoneId: params.zoneId === null ? null : params.zoneId.trim(),
      updatedAt: now,
    },
    { merge: true }
  );

  return { ok: true };
}

export async function markTournamentApplicationOcrProcessingFirestore(params: {
  tournamentId: string;
  entryId: string;
}): Promise<TournamentApplication | null> {
  assertClientFirestorePersistenceConfigured();
  const target = await getTournamentApplicationByIdFirestore(params.tournamentId, params.entryId);
  if (!target) return null;

  const now = new Date().toISOString();
  const db = getSharedFirestoreDb();
  await db.collection(COLLECTION).doc(target.id).set(
    {
      ocrStatus: "PROCESSING" as const,
      ocrRequestedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  return getTournamentApplicationByIdFirestore(params.tournamentId, params.entryId);
}

export async function completeTournamentApplicationOcrFirestore(params: {
  tournamentId: string;
  entryId: string;
  text: string;
  rawResult: string;
  failed?: boolean;
}): Promise<TournamentApplication | null> {
  assertClientFirestorePersistenceConfigured();
  const target = await getTournamentApplicationByIdFirestore(params.tournamentId, params.entryId);
  if (!target) return null;

  const now = new Date().toISOString();
  const db = getSharedFirestoreDb();
  await db.collection(COLLECTION).doc(target.id).set(
    {
      ocrStatus: params.failed ? "FAILED" : "COMPLETED",
      ocrText: params.text,
      ocrRawResult: params.rawResult,
      ocrCompletedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  return getTournamentApplicationByIdFirestore(params.tournamentId, params.entryId);
}

async function listTournamentApplicationsByTournamentIdWithIndexFallback(tournamentId: string): Promise<TournamentApplication[]> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return [];
  const db = getSharedFirestoreDb();
  try {
    const q = await db
      .collection(COLLECTION)
      .where("tournamentId", "==", id)
      .orderBy("createdAt", "desc")
      .get();
    return q.docs.map((doc) => tournamentApplicationFromFirestore(doc.id, doc.data() as Record<string, unknown>));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!message.includes("FAILED_PRECONDITION")) {
      throw error;
    }
    const q = await db.collection(COLLECTION).where("tournamentId", "==", id).get();
    const rows = q.docs.map((doc) => tournamentApplicationFromFirestore(doc.id, doc.data() as Record<string, unknown>));
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

/**
 * production: `listDeduplicatedApplicantsForClientOwner` Firestore 이행.
 * 본인이 생성한 대회(또는 플랫폼 scope 시 전체)에 대한 신청을 userId 기준으로 한 행씩.
 */
export async function listDeduplicatedApplicantsForClientOwnerFirestore(params: {
  ownerUserId: string;
  scope: "creator" | "platform";
}): Promise<DeduplicatedApplicantRow[]> {
  assertClientFirestorePersistenceConfigured();
  const ownerUserId = await resolveCanonicalUserIdForAuth(params.ownerUserId.trim());
  const tournaments =
    params.scope === "platform" ? await listAllTournamentsFirestore() : await listTournamentsByCreatorFirestore(ownerUserId);
  const bestByUser = new Map<string, TournamentApplication>();
  for (const t of tournaments) {
    const apps = await listTournamentApplicationsByTournamentIdWithIndexFallback(t.id);
    for (const raw of apps) {
      const uid = typeof raw.userId === "string" ? raw.userId.trim() : "";
      if (!uid) continue;
      const prev = bestByUser.get(uid);
      const ca = raw.createdAt || "";
      if (!prev) {
        bestByUser.set(uid, raw);
        continue;
      }
      const pb = prev.createdAt || "";
      if (ca.localeCompare(pb) > 0) bestByUser.set(uid, raw);
    }
  }
  const rows: DeduplicatedApplicantRow[] = [];
  for (const app of bestByUser.values()) {
    const name = typeof app.applicantName === "string" ? app.applicantName.trim() : "";
    const phone = typeof app.phone === "string" ? app.phone.trim() : "";
    const uidTrim = app.userId.trim();
    const u = await firestoreGetUserById(uidTrim);
    const pushMarketingAgreed = u ? u.pushMarketingAgreed !== false : true;
    rows.push({
      userId: uidTrim,
      applicantName: name || "—",
      phone: phone || "—",
      lastAppliedAt: typeof app.createdAt === "string" ? app.createdAt : "",
      pushMarketingAgreed,
    });
  }
  rows.sort((a, b) => a.applicantName.localeCompare(b.applicantName, "ko"));
  return rows;
}

const MANUAL_PARTICIPANT_USER_ID_PREFIX = "manual-participant:";

export function isManualParticipantUserId(userId: string): boolean {
  return typeof userId === "string" && userId.startsWith(MANUAL_PARTICIPANT_USER_ID_PREFIX);
}

/** OCR·증빙 없이 관리자가 승인 상태로 등록(현장 입력) */
export async function createAdminRegisteredParticipantFirestore(params: {
  tournamentId: string;
  applicantName: string;
  participantAverage: number;
  phone: string;
  adminNote: string;
}): Promise<{ ok: true; application: TournamentApplication } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const applicantName = params.applicantName.trim();
  if (!applicantName) return { ok: false, error: "이름을 입력해 주세요." };
  const avg = Number(params.participantAverage);
  if (!Number.isFinite(avg)) return { ok: false, error: "에버를 입력해 주세요." };

  const tournament = await getTournamentByIdFirestore(params.tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };

  const maxParticipants = Number(tournament.maxParticipants);
  const occupied = await countCapacityOccupiedApplicationsForTournamentFirestore(params.tournamentId);
  const atCapacity =
    Number.isFinite(maxParticipants) && maxParticipants > 0 && occupied >= maxParticipants;

  const id = randomUUID();
  const manualUserId = `${MANUAL_PARTICIPANT_USER_ID_PREFIX}${id}`;
  const now = new Date().toISOString();
  const application: TournamentApplication = {
    id,
    tournamentId: params.tournamentId.trim(),
    userId: manualUserId,
    applicantName,
    phone: params.phone.trim(),
    depositorName: "",
    proofImageId: "",
    proofImage320Url: "",
    proofImage640Url: "",
    proofOriginalUrl: "",
    ocrStatus: "NOT_REQUESTED",
    ocrText: "",
    ocrRawResult: "",
    ocrRequestedAt: null,
    ocrCompletedAt: null,
    status: atCapacity ? "APPLIED" : "APPROVED",
    createdAt: now,
    updatedAt: now,
    statusChangedAt: now,
    registrationSource: "admin",
    participantAverage: avg,
    adminNote: params.adminNote.trim() ? params.adminNote.trim() : null,
    attendanceChecked: false,
  };

  const plain: Record<string, unknown> = {
    id: application.id,
    tournamentId: application.tournamentId,
    userId: application.userId,
    applicantName: application.applicantName,
    phone: application.phone,
    depositorName: application.depositorName,
    proofImageId: application.proofImageId,
    proofImage320Url: application.proofImage320Url,
    proofImage640Url: application.proofImage640Url,
    proofOriginalUrl: application.proofOriginalUrl,
    ocrStatus: application.ocrStatus,
    ocrText: application.ocrText,
    ocrRawResult: application.ocrRawResult,
    ocrRequestedAt: application.ocrRequestedAt,
    ocrCompletedAt: application.ocrCompletedAt,
    status: application.status,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    statusChangedAt: application.statusChangedAt,
    registrationSource: "admin",
    participantAverage: application.participantAverage,
    adminNote: application.adminNote,
    attendanceChecked: application.attendanceChecked,
  };

  const db = getSharedFirestoreDb();
  await db.collection(COLLECTION).doc(id).set(plain);
  return { ok: true, application };
}

export async function updateParticipantAttendanceCheckedFirestore(params: {
  tournamentId: string;
  entryId: string;
  checked: boolean;
}): Promise<{ ok: true; application: TournamentApplication } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  const entryId = params.entryId.trim();
  if (!tournamentId || !entryId) return { ok: false, error: "잘못된 요청입니다." };

  const application = await getTournamentApplicationByIdFirestore(tournamentId, entryId);
  if (!application) return { ok: false, error: "참가신청을 찾을 수 없습니다." };

  const now = new Date().toISOString();
  const db = getSharedFirestoreDb();
  await db.collection(COLLECTION).doc(entryId).set(
    {
      attendanceChecked: params.checked,
      updatedAt: now,
    },
    { merge: true }
  );
  const after = await getTournamentApplicationByIdFirestore(tournamentId, entryId);
  if (!after) return { ok: false, error: "참가신청을 찾을 수 없습니다." };
  return { ok: true, application: after };
}
