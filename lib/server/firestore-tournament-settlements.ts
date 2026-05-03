import { randomUUID } from "crypto";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { AuthRole } from "../auth/roles";
import { assertClientFirestorePersistenceConfigured } from "./firestore-client-applications";
import { listTournamentApplicationsByTournamentIdFirestore } from "./firestore-tournament-applications";
import {
  getTournamentByIdFirestore,
  getTournamentOwnerAccessPreviewByIdFirestore,
  getTournamentSettlementAccessFieldsByIdFirestore,
  listAllTournamentsFirestore,
  listTournamentsByCreatorFirestore,
} from "./firestore-tournaments";
import { getSharedFirestoreDb } from "./firestore-users";
import { computeLegacyAutoSettlementSummary } from "./settlement-legacy-summary";
import { computeLedgerTotalsFromLines, isSettlementCategoryV2 } from "../settlement-ledger-v2";
import { listPublishedCardFlagsFromFirestoreKv } from "./platform-tournament-published-cards-settings";
import type {
  SettlementExpenseItem,
  SettlementLedgerLineStored,
  SettlementLedgerTournamentSummary,
  TournamentSettlement,
  TournamentSettlementEntry,
  TournamentSettlementEntryStatus,
  TournamentSettlementSummary,
} from "./tournament-settlement-types";

const COLLECTION = "v3_tournament_settlements";

function normalizeExpenseItem(item: SettlementExpenseItem): SettlementExpenseItem {
  return {
    id: item.id,
    title: (item.title ?? "").trim(),
    amount: Number.isFinite(Number(item.amount)) ? Math.max(0, Math.floor(Number(item.amount))) : 0,
  };
}

function normalizeLedgerLineStored(raw: unknown): SettlementLedgerLineStored | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const category = typeof o.category === "string" ? o.category.trim() : "";
  const flow = o.flow === "INCOME" || o.flow === "EXPENSE" ? o.flow : "";
  const amountKrw = Number.isFinite(Number(o.amountKrw)) ? Math.max(0, Math.round(Number(o.amountKrw))) : 0;
  if (!id || !category || !flow) return null;
  const sortOrder = Number.isFinite(Number(o.sortOrder)) ? Math.floor(Number(o.sortOrder)) : 0;
  const ed =
    typeof o.entryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.entryDate.trim()) ? o.entryDate.trim() : null;
  return {
    id,
    category,
    flow,
    amountKrw,
    label: o.label != null && typeof o.label === "string" ? o.label : null,
    note: o.note != null && typeof o.note === "string" ? o.note : null,
    sortOrder,
    ...(ed ? { entryDate: ed } : {}),
  };
}

function normalizeLedgerLinesArray(raw: unknown): SettlementLedgerLineStored[] {
  if (!Array.isArray(raw)) return [];
  const out: SettlementLedgerLineStored[] = [];
  for (const row of raw) {
    const n = normalizeLedgerLineStored(row);
    if (n) out.push(n);
  }
  return out;
}

