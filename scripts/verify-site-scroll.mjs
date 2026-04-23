/**
 * 로컬 dev: 문서 스크롤 없음 + .site-shell-scroll-body만 휠 스크롤.
 * mypage는 시드 PLATFORM 계정 쿠키로 인증( data/v3-dev-store.json 첫 사용자 id ).
 */
import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://localhost:3000";
const paths = ["/", "/site/tournaments", "/site/venues", "/site/community", "/site/mypage"];

/** 로컬 dev-store 시드 — 로그인 없이 mypage 검증용 (운영 데이터 아님) */
const DEV_PLATFORM_SESSION = encodeURIComponent(
  JSON.stringify({ userId: "c0b97eee-5271-4564-bdd5-7e29ea6a5f99", role: "PLATFORM" })
);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 520 },
});
await context.addCookies([
  {
    name: "v3_session",
    value: DEV_PLATFORM_SESSION,
    url: base.replace(/\/$/, "") || "http://localhost:3000",
  },
]);

const page = await context.newPage();
const results = [];

for (const path of paths) {
  const url = `${base.replace(/\/$/, "")}${path}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);

  const before = await page.evaluate(() => {
    const sb = document.querySelector(".site-shell-scroll-body");
    const html = document.documentElement;
    const body = document.body;
    return {
      finalPath: location.pathname + location.search,
      hasScrollBody: Boolean(sb),
      sbScrollHeight: sb?.scrollHeight ?? null,
      sbClientHeight: sb?.clientHeight ?? null,
      sbOverflowY: sb ? getComputedStyle(sb).overflowY : null,
      docScrollTop: html.scrollTop + body.scrollTop,
      htmlOverflowY: getComputedStyle(html).overflowY,
      bodyOverflowY: getComputedStyle(body).overflowY,
      htmlDelta: html.scrollHeight - html.clientHeight,
    };
  });

  await page.locator(".site-shell-scroll-body").first().hover({ timeout: 8000 }).catch(() => {});

  for (let i = 0; i < 6; i += 1) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(120);
  }

  const after = await page.evaluate(() => {
    const sb = document.querySelector(".site-shell-scroll-body");
    const html = document.documentElement;
    const body = document.body;
    return {
      docScrollTop: html.scrollTop + body.scrollTop,
      sbScrollTop: sb?.scrollTop ?? null,
    };
  });

  const canScroll = (before.sbScrollHeight ?? 0) > (before.sbClientHeight ?? 0) + 8;
  const docOk = after.docScrollTop === 0;
  const sbOk = !canScroll || (typeof after.sbScrollTop === "number" && after.sbScrollTop > 0);
  const pass = before.hasScrollBody && docOk && sbOk;

  results.push({ path, url, finalPath: before.finalPath, pass, docOk, canScroll, sbOk, before, after });
}

await browser.close();

for (const r of results) {
  console.log("---");
  console.log(JSON.stringify(r, null, 2));
}

const allPass = results.every((r) => r.pass);
console.log(allPass ? "\nRESULT: PASS (all routes)" : "\nRESULT: FAIL");
process.exit(allPass ? 0 : 1);
