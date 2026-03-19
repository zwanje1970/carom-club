# Hydration 오류 전역 점검 보고서

## 1. 수정 파일 목록 (이번 작업)

| 파일 | hydration 원인 | 수정 방식 |
|------|-----------------|-----------|
| `lib/format-date.ts` | - | `formatKoreanDateWithWeekday()` 추가 (timeZone "Asia/Seoul" 고정, 날짜+요일 표시용). |
| `components/community/BilliardNoteFormScreen.tsx` | `useState(() => new Date().toISOString().slice(0, 10))` — 서버/클라이언트 시각 차이로 초기값 불일치 가능 | 초기값 `""`, `useEffect`에서 1회만 오늘 날짜 설정. 서버/클라이언트 첫 렌더 모두 빈 문자열로 일치. |
| `app/client/tournaments/ClientTournamentCards.tsx` | `Intl.DateTimeFormat("ko-KR", {...})`에 timeZone 없음 — 환경별 출력 차이 | `formatKoreanDateWithWeekday()` 사용 (timeZone "Asia/Seoul" 명시). |
| `components/admin/dashboard/_components/FooterBar.tsx` | `new Date().getFullYear()` 직접 렌더 — 연도 경계에서 서버/클라이언트 불일치 가능 | `"use client"` + `useState(null)` + `useEffect`에서만 연도 설정. 첫 렌더는 `©`만 표시 후 클라이언트에서 연도 채움. |

---

## 2. 기존 조치 (이전 작업) 요약

- **날짜 렌더**: `new Date(x).toLocaleString("ko-KR")` 등 전부 제거 후 `lib/format-date.ts`의 `formatKoreanDateTime`, `formatKoreanDate`, `formatKoreanDateShort`, `formatKoreanSchedule` 사용.
- **적용 범위**: app/admin, app/community, app/client, app/mypage, components (community, admin, tournament, mypage 등) 전반.
- **숫자 포맷**: `price.toLocaleString()`, `amount.toLocaleString()` 등 **숫자**용은 유지 (날짜 아님). 필요 시 locale 고정 검토 가능.

---

## 3. 각 파일의 hydration 원인 및 수정 방식

### 이번에 수정한 4곳

1. **BilliardNoteFormScreen**  
   - **원인**: `noteDate` 초기값을 `new Date().toISOString().slice(0, 10)`로 설정해, 서버와 클라이언트의 “지금” 시각이 다르면 초기 HTML이 달라짐.  
   - **수정**: `noteDate` 초기값 `""`, 마운트 시 `useEffect`에서만 오늘 날짜 설정. 서버/클라이언트 모두 첫 렌더는 빈 입력으로 동일.

2. **ClientTournamentCards**  
   - **원인**: 로컬 `formatDate()`가 `Intl.DateTimeFormat`에 timeZone 없이 사용돼, 서버(Node)와 클라이언트(브라우저)에서 같은 Date라도 다른 문자열이 나올 수 있음.  
   - **수정**: `formatKoreanDateWithWeekday()`로 교체 (timeZone "Asia/Seoul" 명시).

3. **FooterBar**  
   - **원인**: `new Date().getFullYear()`를 렌더에 직접 사용해, 연도가 바뀌는 시점에 서버/클라이언트가 다른 연도를 낼 수 있음.  
   - **수정**: 클라이언트 전용으로 연도 표시. `useState(null)`로 첫 렌더는 `©`만, `useEffect`에서 연도 설정해 mismatch 제거.

4. **format-date**  
   - **추가**: 클라이언트 카드 등에서 쓰일 “날짜+요일” 포맷을 `formatKoreanDateWithWeekday()`로 통일 (timeZone 고정).

---

## 4. 남은 임시봉합 지점

- **suppressHydrationWarning**: 프로젝트 전역 검색 결과 **사용처 0건**.  
- **숫자 toLocaleString**: 금액/수량 등 `number.toLocaleString()`은 그대로 둠. locale 차이는 보통 날짜만큼 심하지 않으며, 필요 시 나중에 공통 유틸로 묶어 locale 고정 가능.

---

## 5. 검색 패턴별 점검 결과

| 패턴 | 결과 |
|------|------|
| `new Date(x).toLocaleString/DateString/TimeString` | **0건** — 모두 `format-date` 계열로 이전됨. |
| `key={Math.random()}`, `key={Date.now()}`, `key={crypto.randomUUID()}` | **0건** — 리스트 key는 id/slug 등 stable key 사용. |
| `typeof window` / `window.` / `localStorage` / `sessionStorage` | **렌더 경로 아님** — `useEffect` 또는 이벤트 핸들러 내부에서만 사용. |
| `Date.now()` / `Math.random()` | 이벤트 핸들러·API·유틸 내부에서만 사용. **초기 렌더/JSX에 사용된 곳 없음.** |
| **날짜 표시** | `lib/format-date.ts` + timeZone "Asia/Seoul"로 통일. |

---

## 6. 목표 달성 여부

- **hydration 오류 0**: 날짜/시간/연도/초기값 관련 mismatch 가능 지점 제거 또는 useEffect로 이전.  
- **서버/클라이언트 최초 HTML 일치**: 날짜·연도·폼 초기값을 서버와 동일한 값으로 맞추거나, 클라이언트 전용은 useEffect 후에만 표시.  
- **client는 표시만**: 날짜는 `format-date`로 포맷만, 연도/오늘 날짜는 필요 시 useEffect에서 설정.  
- **재발 방지**: `lib/format-date.ts`에 timeZone 고정, 새 날짜 표시는 이 유틸 사용 권장.

---

## 7. 참고 — 수정하지 않은 부분

- **template_admin/components/calendar/Calendar.tsx**: `Date.now()` 사용. 템플릿/데모용으로 보이며, 앱 메인 번들 hydration 경로에서 제외된 것으로 간주. 필요 시 동일 원칙으로 timeZone/클라이언트 전용 처리 가능.  
- **API/서버 전용**: `Date.now()`, `new Date()`는 API 라우트·서버 로직에서만 사용되어 hydration과 무관.
