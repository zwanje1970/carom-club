"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toHalfwidth } from "@/lib/input-normalize";

const CLIENT_TYPES = [
  { value: "VENUE", label: "당구장" },
  { value: "CLUB", label: "동호회" },
  { value: "FEDERATION", label: "연맹/협회" },
  { value: "HOST", label: "일반 주최자" },
  { value: "INSTRUCTOR", label: "선수/강사/코치" },
] as const;

export type ClientApplyInitialData = {
  applicantName?: string;
  email?: string;
  phone?: string;
};

export type ExistingApplication = {
  id: string;
  type: string;
  status: string;
  organizationName: string;
  applicantName: string;
  phone: string;
  email: string;
  region: string | null;
  shortDescription: string | null;
  referenceLink: string | null;
};

type Props = {
  successRedirect: string;
  successLinkLabel?: string;
  /** 마이페이지 등에서 넘겨주면 신청자 이름·이메일·연락처 자동 채움 */
  initialData?: ClientApplyInitialData | null;
  /** PENDING 신청이 있으면 폼에 채우고 수정 가능 */
  existingApplication?: ExistingApplication | null;
};

export function ClientApplyForm({ successRedirect, successLinkLabel = "확인", initialData, existingApplication }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const isEditMode = existingApplication?.status === "PENDING";
  const initialEditSnapshot = useRef<Record<string, string> | null>(null);

  const [form, setForm] = useState({
    type: (existingApplication?.type ?? "VENUE") as (typeof CLIENT_TYPES)[number]["value"],
    organizationName: existingApplication?.organizationName ?? "",
    applicantName: existingApplication?.applicantName ?? initialData?.applicantName ?? "",
    phone: existingApplication?.phone ?? initialData?.phone ?? "",
    email: existingApplication?.email ?? initialData?.email ?? "",
    region: existingApplication?.region ?? "",
    shortDescription: existingApplication?.shortDescription ?? "",
    referenceLink: existingApplication?.referenceLink ?? "",
  });

  useEffect(() => {
    if (existingApplication?.status === "PENDING") {
      const n = (s: string | null | undefined) => toHalfwidth(String(s ?? "").trim());
      const snapshot = {
        type: n(existingApplication.type ?? "VENUE"),
        organizationName: n(existingApplication.organizationName ?? ""),
        applicantName: n(existingApplication.applicantName ?? ""),
        phone: n(existingApplication.phone ?? ""),
        email: n(existingApplication.email ?? ""),
        region: n(existingApplication.region ?? ""),
        shortDescription: n(existingApplication.shortDescription ?? ""),
        referenceLink: n(existingApplication.referenceLink ?? ""),
      };
      initialEditSnapshot.current = snapshot;
      setForm({
        type: (existingApplication.type ?? "VENUE") as (typeof CLIENT_TYPES)[number]["value"],
        organizationName: existingApplication.organizationName ?? "",
        applicantName: existingApplication.applicantName ?? "",
        phone: existingApplication.phone ?? "",
        email: existingApplication.email ?? "",
        region: existingApplication.region ?? "",
        shortDescription: existingApplication.shortDescription ?? "",
        referenceLink: existingApplication.referenceLink ?? "",
      });
      return;
    }
    initialEditSnapshot.current = null;
    if (initialData) return;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { name?: string; email?: string; phone?: string }) => {
        if (data.name || data.email || data.phone) {
          setForm((f) => ({
            ...f,
            applicantName: data.name ?? f.applicantName,
            email: data.email ?? f.email,
            phone: data.phone ?? f.phone,
          }));
        }
      })
      .catch(() => {});
  }, [initialData, existingApplication]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (isEditMode && initialEditSnapshot.current) {
      const n = (s: string | null | undefined) => toHalfwidth(String(s ?? "").trim());
      const cur = {
        type: n(form.type),
        organizationName: n(form.organizationName),
        applicantName: n(form.applicantName),
        phone: n(form.phone),
        email: n(form.email),
        region: n(form.region),
        shortDescription: n(form.shortDescription),
        referenceLink: n(form.referenceLink),
      };
      const init = initialEditSnapshot.current;
      if (
        cur.type === init.type &&
        cur.organizationName === init.organizationName &&
        cur.applicantName === init.applicantName &&
        cur.phone === init.phone &&
        cur.email === init.email &&
        cur.region === init.region &&
        cur.shortDescription === init.shortDescription &&
        cur.referenceLink === init.referenceLink
      ) {
        setError("수정한 내용이 없습니다.");
        return;
      }
    }

    setLoading(true);
    try {
      const url = isEditMode ? "/api/mypage/client-application" : "/api/apply/client";
      const method = isEditMode ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; demo?: boolean };
      if (!res.ok) {
        setError(data.error || (isEditMode ? "수정에 실패했습니다." : "신청에 실패했습니다."));
        return;
      }
      setDemoMode(!!data.demo);
      setDone(true);
      setTimeout(() => router.push(successRedirect), 1500);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="bg-site-card rounded-lg border border-site-border p-6 text-center">
        <h2 className="text-xl font-bold text-site-text">
          {isEditMode ? "수정이 완료되었습니다" : "신청이 접수되었습니다"}
        </h2>
        <p className="mt-2 text-gray-600 text-sm">
          검토 후 승인 시 연락드리겠습니다. 승인되면 클라이언트 대시보드에서 업체를 설정할 수 있습니다.
        </p>
        {demoMode && (
          <p className="mt-2 text-amber-600 text-xs">
            데모 모드: DB 미연결로 저장되지 않았습니다. .env에 DATABASE_URL을 설정하면 실제 저장됩니다.
          </p>
        )}
        <Link
          href={successRedirect}
          className="mt-6 inline-block rounded-lg bg-site-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          {successLinkLabel}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-site-card rounded-lg border border-site-border p-6 space-y-4"
    >
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">{error}</p>
          {error.includes("데이터베이스") && !error.includes("DATABASE_URL") && (
            <p className="mt-2 text-amber-800">
              잠시 후 다시 시도해 주세요. 계속되면 관리자에게 문의해 주세요.
            </p>
          )}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">신청 유형 *</label>
        <select
          required
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={form.type}
          onChange={(e) =>
            setForm((f) => ({ ...f, type: e.target.value as typeof form.type }))
          }
        >
          {CLIENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">업체/단체명 *</label>
        <input
          type="text"
          required
          className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
          placeholder="예: OO당구장"
          value={form.organizationName}
          onChange={(e) =>
            setForm((f) => ({ ...f, organizationName: toHalfwidth(e.target.value) }))
          }
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">신청자 이름 *</label>
        <input
          type="text"
          required
          className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
          value={form.applicantName}
          onChange={(e) =>
            setForm((f) => ({ ...f, applicantName: toHalfwidth(e.target.value) }))
          }
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">연락처 *</label>
        <input
          type="tel"
          required
          className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: toHalfwidth(e.target.value) }))}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">이메일 *</label>
        <input
          type="email"
          required
          className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: toHalfwidth(e.target.value) }))}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">지역</label>
        <input
          type="text"
          className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
          placeholder="예: 서울 강남구"
          value={form.region}
          onChange={(e) => setForm((f) => ({ ...f, region: toHalfwidth(e.target.value) }))}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">한줄 소개</label>
        <input
          type="text"
          className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
          placeholder="업체/활동을 한 줄로 소개"
          value={form.shortDescription}
          onChange={(e) =>
            setForm((f) => ({ ...f, shortDescription: toHalfwidth(e.target.value) }))
          }
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">참고 링크</label>
        <input
          type="url"
          className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
          placeholder="https://..."
          value={form.referenceLink}
          onChange={(e) =>
            setForm((f) => ({ ...f, referenceLink: toHalfwidth(e.target.value) }))
          }
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-site-primary py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (isEditMode ? "저장 중..." : "제출 중...") : isEditMode ? "수정 완료" : "신청하기"}
        </button>
        <Link
          href={successRedirect}
          className="rounded-lg border border-site-border px-4 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