function settlementFromData(tournamentId: string, data: Record<string, unknown> | undefined): TournamentSettlement {
  if (!data || typeof data !== "object") {
    return {
      tournamentId,
      refundedApplicationIds: [],
      expenseItems: [],
      ledgerLines: [],
      isSettled: false,
      updatedAt: new Date().toISOString(),
    };
  }
  const d = data;
  const refunded = Array.isArray(d.refundedApplicationIds)
    ? (d.refundedApplicationIds as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : [];
  const expenseItems = Array.isArray(d.expenseItems) ? d.expenseItems.map((item) => normalizeExpenseItem(item as SettlementExpenseItem)) : [];
  const ledgerLines = normalizeLedgerLinesArray(d.ledgerLines);
  return {
    tournamentId: typeof d.tournamentId === "string" ? d.tournamentId : tournamentId,
    refundedApplicationIds: refunded,
    expenseItems,
    ledgerLines,
    isSettled: Boolean(d.isSettled),
    updatedAt: typeof d.updatedAt === "string" && d.updatedAt ? d.updatedAt : new Date().toISOString(),
  };
}

function toPlain(s: TournamentSettlement): Record<string, unknown> {
  return {
    tournamentId: s.tournamentId,
    refundedApplicationIds: s.refundedApplicationIds,
    expenseItems: s.expenseItems,
    ledgerLines: s.ledgerLines,
    isSettled: s.isSettled,
    updatedAt: s.updatedAt,
  };
}

async function getOrCreateSettlementFirestore(tournamentId: string): Promise<TournamentSettlement> {
  const db = getSharedFirestoreDb();
  const ref = db.collection(COLLECTION).doc(tournamentId);
  const snap = await ref.get();
  if (snap.exists) {
    return settlementFromData(tournamentId, snap.data() as Record<string, unknown>);
  }
  const created: TournamentSettlement = {
    tournamentId,
    refundedApplicationIds: [],
    expenseItems: [],
    ledgerLines: [],
    isSettled: false,
    updatedAt: new Date().toISOString(),
  };
  await ref.set(toPlain(created));
  return created;
}

export async function getTournamentSettlementByTournamentIdFirestore(
  tournamentId: string
): Promise<{ ok: true; settlement: TournamentSettlement } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const t = await getTournamentByIdFirestore(tournamentId);
  if (!t) return { ok: false, error: "대회를 찾을 수 없습니다." };
  const settlement = await getOrCreateSettlementFirestore(tournamentId);
  return { ok: true, settlement };
}

export async function getSettlementSummaryByTournamentIdFirestore(
  tournamentId: string
): Promise<{ ok: true; summary: TournamentSettlementSummary } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }
  const settlement = await getOrCreateSettlementFirestore(tournamentId);

  const apps = await listTournamentApplicationsByTournamentIdFirestore(tournamentId);
  const approvedApplications = apps.filter((item) => item.status === "APPROVED");
  const summary = computeLegacyAutoSettlementSummary({
    tournamentId,
    entryFee: tournament.entryFee,
    approvedApplicationIds: approvedApplications.map((item) => item.id),
    refundedApplicationIds: settlement.refundedApplicationIds,
    expenseAmounts: settlement.expenseItems.map((item) => item.amount),
    isSettled: settlement.isSettled,
  });

  return { ok: true, summary };
}

export async function listSettlementEntriesByTournamentIdFirestore(
  tournamentId: string
): Promise<{ ok: true; entries: TournamentSettlementEntry[] } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }
  const settlement = await getOrCreateSettlementFirestore(tournamentId);
  const approvedEntries = (await listTournamentApplicationsByTournamentIdFirestore(tournamentId))
    .filter((item) => item.status === "APPROVED")
    .map((item) => ({
      applicationId: item.id,
      applicantName: item.applicantName,
      phone: item.phone,
      depositorName: item.depositorName,
      status: item.status as TournamentSettlementEntryStatus,
      approvedAt: item.statusChangedAt || item.updatedAt || item.createdAt,
      isRefunded: settlement.refundedApplicationIds.includes(item.id),
    }))
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
  return { ok: true, entries: approvedEntries };
}

