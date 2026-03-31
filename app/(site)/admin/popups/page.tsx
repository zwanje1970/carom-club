"use client";

import { useState, useEffect } from "react";
import { mdiWindowRestore, mdiPlus } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import { PopupForm } from "@/components/admin/popups/PopupForm";
import { POPUP_PAGE_LABELS } from "@/lib/content/constants";
import type { Popup } from "@/types/popup";

export default function AdminPopupsPage() {
  const [list, setList] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = () => {
    fetch("/api/admin/content/popups")
      .then((res) => res.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const formatDateTime = (value: string | null) => {
    if (!value) return "제한 없음";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("ko-KR");
  };

  const handleSubmit = async (data: Omit<Popup, "createdAt" | "updatedAt">) => {
    const res = await fetch("/api/admin/content/popups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "저장에 실패했습니다.");
    }
    setAdding(false);
    setEditingId(null);
    load();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/content/popups/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "팝업 삭제에 실패했습니다.");
    }
    load();
  };

  if (adding) {
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiWindowRestore} title="팝업 추가">
          <Button href="/admin/popups" label="← 목록" color="contrast" small />
        </SectionTitleLineWithButton>
        <CardBox className="max-w-xl">
          <PopupForm onSubmit={handleSubmit} onCancel={() => setAdding(false)} />
        </CardBox>
      </SectionMain>
    );
  }

  if (editingId) {
    const popup = list.find((p) => p.id === editingId);
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiWindowRestore} title="팝업 수정">
          <Button href="/admin/popups" label="← 목록" color="contrast" small />
        </SectionTitleLineWithButton>
        <CardBox className="max-w-xl">
          {popup ? (
            <PopupForm
              initial={popup}
              onSubmit={handleSubmit}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <p className="text-gray-500">항목을 찾을 수 없습니다.</p>
          )}
        </CardBox>
      </SectionMain>
    );
  }

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiWindowRestore} title="팝업 관리">
        <Button icon={mdiPlus} label="팝업 추가" color="info" small onClick={() => setAdding(true)} />
      </SectionTitleLineWithButton>
      <p className="mb-6 text-sm text-gray-500 dark:text-slate-400">
        페이지 접속 시 표시되는 팝업을 관리합니다. DB 연결 시 메인에 반영됩니다.
      </p>
      <CardBox>
        {loading ? (
          <p className="text-gray-500">불러오는 중…</p>
        ) : list.length === 0 ? (
          <p className="text-gray-500">등록된 팝업이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-site-border">
            {list.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-sm text-gray-500">
                    {POPUP_PAGE_LABELS[p.page]} · {p.isVisible ? "표시" : "숨김"}
                  </p>
                  <p className="text-xs text-gray-500">
                    시작: {formatDateTime(p.startAt)} · 종료: {formatDateTime(p.endAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button label="수정" color="info" small onClick={() => setEditingId(p.id)} />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm("삭제하시겠습니까?")) return;
                      try {
                        await handleDelete(p.id);
                      } catch (error) {
                        window.alert(error instanceof Error ? error.message : "팝업 삭제에 실패했습니다.");
                      }
                    }}
                    className="text-sm text-red-600 hover:underline"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBox>
    </SectionMain>
  );
}
