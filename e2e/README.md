# E2E (Playwright) — 난구 경로

**QA 요약·수동 체크·장애 대응:** [`docs/QA-TROUBLE-PATH.md`](../docs/QA-TROUBLE-PATH.md)

## 페이지 · fixture

- **URL:** `/e2e/trouble-solution-path`  
  - 로컬 `next dev`: 항상 사용 가능.  
  - 배포: 빌드 시 `NEXT_PUBLIC_E2E_TROUBLE_PATH=1` 필요 → [QA 문서](../docs/QA-TROUBLE-PATH.md#2-배포에서-e2etrouble-solution-path-켜기)
- **쿼리:** `?fixture=firstRed` 등 — `e2e/fixtures/trouble-path-fixtures.ts`

## 실행

```bash
npm run dev
# CMD: set PLAYWRIGHT_SKIP_WEBSERVER=1
# PowerShell: $env:PLAYWRIGHT_SKIP_WEBSERVER='1'
npm run test:e2e
```

```bash
npx playwright install chromium   # 최초 1회 (mobile: npx playwright install)
```

## 배포 URL에서

```bash
set PLAYWRIGHT_BASE_URL=https://스테이징-도메인
set PLAYWRIGHT_SKIP_WEBSERVER=1
npm run test:e2e
```

## 검증 방식

- DOM `data-testid` / `data-state`(1목, 깜빡임 플래그, 경로 세그먼트, 1적구경로 토글).  
- 스팟 **직접 탭** 제스처는 플레이크 가능 → 상태는 주로 **fixture 주입**으로 검증.

## 리포트

`npx playwright show-report`
