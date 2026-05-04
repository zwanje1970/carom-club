"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ClientDashboardGateJson = {
  hasOrgSetup: boolean;
  hasAnyTournament: boolean;
  firstTournamentId: string;
  hasPublishedCard: boolean;
};

type GateState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ClientDashboardGateJson };

async function fetchDashboardGate(): Promise<
  | { ok: true; data: ClientDashboardGateJson }
  | { ok: false; message: string }
> {
  try {
    const res = await fetch("/api/client/dashboard-gate", { credentials: "same-origin" });
    const json = (await res.json()) as ClientDashboardGateJson | { ok: false; error?: string };
    if (!res.ok || ("ok" in json && json.ok === false)) {
      return {
        ok: false,
        message:
          typeof (json as { error?: string }).error === "string"
            ? (json as { error: string }).error
            : "대시보드 상태를 확인하지 못했습니다.",
      };
    }
    return { ok: true, data: json as ClientDashboardGateJson };
  } catch {
    return { ok: false, message: "네트워크 오류로 확인하지 못했습니다." };
  }
}

function resolveGateCta(data: ClientDashboardGateJson): {
  message: string;
  buttonLabel: string;
  href: string;
} {
  const firstTournamentId = data.firstTournamentId.trim();
  if (!data.hasOrgSetup) {
    return {
      message: "업체설정이 필요합니다.",
      buttonLabel: "업체설정으로 이동",
      href: "/client/setup",
    };
  }
  if (!data.hasAnyTournament) {
    return {
      message: "첫 대회를 생성하세요.",
      buttonLabel: "대회 생성으로 이동",
      href: "/client/tournaments/new",
    };
  }
  if (!data.hasPublishedCard) {
    return {
      message: "대회카드를 게시하세요.",
      buttonLabel: "해당 대회 게시카드 작성/수정으로 이동",
      href: firstTournamentId
        ? `/client/tournaments/${encodeURIComponent(firstTournamentId)}/card-publish-v2`
        : "/client/tournaments/new",
    };
  }
  return {
    message: "대회관리를 시작하세요.",
    buttonLabel: "해당 대회 관리로 이동",
    href: firstTournamentId ? `/client/tournaments/${encodeURIComponent(firstTournamentId)}` : "/client/tournaments",
  };
}

export default function ClientDashboardGateClient() {
  const [state, setState] = useState<GateState>({ status: "loading" });
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const result = await fetchDashboardGate();
      if (!alive) return;
      if (result.ok) {
        setState({ status: "ready", data: result.data });
      } else {
        setState({ status: "error", message: result.message });
      }
    })();
    return () => {
      alive = false;
    };
  }, [requestKey]);

  if (state.status === "loading") {
    return (
      <section className="v3-box v3-stack" style={{ gap: "0.9rem", padding: "1rem" }}>
        <p className="v3-muted" style={{ margin: 0 }}>
          대시보드 상태를 확인하고 있습니다.
        </p>
        <button type="button" className="v3-btn" disabled>
          확인 중
        </button>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="v3-box v3-stack" style={{ gap: "0.9rem", padding: "1rem" }}>
        <p className="v3-muted" style={{ margin: 0 }}>
          {state.message}
        </p>
        <button
          type="button"
          className="v3-btn"
          onClick={() => {
            setState({ status: "loading" });
            setRequestKey((value) => value + 1);
          }}
        >
          다시 시도
        </button>
      </section>
    );
  }

  const cta = resolveGateCta(state.data);
  return (
    <section className="v3-box v3-stack" style={{ gap: "0.9rem", padding: "1rem" }}>
      <p className="v3-muted" style={{ margin: 0 }}>
        {cta.message}
      </p>
      <Link className="v3-btn" href={cta.href} prefetch={false}>
        {cta.buttonLabel}
      </Link>
    </section>
  );
}
