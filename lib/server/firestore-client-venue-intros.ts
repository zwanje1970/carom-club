import type { OutlineDisplayMode } from "../outline-content-types";
import { CACHE_TAG_SITE_VENUES_BOARD_ROWS } from "../cache-tags";
import { revalidateSiteDataTag } from "../revalidate-site-data-tag";
import type { ClientVenueIntroStored } from "./platform-backing-store";
import { assertClientFirestorePersistenceConfigured } from "./firestore-client-applications";
import { getSharedFirestoreDb } from "./firestore-users";

const V3_CLIENT_VENUE_INTROS = "v3_client_venue_intros";

function normalizeOutlineDisplayMode(value: unknown): OutlineDisplayMode | null {
  return value === "TEXT" || value === "IMAGE" || value === "PDF" ? value : null;
}

function introFromDoc(
  userId: string,
  data: Record<string, unknown> | undefined
): ClientVenueIntroStored | null {
  if (!data || typeof data !== "object") return null;
  const now = new Date().toISOString();
  const clientUserId =
    typeof data.clientUserId === "string" && data.clientUserId.trim() ? data.clientUserId.trim() : userId;
  return {
    clientUserId,
    outlineDisplayMode: normalizeOutlineDisplayMode(data.outlineDisplayMode),
    outlineHtml: data.outlineHtml === null || typeof data.outlineHtml === "string" ? (data.outlineHtml as string | null) : null,
    outlineImageUrl:
      data.outlineImageUrl === null || typeof data.outlineImageUrl === "string" ? (data.outlineImageUrl as string | null) : null,
    outlinePdfUrl:
      data.outlinePdfUrl === null || typeof data.outlinePdfUrl === "string" ? (data.outlinePdfUrl as string | null) : null,
    updatedAt: typeof data.updatedAt === "string" && data.updatedAt.trim() ? data.updatedAt : now,
  };
}

export async function getClientVenueIntroByUserIdFirestore(userId: string): Promise<ClientVenueIntroStored | null> {
  assertClientFirestorePersistenceConfigured();
  const uid = userId.trim();
  if (!uid) return null;
  const db = getSharedFirestoreDb();
  const snap = await db.collection(V3_CLIENT_VENUE_INTROS).doc(uid).get();
  if (!snap.exists) return null;
  return introFromDoc(uid, snap.data() as Record<string, unknown> | undefined);
}

export async function upsertClientVenueIntroForUserFirestore(
  userId: string,
  params: {
    outlineDisplayMode: OutlineDisplayMode | null;
    outlineHtml: string | null;
    outlineImageUrl: string | null;
    outlinePdfUrl: string | null;
  }
): Promise<ClientVenueIntroStored> {
  assertClientFirestorePersistenceConfigured();
  const uid = userId.trim();
  const now = new Date().toISOString();
  const next: ClientVenueIntroStored = {
    clientUserId: uid,
    outlineDisplayMode: params.outlineDisplayMode,
    outlineHtml: params.outlineHtml,
    outlineImageUrl: params.outlineImageUrl,
    outlinePdfUrl: params.outlinePdfUrl,
    updatedAt: now,
  };
  const db = getSharedFirestoreDb();
  await db.collection(V3_CLIENT_VENUE_INTROS).doc(uid).set(next, { merge: true });
  revalidateSiteDataTag(CACHE_TAG_SITE_VENUES_BOARD_ROWS);
  return next;
}
