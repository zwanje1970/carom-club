/**
 * 기존 브래킷만 사용한 Firestore 대진표 E2E (서버 함수만 호출).
 *
 *   npx --yes tsx scripts/verify-bracket-existing-e2e.mts
 *   npx --yes tsx scripts/verify-bracket-existing-e2e.mts --bracketId=<uuid>
 *
 * `rounds.length === 1` 인 최신 브래킷을 고르거나, `--bracketId` 로 지정.
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
const BRACKETS = "v3_tournament_brackets";

function parseBracketId(argv: string[]): string {
  for (const a of argv) {
    if (a.startsWith("--bracketId=")) return a.slice("--bracketId=".length).trim();
  }
  const i = argv.indexOf("--bracketId");
  if (i >= 0 && argv[i + 1]) return argv[i + 1]!.trim();
  return "";
}

type FsMatch = {
  id?: string;
  status?: string;
  winnerUserId?: string | null;
  winnerName?: string | null;
  player1?: { userId?: string; name?: string };
  player2?: { userId?: string; name?: string };
};

type FsRound = { roundNumber?: number; matches?: FsMatch[]; status?: string };

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

const {
  updateBracketMatchResultFirestore,
  advanceBracketRoundFirestore,
} = await import("../lib/server/firestore-tournament-brackets");
const { getSharedFirestoreDb } = await import("../lib/server/firestore-users");

const report: Record<string, unknown> = { tournamentId: TOURNAMENT_ID };
const errors: Array<{ step: string; detail: string; stack?: string }> = [];

try {
  const db = getSharedFirestoreDb();
  const explicitId = parseBracketId(process.argv.slice(2));
  let bracketId = explicitId;

  if (!bracketId) {
    const snap = await db.collection(BRACKETS).where("tournamentId", "==", TOURNAMENT_ID).get();
    const rows = snap.docs.map((d) => {
      const data = d.data() as { createdAt?: string; rounds?: FsRound[] };
      return {
        id: d.id,
        createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
        rounds: Array.isArray(data.rounds) ? data.rounds : [],
      };
    });
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const onlyR1 = rows.find((r) => r.rounds.length === 1);
    if (!onlyR1) {
      errors.push({
        step: "pick_bracket",
        detail:
          "이 대회에 rounds가 1개뿐인 브래킷이 없습니다. 새 브래킷을 만든 뒤 `--bracketId` 로 지정하거나 verify-bracket-e2e.mts 로 새로 생성하세요.",
      });
      throw new Error("STOP");
    }
    bracketId = onlyR1.id;
  }

  report.bracketId = bracketId;
  const brRef = db.collection(BRACKETS).doc(bracketId);
  const brSnap = await brRef.get();
  if (!brSnap.exists) {
    errors.push({ step: "load_bracket", detail: "브래킷 문서 없음" });
    throw new Error("STOP");
  }

  const brData = brSnap.data() as { tournamentId?: string; rounds?: FsRound[] };
  if (brData.tournamentId !== TOURNAMENT_ID) {
    errors.push({ step: "load_bracket", detail: "tournamentId 불일치" });
    throw new Error("STOP");
  }

  const rounds = Array.isArray(brData.rounds) ? brData.rounds : [];
  const r1 = rounds.find((r) => r.roundNumber === 1);
  if (!r1 || !Array.isArray(r1.matches) || r1.matches.length !== 16) {
    errors.push({
      step: "r1_shape",
      detail: `라운드1 없음 또는 매치 수 ${r1?.matches?.length ?? 0} (16 필요)`,
    });
    throw new Error("STOP");
  }

  if (rounds.some((r) => r.roundNumber === 2)) {
    errors.push({
      step: "already_advanced",
      detail: "이미 라운드2가 있습니다. 라운드1만 있는 브래킷을 선택하세요.",
    });
    throw new Error("STOP");
  }

  let r1Written = 0;
  let r1SkippedAlready = 0;
  for (const m of r1.matches) {
    const mid = typeof m.id === "string" ? m.id : "";
    const p1 = m.player1?.userId;
    if (!mid || !p1) {
      errors.push({ step: "r1_bad_match", detail: "match id 또는 player1 없음" });
      throw new Error("STOP");
    }
    if (m.status === "COMPLETED" && m.winnerUserId === p1) {
      r1SkippedAlready += 1;
      continue;
    }
    const wr = await updateBracketMatchResultFirestore({
      tournamentId: TOURNAMENT_ID,
      matchId: mid,
      winnerUserId: p1,
    });
    if (!wr.ok) {
      errors.push({ step: "r1_result", detail: `${mid}: ${wr.error}` });
      throw new Error("STOP");
    }
    r1Written += 1;
  }
  report.matchResultsInputOk = true;
  report.round1ResultsWritten = r1Written;
  report.round1ResultsSkippedAlready = r1SkippedAlready;

  const afterR1 = await brRef.get();
  const afterData = afterR1.data() as { rounds?: FsRound[] } | undefined;
  const r1Again = afterData?.rounds?.find((r) => r.roundNumber === 1);
  const allCompleted =
    Array.isArray(r1Again?.matches) &&
    r1Again!.matches!.length === 16 &&
    r1Again!.matches!.every((m) => m.status === "COMPLETED");
  report.round1AllMatchesCompleted = allCompleted;
  report.round1RoundStatus = r1Again?.status ?? null;

  if (!allCompleted) {
    errors.push({ step: "r1_verify", detail: "라운드1 매치가 모두 COMPLETED가 아님" });
    throw new Error("STOP");
  }

  const adv = await advanceBracketRoundFirestore(bracketId, 1);
  if (!adv.ok) {
    errors.push({ step: "advance", detail: adv.error });
    throw new Error("STOP");
  }
  report.advanceOk = true;
  const r2 = adv.bracket.rounds.find((r) => r.roundNumber === 2);
  report.round2MatchCount = r2?.matches.length ?? 0;

  const r1Winners = (r1Again?.matches ?? [])
    .filter((m) => m.status === "COMPLETED" && m.winnerUserId && m.winnerName)
    .map((m) => ({ userId: m.winnerUserId as string, name: m.winnerName as string }));

  let wiringOk = r1Winners.length === 16 && (r2?.matches.length ?? 0) === 8;
  if (wiringOk && r2) {
    for (let i = 0; i < 8; i += 1) {
      const m = r2.matches[i]!;
      const e1 = r1Winners[i * 2];
      const e2 = r1Winners[i * 2 + 1];
      if (
        m.player1?.userId !== e1?.userId ||
        m.player2?.userId !== e2?.userId ||
        m.player1?.name !== e1?.name ||
        m.player2?.name !== e2?.name
      ) {
        wiringOk = false;
        break;
      }
    }
  }
  report.winnerSlotWiringOk = wiringOk;

  const finalSnap = await brRef.get();
  const finalData = finalSnap.data() as { rounds?: FsRound[] } | undefined;
  const r2Fs = finalData?.rounds?.find((r) => r.roundNumber === 2);
  report.firestoreRound2Exists = Boolean(r2Fs);
  report.firestoreRound2MatchCount = Array.isArray(r2Fs?.matches) ? r2Fs!.matches!.length : 0;
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
