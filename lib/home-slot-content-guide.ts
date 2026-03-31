import type { HomeStructureSlotType } from "@/lib/home-structure-slots";

export type HomeSlotContentGuide = {
  /** 운영자에게 보이는 한 줄 설명 */
  summary: string;
  links: { href: string; label: string }[];
};

/** 자동 연결 데이터 출처 안내 + 관리 화면 바로가기 */
export function getHomeSlotContentGuide(slotType: HomeStructureSlotType): HomeSlotContentGuide {
  switch (slotType) {
    case "tournamentIntro":
      return {
        summary: "카드 내용은 등록된 대회 목록과 자동으로 연결됩니다.",
        links: [{ href: "/admin/tournaments", label: "대회 관리로 이동" }],
      };
    case "venueIntro":
      return {
        summary: "카드 내용은 노출 대상 당구장 데이터와 자동으로 연결됩니다.",
        links: [{ href: "/admin/venues", label: "당구장 관리로 이동" }],
      };
    case "venueLink":
      return {
        summary: "이 영역은 당구장 허브로 이어지는 링크 블록입니다.",
        links: [{ href: "/admin/venues", label: "당구장 관리로 이동" }],
      };
    case "nanguEntry":
      return {
        summary: "난구노트·난구해결사 진입 카드는 사이트 정책과 커뮤니티 콘텐츠와 연동됩니다.",
        links: [
          { href: "/admin/members", label: "회원·권한 관리" },
          { href: "/community/nangu", label: "사이트에서 미리보기" },
        ],
      };
    default:
      return { summary: "", links: [] };
  }
}
