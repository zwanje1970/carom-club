# Client console UI (`/client` 전용)

일반 메인 사이트·`/admin`과 스타일이 섞이지 않도록 `components/client/console/ui` 에만 둡니다.

## 컴포넌트

| 컴포넌트 | 용도 |
|----------|------|
| `ConsolePageHeader` | 페이지 본문 상단 — 제목(좌) / 액션(우) |
| `ConsoleSection` | 섹션 테두리 박스 (제목·본문 구역) |
| `ConsoleTable` + `ConsoleTableHead/Body/Row/Th/Td` | 표 래퍼 및 셀 |
| `ConsoleFilterBar` | 목록·표 위 필터 줄 |
| `ConsoleFormPanel` | 폼 필드 그룹 패널 (선택 푸터) |
| `ConsoleSummaryPanel` | 요약 숫자 그리드 |
| `ConsoleActionBar` | 하단 저장/취소 등 액션 줄 |
| `ConsoleBadge` | 상태·라벨 배지 |

## 토큰

`tokens.ts`의 `consoleBorder`, `consoleBtnPrimary` 등을 화면에서 직접 쓰지 않고, 위 컴포넌트로 감싸는 것을 권장합니다.

## import

```tsx
import {
  ConsolePageHeader,
  ConsoleSection,
  ConsoleTable,
  ConsoleTableHead,
  // ...
} from "@/components/client/console/ui";
```
