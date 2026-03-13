# 페이지 섹션 관리 UX 개선 정리

## 1. 수정된 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `lib/content/constants.ts` | `PLACEMENT_TOOLTIPS`, `PLACEMENT_HINTS`, `PLACEMENT_MINIMAP_LABELS` 추가 |
| `components/admin/page-sections/SectionPositionPreview.tsx` | **신규** – 페이지 구조 미니맵, 위치 강조, 현재 섹션 목록, 충돌 경고, 클릭 선택 |
| `components/admin/page-sections/PageSectionForm.tsx` | `sections` prop 추가, 미니맵 영역 레이아웃(flex), `SectionPositionPreview` 사용 |
| `app/admin/page-sections/new/page.tsx` | 섹션 목록 fetch 후 `sections` 전달, CardBox `max-w-4xl` |
| `app/admin/page-sections/[id]/edit/page.tsx` | 전체 섹션 목록 state 추가 후 `sections` 전달, CardBox `max-w-4xl` |

---

## 2. 미니맵 컴포넌트 구조

```
SectionPositionPreview (props: placement, page, sortOrder, currentSectionId, sections, onPlacementChange?)
├── 제목: "페이지 구조 미리보기"
├── 미니맵 영역 (와이어프레임)
│   └── PLACEMENT_ORDER 순서로 6개 박스
│       └── 각 박스: placement별 라벨, isSelected 시 강조(amber 테두리/배경), title=툴팁, onClick→onPlacementChange
├── "현재 선택 위치" 카드
│   ├── currentLabel (한글)
│   └── hint (PLACEMENT_HINTS)
├── "현재 배치된 섹션" (같은 page·placement, 본인 제외)
│   └── 리스트: 제목, 유형, sortOrder
└── 충돌 경고 (같은 placement에 동일 sortOrder 존재 시)
    └── "이 위치에 동일한 정렬 순서(N)의 섹션이 이미 존재합니다."
```

- **위치**: 폼 오른쪽 (lg 이상), 모바일에서는 폼 하단.
- **크기**: 약 260px (sm:w-[260px]), Tailwind 카드·둥근 모서리·hover 적용.
- **강조**: 선택된 영역만 `border-site-primary`, `bg-amber-50` (dark: `bg-amber-900/20`).

---

## 3. position 값과 UI 연결 방식

| placement (DB/폼 값) | 미니맵 라벨 (PLACEMENT_MINIMAP_LABELS) | 툴팁 (PLACEMENT_TOOLTIPS) |
|----------------------|----------------------------------------|----------------------------|
| `below_header` | HEADER 아래 | 사이트 상단 메뉴 바로 아래, 메인 문구 위 영역 |
| `main_visual_bg` | HERO AREA | 메인 비주얼/히어로 배너 영역 |
| `below_main_copy` | 메인 문구 아래 | 메인 문구 아래, 본문 직전 영역 |
| `above_content` | CONTENT TOP | 본문 시작 직전 첫 번째 콘텐츠 영역 |
| `content_middle` | CONTENT MIDDLE | 본문 중간 콘텐츠 영역 |
| `content_bottom` | CONTENT BOTTOM | 페이지 하단, 푸터 직전 영역 |

- **연결**: `form.placement`를 그대로 `SectionPositionPreview`의 `placement`로 전달.
- **동기화**: 노출 위치 셀렉트 변경 시 `form.placement` 변경 → 미니맵에서 해당 박스만 강조.
- **미니맵 클릭**: `onPlacementChange(slug)` 호출 → `setForm((f) => ({ ...f, placement: p }))` → 폼의 노출 위치 셀렉트와 미니맵 모두 동일 값 유지.

---

## 4. 기존 시스템과 충돌 여부

- **타입**: `PlacementSlug` 그대로 사용. 상수만 추가되어 기존 타입/폼과 호환.
- **저장/API**: 변경 없음. `placement` 필드만 시각적으로 보완.
- **프론트 노출**: `getPageSectionsForPage`, `PageSectionsRenderer` 등 기존 로직 유지.
- **충돌 경고**: 같은 `page`·`placement`에서 `sortOrder`만 비교하며, 현재 편집 중인 섹션(`currentSectionId`)은 제외. mock/DB 구조와 무관하게 동작.

요약: **기존 페이지 섹션 시스템과 충돌 없음.** 관리자 폼에 미니맵·위치 강조·현재 섹션 목록·충돌 경고만 추가된 형태입니다.
