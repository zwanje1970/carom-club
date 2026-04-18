"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  isOrgType,
  normalizeRepresentativeImageUrls,
  parseTypeSpecific,
} from "../../../lib/client-organization-setup-parse";
import {
  ORG_TYPES,
  type ClubSpecific,
  type CurriculumItem,
  type FederationSpecific,
  type InstructorSpecific,
  type OrgType,
  type TypeSpecific,
  type VenuePricingType,
  type VenueSpecific,
  emptyTypeSpecificForType,
} from "../../../lib/client-organization-setup-types";

type SetupFormState = {
  name: string;
  type: OrgType;
  phone: string;
  website: string;
  /** 도로명 주소 */
  address: string;
  addressDetail: string;
  addressJibun: string;
  zipCode: string;
  addressNaverMapEnabled: boolean;
  typeSpecific: TypeSpecific;
  isPublished: boolean;
  setupCompleted: boolean;
};

/** 업체 설정 화면에서 다루지 않는 필드 — 저장 시 기존 값 유지 */
type PreservedOrgFields = {
  shortDescription: string;
  description: string;
  logoImageUrl: string;
  coverImageUrl: string;
  email: string;
  region: string;
  representativeImageUrls: string[];
};

type DaumPostcodeData = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  address: string;
  buildingName: string;
  apartment: string;
};

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: { oncomplete: (data: DaumPostcodeData) => void }) => { open: () => void };
    };
  }
}

function loadDaumPostcodeScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.daum?.Postcode) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("script"));
    document.head.appendChild(s);
  });
}

