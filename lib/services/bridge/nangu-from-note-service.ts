import { prisma } from "@/lib/db";
import { revalidateTag } from "next/cache";
import type { TroubleFromNoteRequest } from "@/lib/services/bridge/trouble-from-note-validator";
import {
  mapBallPlacementJson,
  mapTroubleFromNoteContent,
} from "@/lib/services/bridge/trouble-from-note-service";

export async function findExistingNanguPostIdFromNote(noteId: string): Promise<string | null> {
  const row = await prisma.nanguPost.findFirst({
    where: { sourceNoteId: noteId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function createNanguPostFromNote(input: {
  authorId: string;
  noteId: string;
  title: string;
  content: string;
  ballPlacementJson: string;
}) {
  const post = await prisma.nanguPost.create({
    data: {
      authorId: input.authorId,
      title: input.title,
      content: input.content || " ",
      ballPlacementJson: input.ballPlacementJson,
      sourceNoteId: input.noteId,
    },
  });
  revalidateTag("community-nangu-list");
  return { id: post.id };
}

export function mapNoteToNanguContent(
  note: Parameters<typeof mapTroubleFromNoteContent>[0],
  body: TroubleFromNoteRequest
) {
  return mapTroubleFromNoteContent(note, body);
}

export { mapBallPlacementJson };
