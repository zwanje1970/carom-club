/**
 * 정산 Firestore 흐름만 검증 (firestore-tournament-settlements export만 호출).
 *
 *   npx --yes tsx scripts/verify-settlement-firestore-e2e.mts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal(): void {
  const p = resolve(process.cwd(), ".env.local");
  try {
    const raw = readFileSync(p, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (typeof process.env[key] === "undefined") process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

const TOURNAMENT_ID = "8dc4676f-81ba-48cb-83dc-25728a91bf21";
const COLLECTION = "v3_tournament_settlements";

const {
  getTournamentSettlementByTournamentIdFirestore,
  upsertSettlementExpenseItemFirestore,
  deleteSettlementExpenseItemFirestore,
} = await import("../lib/server/firestore-tournament-settlements");
const { getSharedFirestoreDb } = await import("../lib/server/firestore-users");

const report: Record<string, unknown> = {
  tournamentId: TOURNAMENT_ID,
  functionsUsed: [
    "getTournamentSettlementByTournamentIdFirestore",
    "upsertSettlementExpenseItemFirestore (add)",
    "upsertSettlementExpenseItemFirestore (update)",
    "getTournamentSettlementByTournamentIdFirestore (re-read)",
    "deleteSettlementExpenseItemFirestore (cleanup)",
  ],
};
const errors: Array<{ step: string; detail: string; stack?: string }> = [];

function errToDetail(e: unknown): { detail: string; stack?: string } {
  if (e && typeof e === "object" && "message" in e) {
    const m = String((e as { message: unknown }).message);
    const st =
      "stack" in e && typeof (e as { stack: unknown }).stack === "string"
        ? (e as { stack: string }).stack
        : undefined;
    const code = "code" in e ? String((e as { code: unknown }).code) : "";
    return { detail: code ? `${code}: ${m}` : m, stack: st };
  }
  return { detail: String(e) };
}

try {
  const before = await getTournamentSettlementByTournamentIdFirestore(TOURNAMENT_ID);
  if (!before.ok) {
    errors.push({ step: "get_before", detail: before.error });
    throw new Error("STOP");
  }
  report.initialFetchOk = true;
  report.settlementDocExistedBefore = before.settlement.expenseItems.length > 0 || before.settlement.updatedAt !== "";

  const db = getSharedFirestoreDb();
  const refSnap = await db.collection(COLLECTION).doc(TOURNAMENT_ID).get();
  report.firestoreDocExistsAfterGetOrCreate = refSnap.exists;

  const tag = `e2e-settlement-${Date.now()}`;
  const add = await upsertSettlementExpenseItemFirestore({
    tournamentId: TOURNAMENT_ID,
    title: `${tag}-a`,
    amount: 100,
    actorUserId: "e2e-verify-actor",
  });
  if (!add.ok) {
    errors.push({ step: "upsert_add", detail: add.error });
    throw new Error("STOP");
  }
  report.addExpenseOk = true;
  const newId = add.settlement.expenseItems.find((x) => x.title === `${tag}-a`)?.id ?? "";
  if (!newId) {
    errors.push({ step: "add_id", detail: "새 지출 id를 찾지 못함" });
    throw new Error("STOP");
  }
  report.newExpenseItemId = newId;

  const upd = await upsertSettlementExpenseItemFirestore({
    tournamentId: TOURNAMENT_ID,
    expenseItemId: newId,
    title: `${tag}-b`,
    amount: 250,
    actorUserId: "e2e-verify-actor",
  });
  if (!upd.ok) {
    errors.push({ step: "upsert_update", detail: upd.error });
    throw new Error("STOP");
  }
  report.updateExpenseOk = true;
  const itemAfterUpd = upd.settlement.expenseItems.find((x) => x.id === newId);
  report.afterUpdateFromReturn = itemAfterUpd
    ? { title: itemAfterUpd.title, amount: itemAfterUpd.amount }
    : null;

  const after = await getTournamentSettlementByTournamentIdFirestore(TOURNAMENT_ID);
  if (!after.ok) {
    errors.push({ step: "get_after", detail: after.error });
    throw new Error("STOP");
  }
  const reread = after.settlement.expenseItems.find((x) => x.id === newId);
  report.reReadOk = Boolean(reread && reread.title === `${tag}-b` && reread.amount === 250);
  report.reReadItem = reread ? { title: reread.title, amount: reread.amount } : null;

  const raw = (await db.collection(COLLECTION).doc(TOURNAMENT_ID).get()).data() as {
    expenseItems?: { id?: string; title?: string; amount?: number }[];
  } | undefined;
  const rawItem = raw?.expenseItems?.find((x) => x.id === newId);
  report.firestoreRawReRead = rawItem
    ? { title: rawItem.title, amount: rawItem.amount }
    : null;

  const del = await deleteSettlementExpenseItemFirestore({
    tournamentId: TOURNAMENT_ID,
    expenseItemId: newId,
  });
  if (!del.ok) {
    errors.push({ step: "cleanup_delete", detail: del.error });
    throw new Error("STOP");
  }
  report.cleanupDeleteOk = true;
} catch (e) {
  if ((e as Error).message !== "STOP") {
    const { detail, stack } = errToDetail(e);
    errors.push({ step: "unexpected", detail, stack });
  }
}

report.errors = errors;
report.ok = errors.length === 0;
report.devStoreInvocationNote =
  "검증 스크립트는 lib/server/firestore-tournament-settlements.ts 및 firestore-users 등만 호출했습니다. dev-store의 getTournamentSettlementByTournamentId / upsertSettlementExpenseItem 등 디스크 기반 API는 호출하지 않았습니다. (정산 Firestore 모듈이 타입·loadTournamentPublishedCardsArray를 dev-store에서 import하지만, 본 스크립트가 호출한 함수 경로에서는 해당 헬퍼가 실행되지 않습니다.)";

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
