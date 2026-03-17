"use client";

type SessionInfo = {
  name: string;
  role: string;
  loginMode: string;
  isClientAccount: boolean;
};

export function MypageProfileCard({ session }: { session: SessionInfo }) {
  const accountType =
    session.role === "CLIENT_ADMIN"
      ? "클라이언트 회원"
      : session.role === "PLATFORM_ADMIN"
        ? "플랫폼 관리자"
        : "일반회원";
  const loginState =
    session.loginMode === "client" ? "클라이언트 로그인" : "일반회원 로그인";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800 md:p-5">
      <p className="text-lg font-semibold text-site-text">{session.name}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {accountType} {loginState}
      </p>
    </div>
  );
}
