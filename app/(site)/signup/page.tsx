"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toHalfwidth } from "@/lib/input-normalize";
import { AddressSearchButton } from "@/components/AddressSearchButton";
import { safeInternalNextPath } from "@/lib/safe-internal-path";

export default function SignupPage() {
  const router = useRouter();
  const [afterLoginNext, setAfterLoginNext] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const n = new URLSearchParams(window.location.search).get("next");
    setAfterLoginNext(safeInternalNextPath(n));
  }, []);
  const [checkLoading, setCheckLoading] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<"idle" | "available" | "taken">("idle");
  const [form, setForm] = useState({
    name: "",
    username: "",
    phone: "",
    password: "",
    address: "",
    addressDetail: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          username: form.username,
          phone: form.phone,
          password: form.password,
          address: form.address?.trim() || undefined,
          addressDetail: form.addressDetail?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "회원가입에 실패했습니다.");
        return;
      }
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const labelClass = "mb-1.5 block text-sm font-medium text-site-text";
  const inputClass =
    "w-full rounded-lg border border-site-border bg-site-card px-3 py-2.5 text-sm font-input-halfwidth text-site-text placeholder:text-gray-400 focus:border-site-primary focus:outline-none focus:ring-2 focus:ring-site-primary/20";
  const helperClass = "mt-1 text-xs text-gray-500";

  return (
    <main className="min-h-screen bg-site-bg px-4 py-8 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-2xl border border-site-border bg-site-card p-5 shadow-sm sm:p-7">
          <div className="mb-6 text-center sm:mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-site-text sm:text-3xl">회원가입</h1>
            <p className="mt-2 text-sm text-gray-500">정보를 입력하고 바로 서비스를 시작하세요.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className={labelClass}>
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: toHalfwidth(e.target.value) }))}
                />
              </div>

              <div className="sm:col-span-1">
                <label className={labelClass}>
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: toHalfwidth(e.target.value) }))}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>
                  닉네임 <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    required
                    className={inputClass}
                    value={form.username}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, username: toHalfwidth(e.target.value) }));
                      setUsernameCheck("idle");
                    }}
                  />
                  <button
                    type="button"
                    disabled={checkLoading || !form.username.trim()}
                    onClick={async () => {
                      const value = form.username.trim();
                      if (!value) return;
                      setCheckLoading(true);
                      setUsernameCheck("idle");
                      try {
                        const res = await fetch(
                          `/api/auth/check-username?username=${encodeURIComponent(value)}`
                        );
                        const data = await res.json();
                        if (data.available) {
                          setUsernameCheck("available");
                        } else {
                          setUsernameCheck("taken");
                        }
                      } catch {
                        setUsernameCheck("taken");
                      } finally {
                        setCheckLoading(false);
                      }
                    }}
                    className="shrink-0 rounded-lg border border-site-border bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:min-w-[112px]"
                  >
                    {checkLoading ? "확인 중..." : "중복 체크"}
                  </button>
                </div>
                {usernameCheck === "available" && (
                  <p className="mt-1 text-sm text-green-600">사용 가능한 닉네임입니다.</p>
                )}
                {usernameCheck === "taken" && (
                  <p className="mt-1 text-sm text-red-600">이미 사용 중인 닉네임입니다.</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>
                  비밀번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className={inputClass}
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: toHalfwidth(e.target.value) }))
                  }
                />
                <p className={helperClass}>6자 이상 입력해주세요.</p>
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>
                  주소 <span className="text-gray-400">(선택)</span>
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="주소 검색 버튼을 눌러 기본주소를 입력하세요"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                  <AddressSearchButton
                    onSelect={(r) => setForm((f) => ({ ...f, address: r.address }))}
                    label="주소 검색"
                    className="shrink-0 rounded-lg border border-site-border bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:min-w-[112px]"
                  />
                </div>
                <input
                  type="text"
                  className={`${inputClass} mt-2`}
                  placeholder="상세주소 (동·호수 등)"
                  value={form.addressDetail}
                  onChange={(e) => setForm((f) => ({ ...f, addressDetail: e.target.value }))}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-lg bg-site-primary py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "처리 중..." : "가입하기"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-600">
            이미 계정이 있으신가요?{" "}
            <Link
              href={
                afterLoginNext != null
                  ? `/login?next=${encodeURIComponent(afterLoginNext)}`
                  : "/login"
              }
              className="font-medium text-site-primary hover:underline"
            >
              로그인
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
