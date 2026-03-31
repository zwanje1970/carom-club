"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { mdiBrushVariant } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";
import {
  SITE_COLOR_THEME_IDS,
  SITE_COLOR_THEME_PRESETS,
  SITE_CUSTOM_COLOR_THEME_PRESET,
  hexForColorInput,
  isSiteColorThemeId,
  normalizeHexColor,
  parseSiteThemeCustomTokens,
  tokensFromPreset,
  type SiteColorThemeId,
  type SiteThemeCssTokens,
} from "@/lib/site-color-themes";

type ActiveTheme = SiteColorThemeId | typeof SITE_CUSTOM_COLOR_THEME_PRESET | null;

const TOKEN_FIELDS: { key: keyof SiteThemeCssTokens; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "bg", label: "배경 (background)" },
  { key: "card", label: "표면 (surface)" },
  { key: "text", label: "본문 (text)" },
  { key: "textMuted", label: "보조·muted" },
  { key: "border", label: "테두리 (border)" },
];

function ColorTokenRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const picker = hexForColorInput(value);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 py-2 last:border-0 dark:border-slate-700">
      <span className="w-40 shrink-0 text-sm font-medium text-site-text">{label}</span>
      <input
        type="color"
        aria-label={`${label} 색상 선택`}
        className="h-9 w-14 cursor-pointer rounded border border-site-border bg-white p-0.5 dark:bg-slate-900"
        value={picker}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        type="text"
        spellCheck={false}
        placeholder="#RRGGBB"
        className="min-w-[8rem] flex-1 rounded border border-site-border bg-white px-2 py-1.5 font-mono text-sm text-site-text dark:bg-slate-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function AdminSiteColorThemePage() {
  const router = useRouter();
  const [active, setActive] = useState<ActiveTheme>(null);
  const [loading, setLoading] = useState(true);
  const [customDraft, setCustomDraft] = useState<SiteThemeCssTokens | null>(null);
  const [duplicatedFrom, setDuplicatedFrom] = useState<SiteColorThemeId | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    fetch("/api/site-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const p = d?.colorThemePreset;
        if (p === SITE_CUSTOM_COLOR_THEME_PRESET && d?.colorThemeCustom) {
          setActive(SITE_CUSTOM_COLOR_THEME_PRESET);
          const parsed = parseSiteThemeCustomTokens(d.colorThemeCustom);
          setCustomDraft(parsed ?? tokensFromPreset("saas"));
          setDuplicatedFrom(null);
        } else if (typeof p === "string" && isSiteColorThemeId(p)) {
          setActive(p);
          setCustomDraft(null);
          setDuplicatedFrom(null);
        } else {
          setActive(null);
          setCustomDraft(null);
          setDuplicatedFrom(null);
        }
      })
      .catch(() => {
        setActive(null);
        setCustomDraft(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const applyPreset = async (id: SiteColorThemeId) => {
    setError("");
    setOk(false);
    setBusy(id);
    try {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorThemePreset: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "저장에 실패했습니다.");
        return;
      }
      setActive(id);
      setCustomDraft(null);
      setDuplicatedFrom(null);
      setOk(true);
      router.refresh();
    } catch {
      setError("네트워크 오류입니다.");
    } finally {
      setBusy(null);
    }
  };

  const saveCustom = async () => {
    if (!customDraft) return;
    const parsed = parseSiteThemeCustomTokens(customDraft);
    if (!parsed) {
      setError("모든 색상을 올바른 HEX 형식(#RGB 또는 #RRGGBB)으로 입력하세요.");
      return;
    }
    setError("");
    setOk(false);
    setBusy("custom-save");
    try {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colorThemePreset: SITE_CUSTOM_COLOR_THEME_PRESET,
          colorThemeCustom: parsed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "저장에 실패했습니다.");
        return;
      }
      setActive(SITE_CUSTOM_COLOR_THEME_PRESET);
      setCustomDraft(parsed);
      setOk(true);
      router.refresh();
    } catch {
      setError("네트워크 오류입니다.");
    } finally {
      setBusy(null);
    }
  };

  const clearPreset = async () => {
    setError("");
    setOk(false);
    setBusy("clear");
    try {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorThemePreset: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "저장에 실패했습니다.");
        return;
      }
      setActive(null);
      setCustomDraft(null);
      setDuplicatedFrom(null);
      setOk(true);
      router.refresh();
    } catch {
      setError("네트워크 오류입니다.");
    } finally {
      setBusy(null);
    }
  };

  const duplicateFrom = (id: SiteColorThemeId) => {
    setError("");
    setOk(false);
    setCustomDraft(tokensFromPreset(id));
    setDuplicatedFrom(id);
    setActive(SITE_CUSTOM_COLOR_THEME_PRESET);
  };

  const patchToken = (key: keyof SiteThemeCssTokens, raw: string) => {
    setCustomDraft((prev) => {
      const base = prev ?? tokensFromPreset("saas");
      const n = normalizeHexColor(raw);
      return { ...base, [key]: n ?? raw };
    });
  };

  const customValid = customDraft ? parseSiteThemeCustomTokens(customDraft) != null : false;

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiBrushVariant} title="색상 테마">
        <Button href="/admin/site/settings" label="디자인/브랜드 설정" color="contrast" small />
      </SectionTitleLineWithButton>
      <p className="mb-4 max-w-3xl text-sm text-gray-600 dark:text-slate-400">
        검증된 <strong>프리셋 4종</strong>을 그대로 쓰거나, 프리셋을 복제한 뒤 색을 직접 조정한{" "}
        <strong>커스텀 테마</strong>를 저장할 수 있습니다. 저장 시 공개 사이트 전역에 반영됩니다(캐시는 최대
        1분).
      </p>
      {loading ? (
        <p className="text-gray-500">불러오는 중…</p>
      ) : (
        <>
          {error ? <NotificationBar color="danger">{error}</NotificationBar> : null}
          {ok ? (
            <NotificationBar color="success">
              저장되었습니다. 공개 페이지를 새로고침하면 색상이 반영됩니다.
            </NotificationBar>
          ) : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {SITE_COLOR_THEME_IDS.map((id) => {
              const p = SITE_COLOR_THEME_PRESETS[id];
              const isActive = active === id;
              return (
                <CardBox key={id} className={`p-4 ${isActive ? "ring-2 ring-site-primary" : ""}`}>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span
                      className="h-8 w-8 rounded-full border border-site-border shadow-sm"
                      style={{ backgroundColor: p.primary }}
                      title="primary"
                    />
                    <span
                      className="h-8 w-8 rounded-full border border-site-border shadow-sm"
                      style={{ backgroundColor: p.secondary }}
                      title="secondary"
                    />
                    <span
                      className="h-8 w-8 rounded-full border border-site-border shadow-sm"
                      style={{ backgroundColor: p.bg }}
                      title="background"
                    />
                    <span
                      className="h-8 w-8 rounded-full border border-site-border shadow-sm"
                      style={{ backgroundColor: p.card }}
                      title="surface"
                    />
                    <span
                      className="h-8 w-8 rounded-full border border-site-border shadow-sm"
                      style={{ backgroundColor: p.text }}
                      title="text"
                    />
                    <span
                      className="h-8 w-8 rounded-full border border-site-border shadow-sm"
                      style={{ backgroundColor: p.textMuted }}
                      title="muted"
                    />
                  </div>
                  <h3 className="text-base font-semibold text-site-text">{p.label}</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">{p.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      label={isActive ? "적용 중" : "이 테마 적용"}
                      color="info"
                      small
                      disabled={!!busy || isActive}
                      onClick={() => void applyPreset(id)}
                    />
                    <Button
                      label="복제 후 편집"
                      color="contrast"
                      small
                      outline
                      disabled={!!busy}
                      onClick={() => duplicateFrom(id)}
                    />
                  </div>
                </CardBox>
              );
            })}
          </div>

          <CardBox
            className={`mt-6 p-4 ${active === SITE_CUSTOM_COLOR_THEME_PRESET ? "ring-2 ring-site-primary" : ""}`}
          >
            <h3 className="text-base font-semibold text-site-text">커스텀 테마</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
              위 프리셋 카드에서 <strong>복제 후 편집</strong>을 누르면 값이 채워집니다. 색상 선택기와 HEX
              입력을 모두 사용할 수 있습니다.
            </p>
            {duplicatedFrom ? (
              <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
                복제 원본: {SITE_COLOR_THEME_PRESETS[duplicatedFrom].label}
              </p>
            ) : null}
            {customDraft ? (
              <div className="mt-4 max-w-xl">
                {TOKEN_FIELDS.map(({ key, label }) => (
                  <ColorTokenRow
                    key={key}
                    label={label}
                    value={customDraft[key]}
                    onChange={(v) => patchToken(key, v)}
                  />
                ))}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    label={busy === "custom-save" ? "저장 중…" : "커스텀 테마 저장"}
                    color="info"
                    small
                    disabled={!!busy || !customValid}
                    onClick={() => void saveCustom()}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">
                아직 편집 중인 커스텀 초안이 없습니다. 프리셋 카드에서 「복제 후 편집」을 눌러 주세요.
              </p>
            )}
          </CardBox>

          <CardBox className="mt-6 p-4">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              프리셋·커스텀을 끄고 <strong>디자인/브랜드 설정</strong>의 메인/보조 색만 쓰려면 아래를 누르세요.
              (배경·카드 등은 기본 밝은 셸로 돌아갑니다.)
            </p>
            <Button
              className="mt-3"
              label={busy === "clear" ? "처리 중…" : "프리셋 해제 (커스텀 색만)"}
              color="contrast"
              small
              outline
              disabled={!!busy || active === null}
              onClick={() => void clearPreset()}
            />
          </CardBox>
        </>
      )}
    </SectionMain>
  );
}
