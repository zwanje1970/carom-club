"use client";

import { useState, useEffect } from "react";
import { mdiClose } from "@mdi/js";
import { formatKoreanDate } from "@/lib/format-date";
import Button from "../_components/Button";
import CardBox from "../_components/CardBox";
import CardBoxComponentTitle from "../_components/CardBox/Component/Title";
import OverlayLayer from "../_components/OverlayLayer";

export type TournamentCopySource = {
  tournament: {
    id: string;
    organizationId: string;
    name: string;
    title: string | null;
    slug: string | null;
    summary: string | null;
    description: string | null;
    posterImageUrl: string | null;
    imageUrl: string | null;
    venue: string | null;
    venueName: string | null;
    region: string | null;
    startAt: string;
    endAt: string | null;
    entryFee: number | null;
    prizeInfo: string | null;
    gameFormat: string | null;
    qualification: string | null;
    entryCondition: string | null;
    maxParticipants: number | null;
    status: string;
    approvalType: string | null;
    rules: string | null;
    promoContent: string | null;
    outlineDraft: string | null;
    outlinePublished: string | null;
  };
  rule: {
    entryFee: number | null;
    operatingFee: number | null;
    maxEntries: number | null;
    useWaiting: boolean;
    entryConditions: string | null;
    bracketType: string | null;
    bracketConfig: string | null;
    prizeType: string | null;
    prizeInfo: string | null;
  } | null;
  organization: { id: string; name: string; slug: string };
};

type ListItem = {
  id: string;
  name: string;
  startAt: string;
  organizationId: string;
  venue: string | null;
  status: string;
  organization: { id: string; name: string; slug: string };
};

type Props = {
  isActive: boolean;
  onClose: () => void;
  onSelect: (data: TournamentCopySource) => void;
  sameOrgOnly?: boolean;
  currentOrganizationId?: string;
};

export function LoadPreviousTournamentModal({
  isActive,
  onClose,
  onSelect,
  sameOrgOnly: sameOrgOnlyProp,
  currentOrganizationId,
}: Props) {
  const [list, setList] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOne, setLoadingOne] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sameOrgOnly, setSameOrgOnly] = useState(!!sameOrgOnlyProp);

  useEffect(() => {
    if (!isActive) return;
    setError("");
    setLoading(true);
    const url = sameOrgOnly && currentOrganizationId
      ? `/api/admin/tournaments?take=20&organizationId=${encodeURIComponent(currentOrganizationId)}`
      : "/api/admin/tournaments?take=20";
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("목록을 불러올 수 없습니다.");
        return res.json();
      })
      .then((data: ListItem[]) => {
        setList(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "목록 조회 실패");
        setList([]);
      })
      .finally(() => setLoading(false));
  }, [isActive, sameOrgOnly, currentOrganizationId]);

  async function handleSelect(id: string) {
    setLoadingOne(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/tournaments/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "대회 정보를 불러올 수 없습니다.");
      }
      const data: TournamentCopySource = await res.json();
      onSelect(data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoadingOne(null);
    }
  }

  if (!isActive) return null;

  return (
    <OverlayLayer onClick={onClose} className="cursor-pointer">
      <div
        className="z-50 max-h-[calc(100dvh-8rem)] w-11/12 animate-fade-in md:w-2/3 lg:w-1/2"
        onClick={(e) => e.stopPropagation()}
      >
        <CardBox isModal>
          <CardBoxComponentTitle title="이전 대회 불러오기">
            <Button icon={mdiClose} color="whiteDark" onClick={onClose} small roundedFull />
          </CardBoxComponentTitle>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              선택한 대회 내용을 복사해 새 대회 폼에 채웁니다. 저장 시 새 대회로 생성되며 원본은 변경되지 않습니다.
            </p>
            {currentOrganizationId && (
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={sameOrgOnly}
                  onChange={(e) => setSameOrgOnly(e.target.checked)}
                  className="rounded border-gray-300"
                />
                같은 업체 대회만 보기
              </label>
            )}
            {error && (
              <div className="rounded bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}
            {loading ? (
              <p className="py-4 text-center text-gray-500">목록 불러오는 중…</p>
            ) : list.length === 0 ? (
              <p className="py-4 text-center text-gray-500">불러올 대회가 없습니다.</p>
            ) : (
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {list.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(t.id)}
                      disabled={loadingOne !== null}
                      className="flex w-full items-center justify-between rounded border border-gray-200 px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-800"
                    >
                      <span className="font-medium text-gray-900 dark:text-slate-100">{t.name}</span>
                      <span className="text-sm text-gray-500 dark:text-slate-400">
                        {loadingOne === t.id
                          ? "불러오는 중…"
                          : formatKoreanDate(t.startAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardBox>
      </div>
    </OverlayLayer>
  );
}
