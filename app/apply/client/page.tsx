"use client";

import Link from "next/link";
import { ClientApplyForm } from "@/components/mypage/ClientApplyForm";

export default function ApplyClientPage() {
  return (
    <main className="min-h-screen bg-site-bg p-4 py-10">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold text-site-text text-center mb-2">
          클라이언트 신청
        </h1>
        <p className="text-center text-gray-600 text-sm mb-6">
          당구장·동호회·연맹·주최자·강사로 활동하시려면 신청해 주세요. 승인 후 업체를 등록하고 대회·레슨을 운영할 수 있습니다.
        </p>
        <ClientApplyForm
          successRedirect="/"
          successLinkLabel="메인으로"
          initialData={undefined}
        />
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link href="/login" className="text-site-primary hover:underline">
            로그인
          </Link>
          {" · "}
          <Link href="/mypage/client-apply" className="text-site-primary hover:underline">
            마이페이지에서 신청 (회원정보 자동 입력)
          </Link>
          {" · "}
          <Link href="/" className="text-site-primary hover:underline">
            메인
          </Link>
        </p>
      </div>
    </main>
  );
}
