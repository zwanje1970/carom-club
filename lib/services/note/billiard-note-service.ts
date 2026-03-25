import { prisma } from "@/lib/db";
import type { BilliardNoteListParams, BilliardNoteWriteInput } from "@/lib/services/note/billiard-note-types";
import { mapCreateData, mapPatchData } from "@/lib/services/note/billiard-note-mappers";

export async function listCommunityNotes() {
  const list = await prisma.billiardNote.findMany({
    where: { visibility: "community" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      memo: true,
      imageUrl: true,
      visibility: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  });
  return list.map((n) => ({
    id: n.id,
    memo: n.memo,
    imageUrl: n.imageUrl,
    visibility: n.visibility,
    createdAt: n.createdAt.toISOString(),
    authorName: n.author.name,
  }));
}

export async function listMineOrAllNotes(params: BilliardNoteListParams) {
  const list = await prisma.billiardNote.findMany({
    where: params.mine ? { authorId: params.sessionUserId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      memo: true,
      imageUrl: true,
      visibility: true,
      createdAt: true,
      _count: { select: { troubleShotsFromNote: true } },
    },
  });
  return list.map((n) => ({
    id: n.id,
    title: n.title,
    memo: n.memo,
    imageUrl: n.imageUrl,
    visibility: n.visibility,
    createdAt: n.createdAt.toISOString(),
    // Keep existing response contract for backward compatibility.
    sentToTroubleCount: n._count.troubleShotsFromNote,
  }));
}

export async function createBilliardNote(
  authorId: string,
  body: BilliardNoteWriteInput,
  balls: {
    redBall: { x: number; y: number };
    yellowBall: { x: number; y: number };
    whiteBall: { x: number; y: number };
  }
) {
  const note = await prisma.billiardNote.create({
    data: mapCreateData(authorId, body, balls),
  });
  return {
    id: note.id,
    visibility: note.visibility,
    createdAt: note.createdAt.toISOString(),
  };
}

export async function getBilliardNoteDetail(id: string) {
  return prisma.billiardNote.findUnique({
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
      updatedAt: true,
      author: { select: { id: true, name: true } },
    },
  });
}

export async function getBilliardNoteAuthor(id: string) {
  return prisma.billiardNote.findUnique({
    where: { id },
    select: { authorId: true },
  });
}

export async function updateBilliardNote(id: string, body: BilliardNoteWriteInput) {
  const updated = await prisma.billiardNote.update({
    where: { id },
    data: mapPatchData(body),
  });
  return {
    id: updated.id,
    visibility: updated.visibility,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteBilliardNote(id: string) {
  await prisma.billiardNote.delete({ where: { id } });
  return { ok: true as const };
}
