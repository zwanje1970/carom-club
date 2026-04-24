import { getSharedFirestoreDb } from "./firestore-users";

/** 단일 컬렉션에 문서 id = 설정 키, 필드 value_json + updated_at */
export const PLATFORM_KV_COLLECTION = "v3_platform_kv_settings";

export type PlatformKvSettingKey =
  | "siteNotice"
  | "siteLayoutConfig"
  | "siteCommunityConfig"
  | "platformOperationSettings"
  | "siteCommunityFeed"
  | "siteProofImageAssets";

export const PLATFORM_KV_KEYS: Record<
  | "siteNotice"
  | "siteLayoutConfig"
  | "siteCommunityConfig"
  | "platformOperationSettings"
  | "siteCommunityFeed"
  | "siteProofImageAssets",
  PlatformKvSettingKey
> = {
  siteNotice: "siteNotice",
  siteLayoutConfig: "siteLayoutConfig",
  siteCommunityConfig: "siteCommunityConfig",
  platformOperationSettings: "platformOperationSettings",
  siteCommunityFeed: "siteCommunityFeed",
  siteProofImageAssets: "siteProofImageAssets",
};

/** 설정별 helper에서 동일 키 집합을 순회·매핑할 때 사용 */
export const ALL_PLATFORM_KV_SETTING_KEYS: readonly PlatformKvSettingKey[] = [
  PLATFORM_KV_KEYS.siteNotice,
  PLATFORM_KV_KEYS.siteLayoutConfig,
  PLATFORM_KV_KEYS.siteCommunityConfig,
  PLATFORM_KV_KEYS.platformOperationSettings,
  PLATFORM_KV_KEYS.siteCommunityFeed,
  PLATFORM_KV_KEYS.siteProofImageAssets,
];

export async function readPlatformKvJson(key: PlatformKvSettingKey): Promise<unknown | null> {
  const db = getSharedFirestoreDb();
  const snap = await db.collection(PLATFORM_KV_COLLECTION).doc(key).get();
  if (!snap.exists) return null;
  const data = snap.data();
  const raw = data?.value_json;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function upsertPlatformKvJson(key: PlatformKvSettingKey, value: unknown): Promise<void> {
  const db = getSharedFirestoreDb();
  const value_json = JSON.stringify(value);
  const updated_at = new Date().toISOString();
  await db.collection(PLATFORM_KV_COLLECTION).doc(key).set({ value_json, updated_at }, { merge: true });
}
