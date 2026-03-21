import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MypageNotesSessionGuard } from "@/components/mypage/MypageNotesSessionGuard";

/** 쿠키 기반 세션과 맞춰 HTML/RSC가 공용 캐시되지 않도록 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MypageNotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    const h = await headers();
    const path = h.get("x-pathname") ?? "/mypage/notes";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return (
    <MypageNotesSessionGuard initialShow>
      {children}
    </MypageNotesSessionGuard>
  );
}
