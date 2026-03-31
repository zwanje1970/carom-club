import Link from "next/link";
import { mdiSitemap, mdiImageText, mdiOpenInNew } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Icon from "@/components/admin/_components/Icon";
import Button from "@/components/admin/_components/Button";

/**
 * 메인(홈) 구조의 단일 진입 안내: 실제 순서·슬롯·표시는 페이지 빌더만 사용.
 */
export default function AdminSiteMainPage() {
  return (
    <SectionMain>
      <p className="mb-4 text-sm">
        <Link href="/admin/site/home" className="text-site-primary hover:underline">
          ← 홈 화면 설정
        </Link>
      </p>
      <SectionTitleLineWithButton icon={mdiSitemap} title="메인페이지 구성" />
      <p className="mb-6 max-w-2xl text-sm text-gray-600 dark:text-slate-400">
        홈 화면의 <strong>블록 순서·표시·슬롯·노출 기간</strong>은{" "}
        <strong className="text-site-text">페이지 빌더</strong>에서만 관리합니다. 텍스트·이미지 등{" "}
        <strong>내용</strong>은「콘텐츠 편집 (CMS 블록)」목록에서 해당 행을 열어 수정하세요.
      </p>

      <div className="mb-8 flex flex-wrap gap-3">
        <Button href="/admin/page-builder" label="페이지 빌더로 이동" color="info" />
        <Button href="/admin/page-sections" label="콘텐츠 편집 (CMS)" color="contrast" outline />
      </div>

      <ul className="grid max-w-xl gap-4">
        <li>
          <Link href="/admin/site/hero" className="block h-full">
            <CardBox className="h-full p-5 transition hover:border-site-primary/60 hover:bg-gray-50/80 dark:hover:bg-slate-800/50">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-site-primary/10 text-site-primary">
                  <Icon path={mdiImageText} size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-semibold text-site-text">
                    히어로 설정 (정본)
                    <Icon path={mdiOpenInNew} size={16} className="opacity-50" />
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-slate-400">
                    메인 상단 히어로 JSON 설정. 슬롯만 켜 두고 내용은 여기서 편집합니다.
                  </p>
                </div>
              </div>
            </CardBox>
          </Link>
        </li>
      </ul>
    </SectionMain>
  );
}