export async function upsertSettlementExpenseItemFirestore(params: {
  tournamentId: string;
  expenseItemId?: string;
  title: string;
  amount: number;
  actorUserId?: string;
}): Promise<{ ok: true; settlement: TournamentSettlement } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  if (!tournamentId) return { ok: false, error: "잘못된 요청입니다." };
  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };

  const title = params.title.trim();
  const amount = Number(params.amount);
  if (params.expenseItemId !== undefined && !params.expenseItemId.trim()) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  if (!title) return { ok: false, error: "지출 항목명을 입력해 주세요." };
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "지출 금액은 0 이상이어야 합니다." };

  const db = getSharedFirestoreDb();
  return db.runTransaction(async (tx) => {
    const ref = db.collection(COLLECTION).doc(tournamentId);
    const doc = await tx.get(ref);
    const settlement: TournamentSettlement = doc.exists
      ? settlementFromData(tournamentId, doc.data() as Record<string, unknown>)
      : {
          tournamentId,
          refundedApplicationIds: [],
          expenseItems: [],
          ledgerLines: [],
          isSettled: false,
          updatedAt: new Date().toISOString(),
        };

    const normalizedAmount = Math.floor(amount);
    const expenseItemId = params.expenseItemId?.trim() || null;
    if (!expenseItemId) {
      const newExpenseId = randomUUID();
      settlement.expenseItems.push({
        id: newExpenseId,
        title,
        amount: normalizedAmount,
      });
    } else {
      const target = settlement.expenseItems.find((item) => item.id === expenseItemId);
      if (!target) throw new Error("NOT_FOUND:수정할 지출 항목을 찾을 수 없습니다.");
      if (target.title === title && target.amount === normalizedAmount) {
        throw new Error("DUP:이미 처리된 상태입니다.");
      }
      target.title = title;
      target.amount = normalizedAmount;
    }
    settlement.updatedAt = new Date().toISOString();
    tx.set(ref, toPlain(settlement));
    return { ok: true, settlement } as const;
  }).then((r) => r, (e: unknown) => {
    const m = e instanceof Error ? e.message : "";
    if (m.startsWith("NOT_FOUND:")) return { ok: false, error: m.slice(10) } as const;
    if (m.startsWith("DUP:")) return { ok: false, error: m.slice(4) } as const;
    throw e;
  });
}

export async function deleteSettlementExpenseItemFirestore(params: {
  tournamentId: string;
  expenseItemId: string;
}): Promise<{ ok: true; settlement: TournamentSettlement } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  if (!tournamentId) return { ok: false, error: "잘못된 요청입니다." };
  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };
  const expenseItemId = params.expenseItemId.trim();
  if (!expenseItemId) return { ok: false, error: "잘못된 요청입니다." };

  const db = getSharedFirestoreDb();
  return db.runTransaction(async (tx) => {
    const ref = db.collection(COLLECTION).doc(tournamentId);
    const doc = await tx.get(ref);
    const settlement = getOrCreateFromTx(doc, tournamentId);
    const nextItems = settlement.expenseItems.filter((item) => item.id !== expenseItemId);
    if (nextItems.length === settlement.expenseItems.length) {
      throw new Error("NOT_FOUND:삭제할 지출 항목을 찾을 수 없습니다.");
    }
    settlement.expenseItems = nextItems;
    settlement.updatedAt = new Date().toISOString();
    tx.set(ref, toPlain(settlement));
    return { ok: true, settlement } as const;
  }).then(
    (r) => r,
    (e: unknown) => {
      const m = e instanceof Error ? e.message : "";
      if (m.startsWith("NOT_FOUND:")) return { ok: false, error: m.slice(10) } as const;
      throw e;
    }
  );
}

function getOrCreateFromTx(doc: DocumentSnapshot, tournamentId: string): TournamentSettlement {
  if (!doc.exists) {
    return {
      tournamentId,
      refundedApplicationIds: [],
      expenseItems: [],
      ledgerLines: [],
      isSettled: false,
      updatedAt: new Date().toISOString(),
    };
  }
  return settlementFromData(tournamentId, doc.data() as Record<string, unknown>);
}

