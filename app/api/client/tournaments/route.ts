import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { isEmptyOutlineHtml } from "../../../../lib/outline-content-helpers";
import type { OutlineDisplayMode } from "../../../../lib/outline-content-types";
import {
  createTournament,
  getClientStatusByUserId,
  getUserById,
  listAllTournaments,
  listTournamentsByCreator,
  type TournamentRuleSnapshot,
} from "../../../../lib/server/dev-store";

export const runtime = "nodejs";

async function getAuthorizedUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return null;

  const user = await getUserById(session.userId);
  if (!user) return null;

  if (user.role === "PLATFORM") {
    return { user, allowed: true as const };
  }

  if (user.role !== "CLIENT") {
    return { user, allowed: false as const, reason: "client-role-required" as const };
  }

  const clientStatus = await getClientStatusByUserId(user.id);
  if (clientStatus !== "APPROVED") {
    return { user, allowed: false as const, reason: "client-not-approved" as const };
  }

  return { user, allowed: true as const };
}

function parseString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parseFiniteNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function parseBooleanLoose(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

/** POST 본문에서 규칙 필드만 추출 (없으면 생략 → create 시 기본값) */
function parseOutlineDisplayMode(v: unknown): OutlineDisplayMode | null {
  if (v === "TEXT" || v === "IMAGE" || v === "PDF") return v;
  return null;
}

function parseRuleFromBody(body: Record<string, unknown>): Partial<TournamentRuleSnapshot> | undefined {
  const keys = [
    "entryCondition",
    "entryQualificationType",
    "verificationMode",
    "verificationReviewRequired",
    "verificationGuideText",
    "eligibilityType",
    "eligibilityValue",
    "eligibilityCompare",
    "divisionEnabled",
    "divisionMetricType",
    "divisionRulesJson",
    "scope",
    "region",
    "accountNumber",
    "allowMultipleSlots",
    "participantsListPublic",
    "durationType",
    "durationDays",
    "isScotch",
    "teamScoreLimit",
    "teamScoreRule",
  ] as const;

  const out: Partial<TournamentRuleSnapshot> = {};
  let any = false;
  for (const k of keys) {
    if (k in body && body[k] !== undefined) {
      any = true;
      if (k === "verificationReviewRequired") {
        const b = parseBooleanLoose(body[k]);
        if (b !== undefined) out.verificationReviewRequired = b;
      } else if (k === "divisionEnabled") {
        const b = parseBooleanLoose(body[k]);
        if (b !== undefined) out.divisionEnabled = b;
      } else if (k === "allowMultipleSlots") {
        const b = parseBooleanLoose(body[k]);
        if (b !== undefined) out.allowMultipleSlots = b;
      } else if (k === "participantsListPublic") {
        const b = parseBooleanLoose(body[k]);
        if (b !== undefined) out.participantsListPublic = b;
      } else if (k === "isScotch") {
        const b = parseBooleanLoose(body[k]);
        if (b !== undefined) out.isScotch = b;
      } else if (k === "eligibilityValue") {
        const n = parseFiniteNumber(body[k]);
        if (n !== undefined) out.eligibilityValue = n;
      } else if (k === "durationDays") {
        const n = parseFiniteNumber(body[k]);
        if (n !== undefined) out.durationDays = Math.floor(n);
      } else if (k === "teamScoreLimit") {
        const n = parseFiniteNumber(body[k]);
        if (n !== undefined) out.teamScoreLimit = n;
      } else if (k === "divisionRulesJson") {
        out.divisionRulesJson = body[k] as TournamentRuleSnapshot["divisionRulesJson"];
      } else {
        const val = body[k];
        if (typeof val === "string" || typeof val === "number" || val === null) {
          (out as Record<string, unknown>)[k] = val;
        }
      }
    }
  }
  return any ? out : undefined;
}

export async function GET() {
  const auth = await getAuthorizedUser();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!auth.allowed) {
    return NextResponse.json({ error: "접근 권한이 없습니다.", reason: auth.reason }, { status: 403 });
  }

  const tournaments =
    auth.user.role === "PLATFORM"
      ? await listAllTournaments()
      : await listTournamentsByCreator(auth.user.id);

  return NextResponse.json({ tournaments });
}

export async function POST(request: Request) {
  const auth = await getAuthorizedUser();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!auth.allowed) {
    return NextResponse.json({ error: "접근 권한이 없습니다.", reason: auth.reason }, { status: 403 });
  }

  let body: Record<string, unknown> = {};

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const title = parseString(body.title)?.trim() ?? "";
  const date = parseString(body.date)?.trim() ?? "";
  const location = parseString(body.location)?.trim() ?? "";
  const maxParticipants = parseFiniteNumber(body.maxParticipants);
  const entryFee = parseFiniteNumber(body.entryFee);

  const posterImageUrlRaw = body.posterImageUrl;
  const posterImageUrl =
    typeof posterImageUrlRaw === "string" && posterImageUrlRaw.trim() !== ""
      ? posterImageUrlRaw.trim()
      : null;
  const summaryRaw = body.summary;
  const summary =
    typeof summaryRaw === "string" && summaryRaw.trim() !== "" ? summaryRaw.trim() : null;
  const prizeInfoRaw = body.prizeInfo;
  const prizeInfo =
    typeof prizeInfoRaw === "string" && prizeInfoRaw.trim() !== "" ? prizeInfoRaw.trim() : null;

  const outlineHtmlRaw = body.outlineHtml;
  const outlineHtmlCandidate = typeof outlineHtmlRaw === "string" ? outlineHtmlRaw : "";
  const outlineHtml =
    outlineHtmlCandidate !== "" && !isEmptyOutlineHtml(outlineHtmlCandidate) ? outlineHtmlCandidate : null;

  const outlineImageUrlRaw = body.outlineImageUrl;
  const outlineImageUrl =
    typeof outlineImageUrlRaw === "string" && outlineImageUrlRaw.trim() !== ""
      ? outlineImageUrlRaw.trim()
      : null;

  const outlinePdfUrlRaw = body.outlinePdfUrl;
  const outlinePdfUrl =
    typeof outlinePdfUrlRaw === "string" && outlinePdfUrlRaw.trim() !== "" ? outlinePdfUrlRaw.trim() : null;

  const outlineModeParsed = parseOutlineDisplayMode(body.outlineDisplayMode);
  const hasAnyOutline = Boolean(outlineHtml || outlineImageUrl || outlinePdfUrl);
  const outlineDisplayMode: OutlineDisplayMode | null = hasAnyOutline
    ? outlineModeParsed ?? "TEXT"
    : null;

  const venueGuideRaw = body.venueGuideVenueId;
  const venueGuideVenueId =
    typeof venueGuideRaw === "string" && venueGuideRaw.trim() !== "" ? venueGuideRaw.trim() : null;

  const rule = parseRuleFromBody(body);

  const result = await createTournament({
    title,
    date,
    location,
    maxParticipants: maxParticipants ?? Number.NaN,
    entryFee: entryFee ?? Number.NaN,
    createdBy: auth.user.id,
    rule,
    posterImageUrl,
    summary,
    prizeInfo,
    outlineDisplayMode,
    outlineHtml,
    outlineImageUrl,
    outlinePdfUrl,
    venueGuideVenueId,
    eventDates: body.eventDates,
    extraVenues: body.extraVenues,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, tournament: result.tournament });
}
