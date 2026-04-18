"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";
type RequestedType = "GENERAL" | "REGISTERED";

type ClientApplicationResponse = {
  user: {
    id: string;
    name: string;
    role: "USER" | "CLIENT" | "PLATFORM";
    email: string | null;
    phone: string | null;
    clientStatus: ApplicationStatus | null;
  };
  application: {
    id: string;
    organizationName: string;
    contactName: string;
    contactPhone: string;
    requestedClientType: RequestedType;
    status: ApplicationStatus;
    createdAt: string;
  } | null;
};

export default function ClientApplyPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [requestedClientType, setRequestedClientType] = useState<RequestedType>("GENERAL");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [snapshot, setSnapshot] = useState<ClientApplicationResponse | null>(null);

  async function loadSnapshot() {
    try {
      const response = await fetch("/api/client-application");
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as ClientApplicationResponse;
      setSnapshot(data);
    } catch {}
  }

  useEffect(() => {
    void loadSnapshot();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/client-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName,
          contactName,
          contactPhone,
          requestedClientType,
        }),
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "신청 저장에 실패했습니다.");
        return;
      }

      setMessage("클라이언트 신청이 저장되었습니다. 승인 대기 화면으로 이동합니다.");
      await loadSnapshot();
      setTimeout(() => {
        router.push("/client-status/pending");
        router.refresh();
      }, 500);
    } catch {
      setMessage("신청 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "34rem", margin: "0 auto" }}>
      <h1 className="v3-h1">클라이언트 신청</h1>
      <p className="v3-muted">일반회원 계정으로 먼저 가입한 뒤, 클라이언트 신청을 제출하는 최소 흐름입니다.</p>

      <section className="v3-box v3-stack">
        <p>현재 계정: {snapshot?.user.name ?? "-"}</p>
        <p>현재 역할: {snapshot?.user.role ?? "-"}</p>
        <p>현재 신청 상태: {snapshot?.user.clientStatus ?? "신청 전"}</p>
      </section>

      <form className="v3-box v3-stack" onSubmit={handleSubmit}>
        <label className="v3-stack">
          <span>신청 유형</span>
          <select
            value={requestedClientType}
            onChange={(event) => setRequestedClientType(event.target.value === "REGISTERED" ? "REGISTERED" : "GENERAL")}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          >
            <option value="GENERAL">일반</option>
            <option value="REGISTERED">연회원 신청</option>
          </select>
        </label>
        <label className="v3-stack">
          <span>조직명</span>
          <input
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder="예: 캐롬클럽 서울점"
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>담당자명</span>
          <input
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="예: 홍길동"
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>담당자 연락처</span>
          <input
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="예: 010-0000-0000"
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <button type="submit" className="v3-btn" disabled={loading} style={{ padding: "0.7rem 1rem" }}>
          {loading ? "처리 중..." : "클라이언트 신청 제출"}
        </button>
      </form>

      {message ? <p className="v3-muted">{message}</p> : null}

      <div className="v3-row">
        <Link className="v3-btn" href="/">
          홈으로
        </Link>
        <Link className="v3-btn" href="/client-status/pending">
          승인 대기 화면
        </Link>
      </div>
    </main>
  );
}
