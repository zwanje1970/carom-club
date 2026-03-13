import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { processUploadedImage, uploadToBlob } from "@/lib/image-upload";
import { IMAGE_POLICIES } from "@/lib/image-policies";

const BLOB_ERROR_MESSAGE =
  "이미지 저장 설정이 되어 있지 않아 업로드할 수 없습니다. 관리자에게 문의해 주세요.";

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다. .env에 DATABASE_URL을 설정해 주세요." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || !file.size) {
    return NextResponse.json(
      { error: "이미지 파일을 선택해주세요." },
      { status: 400 }
    );
  }

  try {
    const policy = IMAGE_POLICIES.proof;
    const processed = await processUploadedImage(file, policy, session.id);
    const { url } = await uploadToBlob(processed);

    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    await prisma.memberProfile.upsert({
      where: { userId: session.id },
      create: {
        userId: session.id,
        avgProofUrl: url,
        avgProofExpiresAt: expiresAt,
      },
      update: {
        avgProofUrl: url,
        avgProofExpiresAt: expiresAt,
      },
    });

    return NextResponse.json({
      ok: true,
      url,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "이미지 업로드 중 오류가 발생했습니다.";
    if (message.includes("허용") || message.includes("MB") || message.includes("선택")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[avg-proof] upload error:", e);
    const err = e as { message?: string };
    const isBlobError =
      typeof err?.message === "string" &&
      (/blob|token|BLOB_READ_WRITE|unauthorized|403/i.test(err.message) ||
        err.message.includes("token"));
    return NextResponse.json(
      {
        error: isBlobError
          ? BLOB_ERROR_MESSAGE
          : "이미지 업로드 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: isBlobError ? 503 : 500 }
    );
  }
}
