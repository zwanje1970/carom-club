import Link from "next/link";
import { mdiCog } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";

const SETTINGS_MENU = [
  {
    href: "/admin/site",
    label: "사이트 관리 (메인페이지·히어로·푸터 등)",
    description: "메인페이지 구성, 히어로·헤더·푸터·컴포넌트·공통 디자인",
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
    label: "메뉴/문구",
    description: "관리자 메뉴명·버튼 문구 수정",
  },
] as const;

export default function AdminSettingsPage() {
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiCog} title="설정" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">설정 항목을 선택하세요.</p>
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
