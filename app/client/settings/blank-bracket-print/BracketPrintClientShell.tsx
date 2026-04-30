"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import {
  buildBracketScene,
  buildFirstRoundSlotToBoxIndex,
  buildStartPairLabels,
  type StartPairLabel,
} from "./bracket-render-engine";
import { BracketPrintServiceMark, BracketSVG, type MatchType } from "./bracket-print-shared";

/**
 * 실제 인쇄 용지: A4 가로. @page(또는 PDF 삽입) 여백 10mm 기준으로 본문에 쓸 수 있는 직사각형이
 * 277mm × 190mm — 이 크기가 대진 도면(SVG width/height, jsPDF addImage 폭·높이)과 일치한다.
 */
const MARGIN_MM = 10;
/** 대진표(277×190mm) 도면 기준 우상단 — 용지 @page 여백과 별개 */
const SERVICE_MARK_INSET_MM = 0.6;
/** © 표기: 부모 overflow:hidden 클립 방지를 위해 용지 상단 안쪽(양수 mm)에 둔다. */
const SERVICE_MARK_TOP_MM = 0.8;
/** 기존 2.8mm 대비 50% */
const SERVICE_MARK_FONT_MM = 1.4;

const ROUND_LABEL: Record<number, string> = {
  128: "128강", 64: "64강", 32: "32강", 16: "16강",
  8: "8강", 4: "4강", 2: "결승",
};
const roundLabel = (n: number) => ROUND_LABEL[n] ?? `${n}강`;
const START_SIZES = [16, 32, 64, 128] as const;

function validEndOptions(start: number): number[] {
  return [128, 64, 32, 16, 8, 4, 2].filter(e => e < start);
}
function segmentRounds(start: number, end: number): number[] {
  const out: number[] = [];
  for (let n = start; n >= end; n = n / 2) out.push(n);
  if (end === 2 && out[out.length - 1] === 2) out.push(1);
  return out;
}

type BracketStyle = "TREE" | "CENTER";
type TreeLayout   = "HORIZONTAL" | "VERTICAL";

/**
 * 미리보기 용지 px — 모바일 화면 방향·viewport 비율과 무관.
 * 세로형(tree VERTICAL)은 대진 트리가 아래→위로 올라가는 형식일 뿐, 용지는 항상 가로(277×190mm 영역과 동일 비율).
 */
function previewPaperFromPrintSettings(
  _style: BracketStyle,
  _treeLayout: TreeLayout,
): { paperW: number; paperH: number } {
  return { paperW: 1123, paperH: 794 };
}

function touchDistance(touches: { length: number; [index: number]: { clientX: number; clientY: number } | undefined }): number {
  const t1 = touches[0];
  const t2 = touches[1];
  if (!t1 || !t2) return 0;
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.hypot(dx, dy);
}

function formatPdfDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function bracketPdfLayoutType(style: BracketStyle): "tree" | "center" {
  return style === "TREE" ? "tree" : "center";
}

type PdfDownloadStatus = "idle" | "ready" | "downloading" | "saved" | "failed";

/** Android 앱 WebView: MainActivity 에서 주입하는 PDF 저장 브리지 */
type CaromPdfDownloadBridge = {
  savePdfBase64: (base64: string, fileName: string) => void;
};

function logCaromPdfBridgeProbe(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { CaromPdfDownload?: unknown };
  const raw = w.CaromPdfDownload;
  const saveFn =
    raw != null && typeof raw === "object" && "savePdfBase64" in raw
      ? (raw as { savePdfBase64?: unknown }).savePdfBase64
      : undefined;
  console.info("[blank-bracket-print] CaromPdfDownload probe", {
    windowCaromPdfDownloadExists: raw !== undefined && raw !== null,
    typeofCaromPdfDownload: typeof raw,
    savePdfBase64Exists: typeof saveFn === "function",
  });
}

function getCaromPdfDownloadBridge(): CaromPdfDownloadBridge | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { CaromPdfDownload?: CaromPdfDownloadBridge };
  const raw = w.CaromPdfDownload;
  if (raw == null) return undefined;
  if (typeof raw.savePdfBase64 !== "function") return undefined;
  return raw;
}

function pdfBlobUrlToBase64(blobUrl: string): Promise<{ base64: string; blobSize: number }> {
  return fetch(blobUrl)
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise<{ base64: string; blobSize: number }>((resolve, reject) => {
          const blobSize = blob.size;
          const fr = new FileReader();
          fr.onload = () => {
            const dataUrl = fr.result as string;
            const comma = dataUrl.indexOf(",");
            const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
            resolve({ base64, blobSize });
          };
          fr.onerror = () => reject(fr.error);
          fr.readAsDataURL(blob);
        }),
    );
}

function groupLabel(pageIdx: number): string {
  if (pageIdx >= 0 && pageIdx < 26) return `${String.fromCharCode(65 + pageIdx)}조`;
  return `${pageIdx + 1}조`;
}

