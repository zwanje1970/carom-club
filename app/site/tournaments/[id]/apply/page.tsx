"use client";

import SiteShellFrame from "../../../components/SiteShellFrame";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type UploadedProofImage = {
  imageId: string;
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
  const [ocrGateOk, setOcrGateOk] = useState<boolean | null>(null);
  const [ocrGateMessage, setOcrGateMessage] = useState("");
  const [ocrVerifying, setOcrVerifying] = useState(false);
  const ocrGateCacheRef = useRef<{ seed: string; result: { ok: boolean; userMessage: string } } | null>(null);
  const proofAreaRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const focusProofArea = useCallback(() => {
    proofAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    queueMicrotask(() => {
      fileInputRef.current?.focus();
    });
  }, []);

  const runOcrGateForProof = useCallback(
    async (image: UploadedProofImage, depositor: string, phoneValue: string): Promise<{ ok: boolean; userMessage: string }> => {
      setOcrVerifying(true);
      setOcrGateOk(null);
      setOcrGateMessage("");
      try {
        const response = await fetch(`/api/site/tournaments/${tournamentId}/apply/ocr-verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proofImageId: image.imageId,
            depositorName: depositor.trim(),
            phone: phoneValue.trim(),
          }),
        });
        const result = (await response.json()) as {
          ok?: boolean;
          userMessage?: string;
          error?: string;
        };
        const ok = result.ok === true;
        setOcrGateOk(ok);
        const msg =
          (typeof result.userMessage === "string" && result.userMessage.trim()) ||
          (typeof result.error === "string" && result.error.trim()) ||
          "증빙 OCR 검증에 실패했습니다.";
        setOcrGateMessage(msg);
        setMessage(msg);
        if (!ok) {
          focusProofArea();
        }
        return { ok, userMessage: msg };
      } catch {
        const msg = "증빙 OCR 검증 중 오류가 발생했습니다.";
        setOcrGateOk(false);
        setOcrGateMessage(msg);
        setMessage(msg);
        focusProofArea();
        return { ok: false, userMessage: msg };
      } finally {
        setOcrVerifying(false);
      }
    },
    [focusProofArea, tournamentId]
  );

  useEffect(() => {
    async function loadSession() {
      const response = await fetch("/api/auth/session");
      const result = (await response.json()) as {
        authenticated?: boolean;
        user?: SessionUser;
      };

      if (!response.ok || !result.authenticated || !result.user) {
        router.replace(`/login?next=${encodeURIComponent(`/site/tournaments/${tournamentId}/apply`)}`);
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

    const nameTrim = applicantName.trim();
    const phoneTrim = phone.trim();
    const depositorTrim = depositorName.trim();

    if (!nameTrim) {
      setMessage("이름을 입력해 주세요.");
      return;
    }
    if (!phoneTrim) {
      setMessage("전화번호를 입력해 주세요.");
      return;
    }
    if (!depositorTrim) {
      setMessage("입금자명을 입력해 주세요.");
      return;
    }
    if (!uploadedProofImage) {
      setMessage("증빙 이미지를 먼저 업로드해 주세요.");
      focusProofArea();
      return;
    }

    const ocrSeed = `${depositorTrim}|${phoneTrim}|${uploadedProofImage.imageId}`;
    const cached = ocrGateCacheRef.current;
    let gate: { ok: boolean; userMessage: string };
    if (cached?.seed === ocrSeed && cached.result.ok) {
      gate = cached.result;
    } else {
      gate = await runOcrGateForProof(uploadedProofImage, depositorTrim, phoneTrim);
      if (gate.ok) {
        ocrGateCacheRef.current = { seed: ocrSeed, result: gate };
      } else {
        ocrGateCacheRef.current = null;
      }
    }
    if (!gate.ok) {
      setMessage(gate.userMessage);
      focusProofArea();
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
          proofOriginalUrl: uploadedProofImage.w640Url,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "신청 저장에 실패했습니다.");
        const err = (result.error ?? "").trim();
        if (
          err.includes("판독불가") ||
          err.includes("기준 부적합") ||
          err.includes("OCR") ||
          err.includes("증빙")
        ) {
          setOcrGateOk(false);
          setOcrGateMessage(err);
          focusProofArea();
        }
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
    setOcrGateOk(null);
    setOcrGateMessage("");
    ocrGateCacheRef.current = null;
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
      const uploaded: UploadedProofImage = {
        imageId: result.imageId,
        w320Url: result.w320Url,
        w640Url: result.w640Url,
      };
      setUploadedProofImage(uploaded);
      setMessage("증빙 이미지 업로드가 완료되었습니다. OCR 검증 중...");
      const gate = await runOcrGateForProof(uploaded, depositorName, phone);
      const seed = `${depositorName.trim()}|${phone.trim()}|${uploaded.imageId}`;
      if (gate.ok) {
        ocrGateCacheRef.current = { seed, result: gate };
      } else {
        ocrGateCacheRef.current = null;
      }
    } catch {
      setMessage("증빙 이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <SiteShellFrame brandTitle="참가신청서">
      <section className="site-site-gray-main v3-stack" style={{ maxWidth: "36rem", margin: "0 auto" }}>
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
            onChange={(event) => {
              setPhone(event.target.value);
              ocrGateCacheRef.current = null;
              setOcrGateOk(null);
            }}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>입금자명</span>
          <input
            value={depositorName}
            onChange={(event) => {
              setDepositorName(event.target.value);
              ocrGateCacheRef.current = null;
              setOcrGateOk(null);
            }}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <div ref={proofAreaRef} className="v3-stack">
        <label className="v3-stack">
          <span>증빙 이미지 업로드</span>
          <input
            ref={fileInputRef}
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
        {ocrVerifying ? <p className="v3-muted">OCR 검증 중...</p> : null}
        </div>
        <button type="submit" className="v3-btn" disabled={loading || ocrVerifying}>
          {loading ? "저장 중..." : ocrVerifying ? "OCR 검증 중..." : "참가신청 저장"}
        </button>
      </form>

      {message ? <p className="v3-muted">{message}</p> : null}

      <div className="v3-row">
        <Link prefetch={false} className="v3-btn" href={`/site/tournaments/${tournamentId}`}>
          상세로
        </Link>
        <Link prefetch={false} className="v3-btn" href="/site/tournaments">
          목록으로
        </Link>
      </div>
      </section>
    </SiteShellFrame>
  );
}
