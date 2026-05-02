"use client";

import { ChangeEvent, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  COMMUNITY_POST_DEFAULT_SIZE_LEVEL,
  clampCommunityPostSizeLevel,
} from "../../../lib/community-post-content-images";
import { MAX_COMMUNITY_POST_IMAGE_COUNT } from "../../../lib/community-post-images";

type ImageItem = {
  url: string;
  sizeLevel: number;
  previewUrl?: string;
};

type SerializedPayload = {
  content: string;
  imageUrls: string[];
  imageSizeLevels: number[];
};

function toSignature(content: string, imageUrls: string[], imageSizeLevels: number[]): string {
  return `${content}\u001e${imageUrls.join("\u001f")}\u001e${imageSizeLevels.join("\u001f")}`;
}

function parseInitialState(content: string, fallbackUrls: string[], sizeLevels: number[]): { text: string; images: ImageItem[] } {
  const imageRegex = /!\[\]\(([^)]+)\)/g;
  const inContentUrls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = imageRegex.exec(content)) !== null) {
    const u = (m[1] ?? "").trim();
    if (u) inContentUrls.push(u);
  }

  const mergedUrls: string[] = [];
  const seen = new Set<string>();
  for (const u of [...inContentUrls, ...fallbackUrls]) {
    const t = typeof u === "string" ? u.trim() : "";
    if (!t || seen.has(t)) continue;
    seen.add(t);
    mergedUrls.push(t);
  }

  const images: ImageItem[] = mergedUrls.map((url, idx) => ({
    url,
    sizeLevel: clampCommunityPostSizeLevel(sizeLevels[idx] ?? COMMUNITY_POST_DEFAULT_SIZE_LEVEL),
  }));

  const text = content
    .replace(imageRegex, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, images };
}

function serializeState(text: string, images: ImageItem[]): SerializedPayload {
  const cleanText = text.trim();
  const imageUrls = images
    .map((img) => (typeof img.url === "string" ? img.url.trim() : ""))
    .filter((u) => u.length > 0);
  const imageSizeLevels = images
    .filter((img) => typeof img.url === "string" && img.url.trim().length > 0)
    .map((img) => clampCommunityPostSizeLevel(img.sizeLevel));

  let content = cleanText;
  for (const url of imageUrls) {
    if (content.length > 0 && !content.endsWith("\n")) content += "\n";
    content += `![](${url})\n`;
  }
  if (!content && imageUrls.length === 0) {
    content = "";
  }

  return { content, imageUrls, imageSizeLevels };
}

export type CommunityPostBodyEditorHandle = {
  openImageAttach: () => void;
};

type Props = {
  disabled?: boolean;
  initialContent: string;
  initialImageUrls: string[];
  initialImageSizeLevels: number[];
  onSerializedChange: (payload: SerializedPayload) => void;
  onAttachUiChange?: (state: { uploading: boolean; remaining: number; pendingImages: boolean }) => void;
};

const CommunityPostBodyEditor = forwardRef<CommunityPostBodyEditorHandle, Props>(function CommunityPostBodyEditor(
  { disabled, initialContent, initialImageUrls, initialImageSizeLevels, onSerializedChange, onAttachUiChange },
  ref
) {
  const initialSig = useMemo(
    () => toSignature(initialContent, initialImageUrls, initialImageSizeLevels),
    [initialContent, initialImageUrls, initialImageSizeLevels]
  );
  const [text, setText] = useState(() => parseInitialState(initialContent, initialImageUrls, initialImageSizeLevels).text);
  const [images, setImages] = useState<ImageItem[]>(
    () => parseInitialState(initialContent, initialImageUrls, initialImageSizeLevels).images
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastInitSigRef = useRef("");

  useImperativeHandle(
    ref,
    () => ({
      openImageAttach: () => {
        if (disabled) return;
        fileRef.current?.click();
      },
    }),
    [disabled]
  );

  useEffect(() => {
    if (lastInitSigRef.current === initialSig) return;
    lastInitSigRef.current = initialSig;
    const parsed = parseInitialState(initialContent, initialImageUrls, initialImageSizeLevels);
    setText(parsed.text);
    setImages(parsed.images);
    setError("");
  }, [initialSig, initialContent, initialImageUrls, initialImageSizeLevels]);

  useEffect(() => {
    onSerializedChange(serializeState(text, images));
  }, [text, images, onSerializedChange]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 220)}px`;
  }, [text]);

  const remaining = MAX_COMMUNITY_POST_IMAGE_COUNT - images.length;
  useEffect(() => {
    onAttachUiChange?.({ uploading, remaining, pendingImages: false });
  }, [onAttachUiChange, uploading, remaining]);

  async function handleFilePick(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (!picked.length || disabled) return;

    setError("");
    let localCount = images.length;
    for (const file of picked) {
      if (localCount >= MAX_COMMUNITY_POST_IMAGE_COUNT) break;
      const previewUrl = URL.createObjectURL(file);
      const pending: ImageItem = {
        url: "",
        sizeLevel: COMMUNITY_POST_DEFAULT_SIZE_LEVEL,
        previewUrl,
      };
      setImages((prev) => [...prev, pending]);
      localCount += 1;
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("sitePublic", "1");
        const response = await fetch("/api/upload/image", { method: "POST", body: formData });
        if (!response.ok) {
          setImages((prev) => prev.filter((img) => img.previewUrl !== previewUrl));
          localCount -= 1;
          URL.revokeObjectURL(previewUrl);
          setError("이미지 업로드에 실패했습니다.");
          continue;
        }
        const data = (await response.json()) as { w640Url?: string };
        const uploaded = typeof data.w640Url === "string" ? data.w640Url.trim() : "";
        if (!uploaded) {
          setImages((prev) => prev.filter((img) => img.previewUrl !== previewUrl));
          localCount -= 1;
          URL.revokeObjectURL(previewUrl);
          setError("이미지 업로드에 실패했습니다.");
          continue;
        }
        setImages((prev) =>
          prev.map((img) => (img.previewUrl === previewUrl ? { url: uploaded, sizeLevel: img.sizeLevel } : img))
        );
        URL.revokeObjectURL(previewUrl);
      } catch {
        setImages((prev) => prev.filter((img) => img.previewUrl !== previewUrl));
        localCount -= 1;
        URL.revokeObjectURL(previewUrl);
        setError("이미지 업로드에 실패했습니다.");
      } finally {
        setUploading(false);
      }
    }
  }

  function removeImageAt(index: number) {
    setImages((prev) => {
      const hit = prev[index];
      if (hit?.previewUrl) URL.revokeObjectURL(hit.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  return (
    <div className="ui-community-post-editor-shell v3-stack">
      <textarea
        ref={textareaRef}
        className="ui-community-post-editor-textarea"
        placeholder="내용을 입력하세요."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilePick}
        className="ui-community-post-editor-file"
      />
      {images.length > 0 ? (
        <ul className="ui-community-post-editor-image-list">
          {images.map((img, idx) => {
            const src = img.previewUrl ? img.previewUrl : img.url;
            if (!src) return null;
            return (
              <li key={`${src}-${idx}`} className="ui-community-post-editor-image-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="ui-community-post-editor-image" src={src} alt="" loading="lazy" decoding="async" />
                {!disabled ? (
                  <button
                    type="button"
                    className="ui-community-comment-text-action"
                    onClick={() => removeImageAt(idx)}
                  >
                    이미지 삭제
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {error ? <p className="v3-muted ui-community-form-message">{error}</p> : null}
    </div>
  );
});

export default CommunityPostBodyEditor;
