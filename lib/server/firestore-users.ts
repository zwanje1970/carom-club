import * as admin from "firebase-admin";
import type { AuthRole } from "../auth/roles";
import type { DevUser, PlatformUserStatus } from "./dev-store";

const COLLECTION = "v3_platform_users";

let initDone = false;

function ensureFirestore(): admin.firestore.Firestore {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_CREDENTIALS_MISSING_FOR_USERS");
  }
  if (!initDone) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
    initDone = true;
  }
  return admin.firestore();
}

/** 플랫폼 사용자·KV 등 공용 Firestore (자격 증명 없으면 throw) */
export function getSharedFirestoreDb(): admin.firestore.Firestore {
  return ensureFirestore();
}

export function isFirestoreUsersBackendConfigured(): boolean {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return Boolean(projectId && clientEmail && privateKey);
}

function nicknameKey(value: string): string {
  return value.trim().toLowerCase();
}

function docToUser(data: FirebaseFirestore.DocumentData | undefined): DevUser | null {
  if (!data || typeof data !== "object") return null;
  const id = typeof data.id === "string" ? data.id.trim() : "";
  const loginId = typeof data.loginId === "string" ? data.loginId.trim() : "";
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!id || !loginId || !name) return null;
  const roleRaw = data.role;
  const role: AuthRole =
    roleRaw === "USER" || roleRaw === "CLIENT" || roleRaw === "PLATFORM" ? roleRaw : "USER";
  const st = data.status;
  const status: PlatformUserStatus | undefined =
    st === "SUSPENDED" || st === "DELETED" || st === "ACTIVE" ? st : "ACTIVE";
  return {
    id,
    loginId,
    nickname: typeof data.nickname === "string" && data.nickname.trim() ? data.nickname.trim() : loginId,
    name,
    email: typeof data.email === "string" && data.email.trim() ? data.email.trim().toLowerCase() : null,
    phone: typeof data.phone === "string" && data.phone.trim() ? data.phone.trim() : null,
    password: typeof data.password === "string" ? data.password : "",
    role,
    status,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
    linkedVenueId: typeof data.linkedVenueId === "string" ? data.linkedVenueId : null,
    pushMarketingAgreed: data.pushMarketingAgreed !== false,
  };
}

function userToDoc(u: DevUser): Record<string, unknown> {
  const phoneDigits = u.phone ? u.phone.replace(/\D/g, "") : "";
  return {
    id: u.id,
    loginId: u.loginId,
    loginIdNorm: u.loginId.toLowerCase(),
    nickname: u.nickname,
    nicknameKey: nicknameKey(u.nickname),
    name: u.name,
    email: u.email,
    emailNorm: u.email?.toLowerCase() ?? null,
    phone: u.phone,
    phoneDigits: phoneDigits || null,
    password: u.password,
    role: u.role,
    status: u.status ?? "ACTIVE",
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    linkedVenueId: u.linkedVenueId,
    pushMarketingAgreed: u.pushMarketingAgreed,
  };
}

export async function firestoreGetUserById(userId: string): Promise<DevUser | null> {
  const id = userId.trim();
  if (!id) return null;
  const db = ensureFirestore();
  const snap = await db.collection(COLLECTION).doc(id).get();
  return docToUser(snap.data());
}

export async function firestoreFindByLoginIdNorm(loginIdNorm: string): Promise<DevUser | null> {
  const raw = loginIdNorm.trim().toLowerCase();
  if (!raw) return null;
  const db = ensureFirestore();
  const q = await db.collection(COLLECTION).where("loginIdNorm", "==", raw).limit(1).get();
  const d = q.docs[0];
  return d ? docToUser(d.data()) : null;
}

export async function firestoreFindByPhoneDigits(phoneDigits: string): Promise<DevUser | null> {
  const p = phoneDigits.replace(/\D/g, "");
  if (!p) return null;
  const db = ensureFirestore();
  const q = await db.collection(COLLECTION).where("phoneDigits", "==", p).limit(2).get();
  return q.docs[0] ? docToUser(q.docs[0].data()) : null;
}

