import { test, expect } from "@playwright/test";

const E2E_PATH = "/e2e/trouble-solution-path";

function fixtureUrl(name: string) {
  return `${E2E_PATH}?fixture=${encodeURIComponent(name)}`;
}

test.describe("난구 경로 / 1목 E2E", () => {
  test("페이지가 로드되고 편집기 루트가 보인다", async ({ page }) => {
    await page.goto(fixtureUrl("interactive"));
    await expect(page.getByTestId("solution-path-editor-fs")).toBeVisible();
    await expect(page.getByTestId("e2e-trouble-path-page")).toBeVisible();
  });

  test("1) 빨간 공에 먼저 공 스팟 → data-state=red", async ({ page }) => {
    await page.goto(fixtureUrl("firstRed"));
    await expect(page.getByTestId("trouble-e2e-first-object-key")).toHaveAttribute("data-state", "red");
  });

  test("2) 공 스팟 없음 → 1목 해제", async ({ page }) => {
    await page.goto(fixtureUrl("cushionsOnly"));
    await expect(page.getByTestId("trouble-e2e-first-object-key")).toHaveAttribute("data-state", "none");
  });

  test("3) 노란 공만 공 스팟 → 1목 yellow", async ({ page }) => {
    await page.goto(fixtureUrl("firstYellow"));
    await expect(page.getByTestId("trouble-e2e-first-object-key")).toHaveAttribute("data-state", "yellow");
  });

  test("4) 쿠션 여러 개 후 첫 공 스팟 → red", async ({ page }) => {
    await page.goto(fixtureUrl("cushionsThenRed"));
    await expect(page.getByTestId("trouble-e2e-first-object-key")).toHaveAttribute("data-state", "red");
  });

  test("5) 전체 경로선 삭제 후 1목·깜빡임 플래그 해제", async ({ page }) => {
    await page.goto(fixtureUrl("firstRed"));
    await expect(page.getByTestId("trouble-e2e-first-object-key")).toHaveAttribute("data-state", "red");
    await page.getByTestId("trouble-e2e-path-drawer-open").click();
    await page.getByTestId("trouble-e2e-clear-all-paths").click();
    await expect(page.getByTestId("trouble-e2e-first-object-key")).toHaveAttribute("data-state", "none");
    await expect(page.getByTestId("trouble-e2e-blink-flags")).toHaveAttribute("data-object-spot-blink", "off");
  });

  test("6) fixture 전환 시 이전 1목 잔상 없음", async ({ page }) => {
    await page.goto(fixtureUrl("firstRed"));
    await expect(page.getByTestId("trouble-e2e-first-object-key")).toHaveAttribute("data-state", "red");
    await page.goto(fixtureUrl("firstYellow"));
    await expect(page.getByTestId("trouble-e2e-first-object-key")).toHaveAttribute("data-state", "yellow");
  });

  test("7) 수구·1목 깜빡임 플래그 동시 on (동일 data attribute 패턴)", async ({ page }) => {
    await page.goto(fixtureUrl("firstRed"));
    const blink = page.getByTestId("trouble-e2e-blink-flags");
    await expect(blink).toHaveAttribute("data-cue-spot-blink", "on");
    await expect(blink).toHaveAttribute("data-object-spot-blink", "on");
  });

  test("8) 1적구경로 토글 ON 후 오버레이에 object 세그먼트 존재", async ({ page }) => {
    await page.goto(fixtureUrl("cueAndObjectPaths"));
    const overlay = page.getByTestId("nangu-solution-path-overlay").first();
    await expect
      .poll(async () =>
        parseInt((await overlay.getAttribute("data-object-path-segment-count")) ?? "0", 10)
      )
      .toBeGreaterThan(0);
    await page.getByTestId("trouble-e2e-object-path-toggle").first().click();
    await expect(page.getByTestId("trouble-e2e-object-path-toggle").first()).toHaveAttribute(
      "data-state",
      "on"
    );
    expect(
      parseInt((await overlay.getAttribute("data-object-path-segment-count")) ?? "0", 10)
    ).toBeGreaterThan(0);
  });

  test("9) 빈 상태에서 object 경로 세그먼트 0", async ({ page }) => {
    await page.goto(fixtureUrl("interactive"));
    await expect(page.getByTestId("nangu-solution-path-overlay").first()).toHaveAttribute(
      "data-object-path-segment-count",
      "0"
    );
  });
});
