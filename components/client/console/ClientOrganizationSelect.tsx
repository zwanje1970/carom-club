"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ClientOrganization } from "@/types/client-organization";

export function ClientOrganizationSelect({
  organizations,
  activeOrganizationId,
}: {
  organizations: ClientOrganization[];
  activeOrganizationId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (organizations.length === 0) {
    return (
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        접근 가능한 운영 조직이 없습니다
      </span>
    );
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-2">
      <span className="hidden shrink-0 text-[11px] font-medium uppercase tracking-wide text-zinc-500 sm:inline">
        운영 조직
      </span>
      <label className="sr-only" htmlFor="client-console-org-select">
        운영 조직 선택
      </label>
      <select
        id="client-console-org-select"
        className="max-w-[min(18rem,72vw)] border border-zinc-300 bg-white py-1.5 pl-2 pr-7 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        value={activeOrganizationId ?? ""}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          if (!id || id === activeOrganizationId) return;
          startTransition(async () => {
            const res = await fetch("/api/client/active-organization", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ organizationId: id }),
            });
            if (res.ok) {
              router.refresh();
            }
          });
        }}
      >
        {organizations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
