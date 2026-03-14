import Link from "next/link";
import { mdiViewDashboard, mdiImageText, mdiViewModule, mdiPageLayoutHeader, mdiPageLayoutFooter, mdiPalette } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";

const SITE_MENU = [
  { href: "/admin/site/main", label: "메인페이지 구성", description: "섹션 표시/숨김, 순서 변경, 섹션 편집", icon: mdiViewDashboard },
  { href: "/admin/site/hero", label: "히어로 설정", description: "표시 여부, 높이, 배경, 제목, 버튼", icon: mdiImageText },
  { href: "/admin/site/components", label: "컴포넌트 관리", description: "카드·스와이프·배너·텍스트·이미지형 섹션", icon: mdiViewModule },
  { href: "/admin/site/header", label: "헤더 설정", description: "배경색, 글자색, 메뉴 강조색", icon: mdiPageLayoutHeader },
  { href: "/admin/site/footer", label: "푸터 설정", description: "높이, 배경색, 문구, 링크, 고객센터/SNS", icon: mdiPageLayoutFooter },
  { href: "/admin/site/design", label: "공통 디자인 설정", description: "기본 색상·타이포, 섹션 공통 기본값", icon: mdiPalette },
] as const;

export default function AdminSitePage() {
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiViewDashboard} title="사이트 관리" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        메인페이지를 섹션 단위로 통합 관리합니다. 구성·히어로·컴포넌트·헤더·푸터·공통 디자인을 한곳에서 설정할 수 있습니다.
      </p>
      <CardBox>
        <ul className="space-y-0">
          {SITE_MENU.map((item) => (
            <li key={item.href} className="border-b border-gray-200 last:border-b-0 dark:border-slate-700">
              <Link
                href={item.href}
                className="flex items-center gap-4 px-4 py-5 text-left transition hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-site-primary/10 text-site-primary shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-gray-900 dark:text-slate-100">{item.label}</span>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">{item.description}</p>
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
