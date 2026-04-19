"use client";

function IconPdf() {
  return (
    <svg width="48" height="56" viewBox="0 0 48 56" aria-hidden>
      <rect x="4" y="2" width="40" height="52" rx="4" fill="#fef2f2" stroke="#f87171" strokeWidth="1.5" />
      <path d="M14 18h20M14 26h20M14 34h14" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
      <text x="24" y="48" textAnchor="middle" fontSize="9" fontWeight="700" fill="#b91c1c">
        PDF
      </text>
    </svg>
  );
}

function IconDocx() {
  return (
    <svg width="48" height="56" viewBox="0 0 48 56" aria-hidden>
      <rect x="4" y="2" width="40" height="52" rx="4" fill="#eff6ff" stroke="#60a5fa" strokeWidth="1.5" />
      <path d="M14 16h20M14 24h20M14 32h16" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
      <text x="24" y="48" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1d4ed8">
        DOCX
      </text>
    </svg>
  );
}

type Props = {
  url: string;
  fileKind: "pdf" | "docx";
  caption: string;
};

export default function SiteOutlineDocumentCard({ url, fileKind, caption }: Props) {
  return (
    <button
      type="button"
      aria-label={`${caption} — 새 탭에서 열기`}
      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
      style={{
        display: "block",
        maxWidth: "320px",
        width: "100%",
        padding: "0.65rem 0.75rem",
        borderRadius: "0.5rem",
        border: "1px solid #e2e8f0",
        background: "#fff",
        cursor: "pointer",
        textAlign: "left",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
        <div style={{ flexShrink: 0, lineHeight: 0 }}>{fileKind === "pdf" ? <IconPdf /> : <IconDocx />}</div>
        <div className="v3-stack" style={{ gap: "0.2rem", minWidth: 0 }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>
            {fileKind === "pdf" ? "PDF" : "DOCX"}
          </span>
          <span style={{ fontSize: "0.92rem", fontWeight: 600, color: "#0f172a" }}>{caption}</span>
        </div>
      </div>
    </button>
  );
}
