# 관리자 사이트 관리 구조 (메인페이지 섹션 단위 통합)

## 1. 메뉴 재구성

### 사이트 관리 (`/admin/site`)
메인페이지를 섹션 단위로 통합 관리하는 진입점.

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 메인페이지 구성 | `/admin/site/main` | 섹션 표시/숨김, 순서, 각 섹션 편집 이동 |
| 히어로 설정 | `/admin/site/hero` → `/admin/settings/hero` | 표시 여부, 높이, 배경, 제목, 버튼 |
| 컴포넌트 관리 | `/admin/site/components` → `/admin/page-sections` | 카드·배너·텍스트·이미지형 섹션 |
| 헤더 설정 | `/admin/site/header` | 배경색, 글자색, 활성 메뉴 강조색 (전용 화면) |
| 푸터 설정 | `/admin/site/footer` → `/admin/settings/footer` | 높이, 배경색, 문구, 링크, 고객센터/SNS |
| 공통 디자인 설정 | `/admin/site/design` → `/admin/settings/site` | 기본 색상·테마 (섹션 공통 기본값) |

### 설정 (`/admin/settings`)
사이트 관리와 분리된 전역 설정.

- 사이트 기본 정보 (이름, 로고, 테마)
- 관리자 정보 수정
- 알림 설정
- 연동 설정
- 요금 정책
- 메뉴/문구

---

## 2. 메인페이지 구성 페이지 (`/admin/site/main`)

- **표시 순서**: 히어로 → CMS 섹션(홈) → 고정 블록(대회·당구장, 빠른 참가, 공지/커뮤니티, 위치 안내, 푸터)
- **표시 여부**: CMS 섹션은 DB `isVisible` 반영, 고정 블록은 현재 항상 표시 (추후 설정 확장 가능)
- **편집 이동**: 각 행의 "편집"으로 해당 전용 화면 또는 페이지 섹션 수정으로 이동
- **순서 변경**: CMS 섹션만 컴포넌트 관리(페이지 섹션)에서 placement별 드래그 정렬 지원

---

## 3. 히어로 / 푸터 / 헤더

- **히어로**: 기존 `/admin/settings/hero` 유지. 사이트 관리에서는 `/admin/site/hero`로 리다이렉트.
- **푸터**: 기존 `/admin/settings/footer` 유지. `/admin/site/footer`로 리다이렉트.
- **헤더**: 전용 화면 신규 추가 (`/admin/site/header`). 배경색·글자색·활성색만 노출, 저장 시 `PUT /api/site-settings`에 해당 필드만 전달. 미리보기 영역 포함.

---

## 4. 컴포넌트 관리

- 현재는 **페이지 섹션**(`/admin/page-sections`)으로 통합. `/admin/site/components` 접근 시 해당 페이지로 리다이렉트.
- 타입: 이미지·텍스트·CTA (기존 PageSection type). 카드형·스와이프형 등 확장 시 `configJson` 또는 별도 타입 추가로 대응 가능.

---

## 5. 기존 기능 마이그레이션

- **삭제하지 않음**: 기존 설정 페이지(사이트, 히어로, 푸터, 메뉴/문구 등)는 그대로 두고, **사이트 관리**에서 진입 경로만 통합.
- **설정 페이지**: "설정" 메뉴에서 "사이트 관리"를 최상단에 두고, 중복 항목(히어로, 푸터)은 설정 목록에서 제거하고 사이트 관리 쪽으로만 진입하도록 정리.

---

## 6. DB/설정 구조 (현재 및 확장)

- **현재**: `PageSection`(type, isVisible, sortOrder, backgroundColor, titleIconType 등), `SiteSetting`(헤더/푸터/테마), `HeroSettings`(별도 저장) 유지.
- **추가 시**: 메인페이지 고정 블록 표시/순서를 위한 `MainPageLayout` 또는 `SiteSetting`에 `mainPageLayoutJson` 추가 가능.  
  예: `{ sectionOrder: ["hero", "cms_1", "cms_2", "tournaments_venues", ...], sectionVisibility: { quick_apply: true, ... } }`

---

## 7. 미리보기

- **헤더 설정**: 저장 전 색상 미리보기 영역 있음.
- **히어로**: 기존 Hero 설정 폼의 미리보기 블록 유지.
- **전체 메인 미리보기**: 추후 "메인페이지 구성"에서 저장 전 전체 미리보기 탭/모달 추가 가능.
