"use client";

export type ProcessedImage = {
  main: File;
  thumbnail: File;
};

const MAX_ORIGINAL_BYTES = 300 * 1024;
const MAIN_MAX_WIDTH = 1280;
const MAIN_QUALITY = 0.7;
const THUMB_MAX_WIDTH = 300;
const THUMB_QUALITY = 0.6;

let webpSupportPromise: Promise<boolean> | null = null;

function hasImageType(file: File): boolean {
  return typeof file.type === "string" && file.type.startsWith("image/");
}

function stripExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function getExtByMime(mime: string): string {
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function supportsWebP(): Promise<boolean> {
  if (webpSupportPromise) return webpSupportPromise;
  webpSupportPromise = new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      const can = canvas.toDataURL("image/webp").startsWith("data:image/webp");
      resolve(can);
    } catch {
      resolve(false);
    }
  });
  return webpSupportPromise;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve();
      };
      img.onerror = () => reject(new Error("image_load_failed"));
      img.src = url;
      (loadImage as unknown as { _img?: HTMLImageElement })._img = img;
    });
    return (loadImage as unknown as { _img: HTMLImageElement })._img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawResizedCanvas(
  img: HTMLImageElement,
  maxWidth: number
): HTMLCanvasElement {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const ratio = srcW > maxWidth ? maxWidth / srcW : 1;
  const targetW = Math.max(1, Math.round(srcW * ratio));
  const targetH = Math.max(1, Math.round(srcH * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_context_failed");
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas;
}

async function canvasToFile(
  canvas: HTMLCanvasElement,
  mime: "image/webp" | "image/jpeg",
  quality: number,
  fileName: string
): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) {
          reject(new Error("canvas_blob_failed"));
          return;
        }
        resolve(b);
      },
      mime,
      quality
    );
  });
  return new File([blob], fileName, { type: mime });
}

async function makeResizedFile(
  file: File,
  maxWidth: number,
  quality: number,
  suffix: "" | "-thumb"
): Promise<File> {
  const useWebP = await supportsWebP();
  const mime: "image/webp" | "image/jpeg" = useWebP ? "image/webp" : "image/jpeg";
  const img = await loadImage(file);
  const canvas = drawResizedCanvas(img, maxWidth);
  const base = stripExt(file.name);
  const outName = `${base}${suffix}.${getExtByMime(mime)}`;
  return canvasToFile(canvas, mime, quality, outName);
}

export async function processImage(file: File): Promise<ProcessedImage> {
  if (!hasImageType(file)) return { main: file, thumbnail: file };

  try {
    const main =
      file.size <= MAX_ORIGINAL_BYTES
        ? file
        : await makeResizedFile(file, MAIN_MAX_WIDTH, MAIN_QUALITY, "");

    try {
      const thumbnail = await makeResizedFile(main, THUMB_MAX_WIDTH, THUMB_QUALITY, "-thumb");
      return { main, thumbnail };
    } catch {
      return { main, thumbnail: main };
    }
  } catch {
    return { main: file, thumbnail: file };
  }
}

