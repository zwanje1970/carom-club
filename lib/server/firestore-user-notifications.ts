import { randomUUID } from "crypto";
import { assertClientFirestorePersistenceConfigured } from "./firestore-client-applications";
import { getSharedFirestoreDb } from "./firestore-users";

const COLLECTION = "v3_user_notifications";

async function canonicalUserId(raw: string): Promise<string> {
  const { resolveCanonicalUserIdForAuth } = await import("./platform-backing-store");
  return resolveCanonicalUserIdForAuth(raw.trim());
}

export type FirestoreUserNotificationRow = {
  id: string;
  userId: string;
  title: string;
  message: string;
  relatedTournamentId: string | null;
  createdAt: string;
  isRead: boolean;
};

function rowFromDoc(docId: string, data: Record<string, unknown> | undefined): FirestoreUserNotificationRow | null {
  if (!data || typeof data !== "object") return null;
  const userId = typeof data.userId === "string" ? data.userId.trim() : "";
  const title = typeof data.title === "string" ? data.title : "";
  const message = typeof data.message === "string" ? data.message : "";
  const createdAt = typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString();
  const isRead = data.isRead === true;
  const rt = data.relatedTournamentId;
  const relatedTournamentId = typeof rt === "string" && rt.trim() ? rt.trim() : null;
  if (!userId || !title) return null;
  return {
    id: docId,
    userId,
    title,
    message,
    relatedTournamentId,
    createdAt,
    isRead,
  };
}

export async function appendUserNotificationFirestore(params: {
  userId: string;
  title: string;
  message: string;
  relatedTournamentId: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const userId = await canonicalUserId(params.userId);
  if (!userId) return { ok: false, error: "수신자가 없습니다." };
  const title = params.title.trim();
  const message = params.message.trim();
  if (!title) return { ok: false, error: "제목이 없습니다." };
  if (!message) return { ok: false, error: "본문이 없습니다." };
  const id = randomUUID();
  const now = new Date().toISOString();
  const db = getSharedFirestoreDb();
  await db.collection(COLLECTION).doc(id).set({
    id,
    userId,
    title,
    message,
    relatedTournamentId: params.relatedTournamentId,
    createdAt: now,
    isRead: false,
  });
  return { ok: true, id };
}

export async function listUserNotificationsFirestore(userId: string, limit = 20): Promise<FirestoreUserNotificationRow[]> {
  assertClientFirestorePersistenceConfigured();
  const uid = await canonicalUserId(userId);
  if (!uid) return [];
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const db = getSharedFirestoreDb();
  const q = await db
    .collection(COLLECTION)
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(safeLimit)
    .get();
  const out: FirestoreUserNotificationRow[] = [];
  for (const doc of q.docs) {
    const row = rowFromDoc(doc.id, doc.data() as Record<string, unknown>);
    if (row) out.push(row);
  }
  return out;
}

export async function countUnreadUserNotificationsFirestore(userId: string): Promise<number> {
  assertClientFirestorePersistenceConfigured();
  const uid = await canonicalUserId(userId);
  if (!uid) return 0;
  const db = getSharedFirestoreDb();
  const q = await db.collection(COLLECTION).where("userId", "==", uid).where("isRead", "==", false).get();
  return q.size;
}

export async function markUserNotificationReadFirestore(params: {
  userId: string;
  notificationId: string;
}): Promise<FirestoreUserNotificationRow | null> {
  assertClientFirestorePersistenceConfigured();
  const uid = await canonicalUserId(params.userId);
  const notificationId = params.notificationId.trim();
  if (!uid || !notificationId) return null;
  const db = getSharedFirestoreDb();
  const ref = db.collection(COLLECTION).doc(notificationId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown>;
  if (typeof data.userId !== "string" || data.userId.trim() !== uid) return null;
  const now = new Date().toISOString();
  await ref.set({ isRead: true, updatedAt: now }, { merge: true });
  const row = rowFromDoc(notificationId, { ...data, isRead: true });
  return row;
}

export async function markAllUserNotificationsReadFirestore(userId: string): Promise<number> {
  assertClientFirestorePersistenceConfigured();
  const uid = await canonicalUserId(userId);
  if (!uid) return 0;
  const db = getSharedFirestoreDb();
  const q = await db.collection(COLLECTION).where("userId", "==", uid).where("isRead", "==", false).get();
  const now = new Date().toISOString();
  let n = 0;
  const batch = db.batch();
  for (const doc of q.docs) {
    batch.set(doc.ref, { isRead: true, updatedAt: now }, { merge: true });
    n += 1;
  }
  if (n > 0) await batch.commit();
  return n;
}
