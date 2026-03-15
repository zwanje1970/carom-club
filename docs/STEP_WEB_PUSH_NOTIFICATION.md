# Web Push 알림 (STEP: Web Push Notification)

## 개요

캐롬클럽에서 **모바일 웹푸시**로 대회 참가자에게 다음 4가지 알림만 발송하는 기능을 구현했다.

1. **참가 승인** — 참가 신청이 승인되었을 때
2. **대진표 생성** — 대진표가 생성되었을 때
3. **경기장 안내** — 대회 시작 12시간 전
4. **빵빠레** — 대회 종료 시 (우승 / 준우승 / 준결승)

경기 호출 알림은 구현하지 않는다.

---

## Web Push 구조

```
[브라우저]                    [서버]
   |                             |
   | 1. 알림 허용 요청            |
   | 2. Push 구독 (VAPID 공개키)  |
   | 3. POST /api/push/subscribe  | → PushSubscription 저장
   |                             |
   | ... 이벤트 발생 ...          |
   |                             | 4. sendPushToUser() / sendPushToUsers()
   |                             | 5. web-push → push 서비스 (FCM 등)
   | 6. push 이벤트 수신 (SW)     |
   | 7. 알림 표시 / 클릭 시 URL 이동 |
```

- **VAPID**: 서버 식별용 키 쌍. `NEXT_PUBLIC_VAPID_PUBLIC_KEY`(또는 `VAPID_PUBLIC_KEY`), `VAPID_PRIVATE_KEY` 환경 변수로 설정.
- **Service Worker**: `/sw.js` 등록 후 push 이벤트 수신, 알림 표시, 클릭 시 `payload.url`로 이동.
- **알림 대상**: `TournamentEntry.status = CONFIRMED` 참가자만 대상 (경기장 안내·대진표 생성·빵빠레). 참가 승인은 해당 참가자 1명.

---

## 데이터 모델

### PushSubscription

사용자가 알림 허용 시 브라우저 subscription 정보를 저장. 한 사용자가 여러 기기에서 구독 가능.

| 필드     | 설명 |
|----------|------|
| id       | PK |
| userId   | 사용자 ID |
| endpoint | 브라우저 push endpoint URL |
| p256dh   | 클라이언트 공개키 (base64url) |
| auth     | auth secret (base64url) |
| isActive | true면 발송 대상. 실패(410/404 등) 시 자동 false |
| createdAt, updatedAt | |

- Unique: `(userId, endpoint)` — 동일 기기 재구독 시 업데이트.

### NotificationLog

알림 발송 기록.

| 필드          | 설명 |
|---------------|------|
| id            | PK |
| userId        | 수신자 |
| tournamentId  | 대회 (선택) |
| type          | ENTRY_APPROVED \| BRACKET_GENERATED \| VENUE_REMINDER \| PRIZE |
| title         | 제목 |
| body          | 본문 (선택) |
| url           | 클릭 시 이동 URL (선택) |
| status        | PENDING \| SENT \| FAILED |
| errorMessage  | 실패 시 메시지 |
| createdAt     | 생성 시각 |
| sentAt        | 발송 성공 시각 |

---

## API

### POST /api/push/subscribe

- **인증**: 로그인 필수.
- **Body**: `{ endpoint: string, p256dh: string, auth: string }`
- **동작**: PushSubscription 저장. `(userId, endpoint)` 동일 시 업데이트, `isActive = true`.

### POST /api/push/unsubscribe

- **인증**: 로그인 필수.
- **Body**: `{ endpoint?: string }` — 없으면 해당 사용자 전체 구독 비활성화.
- **동작**: `isActive = false` 처리.

### GET /api/push/vapid-public

- **인증**: 불필요.
- **응답**: `{ publicKey: string }` — 클라이언트 구독 시 사용할 VAPID 공개키. 미설정 시 503.

### GET /api/cron/venue-reminder

