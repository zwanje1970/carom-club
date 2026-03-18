/**
 * 이미지 업로드 공통: 검증 + 최적화 + Blob 또는 로컬 저장
 *
 * - BLOB_READ_WRITE_TOKEN 있음 → Vercel Blob 사용 (배포/Neon 연동 시)
 * - 없음 → public/uploads 에 로컬 저장 (로컬 개발/테스트용). 완성 후 토큰만 설정하면 Blob으로 전환됨.
 */

import { put } from "@vercel/blob";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { ImagePolicy } from "./image-policies";
import { getOutputExtension } from "./image-policies";
import { optimizeImage, isAllowedMime } from "./image-optimizer";

export const BLOB_TOKEN_MISSING_MESSAGE =
  "이미지 저장 설정이 되어 있지 않습니다. BLOB_READ_WRITE_TOKEN을 설정해 주세요.";

/** 클라이언트에 반환할 503 메시지 (Blob 미설정 또는 Blob API 오류) */
export const BLOB_SERVICE_UNAVAILABLE_MESSAGE =
  "이미지 저장 설정이 되어 있지 않아 업로드할 수 없습니다. 관리자에게 문의해 주세요.";

/** Blob 설정/토큰/API 오류로 인한 실패인지 판별 (503 반환용) */
export function isBlobConfigError(message: string): boolean {
  return (
    message.includes("BLOB_READ_WRITE_TOKEN") ||
    message.includes("배포 환경에서는 이미지가 저장되지 않습니다") ||
    /blob|token|BLOB_READ_WRITE|unauthorized|403/i.test(message)
  );
}

/** Blob에 저장할 경로 생성: {prefix}/YYYYMMDD-{random}.{ext} */
export function buildBlobPath(
  prefix: string,
  originalFileName: string,
  policy: ImagePolicy,
  suffix?: string
): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 10);
  const ext = getOutputExtension(policy, originalFileName);
  const part = suffix ? `${date}-${suffix}-${random}` : `${date}-${random}`;
  return `${prefix}/${part}.${ext}`;
}

export interface ProcessedImage {
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
  blobPath: string;
}

/**
 * FormData에서 파일 추출 → 검증 → 최적화 → Blob 경로 반환.
 * Blob put은 호출부에서 수행 (토큰 체크 후).
 */
export async function processUploadedImage(
  file: File,
  policy: ImagePolicy,
  pathSuffix?: string
): Promise<ProcessedImage> {
  if (!file.size) {
    throw new Error("이미지 파일을 선택해주세요.");
  }
  if (file.size > policy.maxFileSize) {
    const mb = (policy.maxFileSize / (1024 * 1024)).toFixed(1);
    throw new Error(`파일 크기는 ${mb}MB 이하여야 합니다.`);
  }
  const mime = file.type || "application/octet-stream";
  if (!isAllowedMime(mime, policy)) {
    const allowed = policy.allowedMimeTypes.join(", ");
    throw new Error(`허용 형식: ${allowed}${policy.allowSvg ? ", SVG" : ""}`);
  }

  const arrayBuffer = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);
  const optimized = await optimizeImage(inputBuffer, mime, policy);
  const blobPath = buildBlobPath(
    policy.blobPathPrefix,
    file.name,
    policy,
    pathSuffix
  );

  return {
    buffer: optimized.buffer,
    contentType: optimized.contentType,
    width: optimized.width,
    height: optimized.height,
    blobPath,
  };
}

/**
 * 처리된 이미지를 로컬 public/uploads 에 저장.
 * 로컬 개발/테스트용. BLOB_READ_WRITE_TOKEN 없을 때 사용.
 */
export async function uploadToLocal(processed: ProcessedImage): Promise<{ url: string }> {
  const cwd = process.cwd();
  const dir = path.join(cwd, "public", "uploads", path.dirname(processed.blobPath));
  await mkdir(dir, { recursive: true });
  const filename = path.basename(processed.blobPath);
  const filePath = path.join(dir, filename);
  await writeFile(filePath, processed.buffer);
  const url = `/uploads/${processed.blobPath.replace(/\\/g, "/")}`;
  return { url };
}

/** 배포 환경에서 토큰 없을 때 에러 메시지 (이미지는 Blob에만 저장, /uploads 미지원) */
export const UPLOAD_DEPLOY_REQUIRES_BLOB_MESSAGE =
  "배포 환경에서는 이미지가 저장되지 않습니다. Vercel Blob을 사용하려면 BLOB_READ_WRITE_TOKEN을 설정하세요. (현재 /uploads 경로는 서버리스에서 유지되지 않아 404가 납니다.)";

/**
 * 처리된 이미지를 저장.
 * - BLOB_READ_WRITE_TOKEN 있음 → Vercel Blob (공개 URL 반환, DB에는 이 URL 저장)
 * - Vercel 또는 NODE_ENV=production 이고 토큰 없음 → 에러 (로컬 /uploads 미지원)
 * - 로컬 개발에서만 토큰 없음 → public/uploads (DB에는 /uploads/... 저장, 배포 시 404 주의)
 */
export async function uploadToBlob(
  processed: ProcessedImage,
  options?: { access?: "public" }
): Promise<{ url: string }> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(processed.blobPath, processed.buffer, {
      access: options?.access ?? "public",
      contentType: processed.contentType,
    });
    return { url: blob.url };
  }
  const isDeploy = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (isDeploy) {
    throw new Error(UPLOAD_DEPLOY_REQUIRES_BLOB_MESSAGE);
  }
  return uploadToLocal(processed);
}
