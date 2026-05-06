/**
 * Local-only helper:
 * Register 64 APPROVED participants via client API.
 *
 * Usage:
 *   node scripts/seed-participants-64.mts --tournamentId=<id>
 * Optional:
 *   --baseUrl=http://127.0.0.1:3001
 *   --identifier=aaaaaa
 *   --password=aaaaaa
 */

type ParsedArgs = {
  tournamentId: string;
  baseUrl: string;
  identifier: string;
  password: string;
};

type ListItem = {
  id?: string;
  status?: string;
  applicantName?: string;
};

const TARGET_COUNT = 64;

function parseArgs(argv: string[]): ParsedArgs {
  let tournamentId = "";
  let baseUrl = "http://127.0.0.1:3001";
  let identifier = "aaaaaa";
  let password = "aaaaaa";

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? "";
    const n = argv[i + 1] ?? "";
    if ((a === "--tournamentId" || a === "--tournament-id" || a === "-t") && n) {
      tournamentId = n.trim();
      i += 1;
      continue;
    }
    if (a.startsWith("--tournamentId=") || a.startsWith("--tournament-id=")) {
      tournamentId = a.split("=")[1]?.trim() ?? "";
      continue;
    }
    if (a === "--baseUrl" && n) {
      baseUrl = n.trim();
      i += 1;
      continue;
    }
    if (a.startsWith("--baseUrl=")) {
      baseUrl = a.split("=")[1]?.trim() ?? baseUrl;
      continue;
    }
    if (a === "--identifier" && n) {
      identifier = n.trim();
      i += 1;
      continue;
    }
    if (a.startsWith("--identifier=")) {
      identifier = a.split("=")[1]?.trim() ?? identifier;
      continue;
    }
    if (a === "--password" && n) {
      password = n.trim();
      i += 1;
      continue;
    }
    if (a.startsWith("--password=")) {
      password = a.split("=")[1]?.trim() ?? password;
      continue;
    }
  }

  return { tournamentId, baseUrl, identifier, password };
}

function assertLocalOnly(baseUrl: string): void {
  let u: URL;
  try {
    u = new URL(baseUrl);
  } catch {
    console.error(`[seed-participants-64] invalid --baseUrl: ${baseUrl}`);
    process.exit(1);
    return;
  }
  const host = u.hostname.toLowerCase();
  if (!(host === "localhost" || host === "127.0.0.1" || host === "::1")) {
    console.error(`[seed-participants-64] local only: refusing non-local host "${host}"`);
    process.exit(1);
  }
}

function participantName(index1: number): string {
  return `테스트참가자${String(index1).padStart(3, "0")}`;
}

function participantPhone(index1: number): string {
  return `010${String(index1).padStart(8, "0")}`;
}

function getCookieHeaderFromLoginResponse(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const first = setCookie.split(",")[0] ?? "";
  const kv = first.split(";")[0]?.trim() ?? "";
  return kv;
}

async function login(baseUrl: string, identifier: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const json = (await res.json().catch(() => ({}))) as { authenticated?: boolean; error?: string };
  if (!res.ok || json.authenticated !== true) {
    throw new Error(json.error ?? `login failed (${res.status})`);
  }
  const cookie = getCookieHeaderFromLoginResponse(res);
  if (!cookie) throw new Error("login succeeded but session cookie not found");
  return cookie;
}

