"use client";

import { useState, useEffect } from "react";
import { mdiViewCarousel, mdiPlus } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import { NoticeBarForm } from "@/components/admin/notice-bars/NoticeBarForm";
import { NOTICE_BAR_PAGE_LABELS } from "@/lib/content/constants";
import type { NoticeBar } from "@/types/notice-bar";

export default function AdminNoticeBarsPage() {
  const [list, setList] = useState<NoticeBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = () => {
    fetch("/api/admin/content/notice-bars")
      .then((res) => res.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (data: Omit<NoticeBar, "createdAt" | "updatedAt">) => {
    const res = await fetch("/api/admin/content/notice-bars", {
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

  if (adding) {
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiViewCarousel} title="공지 배너 추가">
          <Button href="/admin/notice-bars" label="← 목록" color="contrast" small />
        </SectionTitleLineWithButton>
        <CardBox className="max-w-xl">
          <NoticeBarForm onSubmit={handleSubmit} onCancel={() => setAdding(false)} />
        </CardBox>
      </SectionMain>
    );
  }

  if (editingId) {
    const bar = list.find((b) => b.id === editingId);
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiViewCarousel} title="공지 배너 수정">
          <Button href="/admin/notice-bars" label="← 목록" color="contrast" small />
        </SectionTitleLineWithButton>
        <CardBox className="max-w-xl">
          {bar ? (
            <NoticeBarForm
              initial={bar}
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
      <SectionTitleLineWithButton icon={mdiViewCarousel} title="공지 배너 관리">
        <Button icon={mdiPlus} label="배너 추가" color="info" small onClick={() => setAdding(true)} />
      </SectionTitleLineWithButton>
      <p className="mb-6 text-sm text-gray-500 dark:text-slate-400">
        헤더 아래 등에 표시되는 공지 배너를 관리합니다. DB 연결 시 메인에 반영됩니다.
      </p>
      <CardBox>
        {loading ? (
          <p className="text-gray-500">불러오는 중…</p>
        ) : list.length === 0 ? (
          <p className="text-gray-500">등록된 공지 배너가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-site-border">
            {list.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div
                  className="rounded px-3 py-2 text-sm"
                  style={{ backgroundColor: b.backgroundColor, color: b.textColor }}
                >
                  {b.message}
                </div>
                <div className="flex gap-2">
                  <span className="text-sm text-gray-500">{NOTICE_BAR_PAGE_LABELS[b.page]}</span>
                  <Button label="수정" color="info" small onClick={() => setEditingId(b.id)} />
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("삭제하시겠습니까?")) setList((prev) => prev.filter((x) => x.id !== b.id));
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
