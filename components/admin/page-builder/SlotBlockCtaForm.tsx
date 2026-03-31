"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PageSection } from "@/types/page-section";
import Button from "@/components/admin/_components/Button";
import type { SlotBlockCtaConfig, SlotBlockCtaLayer, SlotBlockCtaLayerRole } from "@/lib/slot-block-cta";
import {
  mergeSlotBlockCtaIntoSectionStyleJson,
  rolesForSlotType,
  resolveSlotBlockCtaConfig,
  sanitizeCtaLayerForRole,
} from "@/lib/slot-block-cta";
import type { HomeStructureSlotType } from "@/lib/home-structure-slots";
import { SlotBlockDecorateCtaPanel } from "@/components/admin/page-builder/slot-decorate/DecorateCtaLayers";

type Props = {
  section: PageSection;
  styleMergeBase: string | null | undefined;
  onSlotSectionStyleDraft: (mergedSectionStyleJson: string) => void;
  setBusy: (id: string | null) => void;
  onSaved: (updated: PageSection) => void;
  onClose: () => void;
};

/** @deprecated 홈 구조 슬롯은 `HomeAreaDecoratePanel`에서 통합 편집합니다. */
export function SlotBlockCtaForm({
  section,
  styleMergeBase,
  onSlotSectionStyleDraft,
  setBusy,
  onSaved,
  onClose,
}: Props) {
  const onDraftRef = useRef(onSlotSectionStyleDraft);
  onDraftRef.current = onSlotSectionStyleDraft;

  const slotType = section.slotType as HomeStructureSlotType;
  const roles = useMemo(() => rolesForSlotType(slotType), [slotType]);

  const [cfg, setCfg] = useState<SlotBlockCtaConfig>(() =>
    resolveSlotBlockCtaConfig(section.slotType, section.sectionStyleJson)
  );

  useEffect(() => {
    setCfg(resolveSlotBlockCtaConfig(section.slotType, section.sectionStyleJson));
  }, [section.id, section.sectionStyleJson, section.slotType]);

  useEffect(() => {
    const base = styleMergeBase ?? section.sectionStyleJson;
    onDraftRef.current(mergeSlotBlockCtaIntoSectionStyleJson(base, cfg));
  }, [cfg, styleMergeBase, section.sectionStyleJson]);

  const updateRole = (role: SlotBlockCtaLayerRole, layer: SlotBlockCtaLayer) => {
    setCfg((prev) => ({
      ...prev,
      [role]: sanitizeCtaLayerForRole(layer, role),
    }));
  };

  const save = async () => {
    const sanitized: SlotBlockCtaConfig = { ...cfg };
    for (const r of roles) {
      const L = sanitized[r];
      if (L) sanitized[r] = sanitizeCtaLayerForRole(L, r);
    }
    setBusy(section.id);
    try {
      const res = await fetch("/api/admin/content/page-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateStructure",
          id: section.id,
          slotBlockCta: sanitized,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "저장에 실패했습니다.");
        return;
      }
      onSaved(data as PageSection);
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600 dark:text-slate-400">
        클릭 시 이동·동작을 설정합니다. 카드에서만 목록 데이터에 맞춘 자동 연결이 가능합니다.
      </p>
      <SlotBlockDecorateCtaPanel roles={roles} cfg={cfg} onLayerChange={updateRole} />
      <div className="flex flex-wrap gap-2 pt-1">
        <Button label="저장" color="info" small onClick={() => void save()} />
        <Button label="닫기" color="contrast" small onClick={onClose} />
      </div>
    </div>
  );
}
