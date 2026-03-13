# 플랫폼 전환 구조 분석

요구사항: **"당구 대회, 모임, 레슨을 한 곳에서"** — 당구장/동호회/연맹/주최자/강사를 클라이언트로 하는 플랫폼 구조로 전환.

---

## 1. 재사용 가능한 코드

### 1.1 인증·세션
| 위치 | 용도 |
|------|------|
| `lib/auth.ts` | `getSession`, `createSession`, `verifyPassword`, `hashPassword`, 쿠키 관리 |
| `types/auth.ts` | `SessionUser`, `UserRole`, `isPlatformAdmin`, `isClientAdmin` |
| `app/api/auth/login|signup|logout|session` | 로그인/회원가입/로그아웃/세션 조회 |

→ **CLIENT_ADMIN** 전용 API에서 `getSession()` + `isClientAdmin(session)` 조합으로 그대로 재사용.

### 1.2 DB·환경
| 위치 | 용도 |
|------|------|
| `lib/db.ts` | Prisma 클라이언트 (generated) |
| `lib/db-mode.ts` | `isDatabaseConfigured()` — DB 미설정 시 503/목 업 처리 |
| `lib/site-settings.ts` | 사이트명·설명·로고 등 공개 설정 조회 |

→ 새 API·페이지에서 동일 패턴으로 DB/설정 사용.

### 1.3 이미지 업로드
| 위치 | 용도 |
|------|------|
| `lib/image-upload.ts` | `processUploadedImage`, `buildBlobPath` — 검증·최적화·Blob/로컬 저장 |
| `lib/image-policies.ts` | 정책별 확장자·용량 제한 |
| `lib/image-optimizer.ts` | 리사이즈·포맷 변환 |
| `app/api/admin/upload-image/route.ts` | FormData 업로드 엔드포인트 (PLATFORM_ADMIN 전용) |

→ **조직 로고/커버**, **대회 포스터**, **레슨 썸네일** 등에 동일 라이브러리 재사용. 클라이언트용 업로드 API는 권한만 CLIENT_ADMIN으로 추가하면 됨.

### 1.4 관리자 UI 컴포넌트 (admin 공통)
| 위치 | 용도 |
|------|------|
| `components/admin/_components/Section/Main.tsx` | 페이지 본문 영역 |
| `components/admin/_components/Section/TitleLineWithButton.tsx` | 섹션 제목 + 버튼 |
| `components/admin/_components/CardBox` | 카드 레이아웃·테이블 래퍼 |
| `components/admin/_components/FormField` | 라벨+인풋·에러 표시 |
| `components/admin/_components/Button` | 버튼 스타일 |
| `components/admin/_components/NotificationBar` | 성공/에러 메시지 |
| `components/admin/AdminLayout.tsx` | 사이드 메뉴·상단바·로그아웃 (admin 공통 레이아웃) |
| `components/admin/adminMenu.ts` | 메뉴 항목 정의 (대시보드, 대회, 참가자, 당구장, 클라이언트 신청, 설정 등) |

→ **클라이언트 대시보드(/client)** 에서도 카드·폼·테이블이 필요하면 Section/CardBox/FormField/Button 등을 공용으로 사용 가능.  
→ AdminLayout은 **PLATFORM_ADMIN 전용**으로 유지하고, `/client`는 별도 `ClientLayout`(이미 있음) 사용.

### 1.5 에디터·프로모
| 위치 | 용도 |
|------|------|
| `components/admin/OutlineEditor.tsx` | 대회 개요(아웃라인) 드래프트/발행 |
| `components/admin/PromoEditor.tsx` | 조직(당구장) 프로모 드래프트/발행 |
| `lib/admin-drafts.ts` | 드래프트 sessionStorage 저장/복원 |
| `components/RichEditor.tsx` | TipTap 리치 에디터 |

→ **조직 상세 소개(fullDescription)**, **대회 설명**, **레슨 소개** 등에 재사용.

### 1.6 타입·상수 (일부만 재사용)
| 위치 | 용도 |
|------|------|
| `types/tournament.ts` | `BracketConfig`, `PRIZE_TYPES`, `GAME_FORMAT_MAIN` 등 — 대회 규칙/상금 타입 |
| `types/auth.ts` | `UserRole`, `SessionUser` |

→ 대회 규칙·상금 구조는 그대로 쓰고, **대회 상태(status)** 만 새 enum에 맞게 수정(아래 2.1 참고).

---

## 2. 수정해야 할 구조

