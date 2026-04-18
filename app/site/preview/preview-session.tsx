"use client";

import { useEffect } from "react";

const STORAGE_KEY = "pb_login_return";

/**
 * 페이지빌더 미리보기(/site/preview)에서 로그인 후 같은 URL로 돌아오도록 복귀 경로만 저장한다.
 */
export default function PreviewSessionMarker() {
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, `${window.location.pathname}${window.location.search}`);
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
