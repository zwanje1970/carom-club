import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { processUploadedImage, uploadToBlob, isBlobConfigError, BLOB_SERVICE_UNAVAILABLE_MESSAGE } from "@/lib/image-upload";
import { IMAGE_POLICIES } from "@/lib/image-policies";

/** 커뮤니티 게시글 첨부 이미지 업로드. 로그인 필수 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || !file.size) {
    return NextResponse.json({ error: "이미지 파일을 선택해주세요." }, { status: 400 });
  }

  const policy = IMAGE_POLICIES.community;
  try {
    const processed = await processUploadedImage(file, policy, session.id);
    const { url } = await uploadToBlob(processed);
    return NextResponse.json({ url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다.";
    if (message.includes("허용") || message.includes("MB") || message.includes("선택")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[community/upload-image] error:", e);
    if (isBlobConfigError(message)) {
      return NextResponse.json(
        { error: BLOB_SERVICE_UNAVAILABLE_MESSAGE },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
