"use client";

import { CommunityFeatureLoginGate } from "@/components/community/CommunityFeatureLoginGate";

/**
 * 비로그인 시 /mypage/notes/* 진입용 — 본문 대신 전체 화면 딤 + 로그인 유도 모달.
 * 배경 클릭으로는 닫히지 않음(강제 로그인 UX). 닫기는 이전 페이지 또는 홈.
 */
export function NotesLoginGate() {
  return (
    <CommunityFeatureLoginGate
      title="당구노트"
      description="당구노트는 로그인 후 이용 가능합니다."
      titleId="notes-login-title"
      fallbackPath="/mypage/notes"
    />
  );
}
