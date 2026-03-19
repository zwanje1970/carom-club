import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { processUploadedImage, uploadToBlob, isBlobConfigError, BLOB_SERVICE_UNAVAILABLE_MESSAGE } from "@/lib/image-upload";
import { IMAGE_POLICIES } from "@/lib/image-policies";

export const runtime = "nodejs";

/**
 * 당구노트 테이블 이미지 업로드. 로그인한 사용자만.
 * 로컬 테스트: 파일명 자동 생성 후 public/uploads/billiard/ 에 저장, 반환값은 /uploads/billiard/파일명.webp 상대경로.
 * (FORCE_LOCAL_IMAGE_UPLOAD=1 이거나 BLOB_READ_WRITE_TOKEN 없을 때)
 */
export async function POST(request: Request) {
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

  const policy = IMAGE_POLICIES.billiard;
  try {
    const processed = await processUploadedImage(file, policy, session.id);
    const { url } = await uploadToBlob(processed);
    return NextResponse.json({ url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다.";
    if (message.includes("허용") || message.includes("MB") || message.includes("선택")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[community/billiard-notes/upload-image] error:", e);
    if (isBlobConfigError(message)) {
      return NextResponse.json(
        { error: BLOB_SERVICE_UNAVAILABLE_MESSAGE },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