export async function firestoreFindByLoginIdAndPhoneDigits(
  loginIdNorm: string,
  phoneDigits: string
): Promise<DevUser | null> {
  const login = loginIdNorm.trim().toLowerCase();
  const p = phoneDigits.replace(/\D/g, "");
  if (!login || !p) return null;
  const u = await firestoreFindByLoginIdNorm(login);
  if (!u) return null;
  const uPhone = u.phone ? u.phone.replace(/\D/g, "") : "";
  return uPhone === p ? u : null;
}

export async function firestoreIsNicknameKeyTaken(key: string, excludeUserId?: string): Promise<boolean> {
  const db = ensureFirestore();
  const q = await db.collection(COLLECTION).where("nicknameKey", "==", key).limit(8).get();
  for (const doc of q.docs) {
    const u = docToUser(doc.data());
    if (u && (!excludeUserId || u.id !== excludeUserId)) return true;
  }
  return false;
}

export async function firestoreHasDuplicateIdentity(params: {
  loginIdNorm: string;
  email: string | null;
  phoneDigits: string | null;
}): Promise<boolean> {
  const db = ensureFirestore();
  const login = params.loginIdNorm.toLowerCase();
  const byLogin = await db.collection(COLLECTION).where("loginIdNorm", "==", login).limit(1).get();
  if (!byLogin.empty) return true;
  if (params.email) {
    const em = params.email.toLowerCase();
    const byEmail = await db.collection(COLLECTION).where("emailNorm", "==", em).limit(1).get();
    if (!byEmail.empty) return true;
  }
  if (params.phoneDigits) {
    const byPhone = await db.collection(COLLECTION).where("phoneDigits", "==", params.phoneDigits).limit(1).get();
    if (!byPhone.empty) return true;
  }
  return false;
}

export async function firestoreCreateUser(user: DevUser): Promise<void> {
  const db = ensureFirestore();
  await db.collection(COLLECTION).doc(user.id).set(userToDoc(user));
}

export async function firestoreUpdatePassword(userId: string, newPassword: string): Promise<boolean> {
  const id = userId.trim();
  if (!id) return false;
  const db = ensureFirestore();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({
    password: newPassword.trim(),
    updatedAt: new Date().toISOString(),
  });
  return true;
}

export async function firestoreReplaceUser(user: DevUser): Promise<void> {
  const db = ensureFirestore();
  await db.collection(COLLECTION).doc(user.id).set(userToDoc(user));
}

/** 동일 전화번호를 다른 사용자가 쓰는지(Firestore만 검사) */
export async function firestoreHasOtherUserWithPhoneDigits(
  phoneDigits: string,
  excludeUserId: string
): Promise<boolean> {
  const p = phoneDigits.replace(/\D/g, "");
  if (!p) return false;
  const db = ensureFirestore();
  const q = await db.collection(COLLECTION).where("phoneDigits", "==", p).limit(8).get();
  for (const doc of q.docs) {
    if (doc.id !== excludeUserId) return true;
  }
  return false;
}

/** 플랫폼 푸시: Firestore `v3_platform_users` 기준 사용자 id(삭제 계정 제외). */
export async function firestoreListUserIdsForPushAudience(audience: "all" | "client"): Promise<string[]> {
  const db = ensureFirestore();
  const col = db.collection(COLLECTION);
  const snap = audience === "client" ? await col.where("role", "==", "CLIENT").get() : await col.get();
  const out: string[] = [];
  for (const doc of snap.docs) {
    const u = docToUser(doc.data());
    if (!u) continue;
    if (u.status === "DELETED") continue;
    out.push(doc.id);
  }
  return out;
}

/** 마케팅 푸시 동의: Firestore 사용자 문서의 pushMarketingAgreed 기준(명시적 false만 제외). */
export async function firestoreFilterUserIdsWithMarketingPushConsent(userIds: string[]): Promise<string[]> {
  const unique = [...new Set(userIds.map((x) => String(x).trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const db = ensureFirestore();
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const refs = chunk.map((id) => db.collection(COLLECTION).doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const u = docToUser(snap.data());
      if (!u || seen.has(snap.id)) continue;
      if (u.pushMarketingAgreed === false) continue;
      seen.add(snap.id);
      out.push(snap.id);
    }
  }
  return out;
}
