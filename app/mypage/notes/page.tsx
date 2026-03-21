import Link from "next/link";
import { redirect } from "next/navigation";
import { BilliardNotesListClient } from "@/components/community/BilliardNotesListClient";
import { getSession } from "@/lib/auth";

export default async function MypageNotesPage() {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent("/mypage/notes")}`);
  }
  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
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
