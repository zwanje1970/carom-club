import { randomUUID } from "crypto";
import { assertClientFirestorePersistenceConfigured } from "./firestore-client-applications";
import { getTournamentByIdFirestore } from "./firestore-tournaments";
import { getSharedFirestoreDb } from "./firestore-users";
import type { TournamentApplication, TournamentApplicationStatus } from "./dev-store";
import {
  buildProtectedProofImageUrl,
  getAllowedTournamentApplicationNextStatuses,
  getProofImageAssetById,
  resolveCanonicalUserIdForAuth,
} from "./dev-store";

const COLLECTION = "v3_tournament_applications";

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
    st === "APPROVED" ||
    st === "REJECTED"
      ? st
      : "APPLIED";
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
  };
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
  return tournamentApplicationFromFirestore(snap.id, data);
}

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
  return q.docs.map((doc) => tournamentApplicationFromFirestore(doc.id, doc.data() as Record<string, unknown>));
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
  proofImageId: string;
  proofImage320Url: string;
  proofImage640Url: string;
  proofOriginalUrl: string;
}): Promise<{ ok: true; application: TournamentApplication } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const applicantName = params.applicantName.trim();
  const phone = params.phone.trim();
  const depositorName = params.depositorName.trim();
  const proofImageId = params.proofImageId.trim();

  if (!applicantName) return { ok: false, error: "이름을 입력해 주세요." };
  if (!phone) return { ok: false, error: "전화번호를 입력해 주세요." };
  if (!depositorName) return { ok: false, error: "입금자명을 입력해 주세요." };
  if (!proofImageId) {
    return { ok: false, error: "증빙 이미지를 업로드해 주세요." };
  }

  const canonicalUserId = await resolveCanonicalUserIdForAuth(params.userId.trim());
  const tournament = await getTournamentByIdFirestore(params.tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };

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

  const proofImage = await getProofImageAssetById(proofImageId);
  if (!proofImage) {
    return { ok: false, error: "증빙 이미지를 다시 업로드해 주세요." };
  }
  if (proofImage.uploaderUserId !== canonicalUserId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const now = new Date().toISOString();
  const application: TournamentApplication = {
    id: randomUUID(),
    tournamentId: params.tournamentId,
    userId: canonicalUserId,
    applicantName,
    phone,
    depositorName,
    proofImageId,
    proofImage320Url: buildProtectedProofImageUrl(proofImageId, "w320"),
    proofImage640Url: buildProtectedProofImageUrl(proofImageId, "w640"),
    proofOriginalUrl: buildProtectedProofImageUrl(proofImageId, "original"),
    ocrStatus: "NOT_REQUESTED",
    ocrText: "",
    ocrRawResult: "",
    ocrRequestedAt: null,
    ocrCompletedAt: null,
    status: "APPLIED",
    createdAt: now,
    updatedAt: now,
    statusChangedAt: now,
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
  };
  await db.collection(COLLECTION).doc(application.id).set(plain);
  return { ok: true, application };
}

export async function updateTournamentApplicationStatusFirestore(params: {
  tournamentId: string;
  entryId: string;
  nextStatus: TournamentApplicationStatus;
  actorUserId?: string;
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
  await ref.set(
    {
      status: params.nextStatus,
      updatedAt: now,
      statusChangedAt: now,
    },
    { merge: true }
  );

  const after = await getTournamentApplicationByIdFirestore(tournamentId, entryId);
  if (!after) {
    return { ok: false, error: "참가신청을 찾을 수 없습니다." };
  }
  return { ok: true, application: after };
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
