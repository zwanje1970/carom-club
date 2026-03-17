"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ReportItem = {
  id: string;
  targetType: string;
  targetId: string;
  postId: string | null;
  commentId: string | null;
  reason: string;
  reasonLabel: string;
  status: string;
  adminMemo: string | null;
  processedAt: string | null;
  processedBy: string | null;
  createdAt: string;
  reporter: { id: string; name: string; username: string } | null;
  post: { id: string; title: string; boardSlug: string; boardName: string; isHidden: boolean } | null;
  comment: { id: string; content: string; postId: string; postTitle: string; boardSlug: string; boardName: string; isHidden: boolean } | null;
};

const STATUS_OPTIONS = [
  { value: "PENDING", label: "대기" },
  { value: "REVIEWED", label: "검토함" },
  { value: "RESOLVED", label: "처리완료" },
  { value: "DISMISSED", label: "기각" },
];

export default function CommunityReportsClient() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [adminMemo, setAdminMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const loadList = () => {
    setLoading(true);
    fetch("/api/community/reports", { credentials: "include" })
      .then((res) => {
        if (res.status === 403) throw new Error("권한이 없습니다.");
        if (!res.ok) throw new Error("목록을 불러올 수 없습니다.");
        return res.json();
      })
      .then((data) => {
        setItems(data.items ?? []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetch(`/api/community/reports/${selectedId}`, { credentials: "include" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        setDetail(data);
        if (data) {
          setStatus(data.status);
          setAdminMemo(data.adminMemo ?? "");
        }
      })
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const handlePatch = async (payload: { status?: string; adminMemo?: string; hidePost?: boolean; unhidePost?: boolean; hideComment?: boolean; unhideComment?: boolean }) => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/community/reports/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        loadList();
        if (detail) {
          const next = { ...detail };
          if (payload.status != null) next.status = payload.status;
          if (payload.adminMemo !== undefined) next.adminMemo = payload.adminMemo;
          if (payload.hidePost && next.post) next.post = { ...next.post, isHidden: true };
          if (payload.unhidePost && next.post) next.post = { ...next.post, isHidden: false };
          if (payload.hideComment && next.comment) next.comment = { ...next.comment, isHidden: true };
          if (payload.unhideComment && next.comment) next.comment = { ...next.comment, isHidden: false };
          setDetail(next);
        }
      } else {
        const data = await res.json();
        alert(data.error ?? "저장 실패");
      }
    } finally {
      setSaving(false);
    }
  };

  const saveStatusAndMemo = () => {
    handlePatch({ status, adminMemo });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">신고 목록</h2>
        <Link href="/community" className="text-sm text-site-primary hover:underline">커뮤니티로</Link>
      </div>

      {loading ? (
        <p className="text-gray-500">불러오는 중…</p>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-slate-600 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800">
              <tr>
                <th className="text-left p-3">대상</th>
                <th className="text-left p-3">사유</th>
                <th className="text-left p-3">상태</th>
                <th className="text-left p-3">신고자</th>
                <th className="text-left p-3">일시</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">신고 내역이 없습니다.</td>
                </tr>
              )}
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="p-3">
                    {r.targetType === "post" && r.post ? (
                      <span className={r.post.isHidden ? "text-gray-400" : ""}>글: {r.post.title.slice(0, 30)}{r.post.title.length > 30 ? "…" : ""}</span>
                    ) : r.comment ? (
                      <span className={r.comment.isHidden ? "text-gray-400" : ""}>댓글: {r.comment.content.slice(0, 20)}…</span>
                    ) : (
                      r.targetType
                    )}
                  </td>
                  <td className="p-3">{r.reasonLabel}</td>
                  <td className="p-3">{STATUS_OPTIONS.find((s) => s.value === r.status)?.label ?? r.status}</td>
                  <td className="p-3">{r.reporter?.name ?? r.reporter?.username ?? "-"}</td>
                  <td className="p-3">{new Date(r.createdAt).toLocaleString("ko-KR")}</td>
                  <td className="p-3">
                    <button type="button" onClick={() => setSelectedId(r.id)} className="text-site-primary hover:underline">
                      상세
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-slate-600 flex justify-between items-center">
              <h3 className="font-semibold">신고 상세</h3>
              <button type="button" onClick={() => setSelectedId(null)} className="text-gray-500 hover:text-site-text">닫기</button>
            </div>
            <div className="p-4 space-y-4">
              {detailLoading ? (
                <p className="text-gray-500">불러오는 중…</p>
              ) : detail ? (
                <>
                  <div>
                    <p className="text-sm text-gray-500">대상</p>
                    <p className="font-medium">{detail.targetType === "post" ? "게시글" : "댓글"}</p>
                    {detail.post && (
                      <p className="mt-1 text-sm">
                        글: {detail.post.title}
                        {detail.post.boardName && ` (${detail.post.boardName})`}
                        {detail.post.isHidden && <span className="text-amber-600 ml-1">[숨김]</span>}
                      </p>
                    )}
                    {detail.comment && (
                      <p className="mt-1 text-sm">
                        댓글: {detail.comment.content.slice(0, 100)}{detail.comment.content.length > 100 ? "…" : ""}
                        {detail.comment.isHidden && <span className="text-amber-600 ml-1">[숨김]</span>}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">신고 사유</p>
                    <p>{detail.reasonLabel}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">신고자</p>
                    <p>{detail.reporter?.name ?? detail.reporter?.username ?? "-"}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">상태</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2">
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">관리자 메모</label>
                    <textarea value={adminMemo} onChange={(e) => setAdminMemo(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2" placeholder="메모 입력" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={saveStatusAndMemo} disabled={saving} className="py-2 px-4 rounded-lg bg-site-primary text-white text-sm font-medium disabled:opacity-50">
                      {saving ? "저장 중…" : "상태·메모 저장"}
                    </button>
                    {detail.post && (
                      <>
                        {detail.post.isHidden ? (
                          <button type="button" onClick={() => handlePatch({ unhidePost: true })} disabled={saving} className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600 text-sm disabled:opacity-50">
                            글 숨김 해제
                          </button>
                        ) : (
                          <button type="button" onClick={() => handlePatch({ hidePost: true })} disabled={saving} className="py-2 px-4 rounded-lg border border-amber-600 text-amber-600 text-sm disabled:opacity-50">
                            글 숨김 처리
                          </button>
                        )}
                        <Link href={`/community/posts/${detail.post.id}`} target="_blank" rel="noopener noreferrer" className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600 text-sm">
                          글 보기
                        </Link>
                      </>
                    )}
                    {detail.comment && (
                      <>
                        {detail.comment.isHidden ? (
                          <button type="button" onClick={() => handlePatch({ unhideComment: true })} disabled={saving} className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600 text-sm disabled:opacity-50">
                            댓글 숨김 해제
                          </button>
                        ) : (
                          <button type="button" onClick={() => handlePatch({ hideComment: true })} disabled={saving} className="py-2 px-4 rounded-lg border border-amber-600 text-amber-600 text-sm disabled:opacity-50">
                            댓글 숨김 처리
                          </button>
                        )}
                        <Link href={`/community/posts/${detail.comment.postId}#comment-${detail.comment.id}`} target="_blank" rel="noopener noreferrer" className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600 text-sm">
                          댓글 보기
                        </Link>
                      </>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
