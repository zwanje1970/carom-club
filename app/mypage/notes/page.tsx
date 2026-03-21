import Link from "next/link";
import { BilliardNotesListClient } from "@/components/community/BilliardNotesListClient";

/** 비로그인 차단: `middleware.ts` + `layout.tsx`(redirect). 여기서는 목록만 렌더 */
export default async function MypageNotesPage() {
  const buildShort =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.NEXT_PUBLIC_CAROM_NOTES_DIAG ??
    "local";

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <p
          className="mb-2 text-[10px] font-mono text-gray-400/90 dark:text-slate-500"
          data-carom-diag="mypage-notes-page"
          title="배포·빌드 확인용 (확인 후 제거 가능)"
        >
          {`carom:notes-page:${buildShort}`}
        </p>
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/mypage" className="hover:text-site-primary">마이</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">노트</span>
        </nav>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-xl font-bold">노트</h1>
          <Link
            href="/mypage/notes/new"
            className="shrink-0 py-2 px-4 rounded-lg bg-site-primary text-white text-sm font-medium hover:opacity-90"
          >
            새 노트 작성
          </Link>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          개인 기록입니다. 노트에서 난구해결로 보내면 커뮤니티에서 함께 풀 수 있습니다.
        </p>
        <BilliardNotesListClient basePath="/mypage/notes" />
      </div>
    </main>
  );
}
