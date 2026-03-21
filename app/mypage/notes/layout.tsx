import { getSession } from "@/lib/auth";
import { NotesLoginGate } from "@/components/mypage/NotesLoginGate";

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
    return <NotesLoginGate />;
  }
  return <>{children}</>;
}