### 2.1 대회 상태(Tournament.status) 불일치
- **Prisma**: `TournamentStatus` = `DRAFT` | `OPEN` | `CLOSED` | `FINISHED` | `HIDDEN` (요구사항 반영됨)
- **현재 앱**: `types/tournament.ts`의 `TOURNAMENT_STATUSES`는 `draft`·`recruiting`·`closed`·`attendance_check`·`bracket_prep`·`in_progress`·`finished` 등 **문자열** 사용
- **영향**: `app/page.tsx`, `app/tournaments/page.tsx`의 `status: { not: "draft" }` → enum 기준으로는 `DRAFT`;  
  `app/api/admin/tournaments/route.ts`의 `status: status || "draft"` → Prisma는 enum만 허용;  
  `app/api/tournaments/apply/route.ts`의 `tournament.status !== "recruiting"` → `OPEN` 등으로 변경 필요

**수정 방향**  
- 공개 목록: `status`가 `DRAFT`, `HIDDEN`이 **아닌** 대회만 노출 (`notIn: ["DRAFT", "HIDDEN"]`).  
- 참가 신청 허용: `status === "OPEN"`.  
- `types/tournament.ts`: 스펙에 맞게 `TournamentStatus` enum 기반 옵션으로 교체 (예: DRAFT, OPEN, CLOSED, FINISHED, HIDDEN).  
- admin 대회 생성/수정·apply API는 모두 이 enum 값만 사용하도록 통일.

### 2.2 관리자 권한 이원화 (PLATFORM_ADMIN vs CLIENT_ADMIN)
- **현재**: 대부분 `app/api/admin/*`이 `session.role === "PLATFORM_ADMIN"`만 허용.
- **요구사항**:  
  - **PLATFORM_ADMIN**: 전체 조직·클라이언트 신청·사이트 설정·공지 등  
  - **CLIENT_ADMIN**: **자기 소유 조직**에 한해 대회 등록/수정, 참가자 확인, (향후) 레슨 등록

**수정 방향**  
- **대회 CRUD** (`/api/admin/tournaments/*`):  
  - PLATFORM_ADMIN: 모든 조직의 대회 조회/생성/수정/삭제.  
  - CLIENT_ADMIN: `Organization.ownerUserId === session.id`인 조직의 대회만 조회/생성/수정/삭제 (조직 목록도 본인 조직만).  
- **당구장(조직) 관리** (`/api/admin/venues/*`):  
  - PLATFORM_ADMIN만 유지: “전체 조직(당구장·동호회 등) 목록/생성”은 플랫폼 전용.  
  - CLIENT_ADMIN은 `/client/setup`·`/api/client/organization` 등 **자기 조직 프로필 수정** 전용으로 분리.  
- 업로드: `upload-image`는 PLATFORM_ADMIN 전용 유지하고, 클라이언트용은 `/api/client/upload-image` 등 새 라우트에서 `isClientAdmin` 체크 후 같은 `lib/image-upload` 사용.

### 2.3 조직(Organization) 목록·생성 흐름
- **현재**: admin “대회 생성”에서 **전체 조직** 목록을 불러와 조직 선택.  
- **요구사항**: 1계정 1조직, 조직당 대표 1명(`ownerUserId`).

**수정 방향**  
- **admin (PLATFORM_ADMIN)**:  
  - “대회 생성” 시 조직 목록은 그대로 전체 조회 가능 (또는 “조직관리” 메뉴에서 전체 조직 관리).  
  - “당구장관리”를 “조직관리”로 확장해 type=VENUE/CLUB/FEDERATION/HOST/INSTRUCTOR 모두 노출하고, `isPublished`/`setupCompleted` 표시.  
- **client (CLIENT_ADMIN)**:  
  - “대회 등록” 시 조직 선택 없이 **본인 소유 조직 1개**만 사용:  
    `prisma.organization.findFirst({ where: { ownerUserId: session.id } })`  
  - 해당 조직이 없으면 “먼저 조직 설정을 완료해 주세요” → `/client/setup` 유도.

### 2.4 공개 메뉴·라우팅
- **요구사항**: 홈, 대회, 레슨, 당구장, 클럽, 연맹, 공지, 소개.
- **현재**: 홈, 대회, 당구장(venues), 커뮤니티, 로그인/회원가입.

**수정 방향**  
- `app/page.tsx` 및 공통 헤더/푸터:  
  - “커뮤니티” 유지 또는 “공지”로 변경.  
  - “레슨” → `/lessons`, “클럽” → `/clubs`, “연맹” → `/federations` (또는 `/organizations?type=CLUB` 등) 추가.  
  - “소개” → `/about` 등 정적 페이지.  
- 조직 타입별 목록:  
  - 당구장: 기존 `/venues` (type=VENUE + isPublished).  
  - 클럽/연맹: 동일한 “조직 목록” 컴포넌트를 type 필터로 재사용.

