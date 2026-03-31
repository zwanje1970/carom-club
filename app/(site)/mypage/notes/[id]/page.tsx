import { MypageNoteDetailContent } from "@/components/note/MypageNoteDetailContent";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";

export default async function MypageNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/mypage/notes/${id}`)}`);
  }
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

  const linkedNangu = await prisma.nanguPost.findFirst({
    where: { sourceNoteId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const linkedTrouble =
    linkedNangu == null
      ? await prisma.troubleShotPost.findFirst({
          where: { sourceNoteId: id },
          orderBy: { post: { createdAt: "desc" } },
          select: { postId: true },
        })
      : null;

  return (
    <MypageNoteDetailContent
      note={{
        id: note.id,
        authorName: note.author.name,
        title: note.title,
        noteDate: note.noteDate ?? null,
        redBall: { x: note.redBallX, y: note.redBallY },
        yellowBall: { x: note.yellowBallX, y: note.yellowBallY },
        whiteBall: { x: note.whiteBallX, y: note.whiteBallY },
        cueBall: note.cueBall as "white" | "yellow",
        memo: note.memo,
        imageUrl: note.imageUrl,
        visibility: note.visibility,
        createdAt: note.createdAt,
        isAuthor,
      }}
      linkedNanguPostId={linkedNangu?.id ?? null}
      linkedTroublePostId={linkedTrouble?.postId ?? null}
      basePath="/mypage/notes"
    />
  );
}
