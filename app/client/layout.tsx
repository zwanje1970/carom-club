import Link from "next/link";
import { getSession } from "@/lib/auth";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-site-bg p-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold text-site-text">로그인이 필요합니다</h1>
          <p className="mt-2 text-gray-600">클라이언트 대시보드는 로그인 후 이용할 수 있습니다.</p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-lg bg-site-primary px-5 py-2.5 font-medium text-white hover:opacity-90"
          >
            로그인
          </Link>
        </div>
      </div>
    );
  }

  if (session.role !== "CLIENT_ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-site-bg p-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold text-site-text">클라이언트 권한이 없습니다</h1>
          <p className="mt-2 text-gray-600">당구장·동호회·연맹·주최자·강사로 등록하시려면 마이페이지에서 클라이언트 등록 신청을 해 주세요.</p>
          <Link
            href="/mypage"
            className="mt-6 inline-block rounded-lg bg-site-primary px-5 py-2.5 font-medium text-white hover:opacity-90"
          >
            마이페이지로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-site-bg">
      <header className="border-b border-site-border bg-site-card px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/client/dashboard" className="font-semibold text-site-text">
            클라이언트 대시보드
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/client/dashboard" className="text-gray-600 hover:text-site-primary">
              대시보드
            </Link>
            <Link href="/client/tournaments" className="text-gray-600 hover:text-site-primary">
              대회 관리
            </Link>
            <Link href="/client/setup" className="text-gray-600 hover:text-site-primary">
              업체 설정
            </Link>
            <Link href="/client/promo" className="text-gray-600 hover:text-site-primary">
              홍보 페이지 편집
            </Link>
            <Link href="/" className="text-gray-600 hover:text-site-primary">
              메인으로
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  );
}
