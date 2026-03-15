import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ClientSidebar } from "@/components/client/ClientSidebar";

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

  // 권역 관리자는 전용 콘솔로 리다이렉트 (전체 대회 운영 메뉴 접근 불가)
  if (session.role === "ZONE_MANAGER") {
    redirect("/zone");
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
    <div className="flex min-h-screen bg-site-bg">
      <ClientSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
