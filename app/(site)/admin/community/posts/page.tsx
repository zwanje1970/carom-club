import Link from "next/link";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import { mdiForum } from "@mdi/js";

export default function AdminCommunityPostsPage() {
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiForum} title="커뮤니티 글 관리" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        커뮤니티 게시글을 조회·관리합니다.
      </p>
      <CardBox>
        <p className="text-gray-600 dark:text-slate-400 mb-4">
          커뮤니티 게시글 목록은 커뮤니티 관리 화면에서 확인할 수 있습니다.
        </p>
        <Link
          href="/community"
          className="inline-flex items-center rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          커뮤니티로 이동
        </Link>
      </CardBox>
    </SectionMain>
  );
}
