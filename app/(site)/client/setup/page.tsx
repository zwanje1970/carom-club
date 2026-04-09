"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { AddressSearchButton } from "@/components/AddressSearchButton";

const ORG_TYPES = [
  { value: "VENUE", label: "당구장" },
  { value: "CLUB", label: "동호회" },
  { value: "FEDERATION", label: "연맹" },
  { value: "INSTRUCTOR", label: "레슨" },
] as const;

type OrgType = (typeof ORG_TYPES)[number]["value"];

type VenueTableInfo = { kind?: string; count?: string; fee?: string };
export type VenueCategoryOption = "daedae_only" | "mixed";
type VenueSpecific = {
  venueCategory?: VenueCategoryOption;
  daedae?: VenueTableInfo;
  jungdae?: VenueTableInfo;
  pocket?: VenueTableInfo;
  businessHours?: string;
};
type ClubSpecific = {
  memberCount?: string;
  membershipFee?: string;
  activityRegion?: string;
};
type FederationSpecific = { introduction?: string };
type CurriculumItem = { title: string; cost: string };
type InstructorSpecific = {
  instructorIntro?: string;
  lessonLocation?: string;
  curriculum?: CurriculumItem[];
};
type TypeSpecific = VenueSpecific | ClubSpecific | FederationSpecific | InstructorSpecific;

