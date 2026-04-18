"use client";

type Props = {
  /** 저장값(숫자가 있으면 화면·복사 모두 숫자만 사용) — "은행 · 계좌 · 예금주" 형태 권장 */
  accountNumber: string;
};

/** 중점·파이프 등으로 나뉜 경우 은행·예금주 추출 (계좌는 숫자만 별도 표시) */
function parseBankAndHolder(raw: string): { bank: string | null; holder: string | null; restLabel: string | null } {
  const t = raw.trim();
  const parts = t.split(/[·｜|]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      bank: parts[0] || null,
      holder: parts.slice(2).join(" · ") || null,
      restLabel: null,
    };
  }
  if (parts.length === 2) {
    const a = parts[0];
    const b = parts[1];
    const da = a.replace(/\D/g, "");
    const db = b.replace(/\D/g, "");
    if (da.length >= 8 && db.length === 0) {
      return { bank: null, holder: b, restLabel: null };
    }
    if (db.length >= 8 && da.length === 0) {
      return { bank: a, holder: null, restLabel: null };
    }
  }
  const withoutDigits = t.replace(/\d/g, "").replace(/[-\s·｜|/]+/g, " ").trim();
  return {
    bank: null,
    holder: null,
    restLabel: withoutDigits.length > 0 ? withoutDigits : null,
  };
}

export default function AccountNumberCopyInline({ accountNumber }: Props) {
  const text = accountNumber.trim();
  /** 숫자만 (하이픈·공백·기타 제외) — 복사·표시 동일 */
  const digitsOnly = text.replace(/\D/g, "");
  const { bank, holder, restLabel } = parseBankAndHolder(text);

  async function handleCopy() {
    if (!digitsOnly) {
      window.alert("복사할 숫자가 없습니다.");
      return;
    }
    try {
      await navigator.clipboard.writeText(digitsOnly);
      window.alert("계좌번호가 복사되었습니다.");
    } catch {
      window.alert("복사에 실패했습니다.");
    }
  }

  const tailParts = [bank, holder].filter(Boolean) as string[];
  const tailText = tailParts.length > 0 ? tailParts.join(" · ") : restLabel;

  return (
    <div
      className="v3-row"
      style={{
        alignItems: "center",
        gap: "0.5rem",
        flexWrap: "wrap",
        margin: 0,
      }}
    >
      <span style={{ whiteSpace: "pre-wrap" }}>{digitsOnly.length > 0 ? digitsOnly : text}</span>
      <button
        type="button"
        className="v3-btn"
        onClick={() => void handleCopy()}
        style={{
          padding: "0.35rem 0.55rem",
          fontSize: "0.82rem",
          flexShrink: 0,
          lineHeight: 1.2,
        }}
      >
        복사
      </button>
      {tailText ? (
        <span className="v3-muted" style={{ whiteSpace: "pre-wrap" }}>
          {tailText}
        </span>
      ) : null}
    </div>
  );
}
