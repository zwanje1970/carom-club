import Link from "next/link";
import { mdiCog } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import { getAdminCopy, getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";

const SETTINGS_MENU = [
  {
    href: "/admin/site",
    label: "사이트 관리",
    description: "메인페이지 구성, 히어로·헤더·푸터·페이지 섹션(컴포넌트)·공통 디자인 — 단일 진입",
  },
  {
    href: "/admin/settings/notices",
    label: "공지 관리",
    description: "공지바·팝업·긴급 공지 생성·수정·삭제, 노출 기간·디바이스 설정",
  },
  {
    href: "/admin/settings/features",
    label: "기능 관리",
    description: "회원가입·대회 생성·참가 신청·커뮤니티 글쓰기·댓글·레슨 신청 ON/OFF",
  },
  {
    href: "/admin/site/main",
    label: "메인 섹션 관리",
    description: "히어로·대회·당구장·커뮤니티 섹션 표시/순서/제목/배경색",
  },
  {
    href: "/admin/settings/featured-content",
    label: "추천 콘텐츠 관리",
    description: "메인 추천 대회·추천 당구장·추천 게시글 지정",
  },
  {
    href: "/admin/settings/admin-logs",
    label: "관리자 활동 로그",
    description: "공지·시스템 문구·설정 변경 등 관리자 작업 이력",
  },
  {
    href: "/admin/settings/system",
    label: "시스템 관리",
    description: "사이트 캐시 초기화, 페이지 재빌드",
  },
  {
    href: "/admin/settings/system-status",
    label: "사이트 상태",
    description: "오늘 방문자·접속자, 대회·게시글·댓글·신고 수, 최근 24h·최근 목록",
  },
  {
    href: "/admin/settings/backup",
    label: "데이터 백업",
    description: "DB 백업 실행·다운로드·목록, 일일 자동 백업, 복원 안내",
  },
  {
    href: "/admin/me",
    label: "관리자 정보 수정",
    description: "로그인한 관리자 이름·비밀번호 변경",
  },
  {
    href: "/admin/settings/site",
    label: "사이트 기본 정보",
    description: "사이트 이름, 로고, 테마 색상",
  },
  {
    href: "/admin/settings/notifications",
    label: "알림 설정",
    description: "이메일·알림 발송 옵션",
  },
  {
    href: "/admin/settings/integration",
    label: "연동 설정",
    description: "API·외부 서비스 연동",
  },
  {
    href: "/admin/settings/platform-billing",
    label: "요금 정책",
    description: "요금 정책 활성화, 대회 이용권·연회원 가격",
  },
  {
    href: "/admin/settings/labels",
    label: "메뉴·문구",
    description: "메뉴명, 버튼 문구, 페이지 제목, 에러·빈 화면 안내문 등 표시되는 모든 문구를 한 목록에서 수정",
  },
] as const;

export default async function AdminSettingsPage() {
  const copy = await getAdminCopy();
  const c = copy as Record<AdminCopyKey, string>;
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiCog} title={getCopyValue(c, "admin.settings.title")} />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">{getCopyValue(c, "admin.settings.pickItem")}</p>
      <CardBox>
        <ul className="space-y-4">
          {SETTINGS_MENU.map((item) => (
            <li key={item.href} className="border-b border-gray-200 last:border-b-0 dark:border-slate-700">
              <Link
                href={item.href}
                className="flex items-center justify-between gap-4 px-4 py-5 text-left transition hover:bg-gray-50 hover:opacity-90 dark:hover:bg-slate-700/50"
              >
                <div>
                  <span className="font-medium text-gray-900 dark:text-slate-100">{item.label}</span>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
                    {item.description}
                  </p>
                </div>
                <span className="shrink-0 text-gray-400 dark:text-slate-500">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardBox>
    </SectionMain>
  );
}
