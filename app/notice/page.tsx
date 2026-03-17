import Link from "next/link";

/** 플랫폼 공지 페이지. 콘텐츠는 CMS/공지 API 연동 후 확장. */
export default function NoticePage() {
  return (
    <main className="min-h-screen bg-site-bg p-4 py-10">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold text-site-text mb-4">공지사항</h1>
        <p className="text-gray-600 dark:text-slate-400 text-sm mb-6">
          플랫폼 공지 목록이 여기에 표시됩니다.
        </p>
        <p className="text-sm">
          <Link href="/" className="text-site-primary hover:underline">
            메인으로
          </Link>
        </p>
      </div>
    </main>
  );
}
