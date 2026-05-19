"use client";

import { useState } from "react";
import type { SiteCommunityBoardKey, SiteCommunityConfig } from "../../../lib/types/entities";
import CommunityBoardListScrollShell from "./CommunityBoardListScrollShell";
import CommunityPostsListClient from "./CommunityPostsListClient";

type Props = {
  boardListKey: string;
  searchParams: Record<string, string | string[] | undefined>;
  scope: "all" | SiteCommunityBoardKey;
  config: SiteCommunityConfig;
  query?: string;
  showRoomPrefix: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
};

export default function CommunityBoardListAreaClient({
  boardListKey,
  searchParams,
  scope,
  config,
  query,
  showRoomPrefix,
  emptyTitle,
  emptyDesc,
}: Props) {
  const [itemsCount, setItemsCount] = useState(0);

  return (
    <CommunityBoardListScrollShell
      boardListKey={boardListKey}
      searchParams={searchParams}
      itemsCount={itemsCount}
    >
      <CommunityPostsListClient
        scope={scope}
        config={config}
        query={query}
        showRoomPrefix={showRoomPrefix}
        emptyTitle={emptyTitle}
        emptyDesc={emptyDesc}
        onItemsLoaded={setItemsCount}
      />
    </CommunityBoardListScrollShell>
  );
}
