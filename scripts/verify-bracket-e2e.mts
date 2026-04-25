/**
 * Firestore bracket E2E (기존 서버 함수만 사용, dev-store 미사용).
 *
 *   npx --yes tsx scripts/verify-bracket-e2e.mts
 *
 * 사전: `.env.local`에 Firebase Admin 자격 증명, `v3_tournament_brackets` 복합 인덱스 Enabled.
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

const {
  createBracketParticipantSnapshotFirestore,
  createBracketFromSnapshotFirestore,
  updateBracketMatchResultFirestore,
  advanceBracketRoundFirestore,
} = await import("../lib/server/firestore-tournament-brackets");
const { getSharedFirestoreDb } = await import("../lib/server/firestore-users");

const report: Record<string, unknown> = { tournamentId: TOURNAMENT_ID };
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
  const snapResult = await createBracketParticipantSnapshotFirestore({ tournamentId: TOURNAMENT_ID });
  if (!snapResult.ok) {
    errors.push({ step: "snapshot", detail: snapResult.error });
    throw new Error("STOP");
  }
  report.snapshotOk = true;
  report.snapshotId = snapResult.snapshot.id;
  report.snapshotParticipantCount = snapResult.snapshot.participants.length;

  const brResult = await createBracketFromSnapshotFirestore(snapResult.snapshot.id);
  if (!brResult.ok) {
    errors.push({ step: "bracket", detail: brResult.error });
    throw new Error("STOP");
  }
  report.bracketCreateOk = true;
  report.bracketId = brResult.bracket.id;
  let bracket = brResult.bracket;
  report.roundStructureAfterCreate = bracket.rounds.map((r) => ({
    roundNumber: r.roundNumber,
    matchCount: r.matches.length,
    status: r.status,
  }));

  const r1 = bracket.rounds.find((r) => r.roundNumber === 1);
  if (!r1) {
    errors.push({ step: "r1_missing", detail: "round 1 missing" });
    throw new Error("STOP");
  }

  let r1Ok = 0;
  for (const m of r1.matches) {
    const wr = await updateBracketMatchResultFirestore({
      tournamentId: TOURNAMENT_ID,
      matchId: m.id,
      winnerUserId: m.player1.userId,
    });
    if (!wr.ok) {
      errors.push({ step: "r1_result", detail: wr.error });
      throw new Error("STOP");
    }
    bracket = wr.bracket;
    r1Ok += 1;
  }
  report.round1MatchResultsWritten = r1Ok;
  report.round1AllCompleted =
    bracket.rounds.find((r) => r.roundNumber === 1)?.status === "COMPLETED";

  const adv = await advanceBracketRoundFirestore(bracket.id, 1);
  if (!adv.ok) {
    errors.push({ step: "advance", detail: adv.error });
    throw new Error("STOP");
  }
  bracket = adv.bracket;
  report.advanceOk = true;
  const r2 = bracket.rounds.find((r) => r.roundNumber === 2);
  report.round2MatchCount = r2?.matches.length ?? 0;
  report.roundStructureAfterAdvance = bracket.rounds.map((r) => ({
    roundNumber: r.roundNumber,
    matchCount: r.matches.length,
    status: r.status,
  }));

  const db = getSharedFirestoreDb();
  const snapDoc = await db.collection("v3_tournament_participant_snapshots").doc(String(report.snapshotId)).get();
  const brDoc = await db.collection("v3_tournament_brackets").doc(bracket.id).get();
  report.firestoreSnapshotDocExists = snapDoc.exists;
  report.firestoreBracketDocExists = brDoc.exists;
  const brData = brDoc.data() as { rounds?: { matches?: unknown[] }[] } | undefined;
  const r2FromFs = brData?.rounds?.find((_, i, arr) => (arr[i] as { roundNumber?: number })?.roundNumber === 2);
  report.firestoreRound2MatchCount = Array.isArray((r2FromFs as { matches?: unknown[] })?.matches)
    ? (r2FromFs as { matches: unknown[] }).matches.length
    : 0;
} catch (e) {
  if ((e as Error).message !== "STOP") {
    const { detail, stack } = errToDetail(e);
    errors.push({ step: "unexpected", detail, stack });
  }
}

report.errors = errors;
report.ok = errors.length === 0;
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
