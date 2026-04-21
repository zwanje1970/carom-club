"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";

import OutlineContentEditor from "../../../../components/shared/outline/OutlineContentEditor";
import {
  MAX_REPRESENTATIVE_IMAGES,
  isOrgType,
  normalizeRepresentativeImageUrls,
  parseTypeSpecific,
} from "../../../../lib/client-organization-setup-parse";
import type { OrgType, VenueSpecific } from "../../../../lib/client-organization-setup-types";
import { isEmptyOutlineHtml } from "../../../../lib/outline-content-helpers";
import type { OutlineDisplayMode } from "../../../../lib/outline-content-types";

export default function ClientVenueIntroEditPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveFeedback, setSaveFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const [orgType, setOrgType] = useState<OrgType>("VENUE");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [representativeImageUrls, setRepresentativeImageUrls] = useState<string[]>([]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingRep, setUploadingRep] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [outlineDisplayMode, setOutlineDisplayMode] = useState<OutlineDisplayMode>("TEXT");
  const [outlineHtml, setOutlineHtml] = useState("");
  const [outlineImageUrl, setOutlineImageUrl] = useState("");
  const [outlinePdfUrl, setOutlinePdfUrl] = useState("");
  const [outlineEditorCompact, setOutlineEditorCompact] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const repAddInputRef = useRef<HTMLInputElement>(null);
  const repInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 40rem)");
    const apply = () => setOutlineEditorCompact(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [orgRes, introRes] = await Promise.all([fetch("/api/client/organization"), fetch("/api/client/venue-intro")]);
        const orgData = await orgRes.json().catch(() => ({}));
        const introData = await introRes.json().catch(() => ({}));

        if (!orgRes.ok) {
          if (!cancelled) setLoadError(typeof orgData.error === "string" ? orgData.error : "불러오지 못했습니다.");
          return;
        }
        if (!introRes.ok) {
          if (!cancelled) setLoadError(typeof introData.error === "string" ? introData.error : "불러오지 못했습니다.");
          return;
        }
        if (cancelled) return;

        const ot: OrgType = isOrgType(orgData.type) ? orgData.type : "VENUE";
        setOrgType(ot);

        if (ot === "VENUE") {
          const ts = parseTypeSpecific("VENUE", orgData.typeSpecificJson ?? null) as VenueSpecific;
          const rep = normalizeRepresentativeImageUrls(ts.representativeImageUrls);
          const cover = String(orgData.coverImageUrl ?? "").trim();
          const mergedRep = rep.length > 0 ? rep : cover ? [cover] : [];
          setRepresentativeImageUrls(mergedRep);
          setCoverImageUrl(mergedRep[0] ?? "");
        } else {
          setCoverImageUrl(typeof orgData.coverImageUrl === "string" ? orgData.coverImageUrl : "");
          setRepresentativeImageUrls([]);
        }

        const mode = introData.outlineDisplayMode;
        if (mode === "TEXT" || mode === "IMAGE" || mode === "PDF") {
          setOutlineDisplayMode(mode);
        } else {
          setOutlineDisplayMode("TEXT");
        }
        setOutlineHtml(typeof introData.outlineHtml === "string" ? introData.outlineHtml : "");
        setOutlineImageUrl(typeof introData.outlineImageUrl === "string" ? introData.outlineImageUrl : "");
        setOutlinePdfUrl(typeof introData.outlinePdfUrl === "string" ? introData.outlinePdfUrl : "");
      } catch {
        if (!cancelled) setLoadError("불러오는 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function uploadOne(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("sitePublic", "1");
    const res = await fetch("/api/upload/image", {
      method: "POST",
      body: fd,
      credentials: "same-origin",
    });
    const data = (await res.json()) as { error?: string; w640Url?: string };
    if (!res.ok) throw new Error(data.error ?? "업로드 실패");
    const url = data.w640Url;
    if (!url) throw new Error("업로드 실패");
    return url;
  }

  async function onPickCover(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingCover(true);
    try {
      const url = await uploadOne(file);
      setCoverImageUrl(url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "업로드 오류");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function onAddRepresentative(files: FileList | null) {
    if (!files?.length) return;
    setUploadError(null);
    setUploadingRep(true);
    try {
      const next = [...normalizeRepresentativeImageUrls(representativeImageUrls)];
      for (let i = 0; i < files.length; i++) {
        if (next.length >= MAX_REPRESENTATIVE_IMAGES) break;
        const f = files[i];
        if (!f.type.startsWith("image/")) continue;
        const url = await uploadOne(f);
        next.push(url);
      }
      setRepresentativeImageUrls(next);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "업로드 오류");
    } finally {
      setUploadingRep(false);
      if (repAddInputRef.current) repAddInputRef.current.value = "";
    }
  }

  async function onReplaceRepresentative(index: number, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingRep(true);
    try {
      const url = await uploadOne(file);
      const current = normalizeRepresentativeImageUrls(representativeImageUrls);
      if (index < current.length) current[index] = url;
      else if (current.length < MAX_REPRESENTATIVE_IMAGES) current.push(url);
      setRepresentativeImageUrls(current);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "업로드 오류");
    } finally {
      setUploadingRep(false);
      const ref = repInputRefs.current[index];
      if (ref) ref.value = "";
    }
  }

  function removeRepresentative(index: number) {
    setRepresentativeImageUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveState("saving");
    setSaveFeedback(null);
    try {
      const outlineHtmlPayload =
        outlineHtml.trim() !== "" && !isEmptyOutlineHtml(outlineHtml) ? outlineHtml : null;
      const outlineImagePayload = outlineImageUrl.trim() !== "" ? outlineImageUrl.trim() : null;
      const outlinePdfPayload = outlinePdfUrl.trim() !== "" ? outlinePdfUrl.trim() : null;
      const hasAnyOutline = Boolean(outlineHtmlPayload || outlineImagePayload || outlinePdfPayload);

      const repNorm = normalizeRepresentativeImageUrls(representativeImageUrls);
      const body: Record<string, unknown> = {
        outlineDisplayMode: hasAnyOutline ? outlineDisplayMode : null,
        outlineHtml: outlineHtmlPayload,
        outlineImageUrl: outlineImagePayload,
        outlinePdfUrl: outlinePdfPayload,
      };
      if (orgType === "VENUE") body.representativeImageUrls = repNorm;
      else body.coverImageUrl = coverImageUrl.trim() === "" ? null : coverImageUrl.trim();

      const res = await fetch("/api/client/venue-intro", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveFeedback({
          kind: "error",
          message: typeof data.error === "string" ? data.error : "저장에 실패했습니다.",
        });
        setSaveState("error");
        return;
      }
      setSaveFeedback({ kind: "success", message: "저장되었습니다." });
      setSaveState("success");
      if (data.outlineDisplayMode === "TEXT" || data.outlineDisplayMode === "IMAGE" || data.outlineDisplayMode === "PDF") {
        setOutlineDisplayMode(data.outlineDisplayMode);
      }
      setOutlineHtml(typeof data.outlineHtml === "string" ? data.outlineHtml : "");
      setOutlineImageUrl(typeof data.outlineImageUrl === "string" ? data.outlineImageUrl : "");
      setOutlinePdfUrl(typeof data.outlinePdfUrl === "string" ? data.outlinePdfUrl : "");
    } finally {
      setSaving(false);
    }
  }

  const repDisplay = normalizeRepresentativeImageUrls(representativeImageUrls);
  const imageBusy = uploadingCover || uploadingRep;

  if (loading) {
    return (
      <main className="v3-page v3-stack ui-client-dashboard" style={{ maxWidth: "48rem" }}>
        <p className="v3-muted">불러오는 중...</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="v3-page v3-stack ui-client-dashboard" style={{ maxWidth: "48rem" }}>
        <p style={{ color: "#b91c1c", marginBottom: "1rem" }}>{loadError}</p>
      </main>
    );
  }

  return (
    <main className="v3-page v3-stack ui-client-dashboard" style={{ maxWidth: "48rem" }}>
      <div className="v3-row ui-client-dashboard-header" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="v3-row" style={{ alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <h1 className="v3-h1" style={{ marginBottom: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
            당구장 소개 페이지 작성
          </h1>
        </div>
      </div>

      <form className="v3-box v3-stack" onSubmit={handleSubmit} style={{ gap: "0.85rem" }}>
        {orgType === "VENUE" ? (
          <div className="v3-stack" style={{ gap: "0.5rem" }}>
            <span style={{ fontWeight: 600 }}>대표이미지 (최대 4장)</span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "0.5rem",
              }}
            >
              {Array.from({ length: MAX_REPRESENTATIVE_IMAGES }, (_, i) => {
                const url = repDisplay[i] ?? "";
                return (
                  <div
                    key={i}
                    style={{
                      border: "1px solid var(--v3-border, #ddd)",
                      borderRadius: "8px",
                      padding: "0.5rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.4rem",
                    }}
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={`대표이미지 ${i + 1}`}
                        style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "6px" }}
                      />
                    ) : (
                      <div
                        className="v3-muted"
                        style={{
                          width: "100%",
                          aspectRatio: "1",
                          border: "1px dashed var(--v3-border, #ccc)",
                          borderRadius: "6px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.8rem",
                        }}
                      >
                        이미지 {i + 1}
                      </div>
                    )}
                    <input
                      ref={(el) => {
                        repInputRefs.current[i] = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: "none" }}
                      disabled={saving || imageBusy}
                      onChange={(e) => {
                        void onReplaceRepresentative(i, e.target.files);
                      }}
                    />
                    <div className="v3-row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                      <button type="button" className="v3-btn" disabled={saving || imageBusy} onClick={() => repInputRefs.current[i]?.click()}>
                        {uploadingRep ? "업로드중" : url ? "교체" : "추가"}
                      </button>
                      {url ? (
                        <button type="button" className="v3-btn" disabled={saving || imageBusy} onClick={() => removeRepresentative(i)}>
                          삭제
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <input
              ref={repAddInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              style={{ display: "none" }}
              disabled={saving || imageBusy || repDisplay.length >= MAX_REPRESENTATIVE_IMAGES}
              onChange={(e) => {
                void onAddRepresentative(e.target.files);
              }}
            />
            <button
              type="button"
              className="v3-btn"
              disabled={saving || imageBusy || repDisplay.length >= MAX_REPRESENTATIVE_IMAGES}
              onClick={() => repAddInputRef.current?.click()}
            >
              {uploadingRep ? "업로드중" : "사진 추가"}
            </button>
          </div>
        ) : (
          <div className="v3-stack" style={{ gap: "0.5rem" }}>
            <span style={{ fontWeight: 600 }}>대표이미지</span>
            {coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImageUrl}
                alt="대표이미지"
                style={{
                  width: "100%",
                  maxWidth: "18rem",
                  aspectRatio: "1",
                  objectFit: "cover",
                  borderRadius: "8px",
                  border: "1px solid var(--v3-border, #ddd)",
                }}
              />
            ) : (
              <div
                className="v3-muted"
                style={{
                  width: "100%",
                  maxWidth: "18rem",
                  aspectRatio: "1",
                  border: "1px dashed var(--v3-border, #ccc)",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.85rem",
                }}
              >
                이미지 없음
              </div>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              disabled={saving || imageBusy}
              onChange={(e) => {
                void onPickCover(e.target.files);
              }}
            />
            <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" className="v3-btn" disabled={saving || imageBusy} onClick={() => coverInputRef.current?.click()}>
                {uploadingCover ? "업로드중" : coverImageUrl ? "교체" : "파일 선택"}
              </button>
              {coverImageUrl ? (
                <button type="button" className="v3-btn" disabled={saving || imageBusy} onClick={() => setCoverImageUrl("")}>
                  삭제
                </button>
              ) : null}
            </div>
          </div>
        )}

        {uploadError ? <p style={{ color: "#b91c1c", margin: 0 }}>{uploadError}</p> : null}

        <OutlineContentEditor
          heading="당구장 소개"
          displayMode={outlineDisplayMode}
          onDisplayModeChange={setOutlineDisplayMode}
          outlineHtml={outlineHtml}
          onOutlineHtmlChange={setOutlineHtml}
          outlineImageUrl={outlineImageUrl}
          onOutlineImageUrlChange={setOutlineImageUrl}
          outlinePdfUrl={outlinePdfUrl}
          onOutlinePdfUrlChange={setOutlinePdfUrl}
          compact={outlineEditorCompact}
        />
        <div className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <button type="submit" className="ui-btn-primary-solid" disabled={saving || imageBusy}>
            저장
          </button>
          {saveState !== "idle" ? (
            <span style={{ color: saveState === "success" ? "#15803d" : saveState === "error" ? "#b91c1c" : "#6b7280", fontSize: "0.9rem" }}>
              {saveState === "success" ? "저장성공" : saveState === "error" ? "저장실패" : "저장중"}
            </span>
          ) : null}
          <Link className="v3-btn" href="/client/setup">
            업체설정
          </Link>
        </div>
      </form>
    </main>
  );
}
