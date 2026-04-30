/**
 * Firestore KV에 저장된 증빙 이미지용 외부(Storage) URL.
 * 없으면 로컬 디스크 경로(`/api/proof-images` 등)로 제공하는 기존 흐름을 쓴다.
 */
export function getStoredProofImageVariantUrl(
  asset: {
    storageOriginalUrl?: string;
    storageW160Url?: string;
    storageW320Url?: string;
    storageW640Url?: string;
  },
  variant: "original" | "w160" | "w320" | "w640"
): string | null {
  const raw =
    variant === "original"
      ? (typeof asset.storageOriginalUrl === "string" && asset.storageOriginalUrl.trim() !== ""
          ? asset.storageOriginalUrl
          : asset.storageW640Url)
      : variant === "w160"
        ? asset.storageW160Url
        : variant === "w320"
          ? asset.storageW320Url
          : asset.storageW640Url;
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s.startsWith("https://")) return null;
  return s;
}