export default function ClientSetupPage() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveFeedback, setSaveFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const preservedOrgRef = useRef<PreservedOrgFields>({
    shortDescription: "",
    description: "",
    logoImageUrl: "",
    coverImageUrl: "",
    email: "",
    region: "",
    representativeImageUrls: [],
  });

  const [form, setForm] = useState<SetupFormState>({
    name: "",
    type: "VENUE",
    phone: "",
    website: "",
    address: "",
    addressDetail: "",
    addressJibun: "",
    zipCode: "",
    addressNaverMapEnabled: false,
    typeSpecific: emptyTypeSpecificForType("VENUE"),
    isPublished: false,
    setupCompleted: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/client/organization");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setLoadError(typeof data.error === "string" ? data.error : "불러오지 못했습니다.");
          return;
        }
        if (cancelled) return;
        const orgType: OrgType = isOrgType(data.type) ? data.type : "VENUE";
        const typeSpecific = parseTypeSpecific(orgType, data.typeSpecificJson ?? null);
        let mergedRep: string[] = [];
        if (orgType === "VENUE") {
          const rep = normalizeRepresentativeImageUrls((typeSpecific as VenueSpecific).representativeImageUrls);
          const coverImageUrl = String(data.coverImageUrl ?? "").trim();
          mergedRep = rep.length > 0 ? rep : coverImageUrl ? [coverImageUrl] : [];
          (typeSpecific as VenueSpecific).representativeImageUrls = mergedRep;
        }
        preservedOrgRef.current = {
          shortDescription: typeof data.shortDescription === "string" ? data.shortDescription : "",
          description: typeof data.description === "string" ? data.description : "",
          logoImageUrl: typeof data.logoImageUrl === "string" ? data.logoImageUrl : "",
          coverImageUrl: typeof data.coverImageUrl === "string" ? data.coverImageUrl : "",
          email: typeof data.email === "string" ? data.email : "",
          region: typeof data.region === "string" ? data.region : "",
          representativeImageUrls: mergedRep,
        };
        setForm({
          name: typeof data.name === "string" ? data.name : "",
          type: orgType,
          phone: typeof data.phone === "string" ? data.phone : "",
          website: typeof data.website === "string" ? data.website : "",
          address: typeof data.address === "string" ? data.address : "",
          addressDetail: typeof data.addressDetail === "string" ? data.addressDetail : "",
          addressJibun: typeof data.addressJibun === "string" ? data.addressJibun : "",
          zipCode: typeof data.zipCode === "string" ? data.zipCode : "",
          addressNaverMapEnabled: data.addressNaverMapEnabled === true,
          typeSpecific,
          isPublished: data.isPublished === true,
          setupCompleted: data.setupCompleted === true,
        });
      } catch {
        if (!cancelled) setLoadError("불러오는 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setTypeSpecific(update: Partial<TypeSpecific>) {
    setForm((f) => ({ ...f, typeSpecific: { ...f.typeSpecific, ...update } }));
  }

  function setCurriculum(items: CurriculumItem[]) {
    setTypeSpecific({ curriculum: items });
  }

  async function openAddressSearch() {
    try {
      await loadDaumPostcodeScript();
      new window.daum!.Postcode({
        oncomplete: (data: DaumPostcodeData) => {
          const road = data.roadAddress || data.address || "";
          setForm((f) => ({
            ...f,
            address: road,
            addressJibun: data.jibunAddress || "",
            zipCode: data.zonecode || "",
          }));
        },
      }).open();
    } catch {
      // 스크립트 로드 실패 시 무시
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveState("saving");
    setSaveFeedback(null);
    try {
      const p = preservedOrgRef.current;
      const repUrls = normalizeRepresentativeImageUrls(p.representativeImageUrls);
      let nextTypeSpecific: TypeSpecific =
        form.type === "VENUE"
          ? ({ ...form.typeSpecific, representativeImageUrls: repUrls } as TypeSpecific)
          : form.typeSpecific;
      if (form.type === "VENUE") {
        const vs = { ...(nextTypeSpecific as VenueSpecific) };
        vs.representativeImageUrls = repUrls;
        const ptRaw = vs.pricingType;
        const pt: VenuePricingType =
          ptRaw === "FLAT" || ptRaw === "MIXED" || ptRaw === "GENERAL" ? ptRaw : "GENERAL";
        vs.pricingType = pt;
        if (pt === "MIXED") {
          delete vs.feeCategory;
        } else if (pt === "GENERAL") {
          vs.feeCategory = "normal";
        } else {
          vs.feeCategory = "flat";
        }
        const fr = typeof vs.flatRateInfo === "string" ? vs.flatRateInfo.trim() : "";
        if (fr.length) vs.flatRateInfo = fr;
        else delete vs.flatRateInfo;
        nextTypeSpecific = vs as TypeSpecific;
      }
      const typeSpecificJson =
        Object.keys(nextTypeSpecific as object).length === 0 ? null : JSON.stringify(nextTypeSpecific);

      const coverForSave =
        form.type === "VENUE" ? repUrls[0] || p.coverImageUrl || null : p.coverImageUrl || null;

      const res = await fetch("/api/client/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          shortDescription: p.shortDescription || null,
          description: p.description || null,
          fullDescription: null,
          logoImageUrl: p.logoImageUrl || null,
          coverImageUrl: coverForSave,
          phone: form.phone || null,
          email: p.email || null,
          website: form.website || null,
          address: form.address || null,
          addressDetail: form.addressDetail || null,
          addressJibun: form.addressJibun || null,
          zipCode: form.zipCode || null,
          latitude: null,
          longitude: null,
          addressNaverMapEnabled: form.addressNaverMapEnabled,
          region: p.region || null,
          typeSpecificJson,
          isPublished: form.isPublished,
          setupCompleted: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveFeedback({
          kind: "error",
          message: typeof data.error === "string" ? data.error : "저장에 실패했습니다.",
        });
        setSaveState("error");
        return;
      }
      setSaveFeedback({ kind: "success", message: "저장되었습니다." });
      setSaveState("success");
      setForm((f) => ({ ...f, setupCompleted: true }));
    } finally {
      setSaving(false);
    }
  }

  const ts = form.typeSpecific;
  const venue = form.type === "VENUE" ? (ts as VenueSpecific) : ({} as VenueSpecific);
  const venuePricingTypeUi =
    form.type === "VENUE" ? ((venue.pricingType ?? "GENERAL") as VenuePricingType) : "GENERAL";
  const club = form.type === "CLUB" ? (ts as ClubSpecific) : ({} as ClubSpecific);
  const fed = form.type === "FEDERATION" ? (ts as FederationSpecific) : ({} as FederationSpecific);
  const instructor = form.type === "INSTRUCTOR" ? (ts as InstructorSpecific) : ({} as InstructorSpecific);
  const curriculum = instructor.curriculum ?? [];

  const naverMapUrl =
    form.address && form.addressNaverMapEnabled
      ? `https://map.naver.com/v5/search/${encodeURIComponent(form.address)}`
      : null;

  if (initialLoading) {
    return (
      <main className="v3-page v3-stack ui-client-dashboard" style={{ maxWidth: "42rem" }}>
        <p className="v3-muted">불러오는 중...</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="v3-page v3-stack ui-client-dashboard" style={{ maxWidth: "42rem" }}>
        <p style={{ color: "#b91c1c", marginBottom: "1rem" }}>{loadError}</p>
        <Link className="v3-btn" href="/client/settings">
          설정으로
        </Link>
      </main>
    );
  }

  return (
    <main className="v3-page v3-stack ui-client-dashboard" style={{ maxWidth: "42rem" }}>
      <div className="v3-row ui-client-dashboard-header" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="v3-row" style={{ alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link className="v3-btn" href="/client/settings" style={{ padding: "0.5rem 0.9rem" }}>
            ← 설정
          </Link>
          <h1 className="v3-h1" style={{ marginBottom: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
            업체 설정
          </h1>
        </div>
      </div>
      <p className="v3-muted" style={{ margin: 0 }}>
        기본 사업장 정보를 입력합니다.
      </p>

      <form className="v3-box v3-stack" onSubmit={handleSubmit} style={{ gap: "1rem" }}>
        <div>
          <label className="v3-muted" style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.9rem" }}>
            업체 종류
          </label>
          <p
            style={{
              margin: 0,
              padding: "0.5rem 0.65rem",
              borderRadius: "6px",
              border: "1px solid var(--v3-border, #ddd)",
              background: "var(--v3-surface-2, #f5f5f5)",
            }}
          >
            {ORG_TYPES.find((t) => t.value === form.type)?.label ?? form.type}
          </p>
          <p className="v3-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.8rem" }}>
            클라이언트 신청 시 지정한 업체 종류로 고정되어 있습니다.
          </p>
        </div>

        <div>
          <label className="v3-muted" style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.9rem" }}>
            업체/단체명 *
          </label>
          <input
            className="v3-input"
            style={{ width: "100%", padding: "0.5rem 0.65rem", borderRadius: "6px", border: "1px solid var(--v3-border, #ddd)" }}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div className="v3-stack" style={{ gap: "0.5rem" }}>
          <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontWeight: 600 }}>주소</span>
            <button type="button" className="v3-btn" onClick={() => void openAddressSearch()}>
              주소 검색
            </button>
          </div>
          <label className="v3-muted" style={{ display: "block", fontSize: "0.9rem" }}>
            우편번호
            <input
              className="v3-input"
              readOnly
              style={{ width: "100%", marginTop: "0.25rem", padding: "0.5rem 0.65rem", borderRadius: "6px", border: "1px solid var(--v3-border, #ddd)", background: "var(--v3-surface-2, #f5f5f5)" }}
              value={form.zipCode}
              placeholder="주소 검색 시 입력됩니다"
            />
          </label>
          <label className="v3-muted" style={{ display: "block", fontSize: "0.9rem" }}>
            도로명 주소
            <input
              className="v3-input"
              readOnly
              style={{ width: "100%", marginTop: "0.25rem", padding: "0.5rem 0.65rem", borderRadius: "6px", border: "1px solid var(--v3-border, #ddd)", background: "var(--v3-surface-2, #f5f5f5)" }}
              value={form.address}
              placeholder="주소 검색 시 입력됩니다"
            />
          </label>
          {form.addressJibun ? (
            <p className="v3-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              지번: {form.addressJibun}
            </p>
          ) : null}
          <label className="v3-muted" style={{ display: "block", fontSize: "0.9rem" }}>
            상세주소
            <input
              className="v3-input"
              style={{ width: "100%", marginTop: "0.25rem", padding: "0.5rem 0.65rem", borderRadius: "6px", border: "1px solid var(--v3-border, #ddd)" }}
              placeholder="동·호수 등"
              value={form.addressDetail}
              onChange={(e) => setForm((f) => ({ ...f, addressDetail: e.target.value }))}
            />
          </label>
          <div className="v3-row" style={{ alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              id="addressNaverMapEnabled"
              checked={form.addressNaverMapEnabled}
              onChange={(e) => setForm((f) => ({ ...f, addressNaverMapEnabled: e.target.checked }))}
            />
            <label htmlFor="addressNaverMapEnabled" style={{ fontSize: "0.9rem" }}>
              네이버 지도와 연동
            </label>
          </div>
          {naverMapUrl ? (
            <p style={{ margin: 0 }}>
              <a href={naverMapUrl} target="_blank" rel="noopener noreferrer" className="v3-muted" style={{ fontSize: "0.9rem" }}>
                네이버 지도에서 위치 보기 →
              </a>
            </p>
          ) : null}
        </div>

        <div>
          <label className="v3-muted" style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.9rem" }}>
            연락처
          </label>
          <input
            className="v3-input"
            style={{ width: "100%", padding: "0.5rem 0.65rem", borderRadius: "6px", border: "1px solid var(--v3-border, #ddd)" }}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className="v3-muted" style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.9rem" }}>
            링크
          </label>
          <input
            type="url"
            className="v3-input"
            style={{ width: "100%", padding: "0.5rem 0.65rem", borderRadius: "6px", border: "1px solid var(--v3-border, #ddd)" }}
            placeholder="https://..."
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
          />
          <p className="v3-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
            (플레이스, 카페, 블로그 등을 연결하세요)
          </p>
        </div>

        {form.type === "VENUE" && (
          <section className="v3-stack" style={{ gap: "0.75rem", padding: "1rem", borderRadius: "8px", border: "1px solid var(--v3-border, #ddd)" }}>
            <h2 className="v3-h2" style={{ margin: 0, fontSize: "1rem" }}>
              당구장 정보
            </h2>
            <div>
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>구장구분</span>
              <div className="v3-row" style={{ gap: "1rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="venueCategory"
                    checked={(venue.venueCategory ?? "daedae_only") === "daedae_only"}
                    onChange={() => setTypeSpecific({ venueCategory: "daedae_only" })}
                  />
                  대대전용
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="venueCategory"
                    checked={venue.venueCategory === "mixed"}
                    onChange={() => setTypeSpecific({ venueCategory: "mixed" })}
                  />
                  복합구장
                </label>
              </div>
            </div>
            <div>
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>요금유형</span>
              <div className="v3-row" style={{ gap: "1rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                {(
                  [
                    { value: "GENERAL" as const, label: "일반요금" },
                    { value: "FLAT" as const, label: "정액제" },
                    { value: "MIXED" as const, label: "혼용" },
                  ] as const
                ).map((opt) => (
                  <label key={opt.value} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="venuePricingType"
                      checked={venuePricingTypeUi === opt.value}
                      onChange={() => setTypeSpecific({ pricingType: opt.value })}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            {venuePricingTypeUi === "GENERAL" || venuePricingTypeUi === "MIXED"
              ? (["daedae", "jungdae", "pocket"] as const).map((key) => (
                  <div key={key} className="v3-stack" style={{ gap: "0.5rem", padding: "0.75rem", background: "var(--v3-surface-2, #f8f8f8)", borderRadius: "6px" }}>
                    <h3 style={{ margin: 0, fontSize: "0.95rem" }}>{key === "daedae" ? "대대" : key === "jungdae" ? "중대" : "포켓"}</h3>
                    {key === "daedae" ? (
                      <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                        <span style={{ flex: "1 1 6rem", fontSize: "0.75rem", color: "#94a3b8", fontWeight: 400 }}>종류(브랜드)</span>
                        <span style={{ flex: "1 1 6rem", fontSize: "0.75rem", color: "#94a3b8", fontWeight: 400 }}>대수</span>
                        <span style={{ flex: "1 1 6rem", fontSize: "0.75rem", color: "#94a3b8", fontWeight: 400 }}>가격(10분)</span>
                      </div>
                    ) : null}
                    <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                      <input
                        className="v3-input"
                        style={{ flex: "1 1 6rem", padding: "0.4rem 0.5rem", fontSize: "0.9rem" }}
                        value={venue[key]?.kind ?? ""}
                        onChange={(e) =>
                          setTypeSpecific({
                            [key]: { ...venue[key], kind: e.target.value },
                          } as Partial<VenueSpecific>)
                        }
                      />
                      <input
                        className="v3-input"
                        style={{ flex: "1 1 6rem", padding: "0.4rem 0.5rem", fontSize: "0.9rem" }}
                        value={venue[key]?.count ?? ""}
                        onChange={(e) =>
                          setTypeSpecific({
                            [key]: { ...venue[key], count: e.target.value },
                          } as Partial<VenueSpecific>)
                        }
                      />
                      <input
                        className="v3-input"
                        style={{ flex: "1 1 6rem", padding: "0.4rem 0.5rem", fontSize: "0.9rem" }}
                        value={venue[key]?.fee ?? ""}
                        onChange={(e) =>
                          setTypeSpecific({
                            [key]: { ...venue[key], fee: e.target.value },
                          } as Partial<VenueSpecific>)
                        }
                      />
                    </div>
                  </div>
                ))
              : null}
            {venuePricingTypeUi === "FLAT" || venuePricingTypeUi === "MIXED" ? (
              <div>
                <label className="v3-muted" style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.9rem" }}>
                  정액제 요금
                </label>
                <textarea
                  className="v3-input"
                  style={{ width: "100%", minHeight: "6.5rem", padding: "0.5rem 0.65rem", borderRadius: "6px", border: "1px solid var(--v3-border, #ddd)", resize: "vertical" }}
                  value={venue.flatRateInfo ?? ""}
                  onChange={(e) => setTypeSpecific({ flatRateInfo: e.target.value })}
                />
              </div>
            ) : null}
            <div>
              <label className="v3-muted" style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.9rem" }}>
                운영 점수판 시스템
              </label>
              <input
                className="v3-input"
                style={{ width: "100%", padding: "0.5rem 0.65rem", borderRadius: "6px", border: "1px solid var(--v3-border, #ddd)" }}
                placeholder="예: 빌리보드, 빌리존, 큐스코"
                value={venue.scoreSystem ?? ""}
                onChange={(e) => setTypeSpecific({ scoreSystem: e.target.value })}
              />
            </div>
            <div>
              <label className="v3-muted" style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.9rem" }}>
                영업시간
              </label>
              <input
                className="v3-input"
                style={{ width: "100%", padding: "0.5rem 0.65rem", borderRadius: "6px", border: "1px solid var(--v3-border, #ddd)" }}
                placeholder="예: 10:00 ~ 24:00"
                value={venue.businessHours ?? ""}
                onChange={(e) => setTypeSpecific({ businessHours: e.target.value })}
              />
            </div>
          </section>
        )}

        {form.type === "CLUB" && (
          <section className="v3-stack" style={{ gap: "0.75rem", padding: "1rem", borderRadius: "8px", border: "1px solid var(--v3-border, #ddd)" }}>
            <h2 className="v3-h2" style={{ margin: 0, fontSize: "1rem" }}>
              동호회 정보
            </h2>
            <input
              className="v3-input"
              style={{ width: "100%", padding: "0.5rem 0.65rem" }}
              placeholder="회원수"
              value={club.memberCount ?? ""}
              onChange={(e) => setTypeSpecific({ memberCount: e.target.value })}
            />
            <input
              className="v3-input"
              style={{ width: "100%", padding: "0.5rem 0.65rem" }}
              placeholder="회비"
              value={club.membershipFee ?? ""}
              onChange={(e) => setTypeSpecific({ membershipFee: e.target.value })}
            />
            <input
              className="v3-input"
              style={{ width: "100%", padding: "0.5rem 0.65rem" }}
              placeholder="활동지역"
              value={club.activityRegion ?? ""}
              onChange={(e) => setTypeSpecific({ activityRegion: e.target.value })}
            />
          </section>
        )}

        {form.type === "FEDERATION" && (
          <section className="v3-stack" style={{ gap: "0.75rem", padding: "1rem", borderRadius: "8px", border: "1px solid var(--v3-border, #ddd)" }}>
            <h2 className="v3-h2" style={{ margin: 0, fontSize: "1rem" }}>
              연맹 소개
            </h2>
            <textarea
              className="v3-input"
              style={{ width: "100%", minHeight: "5rem", padding: "0.5rem 0.65rem" }}
              placeholder="연맹 소개"
              value={fed.introduction ?? ""}
              onChange={(e) => setTypeSpecific({ introduction: e.target.value })}
            />
          </section>
        )}

        {form.type === "INSTRUCTOR" && (
          <section className="v3-stack" style={{ gap: "0.75rem", padding: "1rem", borderRadius: "8px", border: "1px solid var(--v3-border, #ddd)" }}>
            <h2 className="v3-h2" style={{ margin: 0, fontSize: "1rem" }}>
              레슨 안내
            </h2>
            <textarea
              className="v3-input"
              style={{ width: "100%", minHeight: "4rem" }}
              placeholder="강사 소개"
              value={instructor.instructorIntro ?? ""}
              onChange={(e) => setTypeSpecific({ instructorIntro: e.target.value })}
            />
            <input
              className="v3-input"
              style={{ width: "100%", padding: "0.5rem 0.65rem" }}
              placeholder="레슨 장소"
              value={instructor.lessonLocation ?? ""}
              onChange={(e) => setTypeSpecific({ lessonLocation: e.target.value })}
            />
            <div className="v3-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>커리큘럼(비용)</span>
              <button type="button" className="v3-btn" onClick={() => setCurriculum([...curriculum, { title: "", cost: "" }])}>
                + 추가
              </button>
            </div>
            {curriculum.map((item, i) => (
              <div key={i} className="v3-row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  className="v3-input"
                  style={{ flex: "1 1 8rem", padding: "0.4rem 0.5rem" }}
                  placeholder="과정명"
                  value={item.title}
                  onChange={(e) => {
                    const next = [...curriculum];
                    next[i] = { ...next[i], title: e.target.value };
                    setCurriculum(next);
                  }}
                />
                <input
                  className="v3-input"
                  style={{ width: "6rem", padding: "0.4rem 0.5rem" }}
                  placeholder="비용"
                  value={item.cost}
                  onChange={(e) => {
                    const next = [...curriculum];
                    next[i] = { ...next[i], cost: e.target.value };
                    setCurriculum(next);
                  }}
                />
                <button type="button" className="v3-btn" onClick={() => setCurriculum(curriculum.filter((_, j) => j !== i))}>
                  삭제
                </button>
              </div>
            ))}
          </section>
        )}

        <div className="v3-row" style={{ alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            id="isPublished"
            checked={form.isPublished}
            onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
          />
          <label htmlFor="isPublished" style={{ fontSize: "0.9rem" }}>
            공개 목록에 노출
          </label>
        </div>

        <div className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <button type="submit" className="ui-btn-primary-solid" disabled={saving}>
            저장
          </button>
          {saveState !== "idle" ? (
            <span
              className="v3-muted"
              style={{ color: saveState === "success" ? "#15803d" : saveState === "error" ? "#b91c1c" : "#6b7280", fontSize: "0.9rem" }}
            >
              {saveState === "success" ? "저장성공" : saveState === "error" ? "저장실패" : "저장중"}
            </span>
          ) : null}
          <Link className="v3-btn" href="/client/settings">
            나가기
          </Link>
        </div>
      </form>
    </main>
  );
}