export async function setSettlementRefundedFirestore(params: {
  tournamentId: string;
  applicationId: string;
  refunded: boolean;
}): Promise<{ ok: true; settlement: TournamentSettlement } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const applicationId = params.applicationId.trim();
  if (!applicationId) return { ok: false, error: "applicationId가 필요합니다." };

  const approvedEntriesResult = await listSettlementEntriesByTournamentIdFirestore(params.tournamentId);
  if (!approvedEntriesResult.ok) return { ok: false, error: approvedEntriesResult.error };
  const isApprovedEntry = approvedEntriesResult.entries.some((item) => item.applicationId === applicationId);
  if (!isApprovedEntry) {
    return { ok: false, error: "APPROVED 참가자만 환불 처리할 수 있습니다." };
  }

  const db = getSharedFirestoreDb();
  const tid = params.tournamentId.trim();
  return db.runTransaction(async (tx) => {
    const ref = db.collection(COLLECTION).doc(tid);
    const doc = await tx.get(ref);
    const settlement = getOrCreateFromTx(doc, tid);
    if (params.refunded) {
      if (!settlement.refundedApplicationIds.includes(applicationId)) {
        settlement.refundedApplicationIds.push(applicationId);
      }
    } else {
      settlement.refundedApplicationIds = settlement.refundedApplicationIds.filter((id) => id !== applicationId);
    }
    settlement.updatedAt = new Date().toISOString();
    tx.set(ref, toPlain(settlement));
    return { ok: true, settlement } as const;
  });
}

export async function setTournamentSettlementStatusFirestore(params: {
  tournamentId: string;
  isSettled: boolean;
}): Promise<{ ok: true; settlement: TournamentSettlement } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  if (!tournamentId) return { ok: false, error: "잘못된 요청입니다." };
  if (typeof params.isSettled !== "boolean") return { ok: false, error: "잘못된 요청입니다." };
  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };

  const db = getSharedFirestoreDb();
  return db.runTransaction(async (tx) => {
    const ref = db.collection(COLLECTION).doc(tournamentId);
    const doc = await tx.get(ref);
    const settlement = getOrCreateFromTx(doc, tournamentId);
    if (settlement.isSettled === params.isSettled) {
      throw new Error("DUP:이미 처리된 상태입니다.");
    }
    settlement.isSettled = params.isSettled;
    settlement.updatedAt = new Date().toISOString();
    tx.set(ref, toPlain(settlement));
    return { ok: true, settlement } as const;
  }).then(
    (r) => r,
    (e: unknown) => {
      const m = e instanceof Error ? e.message : "";
      if (m.startsWith("DUP:")) return { ok: false, error: m.slice(4) } as const;
      throw e;
    }
  );
}

/** 장부 라인만 조회(대회 문서는 호출부에서 이미 검증한 경우). */
export async function getSettlementLedgerLinesOnlyFirestore(
  tournamentId: string
): Promise<{ ok: true; lines: SettlementLedgerLineStored[] } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tid = tournamentId.trim();
  if (!tid) return { ok: false, error: "잘못된 요청입니다." };
  const settlement = await getOrCreateSettlementFirestore(tid);
  const lines = normalizeLedgerLinesArray(settlement.ledgerLines).sort((a, b) => {
    const ad = a.entryDate ?? "";
    const bd = b.entryDate ?? "";
    if (ad !== bd) return bd.localeCompare(ad);
    return (b.sortOrder ?? 0) - (a.sortOrder ?? 0);
  });
  return { ok: true, lines };
}

export async function getTournamentLedgerLinesForClientFirestore(
  tournamentId: string
): Promise<
  { ok: true; tournament: SettlementLedgerTournamentSummary; lines: SettlementLedgerLineStored[] } | { ok: false; error: string }
> {
  assertClientFirestorePersistenceConfigured();
  const t = await getTournamentSettlementAccessFieldsByIdFirestore(tournamentId);
  if (!t || t.status === "DELETED") {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }
  const linesOnly = await getSettlementLedgerLinesOnlyFirestore(tournamentId);
  if (!linesOnly.ok) return linesOnly;
  return {
    ok: true,
    tournament: { id: t.id, title: t.title },
    lines: linesOnly.lines,
  };
}

