"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAuthSessionCached } from "../../../lib/client/auth-session-fetch-cache";
import type { SiteCommunityBoardKey } from "../../../lib/types/entities";
import { logCommunityListLoadDiagPhase } from "../../../lib/site/community-load-diag";
import { communityBoardListHref } from "./community-tab-config";

type Props = {
  boardType: SiteCommunityBoardKey;
  isNoticeBoard: boolean;
};

export default function CommunityWriteFabClient({ boardType, isNoticeBoard }: Props) {
  const [showWriteFab, setShowWriteFab] = useState(false);

  useEffect(() => {
    let cancelled = false;
    logCommunityListLoadDiagPhase("auth-check-start", { boardType });
    void (async () => {
      try {
        const session = await fetchAuthSessionCached();
        if (cancelled) return;
        logCommunityListLoadDiagPhase("auth-check-done", {
          boardType,
          authenticated: Boolean(session.authenticated),
        });
        logCommunityListLoadDiagPhase("profile-check-start", { boardType });
        const role = session.user?.role;
        if (cancelled) return;
        logCommunityListLoadDiagPhase("profile-check-done", { boardType, role: role ?? null });
        setShowWriteFab(!isNoticeBoard || role === "PLATFORM");
      } catch {
        if (!cancelled) setShowWriteFab(false);
        logCommunityListLoadDiagPhase("profile-check-done", { boardType, error: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardType, isNoticeBoard]);

  if (!showWriteFab) return null;

  return (
    <Link
      prefetch={false}
      href={`${communityBoardListHref(boardType)}/write`}
      className="community-write-fab"
      aria-label={`${boardType} 글쓰기`}
    >
      <span aria-hidden>+</span>
    </Link>
  );
}
