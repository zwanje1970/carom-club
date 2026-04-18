"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type UploadedProofImage = {
  imageId: string;
  originalUrl: string;
  w320Url: string;
  w640Url: string;
};

export default function SiteTournamentApplyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tournamentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [applicantName, setApplicantName] = useState("");
  const [phone, setPhone] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [uploadedProofImage, setUploadedProofImage] = useState<UploadedProofImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSession() {
      const response = await fetch("/api/auth/session");
      const result = (await response.json()) as {
        authenticated?: boolean;
        user?: SessionUser;
      };

      if (!response.ok || !result.authenticated || !result.user) {
        router.replace(`/login?next=/site/tournaments/${tournamentId}`);
        return;
      }

      setUser(result.user);
      setApplicantName(result.user.name ?? "");
      setPhone(result.user.phone ?? "");
    }

    if (tournamentId) {
      void loadSession();
    }
  }, [router, tournamentId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tournamentId || loading) return;
    if (!uploadedProofImage) {
      setMessage("증빙 이미지를 먼저 업로드해 주세요.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/site/tournaments/${tournamentId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantName: applicantName.trim(),
          phone: phone.trim(),
          depositorName: depositorName.trim(),
          proofImageId: uploadedProofImage.imageId,
          proofImage320Url: uploadedProofImage.w320Url,
          proofImage640Url: uploadedProofImage.w640Url,
          proofOriginalUrl: uploadedProofImage.originalUrl,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "신청 저장에 실패했습니다.");
        return;
      }
      setMessage("참가신청이 저장되었습니다.");
    } catch {
      setMessage("참가신청 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadProofImage(file: File) {
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
      const result = (await response.json()) as UploadedProofImage & { error?: string };
      if (!response.ok || !result.imageId) {
        setMessage(result.error ?? "증빙 이미지 업로드에 실패했습니다.");
        return;
      }
      setUploadedProofImage({
        imageId: result.imageId,
        originalUrl: result.originalUrl,
        w320Url: result.w320Url,
        w640Url: result.w640Url,
      });
      setMessage("증빙 이미지 업로드가 완료되었습니다.");
    } catch {
      setMessage("증빙 이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "36rem", margin: "0 auto" }}>
      <h1 className="v3-h1">참가신청서</h1>
      <p className="v3-muted">대회 ID: {tournamentId}</p>
      <p className="v3-muted">로그인 사용자 기준 최소 신청 흐름입니다.</p>

      <section className="v3-box v3-stack">
        <p>신청자 계정: {user?.name ?? "-"}</p>
        <p>연락처(기본값): {user?.phone ?? "-"}</p>
        <p>증빙 이미지: {uploadedProofImage ? "업로드 완료" : uploading ? "업로드 중..." : "미업로드"}</p>
      </section>

      <form className="v3-box v3-stack" onSubmit={handleSubmit}>
        <label className="v3-stack">
          <span>이름</span>
          <input
            value={applicantName}
            onChange={(event) => setApplicantName(event.target.value)}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>전화번호</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>입금자명</span>
          <input
            value={depositorName}
            onChange={(event) => setDepositorName(event.target.value)}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>증빙 이미지 업로드</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleUploadProofImage(file);
              }
            }}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem", background: "#fff" }}
          />
        </label>
        {uploadedProofImage?.w320Url ? (
          <img
            src={uploadedProofImage.w320Url}
            alt="증빙 이미지 미리보기"
            style={{ width: "100%", maxHeight: "12rem", objectFit: "cover", borderRadius: "0.55rem" }}
          />
        ) : null}
        <button type="submit" className="v3-btn" disabled={loading}>
          {loading ? "저장 중..." : "참가신청 저장"}
        </button>
      </form>

      {message ? <p className="v3-muted">{message}</p> : null}

      <div className="v3-row">
        <Link className="v3-btn" href={`/site/tournaments/${tournamentId}`}>
          상세로
        </Link>
        <Link className="v3-btn" href="/site/tournaments">
          목록으로
        </Link>
      </div>
    </main>
  );
}
