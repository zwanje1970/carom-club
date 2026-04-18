import { MAX_COMMUNITY_POST_IMAGE_COUNT } from "./community-post-images";

/** 본문에 삽입되는 마크다운 한 줄 (w640 URL, 원본 금지) — 저장용으로만 사용, UI에는 비노출 */
const IMG_LINE = /!\[\]\(([^)]+)\)/g;

/** 긴변 기준 단계(px). 2단계(280)가 기본 */
export const COMMUNITY_POST_LONG_EDGE_PX = [180, 240, 280, 340, 420] as const;
export const COMMUNITY_POST_DEFAULT_SIZE_LEVEL = 2;
export const COMMUNITY_POST_SIZE_LEVEL_MIN = 0;
export const COMMUNITY_POST_SIZE_LEVEL_MAX = 4;

export function clampCommunityPostSizeLevel(n: number): number {
  const x = Number.isFinite(n) ? Math.floor(n) : COMMUNITY_POST_DEFAULT_SIZE_LEVEL;
  return Math.max(COMMUNITY_POST_SIZE_LEVEL_MIN, Math.min(COMMUNITY_POST_SIZE_LEVEL_MAX, x));
}

export function getCommunityPostLongEdgePx(level: number): number {
  return COMMUNITY_POST_LONG_EDGE_PX[clampCommunityPostSizeLevel(level)];
}

export function extractCommunityImageUrlsFromContent(content: string): string[] {
  const out: string[] = [];
  const re = new RegExp(IMG_LINE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const u = m[1].trim();
    if (u) out.push(u);
    if (out.length >= MAX_COMMUNITY_POST_IMAGE_COUNT) break;
  }
  return out;
}

/** imageUrls 순서와 동일한 길이로 정규화 (저장·로드) */
export function normalizeCommunityPostImageSizeLevels(imageUrlCount: number, raw: unknown): number[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: number[] = [];
  for (let i = 0; i < imageUrlCount; i++) {
    const v = arr[i];
    out.push(clampCommunityPostSizeLevel(typeof v === "number" ? v : COMMUNITY_POST_DEFAULT_SIZE_LEVEL));
  }
  return out;
}

export type CommunityPostBodySegment =
  | { kind: "text"; value: string }
  | { kind: "img"; url: string; sizeLevel: number };

/** 본문 + imageUrls 폴백 + 길이 맞춘 sizeLevels 로 세그먼트 (상세 렌더) */
export function parseCommunityPostBodySegmentsWithSizes(
  content: string,
  fallbackImageUrls: string[],
  sizeLevels: number[]
): { segments: CommunityPostBodySegment[]; tailImages: { url: string; sizeLevel: number }[] } {
  const re = /!\[\]\(([^)]+)\)/g;
  const segments: CommunityPostBodySegment[] = [];
  const matchedUrls = new Set<string>();
  let last = 0;
  let imgIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const url = m[1].trim();
    if (m.index > last) {
      segments.push({ kind: "text", value: content.slice(last, m.index) });
    }
    if (url) {
      const sizeLevel = clampCommunityPostSizeLevel(sizeLevels[imgIdx] ?? COMMUNITY_POST_DEFAULT_SIZE_LEVEL);
      segments.push({ kind: "img", url, sizeLevel });
      matchedUrls.add(url);
      imgIdx++;
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    segments.push({ kind: "text", value: content.slice(last) });
  }
  if (segments.length === 0) {
    segments.push({ kind: "text", value: content });
  }
  const tailImages: { url: string; sizeLevel: number }[] = [];
  for (const u of fallbackImageUrls) {
    if (!matchedUrls.has(u)) {
      tailImages.push({
        url: u,
        sizeLevel: clampCommunityPostSizeLevel(sizeLevels[imgIdx] ?? COMMUNITY_POST_DEFAULT_SIZE_LEVEL),
      });
      imgIdx++;
    }
  }
  return { segments, tailImages };
}
