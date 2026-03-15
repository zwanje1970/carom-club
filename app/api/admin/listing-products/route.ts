import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET: 등록상품 정책 목록. PLATFORM_ADMIN */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const list = await prisma.listingProduct.findMany({
    orderBy: { code: "asc" },
  });
  return NextResponse.json(list);
}

/** POST: 등록상품 생성. PLATFORM_ADMIN */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  let body: {
    code?: string;
    name?: string;
    description?: string;
    postingMonths?: number;
    price?: number;
    currency?: string;
    isActive?: boolean;
    appliesToGeneralOnly?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!code || !name) {
    return NextResponse.json({ error: "code, name이 필요합니다." }, { status: 400 });
  }
  const postingMonths = typeof body?.postingMonths === "number" ? body.postingMonths : 1;
  const price = typeof body?.price === "number" ? body.price : 0;
  const currency = typeof body?.currency === "string" ? body.currency : "KRW";
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : true;
  const appliesToGeneralOnly = typeof body?.appliesToGeneralOnly === "boolean" ? body.appliesToGeneralOnly : true;
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  try {
    const product = await prisma.listingProduct.create({
      data: { code, name, description, postingMonths, price, currency, isActive, appliesToGeneralOnly },
    });
    return NextResponse.json(product);
  } catch (e) {
    const err = e as { code?: string };
    if (err?.code === "P2002") return NextResponse.json({ error: "이미 존재하는 code입니다." }, { status: 400 });
    throw e;
  }
}
