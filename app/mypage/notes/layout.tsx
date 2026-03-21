import { getSession } from "@/lib/auth";
import { NotesLoginGate } from "@/components/mypage/NotesLoginGate";

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
