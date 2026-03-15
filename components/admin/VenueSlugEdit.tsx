"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "./_components/Button";

export function VenueSlugEdit({
  organizationId,
  initialSlug,
}: {
  organizationId: string;
  initialSlug: string | null;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/venues/${organizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "저장에 실패했습니다.");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="예: hmc, billion"
        className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        aria-label="URL slug"
      />
      <Button type="submit" color="info" small disabled={saving} label={saving ? "저장 중…" : "저장"} />
      {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
    </form>
  );
}