- **용도**: 대회 시작 12시간 전 경기장 안내 푸시 발송.
- **권한**: `Authorization: Bearer <CRON_SECRET>` 또는 `X-Cron-Secret: <CRON_SECRET>` (환경 변수 `CRON_SECRET` 설정 시).
- **동작**: startAt이 약 11~13시간 후인 대회의 CONFIRMED 참가자에게 발송.

---

## 알림 이벤트

| 이벤트       | 트리거 | 제목 예 | URL | 대상 |
|-------------|--------|---------|-----|------|
| 참가 승인   | 참가 신청 승인 시 | 대회 참가신청이 완료되었습니다. | /tournaments/{id} | 해당 참가자 |
| 대진표 생성 | tournament.status = BRACKET_GENERATED | 대진표가 생성되었습니다. | /tournaments/{id}/bracket | CONFIRMED 참가자 전체 |
| 경기장 안내 | 대회 시작 12시간 전 (cron) | 2026/4/30(일) 09:00 1경기장 시합입니다. | /tournaments/{id} | CONFIRMED 참가자 전체 |
| 빵빠레      | 대회 종료 (status → FINISHED) | 우승/준우승/준결승 문구 | /tournaments/{id}/results | 1·2·3위 추정 사용자 |

- **경기장 안내 본문**: "늦지 않게 도착하세요. 지각, 불참 시 실격 처리됩니다."
- **빵빠레 문구**: 우승 "축하합니다! ○○대회 우승입니다." / 준우승 "○○대회 준우승을 축하합니다." / 준결승 "○○대회 준결승 진출을 축하합니다."
- **1·2·3위 추정**: `TournamentFinalMatch` 또는 `TournamentRound.bracketData`에서 추출. 본선 대진이 없으면 빵빠레는 발송되지 않을 수 있음.

---

## Service Worker 동작

- **파일**: `/public/sw.js`
- **등록**: 앱 로드 시 `RegisterServiceWorker`에서 `navigator.serviceWorker.register("/sw.js")` 호출.
- **push 이벤트**: `event.data.json()` → `{ title, body, url }` 사용. `showNotification(title, { body, data: { url } })`.
- **notificationclick**: `data.url`로 이동. 이미 열린 창이 있으면 해당 창으로 이동 후 focus, 없으면 `openWindow(url)`.

---

## 알림 허용 UX

- 사이트 접속 시 바로 권한 요청하지 않음.
- **대회 상세 페이지** 또는 **참가 신청 완료 화면**에 "대진표 알림 받기" 버튼 노출.
- 버튼 클릭 시:
  1. 브라우저 알림 권한 요청
  2. 허용 시 Service Worker로 Push 구독
  3. `GET /api/push/vapid-public` → 구독 객체 생성
  4. `POST /api/push/subscribe`로 서버에 저장

---

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| VAPID_PRIVATE_KEY | 푸시 사용 시 | Web Push VAPID 비공개키. `npx web-push generate-vapid-keys`로 생성. |
| NEXT_PUBLIC_VAPID_PUBLIC_KEY 또는 VAPID_PUBLIC_KEY | 푸시 사용 시 | VAPID 공개키. 클라이언트에 노출. |
| CRON_SECRET | 경기장 안내 cron 사용 시 | `/api/cron/venue-reminder` 호출 시 Bearer 또는 X-Cron-Secret으로 전달. |

---

## 발송 서비스

- **lib/push/sendPush.ts**: `sendPushToUser`, `sendPushToUsers`. userId로 활성 구독 조회 → web-push 전송 → NotificationLog 기록. 410/404/403 시 해당 구독 `isActive = false`.
- **lib/push/venueReminder.ts**: 12시간 후 시작 대회 조회 후 경기장 안내 발송.
- **lib/push/prizeNotifications.ts**: `getTop3FromTournament`, `sendPrizeNotifications`. 대회 status가 FINISHED로 변경될 때 호출되며, 우승/준우승/준결승 대상자에게 빵빠레 발송.
