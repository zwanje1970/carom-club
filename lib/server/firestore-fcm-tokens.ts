import { createHash, randomUUID } from "crypto";
import { getSharedFirestoreDb } from "./firestore-users";

/** `FcmDeviceTokenRecord` 와 동일 필드(순환 import 방지). */
export type FirestoreFcmDeviceTokenRow = {
  id: string;
  userId: string;
  token: string;
  platform: string | null;
  createdAt: string;
  updatedAt: string;
};

const FCM_COLLECTION = "v3_fcm_device_tokens";

function fcmTokenDocId(userId: string, token: string): string {
  return createHash("sha256").update(`${userId.trim()}:${token.trim()}`).digest("hex");
}

function rowFromFirestoreDoc(
  docId: string,
  data: FirebaseFirestore.DocumentData | undefined
): FirestoreFcmDeviceTokenRow | null {
  if (!data || typeof data !== "object") return null;
  const id = typeof data.id === "string" && data.id.trim() ? data.id.trim() : docId.slice(0, 36);
  const userId = typeof data.userId === "string" ? data.userId.trim() : "";
  const token = typeof data.token === "string" ? data.token.trim() : "";
  if (!userId || !token) return null;
  const platform =
    data.platform === null || data.platform === undefined
      ? null
      : typeof data.platform === "string" && data.platform.trim()
        ? data.platform.trim()
        : null;
  const createdAt = typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString();
  const updatedAt = typeof data.updatedAt === "string" ? data.updatedAt : createdAt;
  return { id, userId, token, platform, createdAt, updatedAt };
}

export async function firestoreUpsertFcmDeviceTokenForUser(params: {
  userId: string;
  token: string;
  platform: string | null;
}): Promise<FirestoreFcmDeviceTokenRow> {
  const db = getSharedFirestoreDb();
  const userId = params.userId.trim();
  const token = params.token.trim();
  if (!token) {
    throw new Error("FCM token is empty");
  }
  const docId = fcmTokenDocId(userId, token);
  const ref = db.collection(FCM_COLLECTION).doc(docId);
  const snap = await ref.get();
  const now = new Date().toISOString();
  const id =
    snap.exists && typeof snap.data()?.id === "string" && (snap.data() as { id: string }).id.trim()
      ? (snap.data() as { id: string }).id.trim()
      : randomUUID();
  const createdAt =
    snap.exists && typeof snap.data()?.createdAt === "string" ? (snap.data() as { createdAt: string }).createdAt : now;
  await ref.set(
    {
      id,
      userId,
      token,
      platform: params.platform,
      createdAt,
      updatedAt: now,
    },
    { merge: true }
  );
  return { id, userId, token, platform: params.platform, createdAt, updatedAt: now };
}

export async function firestoreListFcmDeviceTokensForUserIds(userIds: string[]): Promise<FirestoreFcmDeviceTokenRow[]> {
  const idSet = new Set(userIds.map((x) => String(x).trim()).filter(Boolean));
  if (idSet.size === 0) return [];
  const ids = [...idSet];
  const db = getSharedFirestoreDb();
  const seenToken = new Set<string>();
  const out: FirestoreFcmDeviceTokenRow[] = [];
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const q = await db.collection(FCM_COLLECTION).where("userId", "in", chunk).get();
    for (const doc of q.docs) {
      const row = rowFromFirestoreDoc(doc.id, doc.data());
      if (!row) continue;
      if (!idSet.has(row.userId)) continue;
      if (seenToken.has(row.token)) continue;
      seenToken.add(row.token);
      out.push(row);
    }
  }
  return out;
}

export async function firestoreRemoveFcmDeviceTokensByTokenValues(tokens: string[]): Promise<number> {
  const raw = [...new Set(tokens.map((t) => String(t).trim()).filter(Boolean))];
  if (raw.length === 0) return 0;
  const db = getSharedFirestoreDb();
  let removed = 0;
  for (let i = 0; i < raw.length; i += 10) {
    const slice = raw.slice(i, i + 10);
    const q = await db.collection(FCM_COLLECTION).where("token", "in", slice).get();
    const batch = db.batch();
    for (const doc of q.docs) {
      batch.delete(doc.ref);
      removed += 1;
    }
    await batch.commit();
  }
  return removed;
}
