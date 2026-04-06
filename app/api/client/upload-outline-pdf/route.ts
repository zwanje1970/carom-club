import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { assertClientActiveOrgCanMutateTournaments } from "@/lib/client-tournament-access";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * 클라이언트 콘솔 — 경기요강 PDF 업로드 (공개 Blob URL)
 */
export async function POST(request: Request) {
  const session = await getSession();
  const gate = await assertClientActiveOrgCanMutateTournaments(session);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json({ error: "파일 저장 설정이 필요합니다." }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file?.size) {
    return NextResponse.json({ error: "PDF 파일을 선택해 주세요." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "PDF는 12MB 이하만 업로드할 수 있습니다." }, { status: 400 });
  }
  const type = file.type || "";
  if (type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "PDF 파일만 업로드할 수 있습니다." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "outline.pdf";
  const path = `outline/${gate.organizationId}/${Date.now()}-${safe}`;

  try {
    const blob = await put(path, buf, {
      access: "public",
      contentType: "application/pdf",
    });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    console.error("[client/upload-outline-pdf]", e);
    return NextResponse.json({ error: "업로드에 실패했습니다." }, { status: 500 });
  }
}
