import Link from "next/link";
import { BilliardNotesListClient } from "@/components/community/BilliardNotesListClient";

export default function MypageNotesPage() {
  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/mypage" className="hover:text-site-primary">마이페이지</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">당구노트</span>
        </nav>
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-xl font-bold">당구노트</h1>
          <Link
            href="/mypage/notes/new"
            className="shrink-0 py-2 px-4 rounded-lg bg-site-primary text-white text-sm font-medium"
          >
            작성
          </Link>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          회원 개인 기록입니다. 본인만 작성·수정·삭제할 수 있습니다.
        </p>
        <BilliardNotesListClient basePath="/mypage/notes" />
      </div>
    </main>
  );
}
