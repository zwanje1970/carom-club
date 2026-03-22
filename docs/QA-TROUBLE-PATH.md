# 난구 해법 경로 / 1목 E2E · QA

난구해법 **경로선·1목적구** 관련 자동 테스트와 수동 점검용 요약입니다.

---

## 1. E2E 실행 (Playwright)

**준비 (최초 1회):** `npx playwright install chromium`  
(`mobile` 프로젝트까지: `npx playwright install`)

```bash
# 터미널 1 — 개발 서버
npm run dev

# 터미널 2 — 테스트 (이미 서버가 띄어 있으면 webServer 생략)
# Windows CMD
set PLAYWRIGHT_SKIP_WEBSERVER=1
npm run test:e2e

# PowerShell
$env:PLAYWRIGHT_SKIP_WEBSERVER='1'; npm run test:e2e
```

- **대상 스펙:** `e2e/trouble-solution-path.spec.ts`
- **테스트 페이지:** `/e2e/trouble-solution-path` (+ `?fixture=…`)
- **상세:** [`e2e/README.md`](../e2e/README.md)

**유용한 명령:** `npm run test:e2e:ui` · 실패 후 `npx playwright show-report`

---

## 2. 배포에서 `/e2e/trouble-solution-path` 켜기

| 변수 | 값 | 설명 |
|------|-----|------|
| `NEXT_PUBLIC_E2E_TROUBLE_PATH` | `1` | **빌드 시** 주입. 켜면 E2E 전용 경로 페이지가 404가 아님. |

- 로컬 `next dev`는 개발 모드라 **설정 없이** 해당 경로 사용 가능.
- **프로덕션에 상시 켜두지 말 것.** 스테이징/QA 전용 권장.
- 변경 후에는 **재빌드·재배포** 필요 (`NEXT_PUBLIC_*`는 빌드 타임 반영).

---

## 3. 배포 URL로 Playwright 돌리기

```bash
set PLAYWRIGHT_BASE_URL=https://스테이징-도메인
set PLAYWRIGHT_SKIP_WEBSERVER=1
npm run test:e2e
```

배포 측에 `NEXT_PUBLIC_E2E_TROUBLE_PATH=1`이 없으면 해당 URL은 404 → 테스트 실패.

---

## 4. 수동 검증 체크리스트 (사용자·QA)

**전제:** 난구 글에서 **해법 작성**, 공 배치가 있는 상태에서 **전체화면 · 경로선 편집** 진입.

| # | 확인 |
|---|------|
| 1 | 수구 경로에서 **빨간 공에 먼저 공 스팟** → 빨간 공이 1목으로 표시·깜빡임 |
| 2 | 해당 **공 스팟 제거** → 1목 해제, 깜빡임 즉시 소거 |
| 3 | **노란 공에 스팟** → 1목이 노란 공으로 바뀌고, 빨간 공 깜빡임 없음 |
| 4 | 쿠션만 여러 개 찍은 뒤 **첫 공 스팟** → 그 공이 1목 |
| 5 | **전체 경로선 삭제** → 1목·깜빡임 모두 없음 |
| 6 | 경로 다시 시작 → **이전 1목 잔상** 없음 |
| 7 | 수구 깜빡임과 1목 깜빡임이 **같은 느낌**으로 보이는지(육안) |
| 8 | **1적구경로** 토글 ON → 1목 경로선 그리기·스팟 입력 가능 |
| 9 | 1적구경로 OFF이고 조건 미충족 시 **이상한 1목 경로만 그려지지 않음** |
| 10 | 이미 1목이 정해진 뒤 **같은 공·다른 공에 스팟을 더 추가**해도 1목이 바뀌지 않음 — **경로 순서상 첫 유효 공 스팟 우선(순서 유지 검증)** |

모바일: 동일 시나리오를 **터치**로 한 번씩.

---

## 5. 실패 시 먼저 확인할 항목

1. **브라우저 캐시** — 강력 새로고침(Ctrl+Shift+R) 또는 시크릿 창으로 재시도.  
2. **`NEXT_PUBLIC_E2E_TROUBLE_PATH`** — 배포 E2E 페이지가 404면 빌드에 `=1` 넣었는지, 재배포 했는지.  
3. **`PLAYWRIGHT_BASE_URL`** — 프로토콜·도메인 오타, 끝에 `/` 중복 여부.  
4. **1적구경로 토글** — `data-testid="trouble-e2e-object-path-toggle"` / UI에서 **1적구경로**가 의도대로 ON인지(수구/1목 레이어 전환).  
5. **Clear all 이후** — 전체 경로선 삭제 후 **1목 키·깜빡임·세그먼트 수**가 초기화되는지; 이상하면 **한 번 더** 진입·취소 또는 페이지 새로고침.

---

## 6. 관련 파일

| 용도 | 경로 |
|------|------|
| Playwright 설정 | `playwright.config.ts` |
| E2E 스펙 | `e2e/trouble-solution-path.spec.ts` |
| Fixture 이름 | `e2e/fixtures/trouble-path-fixtures.ts` |
| E2E 전용 페이지 | `app/e2e/trouble-solution-path/` |
