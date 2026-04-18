"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Step = 1 | 2;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loginId, setLoginId] = useState("");
  const [phone, setPhone] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/auth/recovery/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: loginId.trim(),
          phone: phone.trim(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; resetToken?: string; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "정보 없음");
        return;
      }
      if (data.resetToken) {
        setResetToken(data.resetToken);
        setStep(2);
      }
    } catch {
      setMessage("실패");
    } finally {
      setLoading(false);
    }
  }

  async function handleNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (newPassword !== newPassword2) {
      setMessage("실패");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/auth/recovery/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, newPassword, newPassword2 }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "실패");
        return;
      }
      router.push("/login?reset=1");
      router.refresh();
    } catch {
      setMessage("실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "30rem", margin: "0 auto" }}>
      <h1 className="v3-h1">비밀번호 찾기</h1>
      <p className="v3-muted">아이디와 전화번호를 입력해 주세요.</p>

      {step === 1 ? (
        <form className="v3-box v3-stack" onSubmit={handleIdentity}>
          <label className="v3-stack">
            <span>아이디</span>
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
              style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
            />
          </label>
          <label className="v3-stack">
            <span>전화번호</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
            />
          </label>
          <button type="submit" className="v3-btn" disabled={loading} style={{ padding: "0.7rem 1rem" }}>
            {loading ? "확인 중..." : "다음"}
          </button>
        </form>
      ) : null}

      {step === 2 ? (
        <form className="v3-box v3-stack" onSubmit={handleNewPassword}>
          <label className="v3-stack">
            <span>새 비밀번호</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
            />
          </label>
          <label className="v3-stack">
            <span>비밀번호 확인</span>
            <input
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              autoComplete="new-password"
              style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
            />
          </label>
          <button type="submit" className="v3-btn" disabled={loading} style={{ padding: "0.7rem 1rem" }}>
            {loading ? "저장 중..." : "저장"}
          </button>
          <button
            type="button"
            className="v3-btn"
            style={{ background: "#f3f4f6" }}
            onClick={() => {
              setStep(1);
              setResetToken("");
              setMessage("");
            }}
          >
            이전
          </button>
        </form>
      ) : null}

      {message ? <p className="v3-muted" style={{ color: "#b91c1c" }}>{message}</p> : null}

      <div className="v3-row">
        <Link className="v3-btn" href="/login">
          로그인
        </Link>
        <Link className="v3-btn" href="/account/find-id">
          아이디 찾기
        </Link>
      </div>
    </main>
  );
}
