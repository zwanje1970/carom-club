"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type EditProfileInitial = {
  name: string;
  email: string;
  phone: string;
  handicap: string;
  avg: string;
};

export function EditProfileForm({
  initial,
}: {
  initial: EditProfileInitial;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState(initial);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch("/api/mypage/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          handicap: form.handicap.trim() || null,
          avg: form.avg.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "수정에 실패했습니다.");
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/mypage");
        router.refresh();
      }, 1000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 p-2 rounded">저장되었습니다.</p>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-site-primary focus:border-site-primary"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          이메일
        </label>
        <input
          type="email"
          className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-site-primary focus:border-site-primary"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          연락처
        </label>
        <input
          type="tel"
          className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-site-primary focus:border-site-primary"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          핸디
        </label>
        <input
          type="text"
          className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-site-primary focus:border-site-primary"
          value={form.handicap}
          onChange={(e) =>
            setForm((f) => ({ ...f, handicap: e.target.value }))
          }
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          AVG
        </label>
        <input
          type="text"
          className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-site-primary focus:border-site-primary"
          value={form.avg}
          onChange={(e) => setForm((f) => ({ ...f, avg: e.target.value }))}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "저장중" : "저장"}
        </button>
        <Link
          href="/mypage"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
