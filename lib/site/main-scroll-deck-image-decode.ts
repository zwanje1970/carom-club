import { isMainSiteLoadDiagEnabled } from "./main-site-load-diag";

const decodeDoneUrls = new Set<string>();
const decodeInflightByUrl = new Map<string, Promise<void>>();

function decodeUrlKey(url: string): string {
  return url.trim();
}

/** kick 등에서 src를 다시 넣을 때 — 해당 URL decode 캐시만 제거(실패 시와 동일, 재시도 가능) */
export function clearMainScrollDeckImageDecodeCacheForUrl(url: string): void {
  const key = decodeUrlKey(url);
  if (!key) return;
  decodeDoneUrls.delete(key);
  decodeInflightByUrl.delete(key);
}

/**
 * 같은 URL은 decode()를 한 번만 실행하고, 진행 중이면 Promise를 공유한다.
 * 실패 시 캐시에 남기지 않아 다음 호출에서 다시 decode할 수 있다.
 */
export function decodeMainScrollDeckImageOnce(img: HTMLImageElement): void {
  if (typeof img.decode !== "function") return;
  const key = decodeUrlKey(img.currentSrc || img.src || "");
  if (!key) return;

  if (decodeDoneUrls.has(key)) return;

  const inflight = decodeInflightByUrl.get(key);
  if (inflight) {
    void inflight.catch(() => {});
    return;
  }

  const promise = img
    .decode()
    .then(() => {
      decodeDoneUrls.add(key);
      decodeInflightByUrl.delete(key);
    })
    .catch((e: unknown) => {
      decodeInflightByUrl.delete(key);
      if (isMainSiteLoadDiagEnabled()) {
        const err = e instanceof Error ? e.message : String(e);
        console.warn(`[main-card-image] phase=main-img-decode-error url=${key} error=${err}`);
      }
    });

  decodeInflightByUrl.set(key, promise);
}
