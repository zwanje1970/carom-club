"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function FindIdPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [maskedLoginId, setMaskedLoginId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setMaskedLoginId(null);
    try {
      const res = await fetch("/api/auth/find-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; maskedLoginId?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "정보 없음");
        return;
      }
      if (data.ok && typeof data.maskedLoginId === "string") {
        setMaskedLoginId(data.maskedLoginId);
      }
    } catch {
      setError("실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "30rem", margin: "0 auto" }}>
      <h1 className="v3-h1">아이디 찾기</h1>
      <p className="v3-muted">가입 시 등록한 전화번호를 입력해 주세요.</p>

      <form className="v3-box v3-stack" onSubmit={handleSubmit}>
        <label className="v3-stack">
          <span>전화번호</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="01012345678 또는 하이픈 포함"
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <button type="submit" className="v3-btn" disabled={loading} style={{ padding: "0.7rem 1rem" }}>
          {loading ? "확인 중..." : "확인"}
        </button>
      </form>

      {maskedLoginId ? (
        <p className="v3-box" style={{ background: "#f0fdf4", borderColor: "#86efac" }}>
          아이디: <strong>{maskedLoginId}</strong>
        </p>
      ) : null}
      {error ? <p className="v3-muted" style={{ color: "#b91c1c" }}>{error}</p> : null}

      <div className="v3-row">
        <Link className="v3-btn" href="/login">
          로그인
        </Link>
        <Link className="v3-btn" href="/account/reset-password">
          비밀번호 찾기
        </Link>
      </div>
    </main>
  );
}
