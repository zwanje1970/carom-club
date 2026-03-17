import Link from "next/link";

/** 회원 문의 게시판. 로그인 후 문의 작성/목록 연동 확장. */
export default function InquiryPage() {
  return (
    <main className="min-h-screen bg-site-bg p-4 py-10">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold text-site-text mb-4">문의사항</h1>
        <p className="text-gray-600 dark:text-slate-400 text-sm mb-6">
          회원 문의 게시판입니다. 로그인 후 문의를 작성할 수 있습니다.
        </p>
        <p className="text-sm flex gap-4">
          <Link href="/login" className="text-site-primary hover:underline">
            로그인
          </Link>
          <Link href="/" className="text-site-primary hover:underline">
            메인으로
          </Link>
        </p>
      </div>
    </main>
  );
}
