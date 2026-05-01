"use client";

import dynamic from "next/dynamic";
import type { MypageHistoryRow } from "./MypageHistoryList";

const MypageHistoryList = dynamic(() => import("./MypageHistoryList"), {
  ssr: false,
  loading: () => (
    <p className="v3-muted" style={{ margin: 0 }}>
      불러오는 중…
    </p>
  ),
});

export default function MypageHistoryDynamicMount({
  initialHistoryRows,
}: {
  initialHistoryRows?: MypageHistoryRow[];
}) {
  return <MypageHistoryList initialRows={initialHistoryRows} />;
}
