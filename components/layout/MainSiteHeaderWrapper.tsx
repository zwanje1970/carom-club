"use client";

import { usePathname } from "next/navigation";
import { MainSiteHeader } from "./MainSiteHeader";
import MobileHeader from "@/components/common/MobileHeader";
import { useGlobalChromeMode } from "@/components/community/BallPlacementFullscreenContext";
import { shouldHideGlobalChromeByPathname } from "@/components/layout/globalChromeRules";

/**
 * 공개 페이지 헤더 래퍼
 * - 모바일: 공통 MobileHeader (좌:나가기, 중:제목, 우:뒤로가기)
 * - 데스크톱: MainSiteHeader (풀 네비게이션)
 */
export function MainSiteHeaderWrapper() {
  const pathname = usePathname() ?? "";
  const chromeMode = useGlobalChromeMode();

  if (shouldHideGlobalChromeByPathname(pathname)) return null;
  if (chromeMode?.hideGlobalChrome) return null;

  // 경로별 제목 설정
  const getTitle = (path: string) => {
    if (path === "/") return "CAROM.CLUB";
    if (path.startsWith("/tournaments")) {
      if (path === "/tournaments") return "대회";
      return "대회 상세";
    }
    if (path.startsWith("/venues")) return "당구장";
    if (path.startsWith("/community")) {
      if (path === "/community") return "커뮤니티";
      if (path.startsWith("/community/nangu")) {
        if (path === "/community/nangu") return "난구해결사";
        return "난구 상세";
      }
      if (path.startsWith("/community/free")) {
        if (path === "/community/free") return "자유게시판";
        return "게시글";
      }
      if (path.startsWith("/community/qna")) {
        if (path === "/community/qna") return "질문게시판";
        return "게시글";
      }
      if (path.startsWith("/community/notice")) {
        if (path === "/community/notice") return "공지사항";
        return "게시글";
      }
      return "게시판";
    }
    if (path.startsWith("/mypage")) {
      if (path === "/mypage") return "마이페이지";
      if (path.startsWith("/mypage/edit")) return "정보 수정";
      if (path.startsWith("/mypage/notes")) return "당구노트";
      return "마이페이지";
    }
    if (path.startsWith("/login")) return "로그인";
    if (path.startsWith("/signup")) return "회원가입";
    if (path.startsWith("/notice")) return "공지사항";
    if (path.startsWith("/inquiry")) return "문의사항";
    return "";
  };

  return (
    <>
      <div className="md:hidden">
        <MobileHeader title={getTitle(pathname)} />
      </div>
      <MainSiteHeader hideOnMobile={true} />
    </>
  );
}