### 2.5 대회 참가 신청(TournamentEntry) 상태
- **요구사항**: APPLIED, CONFIRMED, REJECTED, CANCELED.
- **Prisma**: `TournamentEntryStatus` = applied, waiting_payment, confirmed, waiting_list, cancelled, absent.

**수정 방향**  
- 단계적으로:  
  - “주최자 승인” 플로우는 기존 `applied` → `confirmed` / `cancelled`와 매핑 유지.  
  - 필요 시 enum에 `rejected` 추가하거나, “거절”을 별도 필드/상태로 표현.  
- 목록/상세/이메일 문구만 “신청됨/확정/거절/취소”로 통일.

### 2.6 레슨 구조 (미구현)
- **요구사항**: Lesson, LessonApplication 모델, CLIENT_ADMIN의 레슨 등록·신청 관리.
- **현재**: 해당 모델·API·페이지 없음.

**수정 방향**  
- 4단계에서 Prisma에 `Lesson`, `LessonApplication` 추가 후,  
  - 조직·대회와 유사하게 “조직 소유” 레슨 CRUD,  
  - 공개 목록/상세/신청 API·페이지를 재사용 가능한 패턴(이미지 업로드, FormField, CardBox 등)으로 구현.

### 2.7 관리자 메뉴 구조
- **요구사항**: 대시보드, 조직관리, 대회관리, 레슨관리, 신청관리, 공지관리.
- **현재**: 대시보드, 대회관리, 참가자관리, 대진표관리, 회원관리, 문의관리, 당구장관리, 클라이언트 신청, 설정.

**수정 방향**  
- “당구장관리” → “조직관리”(전체 조직 타입 포함).  
- “참가자관리” → “신청관리”(대회 참가 + 향후 레슨 신청 통합 가능).  
- “레슨관리” 추가(PLATFORM_ADMIN은 전체 레슨 조회, CLIENT_ADMIN은 `/client`에서만 본인 레슨).  
- “공지관리”는 현재 문의/공지 구조에 맞춰 추가 또는 기존 “문의관리”와 통합.

---

## 3. 적용 순서 제안

요구사항의 1~5단계와 위 수정 사항을 맞춘 순서입니다.

| 단계 | 내용 | 우선 작업 |
|------|------|------------|
| **1** | **로그인/권한·회원가입·클라이언트 신청** | ✅ 이미 반영됨 (UserRole, ClientApplication, /apply/client, /admin/client-applications, 역할별 리다이렉트). |
| **2** | **Organization / client setup** | 2.3 적용: `/client/setup` 페이지, `PATCH /api/client/organization`(본인 조직만), slug/로고/커버/설명/주소 등. 공개 목록은 `isPublished && setupCompleted`만 노출. |
| **3** | **대회·참가 신청** | 2.1: status enum 통일, 공개/참가 조건을 DRAFT·OPEN 기준으로 수정. 2.2: 대회 API에 CLIENT_ADMIN 허용 및 조직 스코핑. 2.3: admin은 전체 조직, client는 소유 조직 1개만. 2.5: 참가 상태 문구/필드 정리. |
| **4** | **레슨** | Lesson/LessonApplication 스키마·API·클라이언트 대시보드 “레슨 등록/신청 관리” UI. 이미지/폼은 1번 재사용 코드 활용. |
| **5** | **관리자 대시보드·메뉴** | 2.7: 메뉴를 대시보드, 조직관리, 대회관리, 레슨관리, 신청관리, 공지관리, 설정으로 정리. 2.4: 공개 메뉴(레슨, 클럽, 연맹, 공지, 소개) 추가. |

**추천 작업 순서 (코드 레벨)**  
1. **2.1** — `TournamentStatus` 사용처 일괄 수정 + types/tournament.ts enum 기반으로 통일 (타입/빌드 에러 제거).  
2. **2.2·2.3** — 대회 API 권한(CLIENT_ADMIN) 및 조직 스코핑, admin/client 대회 생성 시 “조직” 로딩 방식 분리.  
3. **2단계** — `/client/setup` 및 `/api/client/organization` 구현.  
4. **2.4** — 공개 메뉴(레슨, 클럽, 연맹, 공지, 소개) 라우트·링크 추가.  
5. **2.7** — admin 메뉴 라벨/경로 정리.  
6. **4단계** — 레슨 모델·API·UI.  
7. **2.5** — 참가 신청 상태 문구/필드 정리 및 “신청관리” 화면 통합.

이 순서로 진행하면 재사용 코드는 최대한 유지하면서, 수정해야 할 구조만 단계적으로 반영할 수 있습니다.