type Org = {
  id: string;
  slug: string;
  name: string;
  type: string;
  shortDescription: string | null;
  description: string | null;
  fullDescription: string | null;
  logoImageUrl: string | null;
  coverImageUrl: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  addressDetail: string | null;
  addressNaverMapEnabled: boolean | null;
  region: string | null;
  typeSpecificJson: string | null;
  isPublished: boolean;
  setupCompleted: boolean;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/svg+xml";

function parseTypeSpecific(type: OrgType, json: string | null): TypeSpecific {
  if (!json?.trim()) {
    if (type === "INSTRUCTOR") return { curriculum: [] };
    return {};
  }
  try {
    const parsed = JSON.parse(json) as TypeSpecific & {
      daedaeFee?: string;
      jungdaeFee?: string;
      pocketFee?: string;
    };
    if (type === "INSTRUCTOR" && !Array.isArray((parsed as InstructorSpecific).curriculum)) {
      (parsed as InstructorSpecific).curriculum = [];
    }
    if (type === "VENUE") {
      const v = parsed as VenueSpecific;
      if (v && (v as { daedaeFee?: string }).daedaeFee && !v.daedae)
        v.daedae = { fee: (v as { daedaeFee?: string }).daedaeFee };
      if (v && (v as { jungdaeFee?: string }).jungdaeFee && !v.jungdae)
        v.jungdae = { fee: (v as { jungdaeFee?: string }).jungdaeFee };
      if (v && (v as { pocketFee?: string }).pocketFee && !v.pocket)
        v.pocket = { fee: (v as { pocketFee?: string }).pocketFee };
    }
    return parsed as TypeSpecific;
  } catch {
    return type === "INSTRUCTOR" ? { curriculum: [] } : {};
  }
}

function OrgImageUpload({
  label,
  value,
  onChange,
  policy,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  policy: "logo" | "banner";
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file?.size) return;
    setErr("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("policy", policy);
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "업로드에 실패했습니다.");
      if (data.url) onChange(data.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <p className="text-xs text-gray-500">이미지 파일을 선택해 주세요. (jpg, png, webp{policy === "logo" ? ", svg" : ""})</p>
      {value ? (
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="h-20 w-28 shrink-0 overflow-hidden rounded border bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? "업로드 중…" : "이미지 변경"}
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              삭제
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-4 text-center">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? "업로드 중…" : "파일 선택"}
          </button>
        </div>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}

export default function ClientSetupPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "success" | "failed">("");
  const [saveFailure, setSaveFailure] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    slug: "",
    name: "",
    type: "CLUB" as OrgType,
    shortDescription: "",
    description: "",
    fullDescription: "",
    logoImageUrl: "",
    coverImageUrl: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    addressDetail: "",
    addressNaverMapEnabled: false,
    region: "",
    typeSpecific: {} as TypeSpecific,
    isPublished: false,
    setupCompleted: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/client/organization");
        if (res.status === 404 || res.status === 403) {
          if (!cancelled) setOrg(null);
          return;
        }
        if (!res.ok) {
          if (!cancelled) setError("업체 정보를 불러올 수 없습니다.");
          return;
        }
        const data = await res.json();
        const orgType = (data.type && ORG_TYPES.some((t) => t.value === data.type)) ? data.type : "CLUB";
        const orgAddress = data.address?.trim() ?? "";
        const orgAddressDetail = data.addressDetail?.trim() ?? "";
        if (!cancelled) {
          setOrg(data);
          setForm({
            slug: data.slug ?? "",
            name: data.name ?? "",
            type: orgType,
            shortDescription: data.shortDescription ?? "",
            description: data.description ?? "",
            fullDescription: data.fullDescription ?? "",
            logoImageUrl: data.logoImageUrl ?? "",
            coverImageUrl: data.coverImageUrl ?? "",
            phone: data.phone ?? "",
            email: data.email ?? "",
            website: data.website ?? "",
            address: orgAddress,
            addressDetail: orgAddressDetail,
            addressNaverMapEnabled: data.addressNaverMapEnabled ?? false,
            region: data.region ?? "",
            typeSpecific: parseTypeSpecific(orgType, data.typeSpecificJson ?? null),
            isPublished: data.isPublished ?? false,
            setupCompleted: data.setupCompleted ?? false,
          });
          if (!orgAddress) {
            fetch("/api/auth/me")
              .then((r) => r.json())
              .then((me: { address?: string; addressDetail?: string }) => {
                if (!cancelled && me?.address != null) {
                  setForm((f) => ({
                    ...f,
                    address: me.address ?? "",
                    addressDetail: me.addressDetail ?? "",
                  }));
                }
              })
              .catch(() => {});
          }
        }
      } catch {
        if (!cancelled) setError("업체 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function setTypeSpecific(update: Partial<TypeSpecific>) {
    setForm((f) => ({ ...f, typeSpecific: { ...f.typeSpecific, ...update } }));
  }

  function setCurriculum(items: CurriculumItem[]) {
    setTypeSpecific({ curriculum: items });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveFailure("");
    setSaveStatus("saving");
    setSaving(true);
    try {
      const typeSpecificJson =
        Object.keys(form.typeSpecific).length === 0
          ? null
          : JSON.stringify(form.typeSpecific);
      const res = await fetch("/api/client/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: form.slug,
          name: form.name,
          type: form.type,
          shortDescription: form.shortDescription,
          description: form.description,
          fullDescription: form.fullDescription,
          logoImageUrl: form.logoImageUrl || null,
          coverImageUrl: form.coverImageUrl || null,
          phone: form.phone || null,
          email: form.email || null,
          website: form.website || null,
          address: form.address || null,
          addressDetail: form.addressDetail || null,
          addressNaverMapEnabled: form.addressNaverMapEnabled,
          region: form.region || null,
          typeSpecificJson,
          isPublished: form.isPublished,
          setupCompleted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveFailure("저장 실패");
        setSaveStatus("failed");
        return;
      }
      setSaveStatus("success");
      setTimeout(() => setSaveStatus(""), 2200);
      setSaveFailure("");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500">불러오는 중...</div>
    );
  }
  if (!org) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-600">소속된 업체가 없습니다.</p>
        <Link href="/client/dashboard" className="mt-4 inline-block text-site-primary hover:underline">
          대시보드로
        </Link>
      </div>
    );
  }

  const ts = form.typeSpecific;
  const venue = form.type === "VENUE" ? (ts as VenueSpecific) : ({} as VenueSpecific);
  const club = form.type === "CLUB" ? (ts as ClubSpecific) : ({} as ClubSpecific);
  const fed = form.type === "FEDERATION" ? (ts as FederationSpecific) : ({} as FederationSpecific);
  const instructor = form.type === "INSTRUCTOR" ? (ts as InstructorSpecific) : ({} as InstructorSpecific);
  const curriculum = instructor.curriculum ?? [];

  const naverMapUrl =
    form.address && form.addressNaverMapEnabled
      ? `https://map.naver.com/v5/search/${encodeURIComponent(form.address)}`
      : null;

  return (
    <div className="max-w-2xl lg:max-w-none space-y-6">
      <h1 className="text-2xl font-bold text-site-text">업체 설정</h1>
      <p className="text-sm text-gray-600">업체 프로필을 설정해 주세요.</p>
      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-site-border bg-site-card p-6">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">업체 종류</label>
          <p className="rounded px-3 py-2 bg-gray-100 text-gray-700 border border-gray-200">
            {ORG_TYPES.find((t) => t.value === form.type)?.label ?? form.type}
          </p>
          <p className="mt-1 text-xs text-gray-500">클라이언트 신청 시 지정한 업체 종류로 고정되어 있습니다.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">주소(slug) *</label>
          <input
            type="text"
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="예: my-venue"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
          <p className="mt-1 text-xs text-gray-500">영문·숫자·하이픈만 사용. 공개 프로필 URL에 사용됩니다.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">업체/단체명 *</label>
          <input
            type="text"
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">한줄 소개</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={form.shortDescription}
            onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2 min-h-[80px]"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        <OrgImageUpload
          label="로고 이미지"
          value={form.logoImageUrl}
          onChange={(url) => setForm((f) => ({ ...f, logoImageUrl: url }))}
          policy="logo"
        />
        <OrgImageUpload
          label="커버 이미지"
          value={form.coverImageUrl}
          onChange={(url) => setForm((f) => ({ ...f, coverImageUrl: url }))}
          policy="banner"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
          <input
            type="email"
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">웹사이트</label>
          <input
            type="url"
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="https://..."
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">주소(지번)</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 border border-gray-300 rounded px-3 py-2"
              placeholder="예: 서울 강남구 역삼동 123-45 (주소 검색으로 자동 채움)"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
            <AddressSearchButton
              onSelect={(r) => {
                setForm((f) => ({
                  ...f,
                  address: r.address,
                  ...(r.region && { region: r.region }),
                }));
              }}
              label="주소 검색"
            />
          </div>
          <input
            type="text"
            className="mt-2 w-full border border-gray-300 rounded px-3 py-2"
            placeholder="상세주소 (동·호수 등)"
            value={form.addressDetail}
            onChange={(e) => setForm((f) => ({ ...f, addressDetail: e.target.value }))}
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="addressNaverMapEnabled"
              checked={form.addressNaverMapEnabled}
              onChange={(e) => setForm((f) => ({ ...f, addressNaverMapEnabled: e.target.checked }))}
            />
            <label htmlFor="addressNaverMapEnabled" className="text-sm text-gray-700">
              네이버 지도와 연동
            </label>
          </div>
          {naverMapUrl && (
            <p className="mt-1">
              <a
                href={naverMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-site-primary hover:underline"
              >
                네이버 지도에서 위치 보기 →
              </a>
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">지역</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="예: 서울 강남구"
            value={form.region}
            onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
          />
        </div>

        {/* 당구장 */}
        {form.type === "VENUE" && (
          <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
            <h3 className="text-sm font-semibold text-gray-800">당구장 정보</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">구장 구분</label>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="venueCategory"
                    value="daedae_only"
                    checked={(venue.venueCategory ?? "daedae_only") === "daedae_only"}
                    onChange={() => setTypeSpecific({ venueCategory: "daedae_only" })}
                    className="text-site-primary"
                  />
                  <span className="text-sm text-gray-700">대대전용</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="venueCategory"
                    value="mixed"
                    checked={venue.venueCategory === "mixed"}
                    onChange={() => setTypeSpecific({ venueCategory: "mixed" })}
                    className="text-site-primary"
                  />
                  <span className="text-sm text-gray-700">복합구장</span>
                </label>
              </div>
              <p className="mt-1 text-xs text-gray-500">구장 유형을 선택해 주세요.</p>
            </div>
            {/* 대대 */}
            <div className="rounded border border-gray-200 bg-white p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">대대</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">대대 종류</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="예: 가브리엘 임퍼레이터"
                    value={venue.daedae?.kind ?? ""}
                    onChange={(e) =>
                      setTypeSpecific({
                        daedae: { ...venue.daedae, kind: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">대수</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="예: 6"
                    value={venue.daedae?.count ?? ""}
                    onChange={(e) =>
                      setTypeSpecific({
                        daedae: { ...venue.daedae, count: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">요금</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="예: 2000원"
                    value={venue.daedae?.fee ?? ""}
                    onChange={(e) =>
                      setTypeSpecific({
                        daedae: { ...venue.daedae, fee: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
            </div>
            {/* 중대 */}
            <div className="rounded border border-gray-200 bg-white p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">중대</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">중대 종류</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="예: 4구"
                    value={venue.jungdae?.kind ?? ""}
                    onChange={(e) =>
                      setTypeSpecific({
                        jungdae: { ...venue.jungdae, kind: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">대수</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="예: 2"
                    value={venue.jungdae?.count ?? ""}
                    onChange={(e) =>
                      setTypeSpecific({
                        jungdae: { ...venue.jungdae, count: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">요금</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="예: 2000원"
                    value={venue.jungdae?.fee ?? ""}
                    onChange={(e) =>
                      setTypeSpecific({
                        jungdae: { ...venue.jungdae, fee: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
            </div>
            {/* 포켓 */}
            <div className="rounded border border-gray-200 bg-white p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">포켓</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">포켓 종류</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="예: 9볼"
                    value={venue.pocket?.kind ?? ""}
                    onChange={(e) =>
                      setTypeSpecific({
                        pocket: { ...venue.pocket, kind: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">대수</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="예: 2"
                    value={venue.pocket?.count ?? ""}
                    onChange={(e) =>
                      setTypeSpecific({
                        pocket: { ...venue.pocket, count: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">요금</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="예: 2000원"
                    value={venue.pocket?.fee ?? ""}
                    onChange={(e) =>
                      setTypeSpecific({
                        pocket: { ...venue.pocket, fee: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">영업시간</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="예: 10:00 ~ 24:00"
                value={venue.businessHours ?? ""}
                onChange={(e) => setTypeSpecific({ businessHours: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* 동호회 */}
        {form.type === "CLUB" && (
          <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
            <h3 className="text-sm font-semibold text-gray-800">동호회 정보</h3>
            <div>
              <label className="block text-sm text-gray-700 mb-1">회원수</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="예: 30명"
                value={club.memberCount ?? ""}
                onChange={(e) => setTypeSpecific({ memberCount: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">회비</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="예: 월 2만원"
                value={club.membershipFee ?? ""}
                onChange={(e) => setTypeSpecific({ membershipFee: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">활동지역</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="예: 서울 강남, 서초"
                value={club.activityRegion ?? ""}
                onChange={(e) => setTypeSpecific({ activityRegion: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* 연맹 */}
        {form.type === "FEDERATION" && (
          <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
            <h3 className="text-sm font-semibold text-gray-800">연맹 소개</h3>
            <div>
              <label className="block text-sm text-gray-700 mb-1">연맹 소개</label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 min-h-[100px]"
                placeholder="연맹 소개를 입력해 주세요."
                value={fed.introduction ?? ""}
                onChange={(e) => setTypeSpecific({ introduction: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* 레슨 */}
        {form.type === "INSTRUCTOR" && (
          <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
            <h3 className="text-sm font-semibold text-gray-800">레슨 안내</h3>
            <div>
              <label className="block text-sm text-gray-700 mb-1">강사 소개</label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 min-h-[80px]"
                placeholder="강사 소개를 입력해 주세요."
                value={instructor.instructorIntro ?? ""}
                onChange={(e) => setTypeSpecific({ instructorIntro: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">레슨 장소</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="예: 서울 강남구 ○○당구장"
                value={instructor.lessonLocation ?? ""}
                onChange={(e) => setTypeSpecific({ lessonLocation: e.target.value })}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm text-gray-700">커리큘럼(비용)</label>
                <button
                  type="button"
                  onClick={() => setCurriculum([...curriculum, { title: "", cost: "" }])}
                  className="text-sm text-site-primary hover:underline"
                >
                  + 추가
                </button>
              </div>
              <div className="space-y-2">
                {curriculum.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      className="flex-1 border border-gray-300 rounded px-3 py-2"
                      placeholder="과정명"
                      value={item.title}
                      onChange={(e) => {
                        const next = [...curriculum];
                        next[i] = { ...next[i], title: e.target.value };
                        setCurriculum(next);
                      }}
                    />
                    <input
                      type="text"
                      className="w-28 border border-gray-300 rounded px-3 py-2"
                      placeholder="비용"
                      value={item.cost}
                      onChange={(e) => {
                        const next = [...curriculum];
                        next[i] = { ...next[i], cost: e.target.value };
                        setCurriculum(next);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setCurriculum(curriculum.filter((_, j) => j !== i))}
                      className="text-red-600 text-sm hover:underline"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPublished"
            checked={form.isPublished}
            onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
          />
          <label htmlFor="isPublished" className="text-sm text-gray-700">공개 목록에 노출</label>
        </div>
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-site-primary px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "저장중" : "저장하고 완료"}
          </button>
          {saveStatus === "saving" ? <span className="self-center text-sm text-gray-600">저장 중...</span> : null}
          {saveStatus === "success" ? <span className="self-center text-sm text-green-700">저장 완료</span> : null}
          {saveStatus === "failed" ? <span className="self-center text-sm text-red-600">{saveFailure || "저장 실패"}</span> : null}
          <Link
            href="/client/dashboard"
            className="rounded-lg border border-site-border px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}
