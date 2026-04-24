import { randomUUID } from "crypto";
import type { Bucket } from "@google-cloud/storage";
import * as admin from "firebase-admin";
import { ensureFirebaseApp } from "./fcm-send";

function resolveStorageBucketName(): string {
  const fromEnv = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (fromEnv) return fromEnv;
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error("FCM_CREDENTIALS_MISSING");
  }
  return `${projectId}.appspot.com`;
}

function contentTypeForExt(ext: "jpg" | "png" | "webp"): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
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

export async function uploadProofImageVariantsToFirebaseStorage(params: {
  imageId: string;
  originalExt: "jpg" | "png" | "webp";
  originalBuffer: Buffer;
  w320Buffer: Buffer;
  w640Buffer: Buffer;
}): Promise<{ storageOriginalUrl: string; storageW320Url: string; storageW640Url: string }> {
  ensureFirebaseApp();
  const bucket = admin.storage().bucket(resolveStorageBucketName());
  const base = `proof-images/${params.imageId}`;

  const [storageOriginalUrl, storageW320Url, storageW640Url] = await Promise.all([
    uploadOneObject({
      bucket,
      objectPath: `${base}/original.${params.originalExt}`,
      buffer: params.originalBuffer,
      contentType: contentTypeForExt(params.originalExt),
    }),
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

  const urls = { storageOriginalUrl, storageW320Url, storageW640Url };
  for (const v of Object.values(urls)) {
    if (typeof v !== "string" || !v.trim().startsWith("https://")) {
      throw new Error("incomplete proof image storage URLs");
    }
  }
  return urls;
}
