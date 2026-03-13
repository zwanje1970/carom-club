"use client";

/**
 * 루트 레벨에서 발생한 에러를 잡아서 표시.
 * (개발 시 500 원인 확인용으로 에러 메시지를 보여줌)
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>오류가 발생했습니다</h1>
        <pre
          style={{
            padding: "1rem",
            background: "#f5f5f5",
            borderRadius: "8px",
            overflow: "auto",
            fontSize: "0.875rem",
            marginBottom: "1rem",
          }}
        >
          {error.message}
        </pre>
        {error.digest && (
          <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
            digest: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "0.5rem 1rem",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
