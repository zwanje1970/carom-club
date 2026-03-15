# 6단계: 플랫폼관리자 화면/메뉴/라우트 정리

작성일: 2025-03-11  
목적: /admin을 플랫폼 운영 전용 콘솔로 정리. 대회 실무 기능은 메뉴·버튼·직접 접근에서 제거 또는 차단.

---

## 1. /admin에서 제거한 메뉴

| 제거 항목 | 비고 |
|-----------|------|
| **대회관리** (사이드바 단일 링크) | 대회 목록/생성 진입용 → 제거 |
| **참가자관리** | 참가 신청·참가자 처리 → 제거 |
| **대진표관리** | 대진 생성·관리 → 제거 |
| 대회 하위 메뉴 (대회 목록, 대회 생성, 참가 신청 관리) | getMenuAside에서 제거. "대회 현황" 단일 링크로 대체 |

**유지한 메뉴**

- 대시보드
- **대회 현황** (모니터링용, 읽기 전용)
- 회원관리
- 문의관리
- 클라이언트 목록
- 회비 장부
- 클라이언트 신청
- 설정
- 콘텐츠 관리(페이지 섹션, 팝업, 공지 배너)

---

## 2. 읽기 전용으로 남긴 화면

| 화면 | 경로 | 플랫폼관리자 동작 |
|------|------|-------------------|
| 대회 현황(목록) | /admin/tournaments | 목록 조회 가능. "대회 생성", "이전 대회 불러오기" 버튼 비노출. 제목 "대회 현황" |
| 대회 상세 | /admin/tournaments/[id] | 업체/일시/장소/상태 등 조회 가능. "설정 수정", "대회요강 편집", "참가자 관리" 버튼 및 "대진표 생성" 버튼 비노출 |

---

## 3. 숨긴 버튼/액션 목록

| 위치 | 숨긴 액션 (플랫폼관리자일 때) |
|------|------------------------------|
| /admin/tournaments | 대회 생성, 이전 대회 불러오기 |
| /admin/tournaments/[id] | 설정 수정, 대회요강 편집, 참가자 관리, 대진표 생성 |
| 대시보드 | "새 대회 만들기" 등 대회 실무 CTA 없음 (메뉴에서 이미 제거) |

---

## 4. 직접 접근 차단/유지한 라우트

| 라우트 | 플랫폼관리자 직접 접근 시 |
|--------|---------------------------|
| /admin/tournaments/new | ClientOnlyBlock 표시. "대회 생성은 클라이언트 관리자 전용" 안내 + 대시보드/대회 현황 링크 |
| /admin/tournaments/[id]/edit | ClientOnlyBlock 표시 |
| /admin/tournaments/[id]/outline | ClientOnlyBlock 표시 |
| /admin/tournaments/[id]/participants | ClientOnlyBlock 표시 |
| /admin/participants | ClientOnlyBlock 표시 (랜딩 페이지 직접 접근) |
| /admin/brackets | ClientOnlyBlock 표시 |
| /admin/tournaments | 유지. 목록만 조회, 생성 버튼 없음 |
| /admin/tournaments/[id] | 유지. 상세 조회만, 수정/참가자/대진 버튼 없음 |

**구현**

- `ClientOnlyBlock` 컴포넌트로 "클라이언트 관리자 전용" 문구 + 대시보드/대회 현황 링크 통일.
- 각 실무 페이지에서 `getSession()` + `isPlatformAdmin(session)` 시 ClientOnlyBlock 렌더 후 return.

---

## 5. 대시보드 성격 변경

- **제목**: "대시보드" → "플랫폼 운영 대시보드"
- **설명 문구**: "플랫폼 운영·모니터링용 대시보드입니다. 대회 실무(생성/수정/참가자/대진표)는 클라이언트 관리자(/client) 콘솔에서 진행합니다."
- **표시 항목**  
  - 전체 클라이언트 수 (→ 클라이언트 목록)  
  - 승인 대기 수 (→ 클라이언트 신청)  
  - 전체 대회 수 (→ 대회 현황, 조회용)  
  - 문의 수 (→ 문의관리)  
- **바로가기**: getMenuAside(대회 현황 단일 링크, 콘텐츠/클라이언트/회원/문의/설정) 유지.
- **제거**: "새 대회 만들기" 등 대회 실무 CTA 없음.

---

## 6. 역할별 UI 분리 방향

| 구분 | 경로 | 성격 |
|------|------|------|
| **플랫폼 운영** | /admin | 플랫폼관리자 전용. 사이트/회원/문의/클라이언트/회비/설정. 대회는 현황 조회만. |
| **대회 운영** | /client | 클라이언트 관리자 전용. 대회 생성·수정·참가자·대진표·결과 등 실무. |

- 메뉴·대시보드 문구로 "/admin = 플랫폼 운영", "/client = 대회 운영"이 드러나도록 정리 완료.

---

## 7. 다음 단계에서 /client로 이관할 기능 목록

- 대회 생성 (폼·API는 유지, 진입은 /client에서)
- 대회 설정 수정
- 대회요강(outline) 편집
- 참가자 관리(목록·확정·불참·출석)
- 대진표 생성·관리
- (추후) 결과 입력·진출자 확정
- (추후) 공동관리자 지정

이번 단계에서는 위 기능을 **삭제하지 않고**, /admin 메뉴·버튼·직접 접근만 제거·차단함.

---

## 8. 변경 파일 요약

- `components/admin/AdminSidebar.tsx` — 메뉴에서 대회관리/참가자관리/대진표관리 제거, "대회 현황" 추가
- `components/admin/adminMenu.ts` — getMenuAside에서 대회 하위 메뉴·대진표 제거, "대회 현황" 단일 링크
- `components/admin/ClientOnlyBlock.tsx` — 신규. 플랫폼관리자 실무 라우트 접근 시 안내
- `app/admin/page.tsx` — 플랫폼 운영 대시보드 문구·통계(클라이언트/승인대기/대회/문의)·바로가기
- `app/admin/tournaments/page.tsx` — 플랫폼관리자일 때 canCreateTournament false, 제목 "대회 현황"
- `app/admin/tournaments/new/page.tsx` — 플랫폼관리자일 때 ClientOnlyBlock
- `app/admin/tournaments/[id]/page.tsx` — 플랫폼관리자일 때 수정/참가자/대진 버튼 비노출
- `app/admin/tournaments/[id]/edit/page.tsx` — 플랫폼관리자일 때 ClientOnlyBlock
- `app/admin/tournaments/[id]/outline/page.tsx` — 플랫폼관리자일 때 ClientOnlyBlock
- `app/admin/tournaments/[id]/participants/page.tsx` — 플랫폼관리자일 때 ClientOnlyBlock
- `app/admin/participants/page.tsx` — 플랫폼관리자일 때 ClientOnlyBlock
- `app/admin/brackets/page.tsx` — 플랫폼관리자일 때 ClientOnlyBlock
