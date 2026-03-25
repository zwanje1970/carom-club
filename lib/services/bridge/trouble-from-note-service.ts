import { prisma } from "@/lib/db";
import { revalidateCommunityHome } from "@/lib/community-home-revalidate";
import { ensureDefaultCommunityBoards } from "@/lib/community-ensure-boards";
import type { TroubleFromNoteRequest } from "@/lib/services/bridge/trouble-from-note-validator";

export async function findAuthorOwnedSourceNote(noteId: string, authorId: string) {
  return prisma.billiardNote.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      authorId: true,
      imageUrl: true,
      memo: true,
      redBallX: true,
      redBallY: true,
      yellowBallX: true,
      yellowBallY: true,
      whiteBallX: true,
      whiteBallY: true,
      cueBall: true,
    },
  }).then((note) => {
    if (!note || note.authorId !== authorId) return null;
    return note;
  });
}

export async function findExistingTroublePostIdFromNote(noteId: string): Promise<string | null> {
  const existing = await prisma.troubleShotPost.findFirst({
    where: { sourceNoteId: noteId },
    orderBy: { post: { createdAt: "desc" } },
    select: { postId: true },
  });
  return existing?.postId ?? null;
}

export async function ensureTroubleBoardId(): Promise<string | null> {
  let board = await prisma.communityBoard.findUnique({
    where: { slug: "trouble" },
    select: { id: true },
  });
  if (!board) {
    await ensureDefaultCommunityBoards();
    board = await prisma.communityBoard.findUnique({
      where: { slug: "trouble" },
      select: { id: true },
    });
  }
  return board?.id ?? null;
}

export function mapTroubleFromNoteContent(note: { memo: string | null }, body: TroubleFromNoteRequest) {
  const bodyTitle = (body.title ?? "").trim();
  const bodyContent = (body.content ?? "").trim();
  const memoTrim = note.memo?.trim() ?? "";
  const title = bodyTitle || "이 배치 해결 방법 부탁드립니다";
  const content = bodyContent || memoTrim || " ";
  return { title, content };
}

export function mapBallPlacementJson(note: {
  redBallX: number;
  redBallY: number;
  yellowBallX: number;
  yellowBallY: number;
  whiteBallX: number;
  whiteBallY: number;
  cueBall: string;
}) {
  return JSON.stringify({
    redBall: { x: note.redBallX, y: note.redBallY },
    yellowBall: { x: note.yellowBallX, y: note.yellowBallY },
    whiteBall: { x: note.whiteBallX, y: note.whiteBallY },
    cueBall: note.cueBall === "yellow" ? "yellow" : "white",
  });
}

export async function createTroublePostFromNote(input: {
  boardId: string;
  authorId: string;
  noteId: string;
  title: string;
  content: string;
  layoutImageUrl: string | null;
  ballPlacementJson: string;
}) {
  const post = await prisma.communityPost.create({
    data: {
      boardId: input.boardId,
      authorId: input.authorId,
      title: input.title,
      content: input.content || " ",
    },
  });

  await prisma.troubleShotPost.create({
    data: {
      postId: post.id,
      sourceNoteId: input.noteId,
      layoutImageUrl: input.layoutImageUrl,
      ballPlacementJson: input.ballPlacementJson,
      difficulty: null,
    },
  });

  revalidateCommunityHome();
  return { id: post.id };
}
