"use client";

import { CommunityFeatureLoginGate } from "@/components/community/CommunityFeatureLoginGate";

/**
 * (레거시) 난구노트 비로그인 UI. 현재는 `app/mypage/notes/layout.tsx`에서 서버 `redirect(/login?next=…)`로 차단.
 * 다른 화면에서 재사용할 때만 import.
 */
export function NotesLoginGate() {
  return (
    <CommunityFeatureLoginGate
      title="난구노트"
      description="난구노트는 로그인 후 이용 가능합니다."
      titleId="notes-login-title"
      fallbackPath="/mypage/notes"
    />
  );
}
