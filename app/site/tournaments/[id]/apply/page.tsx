"use client";

import SiteShellFrame from "../../../components/SiteShellFrame";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/** 키보드 상단과 입력칸 사이 여백(px). */
const APPLY_MOBILE_KEYBOARD_CLEARANCE_PX = 72;

function isSiteApplyKeyboardScrollTarget(el: HTMLElement): boolean {
  if (el.isContentEditable) return true;
  const name = el.tagName;
  if (name === "TEXTAREA" || name === "SELECT") return true;
  if (name === "INPUT") {
    const type = (el as HTMLInputElement).type.toLowerCase();
    return (
      type !== "hidden" &&
      type !== "checkbox" &&
      type !== "radio" &&
      type !== "submit" &&
      type !== "button" &&
      type !== "reset" &&
      type !== "image"
    );
  }
  return false;
}

/** 모바일 키보드에 가리지 않도록 visualViewport 기준으로만 최소 스크롤 보정(복구 스크롤은 하지 않음). */
function scrollSiteApplyFieldClearOfKeyboard(root: HTMLElement) {
  if (typeof window === "undefined") return;
  const active = document.activeElement;
  if (!active || !(active instanceof HTMLElement) || !root.contains(active)) return;
  if (!isSiteApplyKeyboardScrollTarget(active)) return;

  const runAdjust = () => {
    const el = document.activeElement;
    if (!el || !(el instanceof HTMLElement) || !root.contains(el) || !isSiteApplyKeyboardScrollTarget(el)) return;
    const rect = el.getBoundingClientRect();
    const vv = window.visualViewport;
    const pad = APPLY_MOBILE_KEYBOARD_CLEARANCE_PX;
    if (vv && typeof vv.height === "number" && vv.height > 0) {
      const topLimit = vv.offsetTop + pad;
      const bottomLimit = vv.offsetTop + vv.height - pad;
      if (rect.bottom > bottomLimit) {
        window.scrollBy({ top: rect.bottom - bottomLimit + 12, behavior: "smooth" });
      } else if (rect.top < topLimit) {
        window.scrollBy({ top: rect.top - topLimit - 12, behavior: "smooth" });
      }
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      runAdjust();
      window.setTimeout(runAdjust, 320);
    });
  });
}

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
  const [applicationsClosed, setApplicationsClosed] = useState(false);
  const [applySummaryMeta, setApplySummaryMeta] = useState<{
    maxParticipants: number;
    entryFee: number;
    confirmedParticipantCount: number;
    capacityFilledCount: number;
  } | null>(null);
  const [capacityFullModalOpen, setCapacityFullModalOpen] = useState(false);
  const [applyVerificationMode, setApplyVerificationMode] = useState<"NONE" | "AUTO" | "MANUAL" | null>(null);
  const ocrGateCacheRef = useRef<{ seed: string; result: { ok: boolean; userMessage: string } } | null>(null);
  const proofAreaRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const applyPageScrollRootRef = useRef<HTMLElement | null>(null);

  const requiresProof = useMemo(
    () => applyVerificationMode === null || applyVerificationMode !== "NONE",
    [applyVerificationMode],
  );

  const focusProofArea = useCallback(() => {
    proofAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    queueMicrotask(() => {
      fileInputRef.current?.focus();
    });
  }, []);

  const runOcrGateForProof = useCallback(
    async (
      image: UploadedProofImage,
      depositor: string,
      phoneValue: string,
      nameForOcr: string,
    ): Promise<{ ok: boolean; userMessage: string }> => {
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
            applicantName: nameForOcr.trim(),
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

      setApplicantName(result.user.name ?? "");
      setPhone(result.user.phone ?? "");
    }

    if (tournamentId) {
      void loadSession();
    }
  }, [router, tournamentId]);

  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/site/tournaments/${encodeURIComponent(tournamentId)}/summary`, {
          credentials: "same-origin",
        });
        const json = (await res.json()) as {
          applicationsClosed?: boolean;
          maxParticipants?: number;
          entryFee?: number;
          confirmedParticipantCount?: number;
          capacityFilledCount?: number;
          verificationMode?: unknown;
        };
        if (!cancelled && res.ok) {
          setApplicationsClosed(json.applicationsClosed === true);
          const rawVm = json.verificationMode;
          const vm: "NONE" | "AUTO" | "MANUAL" =
            rawVm === "NONE" || rawVm === "AUTO" || rawVm === "MANUAL" ? rawVm : "AUTO";
          setApplyVerificationMode(vm);
          const maxP = json.maxParticipants;
          const fee = json.entryFee;
          const confirmed = json.confirmedParticipantCount;
          const capFilled = json.capacityFilledCount;
          if (
            typeof maxP === "number" &&
            Number.isFinite(maxP) &&
            typeof fee === "number" &&
            Number.isFinite(fee) &&
            typeof confirmed === "number" &&
            Number.isFinite(confirmed) &&
            typeof capFilled === "number" &&
            Number.isFinite(capFilled)
          ) {
            setApplySummaryMeta({
              maxParticipants: maxP,
              entryFee: fee,
              confirmedParticipantCount: confirmed,
              capacityFilledCount: capFilled,
            });
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  useLayoutEffect(() => {
    const root = applyPageScrollRootRef.current;
    if (!root) return;

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && root.contains(t) && isSiteApplyKeyboardScrollTarget(t)) {
        scrollSiteApplyFieldClearOfKeyboard(root);
      }
    };

    let raf = 0;
    const onVisualViewportChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.activeElement;
        if (el instanceof HTMLElement && root.contains(el) && isSiteApplyKeyboardScrollTarget(el)) {
          scrollSiteApplyFieldClearOfKeyboard(root);
        }
      });
    };

    root.addEventListener("focusin", onFocusIn, true);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onVisualViewportChange);
    vv?.addEventListener("scroll", onVisualViewportChange);

    return () => {
      root.removeEventListener("focusin", onFocusIn, true);
      vv?.removeEventListener("resize", onVisualViewportChange);
      vv?.removeEventListener("scroll", onVisualViewportChange);
      cancelAnimationFrame(raf);
    };
  }, []);

  async function submitApplication(waitlist: boolean) {
    if (!tournamentId || loading || applicationsClosed) return;

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
    if (requiresProof) {
      if (!uploadedProofImage) {
        setMessage("증빙 이미지를 먼저 업로드해 주세요.");
        focusProofArea();
        return;
      }

      const ocrSeed = `${nameTrim}|${depositorTrim}|${phoneTrim}|${uploadedProofImage.imageId}`;
      const cached = ocrGateCacheRef.current;
      let gate: { ok: boolean; userMessage: string };
      if (cached?.seed === ocrSeed && cached.result.ok) {
        gate = cached.result;
      } else {
        gate = await runOcrGateForProof(uploadedProofImage, depositorTrim, phoneTrim, nameTrim);
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
          proofImageId: uploadedProofImage?.imageId ?? "",
          proofImage320Url: uploadedProofImage?.w320Url ?? "",
          proofImage640Url: uploadedProofImage?.w640Url ?? "",
          proofOriginalUrl: uploadedProofImage?.w640Url ?? "",
          waitlist,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        const err = (result.error ?? "").trim();
        if (err.includes("참가정원이 되어 신청이 안됩니다")) {
          setCapacityFullModalOpen(true);
          setMessage("");
          return;
        }
        setMessage(result.error ?? "신청 저장에 실패했습니다.");
        if (
          requiresProof &&
          (err.includes("판독불가") ||
            err.includes("기준 부적합") ||
            err.includes("OCR") ||
            err.includes("증빙"))
        ) {
          setOcrGateOk(false);
          setOcrGateMessage(err);
          focusProofArea();
        }
        return;
      }
      setCapacityFullModalOpen(false);
      setMessage(waitlist ? "대기자 신청이 저장되었습니다." : "참가신청이 저장되었습니다.");
    } catch {
      setMessage("참가신청 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tournamentId || loading || applicationsClosed) return;

    const meta = applySummaryMeta;
    if (
      meta &&
      meta.maxParticipants > 0 &&
      meta.capacityFilledCount >= meta.maxParticipants
    ) {
      setCapacityFullModalOpen(true);
      return;
    }

    await submitApplication(false);
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
      const gate = await runOcrGateForProof(uploaded, depositorName, phone, applicantName);
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
      <section
        ref={applyPageScrollRootRef}
        className="site-site-gray-main v3-stack"
        style={{ maxWidth: "36rem", margin: "0 auto" }}
      >
      {applicationsClosed ? (
        <section className="v3-box v3-stack" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>신청이 마감된 대회입니다.</p>
          <p className="v3-muted" style={{ margin: "0.35rem 0 0" }}>
            참가자 확정이 완료되어 새 신청을 받지 않습니다.
          </p>
        </section>
      ) : null}

      <form className="v3-box v3-stack" onSubmit={handleSubmit} style={{ opacity: applicationsClosed ? 0.5 : 1 }} aria-disabled={applicationsClosed}>
        <label className="v3-stack">
          <span>이름</span>
          <input
            value={applicantName}
            onChange={(event) => setApplicantName(event.target.value)}
            disabled={applicationsClosed}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>전화번호</span>
          <input
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              if (requiresProof) {
                ocrGateCacheRef.current = null;
                setOcrGateOk(null);
              }
            }}
            disabled={applicationsClosed}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>입금자명</span>
          <input
            value={depositorName}
            onChange={(event) => {
              setDepositorName(event.target.value);
              if (requiresProof) {
                ocrGateCacheRef.current = null;
                setOcrGateOk(null);
              }
            }}
            disabled={applicationsClosed}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        {requiresProof ? (
          <div ref={proofAreaRef} className="v3-stack">
            <label className="v3-stack">
              <span>증빙 이미지 업로드</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={applicationsClosed}
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
        ) : null}
        <button
          type="submit"
          className="v3-btn"
          disabled={loading || (requiresProof && ocrVerifying) || applicationsClosed}
        >
          {loading ? "저장 중..." : requiresProof && ocrVerifying ? "OCR 검증 중..." : "참가신청 저장"}
        </button>
      </form>

      {message ? <p className="v3-muted">{message}</p> : null}

      {capacityFullModalOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(15,23,42,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding:
              "max(1rem, env(safe-area-inset-top, 0px)) max(1rem, env(safe-area-inset-right, 0px)) max(1rem, env(safe-area-inset-bottom, 0px)) max(1rem, env(safe-area-inset-left, 0px))",
            boxSizing: "border-box",
          }}
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setCapacityFullModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="참가 정원 안내"
            className="v3-box v3-stack"
            style={{
              maxWidth: "22rem",
              width: "100%",
              background: "#fff",
              borderRadius: "0.65rem",
              padding: "1rem",
              gap: "0.65rem",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p style={{ margin: 0, fontWeight: 800, lineHeight: 1.45 }}>참가정원이 되어 신청이 안됩니다.</p>
            <div className="v3-row" style={{ justifyContent: "flex-end", gap: "0.45rem", flexWrap: "wrap" }}>
              <button type="button" className="v3-btn" onClick={() => setCapacityFullModalOpen(false)}>
                신청취소
              </button>
              <button
                type="button"
                className="v3-btn"
                style={{ fontWeight: 800 }}
                onClick={() => {
                  setCapacityFullModalOpen(false);
                  void submitApplication(true);
                }}
              >
                대기자 신청
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
