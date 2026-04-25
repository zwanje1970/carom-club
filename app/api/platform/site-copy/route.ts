import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readdir, readFile } from "fs/promises";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { getUserById } from "../../../../lib/platform-api";

export const runtime = "nodejs";

type CopyItemType = "HARDCODE" | "DATA" | "CONFIG";

type CopyItem = {
  text: string;
  file: string;
  path: string;
  type: CopyItemType;
};

async function requirePlatformUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || user.role !== "PLATFORM") return null;
  return user;
}

async function listTsxFilesRecursively(targetDir: string): Promise<string[]> {
  const entries = await readdir(targetDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await listTsxFilesRecursively(fullPath);
      files.push(...nested);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

function toRoutePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const marker = "/app/site/";
  const index = normalized.indexOf(marker);
  if (index < 0) return "/site";
  const relative = normalized.slice(index + marker.length);
  if (relative === "page.tsx") return "/site";
  if (relative === "layout.tsx") return "/site/*";
  return `/site/${relative.replace(/\/page\.tsx$/, "").replace(/\.tsx$/, "")}`;
}

function detectType(filePath: string, sourceLine: string): CopyItemType {
  const normalizedFile = filePath.replace(/\\/g, "/");
  const line = sourceLine.toLowerCase();

  if (
    line.includes("snapshot.title") ||
    line.includes("snapshot.subtitle") ||
    line.includes("notification.message") ||
    line.includes("notification.title") ||
    line.includes("block.data.text") ||
    line.includes("block.data.label")
  ) {
    return "DATA";
  }

  if (
    normalizedFile.endsWith("/app/site/layout.tsx") &&
    (line.includes("item.label") ||
      line.includes("item.href") ||
      line.includes("getsitelayoutconfig") ||
      line.includes("getsitenotice") ||
      line.includes("config.") ||
      line.includes("sitenotice"))
  ) {
    return "CONFIG";
  }

  return "HARDCODE";
}

function extractStringLiterals(filePath: string, content: string): CopyItem[] {
  const lines = content.split(/\r?\n/);
  const items: CopyItem[] = [];
  const routePath = toRoutePath(filePath);
  const stringRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("import ")) continue;
    if (trimmed.startsWith("from ")) continue;

    let matched: RegExpExecArray | null = null;
    while ((matched = stringRegex.exec(line)) !== null) {
      const raw = (matched[1] ?? matched[2] ?? "").trim();
      if (!raw) continue;
      if (raw.startsWith("/")) continue;
      if (raw.endsWith(".tsx")) continue;
      if (/^[A-Za-z0-9_.-]+$/.test(raw)) continue;

      items.push({
        text: raw,
        file: filePath,
        path: routePath,
        type: detectType(filePath, line),
      });
    }
  }

  return items;
}

function extractDataReferenceItems(filePath: string, content: string): CopyItem[] {
  const routePath = toRoutePath(filePath);
  const lines = content.split(/\r?\n/);
  const references = ["snapshot.title", "snapshot.subtitle", "notification.message", "notification.title", "block.data.text", "block.data.label"];
  const items: CopyItem[] = [];

  for (const line of lines) {
    for (const ref of references) {
      if (!line.includes(ref)) continue;
      items.push({
        text: ref,
        file: filePath,
        path: routePath,
        type: "DATA",
      });
    }
  }

  return items;
}

function dedupe(items: CopyItem[]): CopyItem[] {
  const map = new Map<string, CopyItem>();
  for (const item of items) {
    const key = `${item.text}::${item.file}::${item.path}::${item.type}`;
    if (!map.has(key)) map.set(key, item);
  }
  return Array.from(map.values());
}

export async function GET(request: NextRequest) {
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "Platform role is required." }, { status: 403 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const siteDir = path.join(process.cwd(), "app", "site");

  const files = await listTsxFilesRecursively(siteDir);
  const results: CopyItem[] = [];

  for (const filePath of files) {
    const content = await readFile(filePath, "utf-8");
    results.push(...extractStringLiterals(filePath, content));
    results.push(...extractDataReferenceItems(filePath, content));
  }

  const deduped = dedupe(results);
  const filtered =
    q.length === 0
      ? deduped
      : deduped.filter((item) => item.text.toLowerCase().includes(q.toLowerCase()));

  return NextResponse.json({ q, items: filtered });
}
