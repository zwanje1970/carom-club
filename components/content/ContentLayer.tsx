"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { NoticeBar } from "@/components/common/NoticeBar";
import type { NoticeBar as NoticeBarType } from "@/types/notice-bar";
import type { Popup as PopupType } from "@/types/popup";

const Popup = dynamic(
  () => import("@/components/common/Popup").then((m) => ({ default: m.Popup })),
  { ssr: false }
);

type Props = {
  noticeBars?: NoticeBarType[] | null;
  popups?: PopupType[] | null;
};

export function ContentLayer({ noticeBars, popups }: Props) {
  const [closedPopupId, setClosedPopupId] = useState<string | null>(null);
  const bars = Array.isArray(noticeBars) ? noticeBars : [];
  const pops = Array.isArray(popups) ? popups : [];
  const firstPopup = pops[0];
  const showPopup = firstPopup && closedPopupId !== firstPopup.id;

  return (
    <>
      {bars.map((bar) => (
        <NoticeBar key={bar.id} bar={bar} />
      ))}
      {showPopup && (
        <Popup
          popup={firstPopup}
          onClose={() => setClosedPopupId(firstPopup.id)}
        />
      )}
    </>
  );
}
