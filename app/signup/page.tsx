"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toHalfwidth } from "@/lib/input-normalize";
import { AddressSearchButton } from "@/components/AddressSearchButton";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<"idle" | "available" | "taken">("idle");
  const [form, setForm] = useState({
    name: "",
    username: "",
    phone: "",
    password: "",
    handicap: "",
    avg: "",
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
          handicap: form.handicap || undefined,
          avg: form.avg || undefined,
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

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-site-bg">
      <div className="w-full max-w-md bg-site-card rounded-lg shadow border border-site-border p-6">
        <h1 className="text-2xl font-bold text-center mb-6">회원가입</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: toHalfwidth(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              닉네임 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                className="flex-1 border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
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
                className="shrink-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              연락처 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: toHalfwidth(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength={6}
              className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: toHalfwidth(e.target.value) }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              핸디 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
              value={form.handicap}
              onChange={(e) =>
                setForm((f) => ({ ...f, handicap: toHalfwidth(e.target.value) }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AVG <span className="text-gray-400">(선택)</span>
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
              value={form.avg}
              onChange={(e) => setForm((f) => ({ ...f, avg: toHalfwidth(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              주소 <span className="text-gray-400">(선택)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
                placeholder="주소 검색 버튼을 눌러 기본주소를 입력하세요"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
              <AddressSearchButton
                onSelect={(r) => setForm((f) => ({ ...f, address: r.address }))}
                label="주소 검색"
              />
            </div>
            <input
              type="text"
              className="mt-2 w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
              placeholder="상세주소 (동·호수 등)"
              value={form.addressDetail}
              onChange={(e) => setForm((f) => ({ ...f, addressDetail: e.target.value }))}
            />
          </div>
          <p className="text-xs text-gray-500">
            AVG 증빙 이미지는 가입 후 마이페이지에서 등록할 수 있습니다.
          </p>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-site-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "처리 중..." : "가입하기"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-site-primary hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
