"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { mdiPlus, mdiMinus } from "@mdi/js";
import Icon from "@mdi/react";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";
import type { FooterSettings, FooterPartner } from "@/lib/footer-settings";
import { FOOTER_PARTNER_CATEGORIES } from "@/lib/footer-settings";

const INPUT_CLASS =
  "w-full rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2 text-site-text focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary text-sm";

function generateId(): string {
  return `fp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function FooterSettingsForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<FooterSettings>({
    footerEnabled: false,
    footerBgColor: null,
    footerTextColor: null,
    footerTitle: null,
    footerCompanyName: null,
    footerBusinessNumber: null,
    footerCeoName: null,
    footerAddress: null,
    footerPhone: null,
    footerEmail: null,
    footerCopyright: null,
    footerPartners: [],
  });

  useEffect(() => {
    fetch("/api/admin/site-settings/footer", { credentials: "include" })
      .then((res) => res.json())
      .then((data: FooterSettings) => {
        setForm({
          footerEnabled: data.footerEnabled ?? false,
          footerBgColor: data.footerBgColor ?? null,
          footerTextColor: data.footerTextColor ?? null,
          footerTitle: data.footerTitle ?? null,
          footerCompanyName: data.footerCompanyName ?? null,
          footerBusinessNumber: data.footerBusinessNumber ?? null,
          footerCeoName: data.footerCeoName ?? null,
          footerAddress: data.footerAddress ?? null,
          footerPhone: data.footerPhone ?? null,
          footerEmail: data.footerEmail ?? null,
          footerCopyright: data.footerCopyright ?? null,
          footerPartners: Array.isArray(data.footerPartners) ? data.footerPartners : [],
        });
      })
      .catch(() => setError("설정을 불러올 수 없습니다."))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-settings/footer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장에 실패했습니다.");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const addPartner = () => {
    setForm((f) => ({
      ...f,
      footerPartners: [
        ...f.footerPartners,
        {
          id: generateId(),
          name: "",
          category: "PARTNER",
          logoUrl: null,
          websiteUrl: null,
          sortOrder: f.footerPartners.length,
          enabled: true,
        },
      ],
    }));
  };

  const updatePartner = (id: string, patch: Partial<FooterPartner>) => {
    setForm((f) => ({
      ...f,
      footerPartners: f.footerPartners.map((p) =>
        p.id === id ? { ...p, ...patch } : p
      ),
    }));
  };

  const removePartner = (id: string) => {
    setForm((f) => ({
      ...f,
      footerPartners: f.footerPartners.filter((p) => p.id !== id),
    }));
  };

  const uploadPartnerLogo = async (partnerId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/site-settings/footer-partner-logo", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "업로드 실패");
    updatePartner(partnerId, { logoUrl: data.url });
  };

  if (loading) {
    return (
      <CardBox>
        <p className="text-gray-500 dark:text-slate-400">불러오는 중...</p>
      </CardBox>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <NotificationBar color="danger">{error}</NotificationBar>
      )}
      {success && (
        <NotificationBar color="success">저장되었습니다.</NotificationBar>
      )}

      <CardBox>
        <h3 className="text-lg font-semibold text-site-text mb-4">푸터 사용</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.footerEnabled}
            onChange={(e) =>
              setForm((f) => ({ ...f, footerEnabled: e.target.checked }))
            }
            className="rounded border-site-border"
          />
          <span className="text-sm text-site-text">푸터 영역 표시 (체크 시 설정한 내용이 하단에 노출됩니다)</span>
        </label>
      </CardBox>

      <CardBox>
        <h3 className="text-lg font-semibold text-site-text mb-4">색상</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">배경색</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={form.footerBgColor || "#1a1a2e"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, footerBgColor: e.target.value }))
                }
                className="h-10 w-14 rounded border border-site-border cursor-pointer"
              />
              <input
                type="text"
                value={form.footerBgColor ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, footerBgColor: e.target.value || null }))
                }
                className={`flex-1 ${INPUT_CLASS}`}
                placeholder="#1a1a2e"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">글자색</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={form.footerTextColor || "#e5e7eb"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, footerTextColor: e.target.value }))
                }
                className="h-10 w-14 rounded border border-site-border cursor-pointer"
              />
              <input
                type="text"
                value={form.footerTextColor ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, footerTextColor: e.target.value || null }))
                }
                className={`flex-1 ${INPUT_CLASS}`}
                placeholder="#e5e7eb"
              />
            </div>
          </div>
        </div>
      </CardBox>

      <CardBox>
        <h3 className="text-lg font-semibold text-site-text mb-4">주관사 정보</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">푸터 제목</label>
            <input
              type="text"
              value={form.footerTitle ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, footerTitle: e.target.value || null }))
              }
              className={INPUT_CLASS}
              placeholder="예: 주관사 안내"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">회사/단체명</label>
            <input
              type="text"
              value={form.footerCompanyName ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, footerCompanyName: e.target.value || null }))
              }
              className={INPUT_CLASS}
              placeholder="(주)회사명"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">사업자등록번호</label>
            <input
              type="text"
              value={form.footerBusinessNumber ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, footerBusinessNumber: e.target.value || null }))
              }
              className={INPUT_CLASS}
              placeholder="000-00-00000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">대표자명</label>
            <input
              type="text"
              value={form.footerCeoName ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, footerCeoName: e.target.value || null }))
              }
              className={INPUT_CLASS}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-site-text mb-1">주소</label>
            <input
              type="text"
              value={form.footerAddress ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, footerAddress: e.target.value || null }))
              }
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">연락처</label>
            <input
              type="text"
              value={form.footerPhone ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, footerPhone: e.target.value || null }))
              }
              className={INPUT_CLASS}
              placeholder="02-0000-0000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">이메일</label>
            <input
              type="email"
              value={form.footerEmail ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, footerEmail: e.target.value || null }))
              }
              className={INPUT_CLASS}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-site-text mb-1">하단 문구 (저작권 등)</label>
            <input
              type="text"
              value={form.footerCopyright ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, footerCopyright: e.target.value || null }))
              }
              className={INPUT_CLASS}
              placeholder="© 2025 캐롬클럽. All rights reserved."
            />
          </div>
        </div>
      </CardBox>

      <CardBox>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-site-text">협력업체</h3>
          <Button
            type="button"
            label="추가"
            color="info"
            small
            icon={mdiPlus}
            onClick={addPartner}
          />
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          카드사, 광고업체, 후원업체 등을 로고 또는 이름으로 표시합니다. 표시 순서는 정렬 순서로 조정할 수 있습니다.
        </p>
        {form.footerPartners.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">등록된 협력업체가 없습니다. 추가 버튼으로 등록하세요.</p>
        ) : (
          <ul className="space-y-4">
            {form.footerPartners
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-start gap-4 p-4 rounded-lg border border-site-border bg-gray-50/50 dark:bg-slate-800/50"
                >
                  <div className="flex-1 min-w-[200px] space-y-2">
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => updatePartner(p.id, { name: e.target.value })}
                      className={INPUT_CLASS}
                      placeholder="업체명"
                    />
                    <select
                      value={p.category}
                      onChange={(e) =>
                        updatePartner(p.id, {
                          category: e.target.value as FooterPartner["category"],
                        })
                      }
                      className={INPUT_CLASS}
                    >
                      {FOOTER_PARTNER_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="url"
                      value={p.websiteUrl ?? ""}
                      onChange={(e) =>
                        updatePartner(p.id, { websiteUrl: e.target.value || null })
                      }
                      className={INPUT_CLASS}
                      placeholder="웹사이트 URL (선택)"
                    />
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={(e) =>
                            updatePartner(p.id, { enabled: e.target.checked })
                          }
                          className="rounded border-site-border"
                        />
                        표시
                      </label>
                      <label className="flex items-center gap-2 text-sm text-site-text">
                        순서
                        <input
                          type="number"
                          min={0}
                          value={p.sortOrder}
                          onChange={(e) =>
                            updatePartner(p.id, {
                              sortOrder: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-16 rounded border border-site-border px-2 py-1 text-sm"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-12 w-24 rounded border border-site-border bg-white dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                      {p.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-xs text-gray-400">로고</span>
                      )}
                    </div>
                    <label className="cursor-pointer rounded border border-site-border px-2 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-slate-700">
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadPartnerLogo(p.id, file).catch((err) => setError(err.message));
                        }}
                      />
                      업로드
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePartner(p.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded"
                    title="삭제"
                  >
                    <Icon path={mdiMinus} size={0.9} />
                  </button>
                </li>
              ))}
          </ul>
        )}
      </CardBox>

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          label={saving ? "저장 중..." : "저장"}
          color="info"
          disabled={saving}
        />
        <Button href="/admin/settings" label="취소" color="contrast" outline />
      </div>
    </form>
  );
}
