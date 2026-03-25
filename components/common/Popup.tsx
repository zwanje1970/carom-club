"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { sanitizeImageSrc } from "@/lib/image-src";
import type { Popup as PopupType } from "@/types/popup";

const STORAGE_PREFIX = "carom_popup_hide_";

type Props = {
  popup: PopupType;
  onClose?: () => void;
};

export function Popup({ popup, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const storageKey = `${STORAGE_PREFIX}${popup.id}`;

  useEffect(() => {
    if (popup.hideForTodayEnabled && typeof window !== "undefined") {
      const hiddenUntil = window.localStorage.getItem(storageKey);
      if (hiddenUntil) {
        const until = parseInt(hiddenUntil, 10);
        if (Date.now() < until) {
          onClose?.();
          return;
        }
      }
    }
    setVisible(true);
  }, [popup.id, popup.hideForTodayEnabled, storageKey, onClose]);

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  const handleHideForToday = () => {
    if (popup.hideForTodayEnabled && typeof window !== "undefined") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      window.localStorage.setItem(storageKey, String(tomorrow.getTime()));
    }
    handleClose();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={handleClose}
      />
      <div
        className="relative z-10 w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-title"
      >
        {popup.showCloseButton && (
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-2 top-2 rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"
            aria-label="닫기"
          >
            ×
          </button>
        )}
        <div className="p-6">
          <h3 id="popup-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {popup.title}
          </h3>
          {popup.description && (
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
              {popup.description}
            </p>
          )}
          {(() => {
            const safeSrc = sanitizeImageSrc(popup.imageUrl);
            if (!safeSrc) return null;
            return (
              <div className="relative mt-4 aspect-video w-full overflow-hidden rounded">
                <img
                  src={safeSrc}
                  alt={popup.title ? `${popup.title} 안내 이미지` : "팝업 이미지"}
                  className="absolute inset-0 w-full h-full object-cover min-h-[80px]"
                  data-debug-src={safeSrc}
                />
              </div>
            );
          })()}
          <div className="mt-4 flex flex-wrap gap-2">
            {popup.buttonName && popup.buttonLink && (
              <Link
                href={popup.buttonLink}
                className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                {popup.buttonName}
              </Link>
            )}
            {popup.hideForTodayEnabled && (
              <button
                type="button"
                onClick={handleHideForToday}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                오늘 하루 보지 않기
              </button>
            )}
            {popup.showCloseButton && !popup.hideForTodayEnabled && (
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                닫기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
