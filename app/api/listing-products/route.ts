import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** GET: 등록상품 정책 목록 (등록 화면에서 게시기간/금액 표시용). 로그인 불필요, 활성만 반환 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code"); // 단일 조회 시
  const list = await prisma.listingProduct.findMany({
    where: { isActive: true, ...(code ? { code } : {}) },
    orderBy: { code: "asc" },
  });
  return NextResponse.json(code ? (list[0] ?? null) : list);
}
