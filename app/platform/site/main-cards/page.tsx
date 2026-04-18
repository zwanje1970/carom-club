"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import deckStyles from "../../../site/main-scene-slide-deck.module.css";
import PublishedSnapshotCard from "../../../site/published-snapshot-card";
import { SlideDeckCard, type SlideDeckItem } from "../../../site/tournament-slide-card";

type Template = {
  id: string;
  type: "tournament" | "venue";
  layout: "fixed";
  style: "default";
};

export default function PlatformMainCardsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateType, setTemplateType] = useState<"tournament" | "venue">("tournament");
  const [statusText, setStatusText] = useState("모집중");
  const [topLabelText, setTopLabelText] = useState("제목 위 한 줄");
  const [titleText, setTitleText] = useState("제목을 입력하세요");
  const [descriptionText, setDescriptionText] = useState("설명을 입력하세요");
  const [dateText, setDateText] = useState("2026.04.13");
  const [placeText, setPlaceText] = useState("장소를 입력하세요");
  const [contentText, setContentText] = useState("내용을 입력하세요");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedTemplate = useMemo(
    () => templates.find((item) => item.type === templateType) ?? null,
    [templateType, templates]
  );

  const tournamentSlideDeckShared = useMemo(
    () => ({
      title: titleText,
      subtitle: `${dateText} · ${placeText}`.trim(),
      statusBadge: statusText,
      cardExtraLine1: topLabelText,
      cardExtraLine2: descriptionText,
      image320Url: imagePreviewUrl || undefined,
      backgroundType: (imagePreviewUrl.trim() ? "image" : "theme") as "image" | "theme",
      themeType: "dark" as const,
    }),
    [titleText, dateText, placeText, statusText, topLabelText, descriptionText, imagePreviewUrl]
  );

  const tournamentSlidePreviewA: SlideDeckItem = useMemo(
    () => ({
      snapshotId: "platform-preview-classic",
      ...tournamentSlideDeckShared,
      cardTemplate: "A",
    }),
    [tournamentSlideDeckShared]
  );

  const tournamentSlidePreviewB: SlideDeckItem = useMemo(
    () => ({
      snapshotId: "platform-preview-frame",
      ...tournamentSlideDeckShared,
      cardTemplate: "B",
    }),
    [tournamentSlideDeckShared]
  );

  async function loadTemplates() {
    try {
      const response = await fetch("/api/platform/main-card-template");
      const result = (await response.json()) as { templates?: Template[]; error?: string };
      if (!response.ok || !Array.isArray(result.templates)) {
        setMessage(result.error ?? "템플릿을 불러오지 못했습니다.");
        return;
      }
      setTemplates(result.templates);
    } catch {
      setMessage("템플릿 조회 중 오류가 발생했습니다.");
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function handleSave() {
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/platform/main-card-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: templateType,
        }),
      });
      const result = (await response.json()) as { template?: Template; error?: string };
      if (!response.ok || !result.template) {
        setMessage(result.error ?? "저장에 실패했습니다.");
        return;
      }
      setTemplates((prev) => {
        const index = prev.findIndex((item) => item.type === result.template!.type);
        if (index < 0) return [...prev, result.template!];
        const next = [...prev];
        next[index] = result.template!;
        return next;
      });
      setMessage("게시카드 템플릿이 저장되었습니다.");
    } catch {
      setMessage("템플릿 저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleImageFileChange(file: File | null) {
    if (!file) {
      setImagePreviewUrl("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setImagePreviewUrl(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="v3-page v3-stack" style={{ width: "100%", maxWidth: "none", margin: 0 }}>
      <h1 className="v3-h1">메인용 게시카드 관리</h1>
      <section id="template-ui" className="v3-box v3-stack">
        <label className="v3-stack">
          <span>카드 타입</span>
          <select
            value={templateType}
            onChange={(event) => setTemplateType(event.target.value as "tournament" | "venue")}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          >
            <option value="tournament">대회</option>
            <option value="venue">당구장</option>
          </select>
        </label>
        <div className="template-ui-grid">
          <section className="v3-stack">
            {templateType === "tournament" ? (
              <>
                <label className="v3-stack">
                  <span>상태</span>
                  <select
                    value={statusText}
                    onChange={(event) => setStatusText(event.target.value)}
                    style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                  >
                    <option value="모집중">모집중</option>
                    <option value="진행중">진행중</option>
                    <option value="마감임박">마감임박</option>
                    <option value="대기자모집">대기자모집</option>
                    <option value="마감">마감</option>
                    <option value="종료">종료</option>
                  </select>
                </label>
                <label className="v3-stack">
                  <span>제목 위 한 줄</span>
                  <input
                    value={topLabelText}
                    onChange={(event) => setTopLabelText(event.target.value)}
                    style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                  />
                </label>
                <label className="v3-stack">
                  <span>제목</span>
                  <input
                    value={titleText}
                    onChange={(event) => setTitleText(event.target.value)}
                    style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                  />
                </label>
                <label className="v3-stack">
                  <span>설명</span>
                  <textarea
                    value={descriptionText}
                    onChange={(event) => setDescriptionText(event.target.value)}
                    rows={3}
                    style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem", resize: "vertical" }}
                  />
                </label>
                <label className="v3-stack">
                  <span>날짜</span>
                  <input
                    value={dateText}
                    onChange={(event) => setDateText(event.target.value)}
                    style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                  />
                </label>
                <label className="v3-stack">
                  <span>장소</span>
                  <input
                    value={placeText}
                    onChange={(event) => setPlaceText(event.target.value)}
                    style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                  />
                </label>
                <label className="v3-stack">
                  <span>이미지</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageFileChange(event.target.files?.[0] ?? null)}
                    style={{ padding: "0.45rem 0", border: "none" }}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="v3-stack">
                  <span>제목</span>
                  <input
                    value={titleText}
                    onChange={(event) => setTitleText(event.target.value)}
                    style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                  />
                </label>
                <label className="v3-stack">
                  <span>내용</span>
                  <input
                    value={contentText}
                    onChange={(event) => setContentText(event.target.value)}
                    style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                  />
                </label>
                <label className="v3-stack">
                  <span>이미지</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageFileChange(event.target.files?.[0] ?? null)}
                    style={{ padding: "0.45rem 0", border: "none" }}
                  />
                </label>
              </>
            )}
            <button className="v3-btn" type="button" onClick={handleSave} disabled={loading}>
              {loading ? "저장 중..." : "템플릿 저장"}
            </button>
            <code style={{ fontSize: "0.78rem", color: "#4b5563" }}>
              {JSON.stringify(
                {
                  type: selectedTemplate?.type ?? templateType,
                  layout: selectedTemplate?.layout ?? "fixed",
                  style: selectedTemplate?.style ?? "default",
                },
                null,
                2
              )}
            </code>
          </section>
          <section className="v3-stack template-preview-column">
            {templateType === "tournament" ? (
              <>
                <div className="v3-stack" style={{ gap: "0.45rem", width: "100%" }}>
                  <span className="v3-muted" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                    슬라이드 템플릿 (클래식 · 프레임)
                  </span>
                  <p className="v3-muted" style={{ fontSize: "0.75rem", margin: "-0.2rem 0 0", lineHeight: 1.4 }}>
                    메인 슬라이드와 동일한 카드 UI입니다 (템플릿 A · B).
                  </p>
                  <div className="slide-preview-trio">
                    <div className="slide-preview-cell v3-stack">
                      <span className="v3-muted slide-preview-label">클래식</span>
                      <div className={deckStyles.slideDeckCard} style={{ width: "100%", maxWidth: "min(90%, 387px)" }}>
                        <SlideDeckCard item={tournamentSlidePreviewA} />
                      </div>
                    </div>
                    <div className="slide-preview-cell v3-stack">
                      <span className="v3-muted slide-preview-label">프레임</span>
                      <div className={deckStyles.slideDeckCard} style={{ width: "100%", maxWidth: "min(90%, 387px)" }}>
                        <SlideDeckCard item={tournamentSlidePreviewB} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="v3-box" style={{ padding: "0.75rem" }}>
                <PublishedSnapshotCard
                  item={{
                    snapshotId: "template-preview",
                    title: titleText.slice(0, 120),
                    subtitle: contentText.slice(0, 120),
                    publishedAt: new Date().toISOString(),
                    targetDetailUrl: "/site/venues",
                    image320Url: imagePreviewUrl || undefined,
                  }}
                  alignment="LEFT"
                  layout="horizontal"
                  templateType="venue"
                />
              </div>
            )}
          </section>
        </div>
      </section>

      {message ? <p className="v3-muted">{message}</p> : null}

      <div className="v3-row">
        <Link className="v3-btn" href="/platform/site">
          사이트 관리로
        </Link>
        <Link className="v3-btn" href="/platform">
          플랫폼 홈
        </Link>
      </div>
      <style jsx>{`
        .template-ui-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, min(100%, 920px));
          gap: 1rem;
          align-items: start;
        }

        .template-preview-column {
          width: 100%;
          max-width: min(100%, 920px);
        }

        .slide-preview-trio {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.65rem;
          width: 100%;
          align-items: start;
        }

        .slide-preview-cell {
          min-width: 0;
          gap: 0.25rem;
        }

        .slide-preview-label {
          font-size: 0.7rem;
          font-weight: 600;
        }

        /* 한 줄에 2개가 들어가도록 카드만 약간 축소 (레이아웃 높이에 반영됨) */
        .slide-preview-cell :global(article) {
          zoom: 0.88;
        }

        @media (max-width: 980px) {
          .template-ui-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (max-width: 760px) {
          .slide-preview-trio {
            grid-template-columns: 1fr;
          }

          .slide-preview-cell :global(article) {
            zoom: 1;
          }
        }
      `}</style>
    </main>
  );
}