async function listEntries(baseUrl: string, tournamentId: string, cookie: string): Promise<ListItem[]> {
  const res = await fetch(`${baseUrl}/api/client/tournaments/${encodeURIComponent(tournamentId)}/applications/list-items`, {
    headers: { Cookie: cookie },
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; entries?: ListItem[]; error?: string };
  if (!res.ok || json.ok !== true || !Array.isArray(json.entries)) {
    throw new Error(json.error ?? `list-items failed (${res.status})`);
  }
  return json.entries;
}

async function registerOne(
  baseUrl: string,
  tournamentId: string,
  cookie: string,
  index1: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = participantName(index1);
  const res = await fetch(`${baseUrl}/api/client/tournaments/${encodeURIComponent(tournamentId)}/participants/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      name, // compatibility payload
      applicantName: name, // actual route key
      participantAverage: 20,
      phone: participantPhone(index1),
      adminNote: "E2E 테스트",
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || json.ok !== true) {
    return { ok: false, error: json.error ?? `register failed (${res.status})` };
  }
  return { ok: true };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.tournamentId) {
    console.error("[seed-participants-64] missing --tournamentId=<id>");
    process.exit(1);
  }
  assertLocalOnly(args.baseUrl);

  console.log(`[seed-participants-64] baseUrl=${args.baseUrl}`);
  console.log(`[seed-participants-64] tournamentId=${args.tournamentId}`);
  console.log(`[seed-participants-64] login identifier=${args.identifier}`);

  const cookie = await login(args.baseUrl, args.identifier, args.password);
  const beforeEntries = await listEntries(args.baseUrl, args.tournamentId, cookie);
  const beforeApproved = beforeEntries.filter((e) => e.status === "APPROVED").length;
  const beforeNames = new Set(beforeEntries.map((e) => String(e.applicantName ?? "").trim()).filter(Boolean));

  console.log(`[seed-participants-64] existing APPROVED=${beforeApproved}`);
  if (beforeApproved >= TARGET_COUNT) {
    console.error(`[seed-participants-64] already has ${beforeApproved} APPROVED entries, aborting.`);
    process.exit(1);
  }

  const duplicates: string[] = [];
  for (let i = 1; i <= TARGET_COUNT; i += 1) {
    const nm = participantName(i);
    if (beforeNames.has(nm)) duplicates.push(nm);
  }
  if (duplicates.length > 0) {
    console.error("[seed-participants-64] duplicate target names found, aborting:");
    for (const nm of duplicates) console.error(`  - ${nm}`);
    process.exit(1);
  }

  let success = 0;
  const failures: Array<{ idx: number; error: string }> = [];
  for (let i = 1; i <= TARGET_COUNT; i += 1) {
    const nm = participantName(i);
    const r = await registerOne(args.baseUrl, args.tournamentId, cookie, i);
    if (r.ok) {
      success += 1;
      console.log(`[seed-participants-64] OK ${i}/${TARGET_COUNT} ${nm}`);
    } else {
      failures.push({ idx: i, error: r.error });
      console.error(`[seed-participants-64] FAIL ${i}/${TARGET_COUNT} ${nm} :: ${r.error}`);
    }
  }

  const afterEntries = await listEntries(args.baseUrl, args.tournamentId, cookie);
  const afterApproved = afterEntries.filter((e) => e.status === "APPROVED").length;
  const createdNames = new Set(Array.from({ length: TARGET_COUNT }, (_, i) => participantName(i + 1)));
  const presentCreated = afterEntries.filter(
    (e) => e.status === "APPROVED" && createdNames.has(String(e.applicantName ?? "").trim()),
  ).length;

  console.log("--------------------------------------------------");
  console.log(`[seed-participants-64] success=${success}`);
  console.log(`[seed-participants-64] fail=${failures.length}`);
  console.log(`[seed-participants-64] approved before=${beforeApproved}, after=${afterApproved}`);
  console.log(`[seed-participants-64] created-name approved present=${presentCreated}/${TARGET_COUNT}`);
  if (failures.length > 0) {
    console.log("[seed-participants-64] failure details:");
    for (const f of failures) {
      console.log(`  - index=${f.idx}: ${f.error}`);
    }
  }
  if (presentCreated !== TARGET_COUNT) {
    console.error("[seed-participants-64] verification mismatch: target 64 approved names not fully present.");
    process.exit(2);
  }
}

main().catch((e) => {
  console.error("[seed-participants-64] fatal:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

