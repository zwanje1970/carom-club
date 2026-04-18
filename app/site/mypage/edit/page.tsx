import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { getUserById } from "../../../../lib/server/dev-store";
import ProfileEditForm from "../ProfileEditForm";

export default async function SiteMypageEditPage() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    redirect("/login?next=/site/mypage/edit");
  }

  const user = await getUserById(session.userId);
  if (!user) {
    redirect("/login?next=/site/mypage/edit");
  }

  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">내 정보 수정</h1>
      <section className="v3-box v3-stack">
        <h2 className="v3-h2">수정용 화면</h2>
        <ProfileEditForm
          key={user.id}
          initialName={user.name}
          initialNickname={user.nickname}
          initialEmail={user.email ?? ""}
          initialPhone={user.phone != null ? String(user.phone) : ""}
        />
      </section>
      <div className="v3-row">
        <Link className="v3-btn" href="/site/mypage">
          마이페이지로
        </Link>
      </div>
    </main>
  );
}
