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

/** `next`에 붙은 `?…`·`#…` 제거 — 미들웨어가 `pathname+search`로 넘기면 경로만 비교해야 함 */
function pathOnly(href: string): string {
  const q = href.indexOf("?");
  const h = href.indexOf("#");
  let end = href.length;
  if (q >= 0) end = Math.min(end, q);
  if (h >= 0) end = Math.min(end, h);
  return href.slice(0, end);
}

function defaultPathAfterLogin(role: AuthRole): string {
  if (role === "PLATFORM") return "/platform";
  if (role === "CLIENT") return "/client";
  return "/";
}

/** 일반 회원: 로그인 직후 마이페이지·공개 홈으로만 보내지 않고 루트 메인(`/`)으로 통일 */
function resolveUserPostLoginDest(dest: string): string {
  const p = pathOnly(dest);
  if (p === "/" || p === "/site" || p.startsWith("/site/mypage")) {
    return "/";
  }
  return dest;
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
      if (role === "USER") {
        dest = resolveUserPostLoginDest(dest);
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
    <main className="v3-page v3-stack login-page-outer">
      <div className="login-page-inner v3-stack">
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
      </div>
    </main>
  );
}
