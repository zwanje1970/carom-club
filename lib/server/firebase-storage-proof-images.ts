import { randomUUID } from "crypto";
import type { Bucket } from "@google-cloud/storage";
import * as admin from "firebase-admin";
import { ensureFirebaseApp } from "./fcm-send";

function resolveStorageBucketCandidates(): string[] {
  const fromEnv = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (fromEnv) return [fromEnv];
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error("FCM_CREDENTIALS_MISSING");
  }
  // 신규 Firebase 프로젝트는 `*.firebasestorage.app`를 기본 버킷으로 쓰는 경우가 있다.
  // 기존 `*.appspot.com` 프로젝트와 모두 호환되도록 후보를 순차 시도한다.
  return [`${projectId}.firebasestorage.app`, `${projectId}.appspot.com`];
}

async function uploadOneObject(params: {
  bucket: Bucket;
  objectPath: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  const token = randomUUID();
  const file = params.bucket.file(params.objectPath);
  await file.save(params.buffer, {
    resumable: false,
    metadata: {
      contentType: params.contentType,
      cacheControl: "public, max-age=31536000, immutable",
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });
  const bucketName = params.bucket.name;
  const enc = encodeURIComponent(params.objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${enc}?alt=media&token=${token}`;
}

/** w320 / w640 만 업로드 (w640 = 최대 해상도). `proof-images/{imageId}/original.*` 는 생성하지 않는다. */
export async function uploadProofImageVariantsToFirebaseStorage(params: {
  imageId: string;
  w320Buffer: Buffer;
  w640Buffer: Buffer;
}): Promise<{ storageW320Url: string; storageW640Url: string }> {
  ensureFirebaseApp();
  const base = `proof-images/${params.imageId}`;
  const bucketCandidates = resolveStorageBucketCandidates();
  let lastError: unknown = null;
  for (const bucketName of bucketCandidates) {
    const bucket = admin.storage().bucket(bucketName);
    try {
      const [storageW320Url, storageW640Url] = await Promise.all([
        uploadOneObject({
          bucket,
          objectPath: `${base}/w320.jpg`,
          buffer: params.w320Buffer,
          contentType: "image/jpeg",
        }),
        uploadOneObject({
          bucket,
          objectPath: `${base}/w640.jpg`,
          buffer: params.w640Buffer,
          contentType: "image/jpeg",
        }),
      ]);

      const urls = { storageW320Url, storageW640Url };
      for (const v of Object.values(urls)) {
        if (typeof v !== "string" || !v.trim().startsWith("https://")) {
          throw new Error("incomplete proof image storage URLs");
        }
      }
      return urls;
    } catch (error) {
      lastError = error;
      console.error("[firebase-storage-proof-images] bucket upload failed", {
        bucketName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  throw lastError instanceof Error ? lastError : new Error("FIREBASE_STORAGE_UPLOAD_FAILED");
}
