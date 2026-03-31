import Link from "next/link";
import { getSession } from "@/lib/auth";
import { ZoneSidebar } from "@/components/zone/ZoneSidebar";

export default async function ZoneLayout({
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
          <p className="mt-2 text-gray-600">권역 운영 콘솔은 로그인 후 이용할 수 있습니다.</p>
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

  if (session.role !== "ZONE_MANAGER") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-site-bg p-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold text-site-text">권한이 없습니다</h1>
          <p className="mt-2 text-gray-600">권역 관리자 전용 화면입니다. 배정된 권역이 있으면 권역 관리자 계정으로 로그인해 주세요.</p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-site-primary px-5 py-2.5 font-medium text-white hover:opacity-90"
          >
            메인으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-site-bg">
      <ZoneSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
