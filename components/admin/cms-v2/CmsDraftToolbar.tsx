"use client";

import { useCallback, useEffect, useState } from "react";
import type { PageBuilderKey } from "@/lib/content/page-section-page-rules";
import Button from "@/components/admin/_components/Button";

type DraftMeta = { hasDraft: boolean; updatedAt: string | null };

type Props = {
  page: PageBuilderKey;
  /** 목록·미리보기 새로고침 */
  onAfterMutation: () => void | Promise<void>;
  /** 편집 상단 바용 압축 표시 */
  compact?: boolean;
  /** draft 상태 외부 반영 */
  onMetaChange?: (meta: DraftMeta | null) => void;
};

function toError(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err;
  if (typeof err === "string" && err.trim()) return new Error(err);
  if (err && typeof err === "object" && "type" in err) {
    const eventType = String((err as { type?: unknown }).type ?? "unknown");
    return new Error(`${fallback} (event: ${eventType})`);
  }
  return new Error(fallback);
}

/**
 * 초안 저장(공개본 복사)·게시·초기화. 실제 데이터는 서비스 레이어(CmsPageLayoutDraft)에서 처리.
 */
export function CmsDraftToolbar({ page, onAfterMutation, compact = false, onMetaChange }: Props) {
  const [meta, setMeta] = useState<DraftMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshMeta = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/content/cms-page-draft?page=${encodeURIComponent(page)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && typeof data.hasDraft === "boolean") {
        const nextMeta = {
          hasDraft: data.hasDraft,
          updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
        };
        setMeta(nextMeta);
        onMetaChange?.(nextMeta);
      } else {
        setMeta(null);
        onMetaChange?.(null);
      }
    } catch (err) {
      const error = toError(err, "초안 상태를 불러오지 못했습니다.");
      console.error("[CmsDraftToolbar] refreshMeta failed", { page, error, original: err });
      setMeta(null);
      onMetaChange?.(null);
    }
  }, [page, onMetaChange]);

  useEffect(() => {
    void refreshMeta();
  }, [refreshMeta]);

  const run = async (action: "publish" | "reset" | "ensureSave") => {
    if (action === "reset") {
      if (!window.confirm("초안을 버리고, 다음에 불러올 때 공개된 내용을 기준으로 하시겠습니까?")) {
        return;
      }
    }
    if (action === "publish") {
      if (!window.confirm("초안을 공개 사이트에 반영합니다. 계속할까요?")) {
        return;
      }
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/content/cms-page-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, page }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[CmsDraftToolbar] draft action API failed", {
          action,
          page,
          status: res.status,
          statusText: res.statusText,
          response: data,
        });
        setMessage(typeof data?.error === "string" ? data.error : "처리에 실패했습니다.");
        return;
      }
      if (action === "ensureSave" && data?.created === false) {
        setMessage("이미 초안이 있습니다. 편집 내용은 자동으로 초안에 저장됩니다.");
      } else if (action === "ensureSave") {
        setMessage("공개된 내용을 초안으로 복사했습니다.");
      } else {
        setMessage(null);
      }
      await refreshMeta();
      await onAfterMutation();
    } catch (err) {
      const error = toError(err, `${action} 처리 중 오류가 발생했습니다.`);
      console.error("[CmsDraftToolbar] run failed", { action, page, error, original: err });
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const hint =
    meta?.hasDraft && meta.updatedAt
      ? `초안 있음 · 갱신 ${new Date(meta.updatedAt).toLocaleString("ko-KR")}`
      : "초안 없음(편집 시 자동으로 초안이 생깁니다)";

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {hint}
        </span>
        <Button
          label={loading ? "처리 중…" : "초안 저장"}
          color="white"
          small
          disabled={loading}
          onClick={() => void run("ensureSave")}
        />
        <Button
          label="게시"
          color="info"
          small
          disabled={loading}
          onClick={() => void run("publish")}
        />
        <Button
          label="초안 버리기"
          color="danger"
          small
          disabled={loading}
          onClick={() => void run("reset")}
        />
        {message ? <span className="text-xs text-site-primary">{message}</span> : null}
      </div>
    );
  }

  return (
    <div className="rounded border border-amber-200/80 bg-amber-50/90 px-3 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/25">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-amber-950 dark:text-amber-100/90">
          <strong>초안·게시</strong> · {hint}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            label={loading ? "처리 중…" : "초안 저장"}
            color="white"
            small
            disabled={loading}
            onClick={() => void run("ensureSave")}
          />
          <Button
            label="게시"
            color="info"
            small
            disabled={loading}
            onClick={() => void run("publish")}
          />
          <Button
            label="초안 버리기"
            color="danger"
            small
            disabled={loading}
            onClick={() => void run("reset")}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-600 dark:text-slate-400">
        편집한 블록 순서·내용은 게시하기 전까지 공개 사이트에 반영되지 않습니다. 오른쪽 미리보기는 초안 기준입니다.
      </p>
      {message ? <p className="mt-2 text-xs text-site-primary">{message}</p> : null}
    </div>
  );
}
