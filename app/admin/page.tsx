import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../lib/auth/session";
import { ensurePlatformAdminAccount } from "../../lib/surface-read";
import AdminLoginForm from "./AdminLoginForm";

export const runtime = "nodejs";

export default async function AdminLoginPage() {
  await ensurePlatformAdminAccount({
    loginId: "admin",
    email: "zwanje@naver.com",
    password: "admin1234",
    name: "플랫폼 관리자",
  });

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (session?.role === "PLATFORM") {
    redirect("/");
  }
  if (session) {
    redirect("/unauthorized?from=/admin");
  }

  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "30rem", margin: "0 auto" }}>
      <h1 className="v3-h1">플랫폼 관리자 로그인</h1>
      <p className="v3-muted">아이디와 비밀번호로 로그인합니다.</p>
      <AdminLoginForm />
    </main>
  );
}
