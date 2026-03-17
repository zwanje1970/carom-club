/**
 * 이미지 종류별 최적화 정책
 * - 업로드 시 적용: 리사이즈, 포맷 변환, 품질
 * - 표시 시: next/image, sizes 등으로 추가 최적화
 */

export type ImageKind =
  | "logo"
  | "banner"
  | "venue"
  | "tournament"
  | "content"
  | "section"
  | "proof"
  | "thumbnail"
  | "footerPartner"
  | "billiard"
  | "community";

export interface ImagePolicy {
  /** 최대 폭 (px). 초과 시 비율 유지 리사이즈 */
  maxWidth: number;
  /** 최대 높이 (px). 0이면 비율만 적용 */
  maxHeight: number;
  /** 출력 포맷: "webp" | "jpeg" | "png" | "original" */
  format: "webp" | "jpeg" | "png" | "original";
  /** 품질 1–100 (webp/jpeg). original이면 무시 */
  quality: number;
  /** 업로드 허용 최대 파일 크기 (bytes) */
  maxFileSize: number;
  /** 허용 MIME */
  allowedMimeTypes: string[];
  /** Blob 저장 경로 접두사 (예: logo, content, proof) */
  blobPathPrefix: string;
  /** SVG 허용 (로고 등) */
  allowSvg?: boolean;
}

export const IMAGE_POLICIES: Record<ImageKind, ImagePolicy> = {
  logo: {
    maxWidth: 800,
    maxHeight: 0,
    format: "original",
    quality: 95,
    maxFileSize: 2 * 1024 * 1024, // 2MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
    blobPathPrefix: "logo",
    allowSvg: true,
  },
  banner: {
    maxWidth: 1600,
    maxHeight: 0,
    format: "webp",
    quality: 78,
    maxFileSize: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    blobPathPrefix: "banner",
  },
  venue: {
    maxWidth: 1200,
    maxHeight: 0,
    format: "webp",
    quality: 78,
    maxFileSize: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    blobPathPrefix: "venue",
  },
  tournament: {
    maxWidth: 1600,
    maxHeight: 0,
    format: "webp",
    quality: 78,
    maxFileSize: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    blobPathPrefix: "tournament",
  },
  content: {
    maxWidth: 1200,
    maxHeight: 0,
    format: "webp",
    quality: 75,
    maxFileSize: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    blobPathPrefix: "content",
  },
  /** 페이지 섹션 이미지: 데스크톱 1920, 품질 70~82, webp, 메타 제거 */
  section: {
    maxWidth: 1920,
    maxHeight: 0,
    format: "webp",
    quality: 78,
    maxFileSize: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    blobPathPrefix: "sections",
  },
  proof: {
    maxWidth: 2000,
    maxHeight: 0,
    format: "jpeg",
    quality: 85,
    maxFileSize: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    blobPathPrefix: "proof",
  },
  thumbnail: {
    maxWidth: 400,
    maxHeight: 0,
    format: "webp",
    quality: 72,
    maxFileSize: 2 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    blobPathPrefix: "thumb",
  },
  footerPartner: {
    maxWidth: 200,
    maxHeight: 80,
    format: "webp",
    quality: 80,
    maxFileSize: 512 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
    blobPathPrefix: "footer-partner",
    allowSvg: true,
  },
  billiard: {
    maxWidth: 1200,
    maxHeight: 600,
    format: "webp",
    quality: 82,
    maxFileSize: 2 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    blobPathPrefix: "billiard",
  },
  community: {
    maxWidth: 1200,
    maxHeight: 0,
    format: "webp",
    quality: 75,
    maxFileSize: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    blobPathPrefix: "community",
  },
};

/** 파일 확장자 → 출력 확장자 (format 정책 반영) */
export function getOutputExtension(
  policy: ImagePolicy,
  originalName: string
): string {
  if (policy.format === "original") {
    const ext = originalName.replace(/^.*\./, "").toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return ext;
    return "png";
  }
  return policy.format === "jpeg" ? "jpg" : policy.format;
}
