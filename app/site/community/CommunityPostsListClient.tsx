"use client";

import { useEffect, useRef, useState } from "react";
import type { CommunityPostListItem, SiteCommunityBoardKey, SiteCommunityConfig } from "../../../lib/types/entities";
import { logCommunityListLoadDiagPhase } from "../../../lib/site/community-load-diag";
import SiteDetailShellBodyLoader from "../components/SiteDetailShellBodyLoader";
import CommunityBoardPostList from "./CommunityBoardPostList";

type Props = {
  scope: "all" | SiteCommunityBoardKey;
  config: SiteCommunityConfig;
  query?: string;
  showRoomPrefix: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
  onItemsLoaded?: (count: number) => void;
};

export default function CommunityPostsListClient({
  scope,
  config,
  query = "",
  showRoomPrefix,
  emptyTitle,
  emptyDesc,
  onItemsLoaded,
}: Props) {
  const [items, setItems] = useState<CommunityPostListItem[] | null>(null);
  const onItemsLoadedRef = useRef(onItemsLoaded);
  onItemsLoadedRef.current = onItemsLoaded;

  useEffect(() => {
    logCommunityListLoadDiagPhase("list-client-mounted", { scope });
    let cancelled = false;
    const params = new URLSearchParams();
    if (scope === "all") {
      params.set("scope", "all");
    } else {
      params.set("boardType", scope);
    }
    if (query) params.set("q", query);

    void (async () => {
      logCommunityListLoadDiagPhase("posts-request-start", { scope, origin: "client" });
      try {
        const res = await fetch(`/api/site/community/public-posts?${params.toString()}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = (await res.json()) as { items?: CommunityPostListItem[] };
        const nextItems = Array.isArray(data.items) ? data.items : [];
        logCommunityListLoadDiagPhase("posts-response-done", {
          scope,
          origin: "client",
          itemCount: nextItems.length,
          ok: res.ok,
        });
        if (!cancelled) {
          setItems(nextItems);
          onItemsLoadedRef.current?.(nextItems.length);
        }
      } catch {
        logCommunityListLoadDiagPhase("posts-response-done", {
          scope,
          origin: "client",
          itemCount: 0,
          error: true,
        });
        if (!cancelled) {
          setItems([]);
          onItemsLoadedRef.current?.(0);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scope, query]);

  if (items === null) {
    return (
      <div data-community-list-loading="true">
        <SiteDetailShellBodyLoader />
      </div>
    );
  }

  return (
    <CommunityBoardPostList
      showRoomPrefix={showRoomPrefix}
      config={showRoomPrefix ? config : undefined}
      items={items}
      emptyTitle={emptyTitle}
      emptyDesc={emptyDesc}
    />
  );
}