export function BracketPrintClientShell({
  variant,
  tournamentId,
  embedded = false,
}: {
  variant: "blank" | "tournament";
  tournamentId?: string;
  /** 대회 상세 등 이미 main 안에 넣을 때 true — 중첩 main 방지 */
  embedded?: boolean;
}) {
  const [matchType,    setMatchType]    = useState<MatchType>("NORMAL");
  const [startPlayers, setStartPlayers] = useState(32);
  const [endPlayers,   setEndPlayers]   = useState(2);   /* 결승 */
  const [style,        setStyle]        = useState<BracketStyle>("TREE");
  const [treeLayout,   setTreeLayout]   = useState<TreeLayout>("VERTICAL");
  const [showStartPairNumbers, setShowStartPairNumbers] = useState(false);
  /** 빈 칸 배경만 연한색 — 외곽선(stroke)은 CSS에서 검정 고정 */
  const [warmEmptyBoxFill, setWarmEmptyBoxFill] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string | null>(null);
  const [pdfDownloadName, setPdfDownloadName] = useState("대진표.pdf");
  const [, setPdfDownloadStatus] = useState<PdfDownloadStatus>("idle");
  const [pdfDownloadModalOpen, setPdfDownloadModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewFitScale, setPreviewFitScale] = useState(1);
  const [previewViewportScale, setPreviewViewportScale] = useState(1);
  const pdfRootRef = useRef<HTMLDivElement>(null);
  const pdfBusyRef = useRef(false);
  const pdfDownloadUrlRef = useRef<string | null>(null);
  const pdfDownloadDoneTimerRef = useRef<number | null>(null);
  const previewTopbarRef = useRef<HTMLDivElement>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const pinchActiveRef = useRef(false);
  const pinchStartDistanceRef = useRef(0);
  const pinchStartScaleRef = useRef(1);
  const previewDomStyleSnapshotRef = useRef<{
    bodyOverflow: string;
    bodyTransform: string;
    bodyRotate: string;
    bodyTouchAction: string;
    htmlTransform: string;
    htmlRotate: string;
    htmlTouchAction: string;
  } | null>(null);

  const [tournamentApplicants, setTournamentApplicants] = useState<string[] | null>(null);
  type TournamentPdfPage = { label: string; slots: (string | null)[] };
  const [tournamentPdfPages, setTournamentPdfPages] = useState<TournamentPdfPage[] | null>(null);
  const offscreenTournamentRef = useRef<HTMLDivElement>(null);

  const fetchTournamentApplicants = useCallback(async (): Promise<string[]> => {
    if (variant !== "tournament") return [];
    const tid = (tournamentId ?? "").trim();
    if (!tid) return [];
    const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tid)}/approved-applicants`, {
      credentials: "same-origin",
    });
    const data = (await res.json()) as { applicants?: { name: string }[]; error?: string };
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "승인 참가자 목록을 불러오지 못했습니다.");
    }
    return (data.applicants ?? [])
      .map((a) => (typeof a.name === "string" ? a.name.trim() : ""))
      .filter(Boolean);
  }, [variant, tournamentId]);

  const previewTournamentFirstRoundSlots = useMemo((): (string | null)[] | null => {
    if (variant !== "tournament" || tournamentApplicants === null) return null;
    return Array.from({ length: startPlayers }, (_, i) => {
      const v = tournamentApplicants[i];
      return v && v.trim() ? v.trim() : null;
    });
  }, [variant, tournamentApplicants, startPlayers]);

  const endOptions = useMemo(() => validEndOptions(startPlayers), [startPlayers]);
  const rounds = useMemo(() => {
    if (!endOptions.includes(endPlayers)) return [];
    return segmentRounds(startPlayers, endPlayers);
  }, [startPlayers, endPlayers, endOptions]);

  const onStartChange = useCallback((n: number) => {
    setStartPlayers(n);
    setEndPlayers(prev => {
      const opts = validEndOptions(n);
      return opts.includes(prev) ? prev : (opts[opts.length - 1] ?? 2);
    });
  }, []);

  const scene = useMemo(() => {
    if (!rounds.length) return null;
    return buildBracketScene({ rounds, style, treeLayout });
  }, [rounds, style, treeLayout]);

  const startPairLabels = useMemo((): StartPairLabel[] => {
    if (!scene || !rounds.length || !showStartPairNumbers) return [];
    return buildStartPairLabels(scene, { rounds, style, treeLayout });
  }, [scene, rounds, style, treeLayout, showStartPairNumbers]);

  const firstRoundSlotToBoxIndex = useMemo(() => {
    if (!rounds.length) return null;
    return buildFirstRoundSlotToBoxIndex({ rounds, style, treeLayout });
  }, [rounds, style, treeLayout]);

  const previewPaper = useMemo(() => previewPaperFromPrintSettings(style, treeLayout), [style, treeLayout]);

  const updatePreviewScale = useCallback(() => {
    const { paperW, paperH } = previewPaper;
    const stage = previewStageRef.current;
    const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
    let vw: number;
    let vh: number;
    if (stage) {
      const cs = getComputedStyle(stage);
      const pl = Number.parseFloat(cs.paddingLeft) || 0;
      const pr = Number.parseFloat(cs.paddingRight) || 0;
      const pt = Number.parseFloat(cs.paddingTop) || 0;
      const pb = Number.parseFloat(cs.paddingBottom) || 0;
      vw = stage.clientWidth - pl - pr;
      vh = stage.clientHeight - pt - pb;
    } else if (vv) {
      vw = vv.width;
      vh = vv.height;
    } else {
      vw = window.innerWidth;
      vh = window.innerHeight;
    }
    /* 용지는 항상 가로 고정. 세로/가로 모두 단순 fitScale로 복구한다. */
    const fitScale = Math.min(vw / paperW, vh / paperH, 1);
    let s = fitScale;
    if (!(s > 0) || !Number.isFinite(s)) s = 0.1;
    setPreviewFitScale(s);
    setPreviewScale((prev) => {
      const clampedPrev = Math.max(s, Math.min(prev, 2));
      if (pinchActiveRef.current || clampedPrev > s + 0.001) return clampedPrev;
      return s;
    });
  }, [previewPaper]);

  const syncPreviewViewportScale = useCallback(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
    setPreviewViewportScale(vv?.scale ?? 1);
  }, []);

  useEffect(() => {
    const restoreDomStyles = () => {
      const snap = previewDomStyleSnapshotRef.current;
      if (!snap) return;
      document.body.style.transform = snap.bodyTransform;
      document.body.style.rotate = snap.bodyRotate;
      document.body.style.touchAction = snap.bodyTouchAction;
      document.documentElement.style.transform = snap.htmlTransform;
      document.documentElement.style.rotate = snap.htmlRotate;
      document.documentElement.style.touchAction = snap.htmlTouchAction;
      previewDomStyleSnapshotRef.current = null;
    };

    if (!previewOpen) {
      restoreDomStyles();
      return;
    }
    previewDomStyleSnapshotRef.current = {
      bodyOverflow: document.body.style.overflow,
      bodyTransform: document.body.style.transform,
      bodyRotate: document.body.style.rotate,
      bodyTouchAction: document.body.style.touchAction,
      htmlTransform: document.documentElement.style.transform,
      htmlRotate: document.documentElement.style.rotate,
      htmlTouchAction: document.documentElement.style.touchAction,
    };
    return restoreDomStyles;
  }, [previewOpen]);

  useLayoutEffect(() => {
    if (!previewOpen) return;
    updatePreviewScale();
    syncPreviewViewportScale();
  }, [previewOpen, previewPaper, syncPreviewViewportScale, updatePreviewScale]);

  useEffect(() => {
    if (!previewOpen) return;
    let orientTimer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      requestAnimationFrame(() => updatePreviewScale());
      requestAnimationFrame(() => syncPreviewViewportScale());
    };
    window.addEventListener("resize", run);
    const onOrientation = () => {
      if (orientTimer) clearTimeout(orientTimer);
      orientTimer = setTimeout(run, 150);
    };
    window.addEventListener("orientationchange", onOrientation);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", run);
    vv?.addEventListener("scroll", run);
    return () => {
      if (orientTimer) clearTimeout(orientTimer);
      window.removeEventListener("resize", run);
      window.removeEventListener("orientationchange", onOrientation);
      vv?.removeEventListener("resize", run);
      vv?.removeEventListener("scroll", run);
    };
  }, [previewOpen, syncPreviewViewportScale, updatePreviewScale]);

  useEffect(() => {
    if (pdfExporting) setPdfDownloadModalOpen(false);
  }, [pdfExporting]);

  useEffect(() => {
    if (!pdfDownloadUrl) setPdfDownloadModalOpen(false);
  }, [pdfDownloadUrl]);

  /** 페이지 내부 전용 레이어 미리보기: A4 한 장 전체 scale, 스크롤·스와이프 없음 */
  const handleOpenPreviewOverlay = useCallback(async () => {
    if (!rounds.length || !scene) return;
    if (variant === "tournament") {
      try {
        const names = await fetchTournamentApplicants();
        setTournamentApplicants(names);
      } catch {
        return;
      }
    }
    setPreviewScale(1);
    setPreviewOpen(true);
  }, [rounds.length, scene, variant, fetchTournamentApplicants]);

  const handleClosePreviewOverlay = useCallback(() => {
    setPreviewOpen(false);
    setPreviewScale(1);
    setPreviewFitScale(1);
    setPreviewViewportScale(1);
    pinchActiveRef.current = false;
    pinchStartDistanceRef.current = 0;
    pinchStartScaleRef.current = 1;
    const stage = previewStageRef.current;
    if (stage) {
      stage.scrollLeft = 0;
      stage.scrollTop = 0;
    }
    document.body.style.transform = "";
    document.body.style.rotate = "";
    document.body.style.touchAction = "";
    document.documentElement.style.transform = "";
    document.documentElement.style.rotate = "";
    document.documentElement.style.touchAction = "";
  }, []);

  useEffect(() => {
    return () => {
      if (pdfDownloadDoneTimerRef.current != null) {
        window.clearTimeout(pdfDownloadDoneTimerRef.current);
        pdfDownloadDoneTimerRef.current = null;
      }
      if (pdfDownloadUrlRef.current) {
        URL.revokeObjectURL(pdfDownloadUrlRef.current);
        pdfDownloadUrlRef.current = null;
      }
    };
  }, []);

  /** A4 가로 PDF — html2canvas 로 `.bbp-print-svg` 캡처 후 jsPDF 에 277×190mm 로 삽입 */
  const handleExportPDF = useCallback(async () => {
    if (variant !== "blank") return;
    if (pdfBusyRef.current) return;
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const root = pdfRootRef.current;
    console.info("[blank-bracket-print] PDF export click");
    if (!root) {
      console.error("[blank-bracket-print] PDF export aborted: root is null");
      return;
    }

    pdfBusyRef.current = true;
    setPdfExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      console.info("[blank-bracket-print] html2canvas start");
      const canvas = await html2canvas(root, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      console.info("[blank-bracket-print] html2canvas done", { width: canvas.width, height: canvas.height });

      const imgData = canvas.toDataURL("image/png");
      console.info("[blank-bracket-print] jsPDF create");
      const pdf = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });
      pdf.addImage(imgData, "PNG", MARGIN_MM, MARGIN_MM, 277, 190);
      const blob = pdf.output("blob");
      const nextUrl = URL.createObjectURL(blob);
      const nextName = `${startPlayers}${bracketPdfLayoutType(style)}daejinpyo${formatPdfDate(new Date())}.pdf`;
      if (pdfDownloadUrlRef.current) {
        URL.revokeObjectURL(pdfDownloadUrlRef.current);
      }
      pdfDownloadUrlRef.current = nextUrl;
      setPdfDownloadUrl(nextUrl);
      setPdfDownloadName(nextName);
      setPdfDownloadStatus("ready");
      setPdfDownloadModalOpen(true);
      console.info("[blank-bracket-print] PDF blob url ready");
    } catch (error) {
      console.error("[blank-bracket-print] PDF export failed", error);
      setPdfDownloadStatus("failed");
      throw error;
    } finally {
      pdfBusyRef.current = false;
      setPdfExporting(false);
    }
  }, [variant, startPlayers, style, warmEmptyBoxFill]);

  const runTournamentMultiPagePdf = useCallback(
    async (pageElements: HTMLElement[]) => {
      if (variant !== "tournament" || pdfBusyRef.current || !scene) return;
      pdfBusyRef.current = true;
      try {
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import("html2canvas"),
          import("jspdf"),
        ]);
        const pdf = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });
        for (let i = 0; i < pageElements.length; i++) {
          if (i > 0) pdf.addPage("a4", "l");
          const canvas = await html2canvas(pageElements[i], {
            scale: 3,
            backgroundColor: "#ffffff",
            useCORS: true,
            logging: false,
          });
          pdf.addImage(canvas.toDataURL("image/png"), "PNG", MARGIN_MM, MARGIN_MM, 277, 190);
        }
        const blob = pdf.output("blob");
        const nextUrl = URL.createObjectURL(blob);
        const tid = (tournamentId ?? "").trim() || "tournament";
        const nextName = `jochabyeol1cha_${tid}_${formatPdfDate(new Date())}.pdf`;
        if (pdfDownloadUrlRef.current) {
          URL.revokeObjectURL(pdfDownloadUrlRef.current);
        }
        pdfDownloadUrlRef.current = nextUrl;
        setPdfDownloadUrl(nextUrl);
        setPdfDownloadName(nextName);
        setPdfDownloadStatus("ready");
        setPdfDownloadModalOpen(true);
      } catch (error) {
        console.error("[tournament-group-bracket-print] PDF export failed", error);
        setPdfDownloadStatus("failed");
      } finally {
        pdfBusyRef.current = false;
        setPdfExporting(false);
        setTournamentPdfPages(null);
      }
    },
    [variant, scene, tournamentId],
  );

  useLayoutEffect(() => {
    if (variant !== "tournament" || !tournamentPdfPages?.length) return;
    if (!scene) {
      setTournamentPdfPages(null);
      setPdfExporting(false);
      return;
    }
    const root = offscreenTournamentRef.current;
    if (!root) {
      setTournamentPdfPages(null);
      setPdfExporting(false);
      return;
    }
    const els = [...root.querySelectorAll("[data-tg-pdf-page]")] as HTMLElement[];
    if (els.length !== tournamentPdfPages.length) {
      setTournamentPdfPages(null);
      setPdfExporting(false);
      return;
    }
    void runTournamentMultiPagePdf(els);
  }, [variant, tournamentPdfPages, scene, runTournamentMultiPagePdf]);

  const handleTournamentGroupPdf = useCallback(async () => {
    if (variant !== "tournament" || pdfBusyRef.current || !scene || !rounds.length) return;
    const tid = (tournamentId ?? "").trim();
    if (!tid) return;
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    setPdfExporting(true);
    try {
      const names = await fetchTournamentApplicants();
      setTournamentApplicants(names);
      const chunk = startPlayers;
      const pageCount = Math.max(1, Math.ceil(names.length / chunk));
      const pages: TournamentPdfPage[] = [];
      for (let p = 0; p < pageCount; p++) {
        const slice = names.slice(p * chunk, p * chunk + chunk);
        const slots: (string | null)[] = Array.from({ length: chunk }, (_, i) => {
          const v = slice[i];
          return v && v.trim() ? v.trim() : null;
        });
        pages.push({ label: groupLabel(p), slots });
      }
      setTournamentPdfPages(pages);
    } catch (error) {
      console.error("[tournament-group-bracket-print] prepare failed", error);
      setPdfExporting(false);
    }
  }, [variant, tournamentId, scene, rounds.length, startPlayers, fetchTournamentApplicants]);

  const handlePdfDownload = useCallback(() => {
    if (!pdfDownloadUrl) {
      console.warn("[blank-bracket-print] handlePdfDownload skipped: no pdfDownloadUrl");
      setPdfDownloadStatus("failed");
      return;
    }
    if (!pdfDownloadUrl.startsWith("blob:")) {
      console.warn("[blank-bracket-print] handlePdfDownload: unexpected href (not blob:)", pdfDownloadUrl.slice(0, 48));
    }
    try {
      if (pdfDownloadDoneTimerRef.current != null) {
        window.clearTimeout(pdfDownloadDoneTimerRef.current);
        pdfDownloadDoneTimerRef.current = null;
      }
      setPdfDownloadStatus("downloading");
      logCaromPdfBridgeProbe();

      const bridge = getCaromPdfDownloadBridge();
      if (bridge && pdfDownloadUrl.startsWith("blob:")) {
        console.info("[blank-bracket-print] handlePdfDownload: using Android bridge savePdfBase64", {
          fileName: pdfDownloadName,
        });
        void pdfBlobUrlToBase64(pdfDownloadUrl)
          .then(({ base64, blobSize }) => {
            console.info("[blank-bracket-print] before savePdfBase64", {
              fileName: pdfDownloadName,
              blobSize,
              base64Length: base64.length,
            });
            bridge.savePdfBase64(base64, pdfDownloadName);
            console.info("[blank-bracket-print] after savePdfBase64 (native returns void)", {
              fileName: pdfDownloadName,
              base64Length: base64.length,
            });
          })
          .catch((error) => {
            console.error("[blank-bracket-print] PDF blob→base64 failed", error);
            setPdfDownloadStatus("failed");
          });
        return;
      }

      console.info("[blank-bracket-print] handlePdfDownload: bridge absent or invalid — fallback <a download>", {
        name: pdfDownloadName,
        hrefPrefix: pdfDownloadUrl.slice(0, 24),
      });
      const a = document.createElement("a");
      a.href = pdfDownloadUrl;
      a.download = pdfDownloadName;
      a.setAttribute("download", pdfDownloadName);
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      window.setTimeout(() => {
        if (a.parentNode) a.remove();
      }, 250);
      pdfDownloadDoneTimerRef.current = window.setTimeout(() => {
        setPdfDownloadStatus("ready");
        pdfDownloadDoneTimerRef.current = null;
      }, 400);
    } catch (error) {
      console.error("[blank-bracket-print] PDF download failed", error);
      setPdfDownloadStatus("failed");
    }
  }, [pdfDownloadName, pdfDownloadUrl]);

  const handlePreviewTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 2) return;
    const distance = touchDistance(e.touches);
    if (!(distance > 0)) return;
    pinchActiveRef.current = true;
    pinchStartDistanceRef.current = distance;
    pinchStartScaleRef.current = previewScale;
  }, [previewScale]);

  const handlePreviewTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (!pinchActiveRef.current || e.touches.length !== 2) return;
    const distance = touchDistance(e.touches);
    if (!(distance > 0) || !(pinchStartDistanceRef.current > 0)) return;
    e.preventDefault();
    const ratio = distance / pinchStartDistanceRef.current;
    const nextScale = Math.max(previewFitScale, Math.min(pinchStartScaleRef.current * ratio, 2));
    setPreviewScale(nextScale);
  }, [previewFitScale]);

  const handlePreviewTouchEnd = useCallback(() => {
    pinchActiveRef.current = false;
    pinchStartDistanceRef.current = 0;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as Window & { __caromOnPdfSaved?: (ok: boolean) => void };
    w.__caromOnPdfSaved = (ok: boolean) => {
      if (pdfDownloadDoneTimerRef.current != null) {
        window.clearTimeout(pdfDownloadDoneTimerRef.current);
        pdfDownloadDoneTimerRef.current = null;
      }
      if (ok) {
        setPdfDownloadStatus("saved");
        pdfDownloadDoneTimerRef.current = window.setTimeout(() => {
          setPdfDownloadStatus("ready");
          pdfDownloadDoneTimerRef.current = null;
        }, 4000);
      } else {
        setPdfDownloadStatus("failed");
      }
    };
    return () => {
      delete w.__caromOnPdfSaved;
      if (pdfDownloadDoneTimerRef.current != null) {
        window.clearTimeout(pdfDownloadDoneTimerRef.current);
        pdfDownloadDoneTimerRef.current = null;
      }
    };
  }, []);

  const previewStageIsZoomed = previewScale > previewFitScale + 0.001;

  return (
    <>
      {/* html2canvas 캡처용 오프스크린 SVG — 본 페이지에서는 인쇄하지 않음 */}
      <style>{`
        @media screen {
          .bbp-print-svg {
            position: fixed;
            left: -10000px;
            top: 0;
            width: 277mm;
            height: 190mm;
            overflow: hidden;
            z-index: -1;
            pointer-events: none;
          }
        }
        .bbp-print-page-sheet {
          position: relative;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }
        @media screen {
          .tg-pdf-offscreen {
            position: fixed;
            left: -12000px;
            top: 0;
            width: 277mm;
            z-index: -1;
            pointer-events: none;
            overflow: hidden;
          }
        }
        .tg-pdf-offscreen .tg-pdf-page {
          position: relative;
          width: 277mm;
          height: 190mm;
          box-sizing: border-box;
          overflow: hidden;
          background: #fff;
        }
        .tg-pdf-group-title {
          position: absolute;
          top: 1.2mm;
          left: 0;
          right: 0;
          text-align: center;
          z-index: 6;
          margin: 0;
          padding: 0;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: 4.2mm;
          font-weight: 800;
          line-height: 1.1;
          color: #111827;
          letter-spacing: 0.04em;
          pointer-events: none;
          user-select: none;
        }
        .bbp-print-service-mark {
          position: absolute;
          top: ${SERVICE_MARK_TOP_MM}mm;
          right: ${SERVICE_MARK_INSET_MM}mm;
          z-index: 10;
          margin: 0;
          padding: 0;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: ${SERVICE_MARK_FONT_MM}mm;
          font-weight: 300;
          line-height: 1.2;
          color: #888888;
          letter-spacing: 0.02em;
          white-space: nowrap;
          pointer-events: none;
          user-select: none;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @media print {
          .bbp-print-service-mark {
            position: absolute;
            top: ${SERVICE_MARK_TOP_MM}mm;
            right: ${SERVICE_MARK_INSET_MM}mm;
          }
        }
        /* 빈 대진표 칸: 테두리는 항상 검정 — 배경만 .bbp-match-box--fill 에서 변경 */
        .bbp-match-box {
          fill: #ffffff;
          stroke: #000000;
          stroke-width: 0.2;
        }
        .bbp-match-box--fill {
          fill: #fffbe6;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .preview-overlay {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          box-sizing: border-box;
          font-family: system-ui, "Segoe UI", sans-serif;
          background: #e5e7eb;
          overflow: hidden;
          touch-action: auto;
          overscroll-behavior: contain;
        }
        .preview-overlay .preview-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 100dvh;
          max-height: 100dvh;
          background: #e5e7eb;
          overflow: hidden;
          box-sizing: border-box;
          touch-action: auto;
        }
        .preview-overlay .preview-topbar {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 10px;
          box-sizing: border-box;
          background: #e5e7eb;
        }
        .preview-overlay .preview-close-button {
          min-height: 44px;
          padding: 0 18px;
          font-size: 1rem;
          font-weight: 700;
          border: none;
          border-radius: 10px;
          background: #f59e0b;
          color: #111827;
          cursor: pointer;
        }
        /* 모바일에서는 수동 회전 계열 조작 버튼을 표시하지 않는다(자동 방향 대응 우선) */
        @media (max-width: 1024px) {
          .preview-overlay .preview-rotate-button,
          .preview-overlay [data-preview-rotate],
          .preview-overlay [aria-label*="회전"] {
            display: none !important;
          }
        }
        .preview-overlay .preview-stage {
          flex: 1 1 auto;
          min-height: 0;
          overflow: auto;
          display: block;
          padding: 0 max(16px, env(safe-area-inset-left, 0px)) calc(env(safe-area-inset-bottom, 0px) + 16px) max(16px, env(safe-area-inset-right, 0px));
          box-sizing: border-box;
          touch-action: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }
        .preview-overlay .paper-frame-slot {
          width: max-content;
          height: max-content;
          min-width: 100%;
          min-height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-sizing: border-box;
          touch-action: auto;
        }
        .preview-overlay .paper-frame {
          position: absolute;
          left: 0;
          top: 0;
          transform-origin: top left;
          will-change: transform;
          touch-action: auto;
        }
        .preview-overlay .paper {
          background: #ffffff;
          box-shadow: 0 10px 28px rgba(0,0,0,0.18);
          box-sizing: border-box;
          border-radius: 2px;
          padding: ${MARGIN_MM}mm;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          touch-action: auto;
        }
        .preview-overlay .bracket-scene {
          line-height: 0;
        }
      `}</style>

      {/* ── 설정 패널 ── */}
      <div
        className="bbp-no-print"
        style={{
          maxWidth: embedded ? "100%" : "min(100%,56rem)",
          margin: embedded ? 0 : "0 auto",
          padding: embedded ? "0 0 0.75rem 0" : "0 0.75rem 1.5rem",
        }}
      >
        <div className={embedded ? "v3-stack" : "v3-page v3-stack"} style={{ gap: "1rem", paddingTop: embedded ? 0 : "0.35rem" }}>
          <section className="v3-box v3-stack"
            style={{ gap: 0, border: "1px solid #d1d5db", borderRadius: "8px", padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "1rem 1rem 0.75rem", borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
              <h2 className="v3-h2" style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>설정</h2>
            </div>
            <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {/* 경기 유형 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>1. 경기 유형</span>
                <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
                  {(["NORMAL", "SCOTCH"] as MatchType[]).map(t => (
                    <label key={t} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", minHeight: "44px" }}>
                      <input type="radio" name="mt" checked={matchType === t} onChange={() => setMatchType(t)} />
                      {t === "NORMAL" ? "일반" : "스카치(2인 1조)"}
                    </label>
                  ))}
                </div>
              </div>
              {/* 강수 */}
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: "1 1 10rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>2. 시작 강수</span>
                  <select value={startPlayers} onChange={e => onStartChange(Number(e.target.value))}
                    style={{ padding: "0.5rem", fontSize: "1rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    {START_SIZES.map(s => <option key={s} value={s}>{roundLabel(s)}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: "1 1 10rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>3. 종료 강수</span>
                  <select value={endPlayers} onChange={e => setEndPlayers(Number(e.target.value))}
                    style={{ padding: "0.5rem", fontSize: "1rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    {endOptions.map(e => <option key={e} value={e}>{roundLabel(e)}</option>)}
                  </select>
                </label>
              </div>
              {/* 스타일 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>4. 스타일</span>
                <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
                  {(["TREE", "CENTER"] as BracketStyle[]).map(s => (
                    <label key={s} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", minHeight: "44px" }}>
                      <input type="radio" name="st" checked={style === s} onChange={() => setStyle(s)} />
                      {s === "TREE" ? "트리형" : "양쪽→중앙"}
                    </label>
                  ))}
                </div>
                {style === "TREE" && (
                  <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
                    {(["HORIZONTAL", "VERTICAL"] as TreeLayout[]).map(l => (
                      <label key={l} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", minHeight: "40px" }}>
                        <input type="radio" name="tl" checked={treeLayout === l} onChange={() => setTreeLayout(l)} />
                        {l === "HORIZONTAL" ? "가로형 (좌→우)" : "세로형 (아래→위)"}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", minHeight: "44px" }}>
                <input
                  type="checkbox"
                  checked={showStartPairNumbers}
                  onChange={(e) => setShowStartPairNumbers(e.target.checked)}
                />
                <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>조번호 표시</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", minHeight: "44px" }}>
                <input
                  type="checkbox"
                  checked={warmEmptyBoxFill}
                  onChange={(e) => setWarmEmptyBoxFill(e.target.checked)}
                />
                <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>빈 칸 배경색</span>
              </label>
            </div>
            <div style={{ padding: "1rem", borderTop: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="v3-btn"
                onClick={() => void handleOpenPreviewOverlay()}
                disabled={!rounds.length || !scene}
                style={{ padding: "0.55rem 1rem", minHeight: "44px" }}
              >
                미리보기
              </button>
              {variant === "blank" ? (
                <button
                  type="button"
                  className="ui-btn-primary-solid"
                  disabled={!rounds.length || !scene || pdfExporting}
                  onClick={() => void handleExportPDF()}
                  style={{ padding: "0.55rem 1rem", minHeight: "44px" }}
                >
                  {pdfExporting ? "PDF 생성 중…" : "PDF 생성"}
                </button>
              ) : (
                <button
                  type="button"
                  className="ui-btn-primary-solid"
                  disabled={!rounds.length || !scene || pdfExporting}
                  onClick={() => void handleTournamentGroupPdf()}
                  style={{ padding: "0.55rem 1rem", minHeight: "44px" }}
                >
                  {pdfExporting ? "PDF 생성 중…" : "조별 1차 대진표 인쇄"}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* html2canvas·새창 미리보기 공용: 277×190mm SVG (화면 밖) — 빈 대진표 단일 페이지만 */}
      {scene && variant === "blank" ? (
        <div ref={pdfRootRef} className="bbp-print-svg" id="bbp-print-svg-root">
          <div className="bbp-print-page-sheet">
            <BracketSVG
              scene={scene}
              matchType={matchType}
              startPairLabels={startPairLabels}
              warmEmptyBoxFill={warmEmptyBoxFill}
            />
            <BracketPrintServiceMark />
          </div>
        </div>
      ) : null}

      {variant === "tournament" && tournamentPdfPages && scene ? (
        <div ref={offscreenTournamentRef} className="tg-pdf-offscreen" aria-hidden>
          {tournamentPdfPages.map((page, idx) => (
            <div key={`${page.label}-${idx}`} className="tg-pdf-page" data-tg-pdf-page={String(idx)}>
              <p className="tg-pdf-group-title">{page.label}</p>
              <BracketSVG
                scene={scene}
                matchType={matchType}
                startPairLabels={startPairLabels}
                warmEmptyBoxFill={warmEmptyBoxFill}
                firstRoundNameSlots={page.slots}
                firstRoundSlotToBoxIndex={firstRoundSlotToBoxIndex}
              />
              <BracketPrintServiceMark />
            </div>
          ))}
        </div>
      ) : null}

      {previewOpen && scene && typeof document !== "undefined"
        ? createPortal(
            <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="빈 대진표 미리보기">
              <div className="preview-root">
                <div className="preview-topbar" ref={previewTopbarRef}>
                  <button type="button" className="preview-close-button" onClick={handleClosePreviewOverlay}>
                    닫기
                  </button>
                </div>
                <div
                  className="preview-stage"
                  ref={previewStageRef}
                  onTouchStart={handlePreviewTouchStart}
                  onTouchMove={handlePreviewTouchMove}
                  onTouchEnd={handlePreviewTouchEnd}
                  onTouchCancel={handlePreviewTouchEnd}
                  style={{
                    overflow: previewStageIsZoomed ? "auto" : "hidden",
                    touchAction: previewStageIsZoomed ? "pan-x pan-y pinch-zoom" : "none",
                  }}
                >
                  <div
                    className="paper-frame-slot"
                    style={{
                      width: previewPaper.paperW * previewScale,
                      height: previewPaper.paperH * previewScale,
                    }}
                  >
                    <div
                      className="paper-frame"
                      style={{
                        width: previewPaper.paperW,
                        height: previewPaper.paperH,
                        left: 0,
                        top: 0,
                        marginLeft: 0,
                        marginTop: 0,
                        transform: `scale(${previewScale})`,
                        transformOrigin: "top left",
                      }}
                    >
                    <div
                      className="paper"
                      style={{ width: previewPaper.paperW, height: previewPaper.paperH }}
                    >
                      <div className="bracket-scene">
                        <div className="bbp-print-page-sheet">
                          <BracketSVG
                            scene={scene}
                            matchType={matchType}
                            startPairLabels={startPairLabels}
                            warmEmptyBoxFill={warmEmptyBoxFill}
                            firstRoundNameSlots={variant === "tournament" ? previewTournamentFirstRoundSlots : null}
                            firstRoundSlotToBoxIndex={variant === "tournament" ? firstRoundSlotToBoxIndex : null}
                          />
                          <BracketPrintServiceMark />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {pdfDownloadModalOpen && pdfDownloadUrl && typeof document !== "undefined"
        ? createPortal(
            <div
              role="presentation"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2147483647,
                background: "rgba(15, 23, 42, 0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
                boxSizing: "border-box",
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="bbp-pdf-download-modal-title"
                style={{
                  width: "100%",
                  maxWidth: "22rem",
                  background: "#fff",
                  borderRadius: "12px",
                  padding: "1.1rem 1.15rem",
                  boxShadow: "0 16px 48px rgba(0,0,0,0.22)",
                  boxSizing: "border-box",
                }}
              >
                <h2 id="bbp-pdf-download-modal-title" style={{ margin: "0 0 0.65rem", fontSize: "1.05rem", fontWeight: 800 }}>
                  PDF 다운로드
                </h2>
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", lineHeight: 1.45, color: "#334155" }}>
                  PDF는 기기의 <strong>다운로드</strong> 폴더(또는 브라우저가 안내하는 저장 위치)에 저장됩니다.
                </p>
                <p style={{ margin: "0 0 1rem", fontSize: "0.88rem", lineHeight: 1.45, color: "#475569" }}>
                  파일명: <strong style={{ wordBreak: "break-all" }}>{pdfDownloadName}</strong>
                </p>
                <p style={{ margin: "0 0 1.1rem", fontSize: "0.85rem", color: "#64748b" }}>
                  확인을 누르면 다운로드가 시작됩니다.
                </p>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="v3-btn"
                    onClick={() => setPdfDownloadModalOpen(false)}
                    style={{ minHeight: "44px", padding: "0.55rem 1rem" }}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="ui-btn-primary-solid"
                    onClick={() => {
                      setPdfDownloadModalOpen(false);
                      handlePdfDownload();
                    }}
                    style={{ minHeight: "44px", padding: "0.55rem 1rem" }}
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
