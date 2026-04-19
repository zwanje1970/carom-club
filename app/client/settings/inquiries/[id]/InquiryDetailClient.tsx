"use client";

import InquiryComposerShell from "../../../../components/InquiryComposerShell";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type Inquiry = {
  id: string;
  clientUserId: string;
  clientOrganizationId: string | null;
  type: "ERROR" | "FEATURE";
  title: string;
  body: string;
  imageUrls: string[];
  status: "OPEN" | "CHECKED" | "DONE";
  createdAt: string;
  updatedAt: string;
};

type CommentRow = {
  id: string;
  authorRole: "CLIENT" | "PLATFORM";
  authorLabel: string;
  body: string;
  imageUrls: string[];
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = { ERROR: "오류 제보", FEATURE: "기능 제안" };

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

export default function InquiryDetailClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [row, setRow] = useState<Inquiry | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editImages, setEditImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState("");
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [uploadingComment, setUploadingComment] = useState(false);
  const commentFileRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/client/inquiries/${encodeURIComponent(id)}`, { credentials: "same-origin" });
      const data = (await res.json()) as { error?: string; inquiry?: Inquiry; comments?: CommentRow[] };
      if (!res.ok) {
        setErr(data.error ?? "불러오지 못했습니다.");
        setRow(null);
        setComments([]);
        return;
      }
      if (data.inquiry) {
        setRow(data.inquiry);
        setEditTitle(data.inquiry.title);
        setEditBody(data.inquiry.body);
        setEditImages([...data.inquiry.imageUrls]);
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
    if (!url) throw new Error("업로드 응답에 URL이 없습니다.");
    return url;
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length || !row || row.status === "DONE") return;
    setUploading(true);
    setNotice("");
    try {
      const next = [...editImages];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f.type.startsWith("image/")) continue;
        const url = await uploadOne(f);
        next.push(url);
        if (next.length >= 10) break;
      }
      setEditImages(next);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "이미지 업로드 오류");
    } finally {
      setUploading(false);
    }
  }

  async function onPickCommentFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadingComment(true);
    setNotice("");
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
      setNotice(e instanceof Error ? e.message : "오류");
    } finally {
      setUploadingComment(false);
    }
  }

  async function saveEdit() {
    if (!id || !row || row.status === "DONE") return;
    setNotice("");
    if (!editTitle.trim() || !editBody.trim()) {
      setNotice("제목과 내용을 입력해 주세요.");
      return;
    }
    if (row.type === "ERROR" && editImages.length === 0) {
      setNotice("오류 제보는 이미지 1장 이상 필요합니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/client/inquiries/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          title: editTitle.trim(),
          body: editBody.trim(),
          imageUrls: editImages,
        }),
      });
      const data = (await res.json()) as { error?: string; inquiry?: Inquiry };
      if (!res.ok) {
        setNotice(data.error ?? "저장에 실패했습니다.");
        return;
      }
      if (data.inquiry) {
        setRow(data.inquiry);
        setEditTitle(data.inquiry.title);
        setEditBody(data.inquiry.body);
        setEditImages([...data.inquiry.imageUrls]);
      }
      await load();
      router.refresh();
    } catch {
      setNotice("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function postComment() {
    if (!id || !row || !draft.trim()) return;
    setPosting(true);
    setNotice("");
    try {
      const res = await fetch(`/api/client/inquiries/${encodeURIComponent(id)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ body: draft.trim(), imageUrls: draftImages }),
      });
      const data = (await res.json()) as { error?: string; comments?: CommentRow[]; inquiry?: Inquiry };
      if (!res.ok) {
        setNotice(data.error ?? "등록에 실패했습니다.");
        return;
      }
      if (Array.isArray(data.comments)) setComments(data.comments);
      if (data.inquiry) {
        setRow(data.inquiry);
        setEditTitle(data.inquiry.title);
        setEditBody(data.inquiry.body);
        setEditImages([...data.inquiry.imageUrls]);
      }
      setDraft("");
      setDraftImages([]);
      router.refresh();
    } catch {
      setNotice("등록 중 오류가 발생했습니다.");
    } finally {
      setPosting(false);
    }
  }

  const canEdit = row && row.status !== "DONE";

  const hasAdminReply = comments.some((c) => c.authorRole === "PLATFORM");

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
          disabled={posting || uploadingComment}
          rows={2}
          style={COMPOSER_TEXTAREA_STYLE}
        />
        <input
          ref={commentFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={posting || uploadingComment || draftImages.length >= 5}
          style={{ display: "none" }}
          onChange={(e) => {
            void onPickCommentFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="v3-btn"
          disabled={posting || uploadingComment || draftImages.length >= 5}
          onClick={() => commentFileRef.current?.click()}
          style={{ flexShrink: 0 }}
        >
          {uploadingComment ? "…" : "사진"}
        </button>
        <button
          type="button"
          className="v3-btn"
          disabled={posting || !draft.trim()}
          onClick={() => void postComment()}
          style={{ flexShrink: 0, fontWeight: 700 }}
        >
          {posting ? "…" : "등록"}
        </button>
      </div>
    </>
  );

  return (
    <main
      className="v3-page ui-client-dashboard"
      style={{
        maxWidth: "42rem",
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
      ) : err ? (
        <div style={{ padding: "1rem" }}>
          <p style={{ color: "#b91c1c" }}>{err}</p>
        </div>
      ) : row ? (
        <InquiryComposerShell
          scroll={
            <div style={{ padding: "1rem", paddingBottom: "0.5rem" }}>
              <div className="v3-row" style={{ alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                <Link className="v3-btn" href="/client/settings/inquiries" style={{ padding: "0.5rem 0.9rem" }}>
                  ← 목록
                </Link>
                <h1 className="v3-h1" style={{ marginBottom: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  문의
                </h1>
              </div>

              <section className="v3-box v3-stack" style={{ gap: "0.5rem", padding: "1rem" }}>
                <p style={{ margin: 0, fontSize: "0.9rem" }}>
                  <strong>유형</strong> {TYPE_LABEL[row.type] ?? row.type}
                </p>
                <p style={{ margin: 0, fontSize: "0.9rem" }}>
                  <strong>상태</strong> {hasAdminReply ? "답변완료" : "답변대기"}
                </p>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                  작성 {new Date(row.createdAt).toLocaleString("ko-KR")} · 수정{" "}
                  {new Date(row.updatedAt).toLocaleString("ko-KR")}
                </p>
              </section>

              {canEdit ? (
                <>
                  <label className="v3-stack" style={{ gap: "0.25rem", marginTop: "0.75rem" }}>
                    <span style={{ fontWeight: 600 }}>제목</span>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      disabled={saving || uploading}
                      maxLength={200}
                      style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    />
                  </label>
                  <div className="v3-stack" style={{ gap: "0.25rem", marginTop: "0.5rem" }}>
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
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        disabled={saving || uploading}
                        rows={10}
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
                      {editImages.length > 0 ? (
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
                          {editImages.map((url, idx) => (
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
                                onClick={() => setEditImages((p) => p.filter((_, i) => i !== idx))}
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
                      <div style={{ padding: "0.45rem 0.55rem 0.55rem", borderTop: editImages.length > 0 ? "1px solid #e5e7eb" : undefined }}>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          disabled={saving || uploading || editImages.length >= 10}
                          style={{ display: "none" }}
                          onChange={(e) => {
                            void onPickFiles(e.target.files);
                            e.target.value = "";
                          }}
                        />
                        <button
                          type="button"
                          className="v3-btn"
                          disabled={saving || uploading || editImages.length >= 10}
                          onClick={() => fileRef.current?.click()}
                          style={{ padding: "0.4rem 0.75rem", fontSize: "0.88rem" }}
                        >
                          {uploading ? "처리 중…" : "사진 추가"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ui-btn-primary-solid"
                    disabled={saving || uploading}
                    onClick={() => void saveEdit()}
                    style={{ padding: "0.55rem 1rem", alignSelf: "flex-start", marginTop: "0.5rem" }}
                  >
                    {saving ? "저장 중…" : "수정 저장"}
                  </button>
                </>
              ) : (
                <>
                  <section className="v3-box v3-stack" style={{ gap: "0.5rem", marginTop: "0.75rem" }}>
                    <h2 className="v3-h2" style={{ margin: 0, fontSize: "1.1rem" }}>
                      {row.title}
                    </h2>
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                        fontSize: "0.95rem",
                        lineHeight: 1.55,
                      }}
                    >
                      {row.body}
                    </pre>
                  </section>
                  {row.imageUrls.length > 0 ? (
                    <section className="v3-stack" style={{ gap: "0.5rem", marginTop: "0.75rem" }}>
                      <span style={{ fontWeight: 600 }}>첨부 이미지</span>
                      <div className="v3-stack" style={{ gap: "0.75rem" }}>
                        {row.imageUrls.map((url, idx) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={`${url}-${idx}`} src={url} alt="" style={{ maxWidth: "100%", border: "1px solid #e5e7eb", borderRadius: "4px" }} />
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              )}

              <section className="v3-stack" style={{ gap: "0.5rem", marginTop: "0.75rem" }}>
                <h2 className="v3-h2" style={{ margin: 0, fontSize: "1rem" }}>
                  댓글
                </h2>
                {comments.length === 0 ? (
                  <p className="v3-muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                    아직 댓글이 없습니다.
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
                                  <img key={`${url}-${idx}`} src={url} alt="" style={{ maxWidth: "100%", borderRadius: "4px" }} />
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

              {notice ? <p style={{ color: "#b91c1c", marginTop: "0.5rem", marginBottom: 0 }}>{notice}</p> : null}
            </div>
          }
          composer={composer}
        />
      ) : null}
    </main>
  );
}
