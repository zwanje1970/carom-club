import Link from "next/link";
import {
  mdiPageLayoutBody,
  mdiViewCarousel,
  mdiOpenInNew,
} from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Icon from "@/components/admin/_components/Icon";

const LINKS = [
  {
    href: "/admin/site/main",
    title: "메인페이지 구성",
    desc: "홈에 노출할 섹션 순서·표시 여부·배경 등(콘텐츠 블록). 팝업·공지바는 콘텐츠 관리 메뉴에서 다룹니다.",
    icon: mdiPageLayoutBody,
  },
  {
    href: "/admin/site/hero",
    title: "히어로 설정",
    desc: "메인 상단 히어로(배경·제목·버튼)의 정식 편집 화면입니다. JSON 히어로가 켜져 있을 때 적용됩니다.",
    icon: mdiViewCarousel,
  },
];

export default function AdminSiteHomeSettingsHubPage() {
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiPageLayoutBody} title="홈 화면 설정" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400 max-w-3xl">
        메인(홈)에 보이는 구성과 히어로를 설정합니다. <strong>히어로 문구·이미지</strong>는 아래「히어로 설정」에서만
        수정하세요. 페이지 섹션 편집 화면의 예전 히어로 문구 편집은 더 이상 사용하지 않습니다.
      </p>
      <ul className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        {LINKS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block h-full">
              <CardBox className="h-full p-5 transition hover:border-site-primary/60 hover:bg-gray-50/80 dark:hover:bg-slate-800/50">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-site-primary/10 text-site-primary">
                    <Icon path={item.icon} size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-site-text flex items-center gap-1">
                      {item.title}
                      <Icon path={mdiOpenInNew} size={16} className="opacity-50" />
                    </p>
                    <p className="mt-2 text-xs text-gray-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </CardBox>
            </Link>
          </li>
        ))}
      </ul>
    </SectionMain>
  );
}