export async function replaceSettlementLedgerLinesFirestore(params: {
  tournamentId: string;
  lines: Array<{
    category: string;
    flow: string;
    amountKrw: number;
    label?: string | null;
    note?: string | null;
    entryDate?: string | null;
  }>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  if (!tournamentId) return { ok: false, error: "잘못된 요청입니다." };
  const access = await getTournamentOwnerAccessPreviewByIdFirestore(tournamentId);
  if (!access || access.status === "DELETED") {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }

  const built: SettlementLedgerLineStored[] = [];
  for (let i = 0; i < params.lines.length; i++) {
    const row = params.lines[i]!;
    const cat = String(row.category ?? "").trim();
    const flow = String(row.flow ?? "").trim();
    if (!isSettlementCategoryV2(cat)) {
      return { ok: false, error: "알 수 없는 카테고리입니다." };
    }
    if (flow !== "INCOME" && flow !== "EXPENSE") {
      return { ok: false, error: "구분은 수입(INCOME) 또는 비용(EXPENSE)이어야 합니다." };
    }
    const amountKrw = Number(row.amountKrw);
    if (!Number.isFinite(amountKrw) || amountKrw < 0) {
      return { ok: false, error: "금액은 0 이상이어야 합니다." };
    }
    const entryDateRaw = row.entryDate != null && typeof row.entryDate === "string" ? row.entryDate.trim() : "";
    const entryDate = /^\d{4}-\d{2}-\d{2}$/.test(entryDateRaw) ? entryDateRaw : null;
    built.push({
      id: randomUUID(),
      category: cat,
      flow,
      amountKrw: Math.round(amountKrw),
      label: row.label != null && String(row.label).trim() ? String(row.label).trim() : null,
      note: row.note != null && String(row.note).trim() ? String(row.note).trim() : null,
      sortOrder: i,
      entryDate,
    });
  }

  const db = getSharedFirestoreDb();
  await db.runTransaction(async (tx) => {
    const ref = db.collection(COLLECTION).doc(tournamentId);
    const doc = await tx.get(ref);
    const settlement = getOrCreateFromTx(doc, tournamentId);
    settlement.ledgerLines = built;
    settlement.updatedAt = new Date().toISOString();
    tx.set(ref, toPlain(settlement));
  });
  return { ok: true };
}

function tournamentDateToYmdForFilter(dateStr: string): string | null {
  const s = String(dateStr ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export async function getSettlementLedgerOverviewForClientFirestore(params: {
  userId: string;
  role: AuthRole;
}): Promise<
  | {
      ok: true;
      rows: { tournamentId: string; title: string; income: number; expense: number; net: number }[];
      grand: { income: number; expense: number; net: number };
    }
  | { ok: false; error: string }
> {
  assertClientFirestorePersistenceConfigured();
  const tournaments =
    params.role === "PLATFORM"
      ? await listAllTournamentsFirestore()
      : await listTournamentsByCreatorFirestore(params.userId);

  const publishedCards = await listPublishedCardFlagsFromFirestoreKv();
  const published = tournaments.filter((t) =>
    publishedCards.some((c) => c.tournamentId === t.id && c.isPublished === true && c.isActive === true)
  );

  published.sort((a, b) => {
    const ay = tournamentDateToYmdForFilter(a.date) ?? "";
    const by = tournamentDateToYmdForFilter(b.date) ?? "";
    return by.localeCompare(ay);
  });

  const db = getSharedFirestoreDb();
  const rows: { tournamentId: string; title: string; income: number; expense: number; net: number }[] = [];
  let gin = 0;
  let gex = 0;
  for (const t of published) {
    const doc = await db.collection(COLLECTION).doc(t.id).get();
    const s = doc.exists
      ? settlementFromData(t.id, doc.data() as Record<string, unknown>)
      : { ledgerLines: [] as SettlementLedgerLineStored[] };
    const lines = normalizeLedgerLinesArray(s.ledgerLines);
    const { income, expense, net } = computeLedgerTotalsFromLines(lines);
    gin += income;
    gex += expense;
    rows.push({ tournamentId: t.id, title: t.title, income, expense, net });
  }

  return {
    ok: true,
    rows,
    grand: { income: gin, expense: gex, net: gin - gex },
  };
}
