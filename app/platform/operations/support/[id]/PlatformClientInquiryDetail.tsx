"use client";

import InquiryComposerShell from "../../../../components/InquiryComposerShell";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type Inquiry = {
  id: string;
  title: string;
  body: string;
  imageUrls: string[];
  createdAt: string;
  senderName: string;
  organizationDisplay: string;
};

type CommentRow = {
  id: string;
  authorRole: "CLIENT" | "PLATFORM";
  authorLabel: string;
  body: string;
  imageUrls: string[];
  createdAt: string;
};

const COMPOSER_TEXTAREA_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  resize: "vertical" as const,
  maxHeight: "7rem",
  overflowY: "auto",
  padding: "0.5rem",
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  fontSize: "0.92rem",
};

export default function PlatformClientInquiryDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [row, setRow] = useState<Inquiry | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [draft, setDraft] = useState("");
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/platform/client-inquiries/${encodeURIComponent(id)}`, { credentials: "same-origin" });
      const data = (await res.json()) as { error?: string; inquiry?: Inquiry; comments?: CommentRow[] };
      if (!res.ok) {
        setErr(data.error ?? "불러오지 못했습니다.");
        setRow(null);
        setComments([]);
        return;
      }
      if (data.inquiry) {
        setRow(data.inquiry);
      }
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch {
      setErr("오류가 발생했습니다.");
      setRow(null);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length, row?.id]);

  async function uploadOne(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload/image", { method: "POST", body: fd, credentials: "same-origin" });
    const data = (await res.json()) as { error?: string; w640Url?: string };
    if (!res.ok) throw new Error(data.error ?? "업로드 실패");
    const url = data.w640Url;
    if (!url) throw new Error("응답 오류");
    return url;
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setErr("");
    try {
      const next = [...draftImages];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f.type.startsWith("image/")) continue;
        const url = await uploadOne(f);
        next.push(url);
        if (next.length >= 5) break;
      }
      setDraftImages(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
    } finally {
      setUploading(false);
    }
  }

  async function postComment() {
    if (!id || !row || !draft.trim()) return;
    setPosting(true);
    setErr("");
    try {
      const res = await fetch(`/api/platform/client-inquiries/${encodeURIComponent(id)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          body: draft.trim(),
          imageUrls: draftImages,
        }),
      });
      const data = (await res.json()) as { error?: string; inquiry?: Inquiry; comments?: CommentRow[] };
      if (!res.ok) {
        setErr(data.error ?? "등록 실패");
        return;
      }
      if (data.inquiry) setRow(data.inquiry);
      if (Array.isArray(data.comments)) setComments(data.comments);
      setDraft("");
      setDraftImages([]);
      router.refresh();
    } catch {
      setErr("등록 중 오류");
    } finally {
      setPosting(false);
    }
  }

  function senderHead() {
    if (!row) return "";
    const org = row.organizationDisplay?.trim() || "소속 없음";
    return `${row.senderName} (${org})`;
  }

  const composer = (
    <>
      {draftImages.length > 0 ? (
        <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.35rem" }}>
          {draftImages.map((url, idx) => (
            <div key={`${url}-${idx}`} style={{ position: "relative", width: "3.25rem", height: "3.25rem" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px" }} />
              <button
                type="button"
                aria-label="첨부 제거"
                onClick={() => setDraftImages((p) => p.filter((_, i) => i !== idx))}
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: "1.1rem",
                  height: "1.1rem",
                  padding: 0,
                  border: "none",
                  borderRadius: "999px",
                  background: "rgba(15,23,42,0.6)",
                  color: "#fff",
                  lineHeight: 1,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="v3-row" style={{ gap: "0.5rem", alignItems: "flex-end" }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={posting || uploading}
          rows={2}
          style={COMPOSER_TEXTAREA_STYLE}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={posting || uploading || draftImages.length >= 5}
          style={{ display: "none" }}
          onChange={(e) => {
            void onPickFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="v3-btn"
          disabled={posting || uploading || draftImages.length >= 5}
          onClick={() => fileRef.current?.click()}
          style={{ flexShrink: 0 }}
        >
          {uploading ? "…" : "사진"}
        </button>
        <button
          type="button"
          className="v3-btn"
          disabled={posting || !draft.trim()}
          onClick={() => void postComment()}
          style={{ flexShrink: 0, fontWeight: 600 }}
        >
          {posting ? "…" : "등록"}
        </button>
      </div>
    </>
  );

  return (
    <main
      className="v3-page"
      style={{
        maxWidth: "48rem",
        margin: "0 auto",
        padding: 0,
        height: "100dvh",
        maxHeight: "100dvh",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {loading ? (
        <div style={{ padding: "1rem" }}>
          <p className="v3-muted">불러오는 중…</p>
        </div>
      ) : err && !row ? (
        <div style={{ padding: "1rem" }}>
          <p style={{ color: "#b91c1c" }}>{err}</p>
        </div>
      ) : row ? (
        <InquiryComposerShell
          scroll={
            <div style={{ padding: "1rem", paddingBottom: "0.5rem" }}>
              <div className="v3-row" style={{ alignItems: "center", gap: "0.65rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                <h1 className="v3-h1" style={{ marginBottom: 0 }}>
                  문의
                </h1>
              </div>

              <section
                className="v3-box v3-stack"
                style={{
                  gap: "0.5rem",
                  padding: "0.85rem 1rem",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{senderHead()}</p>
                <h2 className="v3-h2" style={{ margin: 0, fontSize: "1.15rem", lineHeight: 1.35 }}>
                  {row.title}
                </h2>
                <p style={{ margin: 0, fontSize: "0.86rem", color: "#64748b" }}>
                  {new Date(row.createdAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </section>

              <section className="v3-box v3-stack" style={{ gap: "0.65rem", marginTop: "0.75rem" }}>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.95rem", lineHeight: 1.55 }}>{row.body}</pre>
                {row.imageUrls && row.imageUrls.length > 0 ? (
                  <div className="v3-stack" style={{ gap: "0.65rem" }}>
                    {row.imageUrls.map((url, idx) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={`${url}-${idx}`}
                        src={url}
                        alt=""
                        style={{ maxWidth: "100%", height: "auto", border: "1px solid #e5e7eb", borderRadius: "4px", display: "block" }}
                      />
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="v3-stack" style={{ gap: "0.5rem", marginTop: "0.75rem" }}>
                {comments.length === 0 ? (
                  <p className="v3-muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                    답변 없음
                  </p>
                ) : (
                  <div className="v3-stack" style={{ gap: "0.65rem" }}>
                    {comments.map((c) => {
                      const isPl = c.authorRole === "PLATFORM";
                      return (
                        <div
                          key={c.id}
                          style={{
                            display: "flex",
                            justifyContent: isPl ? "flex-end" : "flex-start",
                          }}
                        >
                          <div
                            style={{
                              maxWidth: "min(100%, 34rem)",
                              borderRadius: "8px",
                              padding: "0.55rem 0.7rem",
                              border: "1px solid",
                              borderColor: isPl ? "#cbd5e1" : "#bfdbfe",
                              background: isPl ? "#f8fafc" : "#eff6ff",
                            }}
                          >
                            <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                              {isPl ? "관리자" : "클라이언트"} · {c.authorLabel}
                              <span className="v3-muted" style={{ marginLeft: "0.35rem" }}>
                                {new Date(c.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            </div>
                            <pre
                              style={{
                                margin: 0,
                                whiteSpace: "pre-wrap",
                                fontFamily: "inherit",
                                fontSize: "0.9rem",
                                lineHeight: 1.5,
                              }}
                            >
                              {c.body}
                            </pre>
                            {c.imageUrls.length > 0 ? (
                              <div className="v3-stack" style={{ gap: "0.35rem", marginTop: "0.45rem" }}>
                                {c.imageUrls.map((url, idx) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={`${url}-${idx}`}
                                    src={url}
                                    alt=""
                                    style={{ maxWidth: "100%", borderRadius: "4px", display: "block" }}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={threadEndRef} />
                  </div>
                )}
              </section>

              {err ? <p style={{ color: "#b91c1c", fontSize: "0.9rem", marginTop: "0.5rem" }}>{err}</p> : null}
            </div>
          }
          composer={composer}
        />
      ) : null}
    </main>
  );
}
