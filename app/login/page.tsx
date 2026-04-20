"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import type { AuthRole } from "../../lib/auth/roles";

function safeNextPath(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  try {
    const n = decodeURIComponent(raw.trim());
    if (!n.startsWith("/") || n.startsWith("//")) return null;
    if (n.includes("://")) return null;
    return n || "/";
  } catch {
    return null;
  }
}

function defaultPathAfterLogin(role: AuthRole): string {
  if (role === "PLATFORM") return "/platform";
  if (role === "CLIENT") return "/client";
  return "/";
}

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("reset") === "1") {
      setResetDone(true);
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
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
          rememberMe,
        }),
      });

      const body = (await response.json()) as {
        error?: string;
        user?: { role?: AuthRole };
      };
      if (!response.ok) {
        setMessage(body.error ?? "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      const role: AuthRole =
        body.user?.role === "PLATFORM" || body.user?.role === "CLIENT" || body.user?.role === "USER"
          ? body.user.role
          : "USER";

      let nextPath: string | null = null;
      if (typeof window !== "undefined") {
        nextPath = safeNextPath(new URLSearchParams(window.location.search).get("next"));
      }

      let dest: string;
      if (nextPath && nextPath !== "/login") {
        dest = nextPath;
      } else {
        dest = defaultPathAfterLogin(role);
      }

      router.push(dest);
      router.refresh();
    } catch {
      setMessage("로그인 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    setMessage("");

    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      router.refresh();
    } catch {
      setMessage("세션 정리에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "30rem", margin: "0 auto" }}>
      <h1 className="v3-h1">로그인</h1>

      {resetDone ? (
        <p className="v3-box" style={{ background: "#f0fdf4", borderColor: "#86efac", marginBottom: 0 }}>
          변경 완료
        </p>
      ) : null}

      <form className="v3-box v3-stack" onSubmit={handleLogin}>
        <label className="v3-stack">
          <span>아이디</span>
          <input
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            placeholder="아이디 입력"
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

        <label className="v3-row" style={{ alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
          <span>자동로그인</span>
        </label>

        <button
          type="submit"
          className="v3-btn v3-btn--login-submit"
          disabled={loading}
          style={{ padding: "0.7rem 1rem" }}
        >
          {loading ? "처리 중..." : "로그인"}
        </button>

        <button
          type="button"
          className="v3-btn"
          disabled={loading}
          onClick={handleLogout}
          style={{ padding: "0.7rem 1rem", background: "#fff7ed", borderColor: "#f4b183" }}
        >
          로그아웃
        </button>
      </form>

      {message ? <p className="v3-muted">{message}</p> : null}

      <p className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
        <Link className="v3-muted" href="/account/find-id" style={{ fontSize: "0.95rem" }}>
          아이디 찾기
        </Link>
        <span className="v3-muted" style={{ opacity: 0.5 }}>
          |
        </span>
        <Link className="v3-muted" href="/account/reset-password" style={{ fontSize: "0.95rem" }}>
          비밀번호 찾기
        </Link>
      </p>

      <div className="v3-row">
        <Link className="v3-btn" href="/signup">
          회원가입
        </Link>
        <Link className="v3-btn" href="/">
          홈으로
        </Link>
      </div>
    </main>
  );
}
