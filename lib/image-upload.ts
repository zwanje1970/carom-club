import "server-only";

/**
 * 이미지 업로드 공통: 검증 + 최적화 + 저장
 *
 * - `BLOB_READ_WRITE_TOKEN`이 있으면 Vercel Blob 우선, 실패 시 `public/uploads/...` 로컬 폴백
 * - 토큰이 없으면 로컬만 사용 (`/uploads/...` URL)
 * - 서버리스 프로덕션에서 로컬 폴백은 비영속(ephemeral)일 수 있음 → Blob 권장
 */

import { put } from "@vercel/blob";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { ImagePolicy } from "./image-policies";
import { getOutputExtension } from "./image-policies";
import { optimizeImage, isAllowedMime } from "./image-optimizer";

export const BLOB_TOKEN_MISSING_MESSAGE =
  "이미지 저장 설정이 되어 있지 않습니다. BLOB_READ_WRITE_TOKEN을 설정해 주세요.";

/** 클라이언트에 반환할 503 메시지 (Blob·로컬 모두 실패 등) */
export const BLOB_SERVICE_UNAVAILABLE_MESSAGE =
  "이미지를 저장할 수 없습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.";

/** Blob 설정/토큰/API 오류로 인한 실패인지 판별 (라우트 503 등 보조용) */
export function isBlobConfigError(message: string): boolean {
  return (
    message.includes("BLOB_READ_WRITE_TOKEN") ||
    message.includes("배포 환경에서는 이미지가 저장되지 않습니다") ||
    /blob|token|BLOB_READ_WRITE|unauthorized|403/i.test(message)
  );
}

export const STORAGE_UNAVAILABLE_PREFIX = "STORAGE_UNAVAILABLE:";

/** @deprecated 토큰 없을 때 더 이상 업로드 진입점에서 throw 하지 않음 — 문구만 유지 */
export const UPLOAD_DEPLOY_REQUIRES_BLOB_MESSAGE =
  "배포 환경에서는 이미지가 저장되지 않습니다. Vercel Blob을 사용하려면 BLOB_READ_WRITE_TOKEN을 설정하세요. (현재 /uploads 경로는 서버리스에서 유지되지 않아 404가 납니다.)";

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

function assertSafeRelativeBlobPath(blobPath: string): void {
  const n = blobPath.replace(/\\/g, "/").trim();
  if (!n || n.startsWith("/") || n.includes("..")) {
    throw new Error("Invalid upload path");
  }
}

/**
 * FormData에서 파일 추출 → 검증 → 최적화 → 저장용 상대 경로(blobPath) 반환.
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
 * `public/uploads/{blobPath}` 에 저장. 반환 URL: `/uploads/{blobPath}` (POSIX 슬래시).
 * 디렉터리는 `recursive: true` 로 생성.
 */
export async function saveToLocalUploads(processed: ProcessedImage): Promise<{ url: string }> {
  assertSafeRelativeBlobPath(processed.blobPath);
  const cwd = process.cwd();
  const baseDir = path.resolve(cwd, "public", "uploads");
  const subDir = path.dirname(processed.blobPath);
  const dir = path.resolve(baseDir, subDir);
  const relativeFromBase = path.relative(baseDir, dir);
  if (relativeFromBase.startsWith("..") || path.isAbsolute(relativeFromBase)) {
    throw new Error("Invalid upload directory");
  }
  await mkdir(dir, { recursive: true });
  const filename = path.basename(processed.blobPath);
  if (!filename || filename !== path.basename(path.normalize(filename)) || filename.includes("..")) {
    throw new Error("Invalid filename");
  }
  const filePath = path.join(dir, filename);
  const resolvedFile = path.resolve(filePath);
  const relToBase = path.relative(baseDir, resolvedFile);
  if (relToBase.startsWith("..") || path.isAbsolute(relToBase)) {
    throw new Error("Path escapes upload root");
  }
  await writeFile(resolvedFile, processed.buffer);
  const url = `/uploads/${processed.blobPath.replace(/\\/g, "/")}`;
  return { url };
}

/** @deprecated `saveToLocalUploads` 와 동일 */
export const uploadToLocal = saveToLocalUploads;

/**
 * Vercel Blob에만 업로드 (토큰·네트워크 오류 시 throw).
 */
export async function putToVercelBlob(
  processed: ProcessedImage,
  options?: { access?: "public" }
): Promise<{ url: string }> {
  const blob = await put(processed.blobPath, processed.buffer, {
    access: options?.access ?? "public",
    contentType: processed.contentType,
  });
  return { url: blob.url };
}

/**
 * 처리된 이미지 저장 진입점: Blob 토큰이 있으면 Blob 우선, 실패 시 로컬 폴백.
 * 토큰이 없으면 로컬만. 둘 다 실패 시 `STORAGE_UNAVAILABLE:` 로 시작하는 Error throw.
 */
export async function uploadProcessedImage(
  processed: ProcessedImage,
  options?: { access?: "public" }
): Promise<{ url: string }> {
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  if (hasToken) {
    try {
      return await putToVercelBlob(processed, options);
    } catch (blobErr) {
      console.error("[image-upload] Vercel Blob upload failed:", blobErr);
      try {
        const { url } = await saveToLocalUploads(processed);
        console.warn("[image-upload] Local uploads fallback succeeded after Blob failure:", url);
        return { url };
      } catch (localErr) {
        console.error("[image-upload] Local fallback failed after Blob failure:", localErr);
        const le = localErr instanceof Error ? localErr.message : String(localErr);
        throw new Error(`${STORAGE_UNAVAILABLE_PREFIX} Blob failed and local save failed: ${le}`);
      }
    }
  }
  try {
    const { url } = await saveToLocalUploads(processed);
    return { url };
  } catch (localErr) {
    console.error("[image-upload] Local save failed (Blob token not configured):", localErr);
    const le = localErr instanceof Error ? localErr.message : String(localErr);
    throw new Error(`${STORAGE_UNAVAILABLE_PREFIX} Local save failed: ${le}`);
  }
}

/**
 * `uploadProcessedImage` 와 동일. 기존 라우트·호환용 이름.
 */
export async function uploadToBlob(
  processed: ProcessedImage,
  options?: { access?: "public" }
): Promise<{ url: string }> {
  return uploadProcessedImage(processed, options);
}
