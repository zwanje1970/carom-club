/**
 * 플랫폼(또는 승인된 클라이언트) 세션으로 실제 API만 호출해
 * 테스트 대회 10개 생성 → 이미지 업로드 → 카드 스냅샷 발행.
 *
 * 사용법:
 *   1) 로그인 후 브라우저에서 `v3_session` 쿠키 값을 복사
 *   2) 서버 실행: npm run dev
 *   3) CAROM_COOKIE='v3_session=...' node scripts/seed-test-tournament-cards.mjs
 *
 * 환경 변수:
 *   CAROM_COOKIE — 필수. 전체 Cookie 헤더 문자열 (예: v3_session=%7B%22userId%22...)
 *   BASE_URL     — 선택. 기본 http://localhost:3000
 *   PUBLISH_GAP_MS — 선택. 발행 간격(ms). 정렬 구분용, 기본 1200
 *   SKIP_HOME_PUBLISH — 1 이면 메인 `home` 페이지 발행 생략 (대회·카드만)
 *
 * 메인 슬라이드 노출: 마지막에 기존 API `PUT /api/platform/site-pages/home/publish`로
 * TOURNAMENT_SNAPSHOT 슬라이드 블록을 발행합니다. PLATFORM 역할 쿠키가 필요합니다.
 *
 * 요구: Node 20+ (File/Blob + fetch)
 */

import { setTimeout as delay } from "node:timers/promises";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const COOKIE = process.env.CAROM_COOKIE ?? "";
const PUBLISH_GAP_MS = Math.max(0, Number(process.env.PUBLISH_GAP_MS ?? 1200) || 1200);
const SKIP_HOME_PUBLISH = process.env.SKIP_HOME_PUBLISH === "1";

const COUNT = 10;

/** 1×1 PNG — 업로드 후 sharp가 w320/w640 생성 */
const MIN_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function formatLocalYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function datePlusDays(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return formatLocalYmd(d);
}

async function fetchJson(path, init) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Cookie: COOKIE,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { _raw: text };
  }
  if (!res.ok) {
    const err = new Error(typeof data.error === "string" ? data.error : `HTTP ${res.status} ${path}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

async function uploadPlaceholderImage() {
  const file = new File([MIN_PNG], "test-card.png", { type: "image/png" });
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/api/upload/image`, {
    method: "POST",
    headers: { Cookie: COOKIE },
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data.imageId) {
    throw new Error(data.error ?? `upload failed ${res.status}`);
  }
  return {
    imageId: data.imageId,
    image320Url: data.w320Url,
    image640Url: data.w640Url,
  };
}

/** `/site` 메인에 슬라이드 영역을 켜기 위해 발행된 home 페이지에 SLIDE_CARDS 블록이 있어야 함 */
async function publishHomeTournamentSlideBlock() {
  return fetchJson("/api/platform/site-pages/home/publish", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sections: [
        {
          id: "seed-home-section-1",
          order: 1,
          blocks: [
            {
              id: "seed-home-title-1",
              type: "TITLE",
              data: { text: "진행중 대회", alignment: "LEFT" },
            },
            {
              id: "seed-home-slide-1",
              type: "SLIDE_CARDS",
              data: {
                cardSourceType: "TOURNAMENT_SNAPSHOT",
                sortType: "DEADLINE",
                sortTypeCategory: "DEFAULT",
                itemLimit: COUNT,
                alignment: "LEFT",
              },
            },
          ],
        },
      ],
    }),
  });
}

async function main() {
  if (!COOKIE.includes("v3_session=")) {
    console.error("CAROM_COOKIE 환경 변수에 v3_session=... 형태의 쿠키를 넣어 주세요.");
    process.exit(1);
  }

  console.warn("주의: 재실행 시 동일 규칙으로 대회·스냅샷이 추가됩니다. 필요하면 data/v3-dev-store.json 백업 후 실행하세요.\n");

  const results = [];

  for (let i = 1; i <= COUNT; i += 1) {
    const title = `테스트 대회 ${i}`;
    const location = `테스트 구장 ${i}`;
    const date = datePlusDays(i);

    const created = await fetchJson("/api/client/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        date,
        location,
        maxParticipants: 16,
        entryFee: 0,
      }),
    });

    const tournamentId = created.tournament?.id;
    if (!tournamentId) {
      throw new Error("대회 생성 응답에 tournament.id가 없습니다.");
    }

    const img = await uploadPlaceholderImage();

    const published = await fetchJson("/api/client/card-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentId,
        templateType: "tournament",
        title,
        subtitle: `${date} · ${location}`,
        imageId: img.imageId,
        image320Url: img.image320Url,
        image640Url: img.image640Url,
        textLayout: "상단 제목 + 하단 보조문구",
        imageLayout: "고정 레이아웃",
      }),
    });

    const snapshot = published.snapshot;
    const list = await fetchJson(`/api/client/card-snapshots?tournamentId=${encodeURIComponent(tournamentId)}`);

    results.push({
      index: i,
      tournamentId,
      tournamentCreatedAt: created.tournament?.createdAt,
      snapshotId: snapshot?.snapshotId,
      publishedAt: snapshot?.publishedAt,
      updatedAt: snapshot?.updatedAt,
      isPublished: snapshot?.isPublished,
      isActive: snapshot?.isActive,
      snapshotsInStore: list.snapshots?.length ?? 0,
    });

    console.log(
      `[${i}/${COUNT}] ${title} → tournament=${tournamentId} snapshot=${snapshot?.snapshotId} publishedAt=${snapshot?.publishedAt}`,
    );

    if (i < COUNT) {
      await delay(PUBLISH_GAP_MS);
    }
  }

  console.log("\n--- 요약 (메인 슬라이드는 snapshot updatedAt 최신순) ---");
  for (const r of results) {
    console.log(
      JSON.stringify(
        {
          title: `테스트 대회 ${r.index}`,
          tournamentId: r.tournamentId,
          tournamentCreatedAt: r.tournamentCreatedAt,
          snapshotId: r.snapshotId,
          publishedAt: r.publishedAt,
          updatedAt: r.updatedAt,
          isPublished: r.isPublished,
          isActive: r.isActive,
        },
        null,
        0,
      ),
    );
  }

  if (SKIP_HOME_PUBLISH) {
    console.log("\n(SKIP_HOME_PUBLISH=1) home 페이지 발행을 건너뜀 — 메인 슬라이드 블록이 없으면 카드가 보이지 않을 수 있습니다.");
  } else {
    try {
      const pub = await publishHomeTournamentSlideBlock();
      console.log("\n--- home 발행 ---");
      console.log(`pageId=home publishedAt=${pub.published?.publishedAt ?? "?"}`);
    } catch (e) {
      console.error("\nhome 페이지 발행 실패(PLATFORM 쿠키·권한 확인):", e.message ?? e);
      if (e.body) console.error(JSON.stringify(e.body, null, 2));
      process.exit(2);
    }
  }

  console.log("\n브라우저에서 /site 메인을 열어 슬라이드(스와이프)로 카드가 보이는지 확인하세요.");
}

main().catch((e) => {
  console.error(e.message ?? e);
  if (e.body) console.error(JSON.stringify(e.body, null, 2));
  process.exit(1);
});
