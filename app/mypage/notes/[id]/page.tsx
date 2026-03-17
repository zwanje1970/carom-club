import Link from "next/link";
import { BilliardNoteDetailClient } from "@/components/community/BilliardNoteDetailClient";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";

export default async function MypageNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const note = await prisma.billiardNote.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      title: true,
      noteDate: true,
      redBallX: true,
      redBallY: true,
      yellowBallX: true,
      yellowBallY: true,
      whiteBallX: true,
      whiteBallY: true,
      cueBall: true,
      memo: true,
      imageUrl: true,
      visibility: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });

  if (!note) notFound();
  const isAuthor = session?.id === note.authorId;
  if (!isAuthor) notFound();

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/mypage" className="hover:text-site-primary">마이페이지</Link>
          <span aria-hidden>/</span>
          <Link href="/mypage/notes" className="hover:text-site-primary">당구노트</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">상세</span>
        </nav>
        <h1 className="text-xl font-bold mb-6">{note.title || "당구노트"}</h1>
        <BilliardNoteDetailClient
          note={{
            id: note.id,
            authorName: note.author.name,
            title: note.title,
            noteDate: note.noteDate?.toISOString() ?? null,
            redBall: { x: note.redBallX, y: note.redBallY },
            yellowBall: { x: note.yellowBallX, y: note.yellowBallY },
            whiteBall: { x: note.whiteBallX, y: note.whiteBallY },
            cueBall: note.cueBall as "white" | "yellow",
            memo: note.memo,
            imageUrl: note.imageUrl,
            visibility: note.visibility,
            createdAt: note.createdAt.toISOString(),
            isAuthor,
          }}
          basePath="/mypage/notes"
        />
      </div>
    </main>
  );
}
