"use client";

import { useCallback, useEffect, useState } from "react";

type Feature = { id: string; code: string; name: string };

export function AdminPlanFeaturesManager({
  planId,
  planCode,
  initialFeatures,
}: {
  planId: string;
  planCode: string;
  initialFeatures: Feature[];
}) {
  const [features, setFeatures] = useState<Feature[]>(initialFeatures);
  const [allFeatures, setAllFeatures] = useState<Feature[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchPlanFeatures = useCallback(async () => {
    const res = await fetch(`/api/admin/pricing-plans/${planId}/features`);
    if (!res.ok) return;
    const data = await res.json();
    setFeatures(data.map((pf: { feature: Feature }) => pf.feature));
  }, [planId]);

  useEffect(() => {
    fetch("/api/admin/features")
      .then((r) => r.json())
      .then(setAllFeatures)
      .catch(() => {});
  }, []);

  const connectedIds = new Set(features.map((f) => f.id));
  const available = allFeatures.filter((f) => !connectedIds.has(f.id));

  async function addFeature() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pricing-plans/${planId}/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureId: selectedId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "추가 실패");
        return;
      }
      setSelectedId("");
      await fetchPlanFeatures();
    } finally {
      setLoading(false);
    }
  }

  async function removeFeature(featureId: string) {
    if (!confirm("이 요금제에서 기능 연결을 해제하시겠습니까?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pricing-plans/${planId}/features/${featureId}`, { method: "DELETE" });
      if (!res.ok) {
        alert("제거 실패");
        return;
      }
      await fetchPlanFeatures();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-site-border bg-site-card p-4">
      <h2 className="font-medium">포함 기능 ({planCode})</h2>
      <ul className="space-y-1">
        {features.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2">
            <span>{f.name} ({f.code})</span>
            <button
              type="button"
              disabled={loading}
              onClick={() => removeFeature(f.id)}
              className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
            >
              제거
            </button>
          </li>
        ))}
      </ul>
      {available.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded border border-site-border px-2 py-1 text-sm"
          >
            <option value="">기능 선택</option>
            {available.map((f) => (
              <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
            ))}
          </select>
          <button
            type="button"
            disabled={loading || !selectedId}
            onClick={addFeature}
            className="rounded bg-site-primary px-3 py-1 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            추가
          </button>
        </div>
      )}
    </div>
  );
}
