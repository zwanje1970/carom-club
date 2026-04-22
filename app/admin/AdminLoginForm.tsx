"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginResponse = {
  error?: string;
  user?: {
    role?: "USER" | "CLIENT" | "PLATFORM";
  };
};

export default function AdminLoginForm() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: loginId.trim(),
          password: password.trim(),
        }),
      });

      const result = (await response.json()) as LoginResponse;
      if (!response.ok) {
        setMessage(result.error ?? "로그인에 실패했습니다.");
        return;
      }

      if (result.user?.role !== "PLATFORM") {
        await fetch("/api/auth/session", { method: "DELETE" });
        setMessage("플랫폼 관리자 권한이 없습니다.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setMessage("로그인 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="v3-box v3-stack" onSubmit={handleSubmit}>
      <label className="v3-stack">
        <span>아이디</span>
        <input
          value={loginId}
          onChange={(event) => setLoginId(event.target.value)}
          placeholder="admin"
          autoComplete="username"
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
      <button type="submit" className="v3-btn" disabled={loading} style={{ padding: "0.7rem 1rem" }}>
        {loading ? "처리 중..." : "로그인"}
      </button>
      {message ? <p className="v3-muted">{message}</p> : null}
    </form>
  );
}
