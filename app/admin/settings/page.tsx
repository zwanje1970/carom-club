import Link from "next/link";
import { mdiCog } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";

const SETTINGS_MENU = [
  {
    href: "/admin/settings/site",
    label: "사이트 설정",
    description: "사이트 이름, 로고, 기본 정보",
  },
  {
    href: "/admin/settings/hero",
    label: "메인 히어로 설정",
    description: "메인페이지 상단 히어로 배경·텍스트·버튼",
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
    href: "/admin/settings/labels",
    label: "메뉴/문구",
    description: "관리자 메뉴명·버튼 문구 수정",
  },
  {
    href: "/admin/settings/footer",
    label: "푸터 설정",
    description: "하단 푸터 배경/글자색, 주관사 정보, 협력업체",
  },
] as const;

export default function AdminSettingsPage() {
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiCog} title="설정" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">설정 항목을 선택하세요.</p>
      <CardBox>
        <ul className="divide-y divide-gray-200 dark:divide-slate-700">
          {SETTINGS_MENU.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-4 px-0 py-4 text-left transition first:pt-0 last:pb-0 hover:opacity-80"
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
