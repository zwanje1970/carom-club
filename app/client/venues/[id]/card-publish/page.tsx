"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import PublishedSnapshotCard from "../../../../site/published-snapshot-card";

type Template = {
  id: string;
  name: string;
  textAreaStructure: string;
  imageSlotStructure: string;
  defaultLayout: string;
};

type UploadedImage = {
  imageId: string;
  w320Url: string;
  w640Url: string;
};

type Snapshot = {
  snapshotId: string;
  version: number;
  isActive: boolean;
  publishedAt: string;
};

const VENUE_NAME_MAP: Record<string, string> = {
  "venue-1": "카롬 강남점",
  "venue-2": "카롬 서초점",
  "venue-3": "카롬 수원점",
};

export default function ClientVenueCardPublishPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const venueId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const venueName = VENUE_NAME_MAP[venueId] ?? venueId;
  const [template, setTemplate] = useState<Template | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [textLayout, setTextLayout] = useState("");
  const [imageLayout, setImageLayout] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);

  useEffect(() => {
    async function loadTemplate() {
      try {
        const response = await fetch("/api/client/card-template");
        const result = (await response.json()) as { template?: Template; error?: string };
        if (!response.ok || !result.template) {
          setMessage(result.error ?? "템플릿을 불러오지 못했습니다.");
          return;
        }
        setTemplate(result.template);
        setTextLayout(result.template.textAreaStructure);
        setImageLayout(result.template.defaultLayout);
      } catch {
        setMessage("템플릿 조회 중 오류가 발생했습니다.");
      }
    }

    void loadTemplate();
  }, []);

  useEffect(() => {
    async function loadSnapshots() {
      if (!venueId) return;
      try {
        const response = await fetch(`/api/client/venue-card-snapshots?venueId=${encodeURIComponent(venueId)}`);
        const result = (await response.json()) as {
          snapshots?: Snapshot[];
          activeSnapshot?: Snapshot | null;
        };
        if (!response.ok) return;
        setSnapshots(result.snapshots ?? []);
        setActiveSnapshotId(result.activeSnapshot?.snapshotId ?? null);
      } catch {}
    }
    void loadSnapshots();
  }, [venueId]);

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!venueId || loading) return;
    if (!uploadedImage) {
      setMessage("이미지 업로드 후 발행할 수 있습니다.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/client/venue-card-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId,
          templateType: "venue",
          title: title.trim(),
          subtitle: content.trim(),
          imageId: uploadedImage.imageId,
          image320Url: uploadedImage.w320Url,
          image640Url: uploadedImage.w640Url,
          textLayout: textLayout.trim(),
          imageLayout: imageLayout.trim(),
        }),
      });
      const result = (await response.json()) as { error?: string; snapshot?: { snapshotId?: string } };
      if (!response.ok) {
        setMessage(result.error ?? "발행에 실패했습니다.");
        return;
      }
      setMessage("재발행이 완료되었습니다. 최신 스냅샷이 노출됩니다.");
      const snapshotId = result.snapshot?.snapshotId;
      if (snapshotId) {
        setActiveSnapshotId(snapshotId);
      }
      const reload = await fetch(`/api/client/venue-card-snapshots?venueId=${encodeURIComponent(venueId)}`);
      if (reload.ok) {
        const reloadResult = (await reload.json()) as { snapshots?: Snapshot[] };
        setSnapshots(reloadResult.snapshots ?? []);
      }
      router.refresh();
    } catch {
      setMessage("발행 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStopPublishing() {
    if (!activeSnapshotId || loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/client/venue-card-snapshots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId: activeSnapshotId,
          isActive: false,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "게시 중단에 실패했습니다.");
        return;
      }
      setActiveSnapshotId(null);
      setMessage("게시가 중단되었습니다. 노출 목록에서 즉시 제거됩니다.");
      const reload = await fetch(`/api/client/venue-card-snapshots?venueId=${encodeURIComponent(venueId)}`);
      if (reload.ok) {
        const reloadResult = (await reload.json()) as { snapshots?: Snapshot[] };
        setSnapshots(reloadResult.snapshots ?? []);
      }
      router.refresh();
    } catch {
      setMessage("게시 중단 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadImage(file: File) {
    if (uploading) return;
    setUploading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as UploadedImage & { error?: string };
      if (!response.ok || !result.imageId) {
        setMessage(result.error ?? "이미지 업로드에 실패했습니다.");
        return;
      }
      setUploadedImage({
        imageId: result.imageId,
        w320Url: result.w320Url,
        w640Url: result.w640Url,
      });
      setMessage("이미지 업로드가 완료되었습니다.");
    } catch {
      setMessage("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "40rem", margin: "0 auto" }}>
      <h1 className="v3-h1">게시카드 작성</h1>
      <p className="v3-muted">템플릿 형식은 플랫폼에서 관리하고, 클라이언트는 당구장용 문구/이미지를 채워 발행합니다.</p>
      <p className="v3-muted">이 화면은 카드 내용 입력/발행 전용이며, 당구장 원본 데이터 전체를 수정하는 화면이 아닙니다.</p>

      <section className="v3-box v3-stack">
        <p>당구장 ID: {venueId || "-"}</p>
        <p>당구장명: {venueName || "-"}</p>
        <p>템플릿: {template?.name ?? "-"}</p>
        <p>현재 게시 상태: {activeSnapshotId ? "노출 중" : "노출 안 함"}</p>
      </section>

      <form className="v3-box v3-stack" onSubmit={handlePublish}>
        <label className="v3-stack">
          <span>카드 제목</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>내용</span>
          <input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>카드 이미지 업로드</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleUploadImage(file);
              }
            }}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem", background: "#fff" }}
          />
          <p className="v3-muted">
            {uploadedImage
              ? `업로드 완료: imageId=${uploadedImage.imageId}`
              : uploading
                ? "업로드 중..."
                : "업로드된 이미지가 없습니다"}
          </p>
        </label>
        <label className="v3-stack">
          <span>텍스트 배치 결과</span>
          <input
            value={textLayout}
            onChange={(event) => setTextLayout(event.target.value)}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>이미지 배치 결과</span>
          <input
            value={imageLayout}
            onChange={(event) => setImageLayout(event.target.value)}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <p className="v3-muted" style={{ margin: 0 }}>
          배치 결과 값은 이번 발행 스냅샷에만 적용되며, 플랫폼 템플릿 원본은 변경되지 않습니다.
        </p>

        <section className="v3-box v3-stack" style={{ background: "#fafafa" }}>
          <p style={{ fontWeight: 700 }}>미리보기</p>
          <PublishedSnapshotCard
            previewOnly
            item={{
              snapshotId: "preview-venue",
              title: title.trim() || "(카드 제목)",
              subtitle: content.trim() || "(내용)",
              publishedAt: new Date().toISOString(),
              targetDetailUrl: `/site/venues/${venueId}`,
              image320Url: uploadedImage?.w320Url,
            }}
            alignment="LEFT"
            layout="horizontal"
            templateType="venue"
          />
          <p className="v3-muted">텍스트 배치: {textLayout || "-"}</p>
          <p className="v3-muted">이미지 배치: {imageLayout || "-"}</p>
        </section>

        <div className="v3-row">
          <button type="submit" className="v3-btn" disabled={loading}>
            {loading ? "처리 중..." : activeSnapshotId ? "재발행" : "최초 발행"}
          </button>
          <button
            type="button"
            className="v3-btn"
            disabled={loading || !activeSnapshotId}
            onClick={handleStopPublishing}
            style={{
              background: "#fff3e8",
              borderColor: "#f0b36d",
              opacity: activeSnapshotId ? 1 : 0.6,
              cursor: activeSnapshotId ? "pointer" : "not-allowed",
            }}
          >
            게시 중단
          </button>
        </div>
      </form>

      {message ? <p className="v3-muted">{message}</p> : null}

      <section className="v3-box v3-stack">
        <h2 className="v3-h2">스냅샷 이력</h2>
        {snapshots.length === 0 ? (
          <p className="v3-muted">발행 이력이 없습니다.</p>
        ) : (
          <ul className="v3-list">
            {snapshots.map((snapshot) => (
              <li key={snapshot.snapshotId}>
                v{snapshot.version} / {snapshot.isActive ? "ACTIVE" : "INACTIVE"} /{" "}
                {new Date(snapshot.publishedAt).toLocaleString("ko-KR")}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="v3-row">
        <Link className="v3-btn" href={`/site/venues/${venueId}`}>
          사이트 상세 확인
        </Link>
      </div>
    </main>
  );
}
