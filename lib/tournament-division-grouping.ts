import { parseDivisionRulesJson, type DivisionRule } from "@/lib/tournament-certification";

export type DivisionSortableEntry = {
  id: string;
  divisionName: string | null;
  divisionMatchedValue?: number | null;
  divisionMatchedAverage: number | null;
  createdAt?: string;
  userName?: string;
};

export type DivisionGroup<T extends DivisionSortableEntry> = {
  key: string;
  label: string;
  order: number;
  entries: T[];
  isUnassigned: boolean;
};

export function getDivisionOrderMap(divisionRulesJson: unknown): Map<string, number> {
  const rules = parseDivisionRulesJson(divisionRulesJson);
  const map = new Map<string, number>();
  for (let i = 0; i < rules.length; i += 1) {
    map.set(rules[i].name, i);
  }
  return map;
}

function compareAverageDesc<T extends DivisionSortableEntry>(a: T, b: T): number {
  const aa = a.divisionMatchedValue ?? a.divisionMatchedAverage ?? null;
  const bb = b.divisionMatchedValue ?? b.divisionMatchedAverage ?? null;
  if (aa == null && bb == null) {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return (a.userName ?? "").localeCompare(b.userName ?? "", "ko");
  }
  if (aa == null) return 1;
  if (bb == null) return -1;
  if (aa !== bb) return bb - aa;
  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return ta - tb;
}

export function sortEntriesByDivision<T extends DivisionSortableEntry>(
  entries: T[],
  divisionRulesJson: unknown
): T[] {
  const rules = parseDivisionRulesJson(divisionRulesJson);
  if (rules.length === 0) return [...entries];
  const orderMap = getDivisionOrderMap(divisionRulesJson);
  const fallbackOrder = rules.length + 1;
  return [...entries].sort((a, b) => {
    const oa = a.divisionName && orderMap.has(a.divisionName) ? orderMap.get(a.divisionName)! : fallbackOrder;
    const ob = b.divisionName && orderMap.has(b.divisionName) ? orderMap.get(b.divisionName)! : fallbackOrder;
    if (oa !== ob) return oa - ob;
    return compareAverageDesc(a, b);
  });
}

export function groupEntriesByDivision<T extends DivisionSortableEntry>(
  entries: T[],
  divisionRulesJson: unknown,
  unassignedLabel: string
): {
  groups: DivisionGroup<T>[];
  rules: DivisionRule[];
  hasUnknownDivisionName: boolean;
} {
  const rules = parseDivisionRulesJson(divisionRulesJson);
  if (rules.length === 0) {
    return { groups: [], rules, hasUnknownDivisionName: false };
  }

  const orderMap = getDivisionOrderMap(divisionRulesJson);
  const buckets = new Map<string, T[]>();
  let hasUnknownDivisionName = false;

  for (const rule of rules) {
    buckets.set(rule.name, []);
  }
  buckets.set(unassignedLabel, []);

  for (const e of entries) {
    if (!e.divisionName) {
      buckets.get(unassignedLabel)!.push(e);
      continue;
    }
    if (!orderMap.has(e.divisionName)) {
      hasUnknownDivisionName = true;
      buckets.get(unassignedLabel)!.push(e);
      continue;
    }
    buckets.get(e.divisionName)!.push(e);
  }

  const groups: DivisionGroup<T>[] = rules.map((rule, idx) => ({
    key: rule.name,
    label: rule.name,
    order: idx,
    entries: (buckets.get(rule.name) ?? []).sort(compareAverageDesc),
    isUnassigned: false,
  }));
  const unassignedEntries = (buckets.get(unassignedLabel) ?? []).sort(compareAverageDesc);
  if (unassignedEntries.length > 0) {
    groups.push({
      key: "__unassigned__",
      label: unassignedLabel,
      order: rules.length + 1,
      entries: unassignedEntries,
      isUnassigned: true,
    });
  }

  return { groups, rules, hasUnknownDivisionName };
}

export function getUnassignedDivisionLabel(fallback: string): string {
  return fallback.trim() || "미배정";
}
