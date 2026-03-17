import { NextResponse } from "next/server";
import { getSystemTextMap } from "@/lib/system-text";

/** 공개: 키 목록으로 문구 맵 조회. ?keys=key1,key2 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keysParam = searchParams.get("keys");
  const keys = keysParam ? keysParam.split(",").map((k) => k.trim()).filter(Boolean) : [];
  if (keys.length === 0) {
    return NextResponse.json({});
  }
  const map = await getSystemTextMap(keys);
  return NextResponse.json(map);
}
