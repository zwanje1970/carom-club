"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameMessage, setNicknameMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pushMarketingAgreed, setPushMarketingAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!pushMarketingAgreed) {
      setMessage("대회 안내 및 이벤트 알림 수신에 동의해 주세요.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, nickname, name, email, phone, password, pushMarketingAgreed }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "회원가입에 실패했습니다.");
        return;
      }
      setMessage("회원가입이 완료되었습니다. 로그인 화면으로 이동합니다.");
      setTimeout(() => {
        router.push("/login");
      }, 500);
    } catch {
      setMessage("회원가입 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "30rem", margin: "0 auto" }}>
      <h1 className="v3-h1">회원가입</h1>
      <p className="v3-muted">아이디와 비밀번호로 계정을 생성합니다. 이메일과 전화번호는 부가 정보입니다.</p>

      <form className="v3-box v3-stack" onSubmit={handleSignup}>
        <label className="v3-stack">
          <span>아이디</span>
          <input
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            placeholder="아이디"
            autoComplete="username"
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>닉네임 (2~12자)</span>
          <input
            value={nickname}
            onChange={(event) => {
              setNickname(event.target.value);
              setNicknameMessage("");
            }}
            onBlur={async () => {
              const trimmed = nickname.trim();
              if (!trimmed) {
                setNicknameMessage("");
                return;
              }
              try {
                const q = encodeURIComponent(nickname);
                const response = await fetch(`/api/auth/check-nickname?nickname=${q}`);
                const data = (await response.json()) as { available?: boolean; error?: string };
                if (!response.ok || !data.available) {
                  setNicknameMessage(data.error === "이미 사용중" ? "이미 사용중" : data.error ?? "");
                  return;
                }
                setNicknameMessage("");
              } catch {
                setNicknameMessage("");
              }
            }}
            placeholder="닉네임"
            autoComplete="nickname"
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
          {nicknameMessage ? <span className="v3-muted">{nicknameMessage}</span> : null}
        </label>
        <label className="v3-stack">
          <span>이름</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="이름"
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>이메일 (선택)</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="example@email.com"
            autoComplete="email"
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>전화번호 (선택)</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="010-0000-0000"
            autoComplete="tel"
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호"
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-row" style={{ alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            required
            checked={pushMarketingAgreed}
            onChange={(event) => setPushMarketingAgreed(event.target.checked)}
          />
          <span>대회 안내 및 이벤트 알림 수신 동의 (필수)</span>
        </label>
        <button type="submit" className="v3-btn" disabled={loading} style={{ padding: "0.7rem 1rem" }}>
          {loading ? "처리 중..." : "회원가입"}
        </button>
      </form>

      {message ? <p className="v3-muted">{message}</p> : null}

      <div className="v3-row">
        <Link className="v3-btn" href="/login">
          로그인으로
        </Link>
        <Link className="v3-btn" href="/">
          홈으로
        </Link>
      </div>
    </main>
  );
}
