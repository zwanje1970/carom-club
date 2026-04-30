"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

const TYPE_LABEL: Record<string, string> = { ERROR: "오류 제보", FEATURE: "기능 제안" };

export default function InquiryNewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const inquiryType = useMemo<"ERROR" | "FEATURE">(() => {
    const t = (searchParams.get("type") ?? "").toLowerCase();
    return t === "feature" ? "FEATURE" : "ERROR";
  }, [searchParams]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function uploadOne(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload/image", {
      method: "POST",
      body: fd,
      credentials: "same-origin",
    });
    const data = (await res.json()) as { error?: string; w640Url?: string };
    if (!res.ok) throw new Error(data.error ?? "업로드 실패");
    const url = data.w640Url;
    if (!url) throw new Error("업로드 응답에 URL이 없습니다.");
    return url;
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setNotice("");
    try {
      const next: string[] = [...imageUrls];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f.type.startsWith("image/")) continue;
        const url = await uploadOne(f);
        next.push(url);
        if (next.length >= 10) break;
      }
      setImageUrls(next);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "이미지 업로드 오류");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(idx: number) {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit() {
    setNotice("");
    if (!title.trim() || !body.trim()) {
      setNotice("제목과 내용을 입력해 주세요.");
      return;
    }
    if (inquiryType === "ERROR" && imageUrls.length === 0) {
      setNotice("오류 제보는 이미지 1장 이상 필요합니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/client/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          type: inquiryType,
          title: title.trim(),
          body: body.trim(),
          imageUrls,
        }),
      });
      const data = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) {
        setNotice(data.error ?? "등록에 실패했습니다.");
        return;
      }
      if (data.id) {
        router.push(`/client/settings/inquiries/${data.id}`);
        return;
      }
      router.push("/client/settings/inquiries");
    } catch {
      setNotice("등록 요청 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="v3-page v3-stack ui-client-dashboard" style={{ gap: "0.85rem", maxWidth: "40rem", paddingTop: "0.35rem" }}>
      <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
        유형: {TYPE_LABEL[inquiryType]}
      </p>

      <label className="v3-stack" style={{ gap: "0.25rem" }}>
        <span style={{ fontWeight: 600 }}>제목</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving || uploading}
          maxLength={200}
          style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
        />
      </label>

      <div className="v3-stack" style={{ gap: "0.25rem" }}>
        <span style={{ fontWeight: 600 }}>내용</span>
        <div
          style={{
            border: "1px solid #bbb",
            borderRadius: "0.4rem",
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={saving || uploading}
            rows={10}
            placeholder="내용을 입력하세요."
            style={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              padding: "0.55rem",
              border: "none",
              borderRadius: 0,
              lineHeight: 1.5,
              resize: "vertical",
              minHeight: "10rem",
            }}
          />
          {imageUrls.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                padding: "0.5rem 0.55rem",
                borderTop: "1px solid #e5e7eb",
                background: "#fafafa",
              }}
            >
              {imageUrls.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  style={{
                    position: "relative",
                    width: "6.5rem",
                    height: "6.5rem",
                    flexShrink: 0,
                    borderRadius: "0.35rem",
                    overflow: "hidden",
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button
                    type="button"
                    aria-label="첨부 이미지 제거"
                    onClick={() => removeImage(idx)}
                    style={{
                      position: "absolute",
                      top: "0.2rem",
                      right: "0.2rem",
                      width: "1.35rem",
                      height: "1.35rem",
                      padding: 0,
                      lineHeight: 1,
                      border: "none",
                      borderRadius: "999px",
                      background: "rgba(15,23,42,0.65)",
                      color: "#fff",
                      fontSize: "1rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ padding: "0.45rem 0.55rem 0.55rem", borderTop: imageUrls.length > 0 ? "1px solid #e5e7eb" : undefined }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={saving || uploading || imageUrls.length >= 10}
              style={{ display: "none" }}
              onChange={(e) => {
                void onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="v3-btn"
              disabled={saving || uploading || imageUrls.length >= 10}
              onClick={() => fileRef.current?.click()}
              style={{ padding: "0.4rem 0.75rem", fontSize: "0.88rem" }}
            >
              {uploading ? "처리 중…" : "사진 추가"}
            </button>
          </div>
        </div>
      </div>

      {notice ? (
        <p style={{ color: "#b91c1c", margin: 0, fontSize: "0.9rem" }}>{notice}</p>
      ) : null}

      <button
        type="button"
        className="ui-btn-primary-solid"
        disabled={saving || uploading}
        onClick={() => void onSubmit()}
        style={{ padding: "0.6rem 1.2rem", alignSelf: "flex-start" }}
      >
        {saving ? "등록 중…" : "등록"}
      </button>
    </main>
  );
}
