import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { processUploadedImage, uploadToBlob, isBlobConfigError, BLOB_SERVICE_UNAVAILABLE_MESSAGE } from "@/lib/image-upload";
import { IMAGE_POLICIES } from "@/lib/image-policies";

export const runtime = "nodejs";

/** 대회 참가 신청 시 AVG 인증서 이미지 업로드. URL만 반환하며 DB에는 저장하지 않음. 신청 폼에서 avgProofUrl로 전달 */
export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다." },
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

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "이미지 업로드 중 오류가 발생했습니다.";
    if (message.includes("허용") || message.includes("MB") || message.includes("선택")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[apply/upload-avg-proof] error:", e);
    if (isBlobConfigError(message)) {
      return NextResponse.json(
        { error: BLOB_SERVICE_UNAVAILABLE_MESSAGE },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error: "이미지 업로드 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 }
    );
  }
}
