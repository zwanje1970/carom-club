# 캐롬클럽 커뮤니티 기능 명세

## 목표
- 커뮤니티 메인: **허브형**
- **일반 게시판** + **난구해결사** 분리
- **당구노트**: 마이페이지 유지, 난구해결로 전송만 연결
- 게시판 UI: **종류별 상이** (리스트형 / 카드형 / Q&A 특수형)
- **무거운 Prisma 조회 금지** (목록은 최소 필드, 상세는 개별 조회, `organization: true` 금지)

---

## 라우트

| 경로 | 설명 |
|------|------|
| `/community` | 커뮤니티 메인 (허브) |
| `/community/free` | 자유게시판 목록 |
| `/community/qna` | 질문/Q&A 목록 |
| `/community/tips` | 공략/팁 목록 |
| `/community/reviews` | 후기 목록 |
| `/community/trouble` | 난구해결사 목록 |
| `/community/[boardSlug]/[postId]` | 게시글 상세 (일반) |
| `/community/trouble/[postId]` | 난구해결사 상세 |
| `/community/[boardSlug]/write` | 글쓰기 |
| `/mypage/notes` | 당구노트 목록 (마이페이지) |
| `/mypage/notes/new` | 노트 작성 |
| `/mypage/notes/[id]` | 노트 상세/수정 |
| `/mypage/notes/[id]/edit` | 노트 편집 |

**당구노트 인증**: `/mypage/notes` 하위는 **로그인 필수**. 비회원은 서버 레이아웃에서 본문을 렌더하지 않고 로그인 유도 모달만 표시. `/api/community/billiard-notes`·`/[id]`는 비로그인 시 조회/생성/수정(및 커뮤니티 피드 목록) **401**.

---

## 커뮤니티 메인 (허브)
- **상단**: 제목 + 글쓰기 버튼 + 게시판 탭
- **중간**: 인기글, 최신글 유지
- **하단**:
  - 게시판 카드 4개 (자유/질문/팁/후기), 카드당 최신글 3개
  - **난구해결사 강조 카드** (크게): 진행중 수 / 해결 수, "문제풀기" / "등록" 버튼

---

## 게시판 UI (종류별)
- **자유/공지** → 리스트형
- **질문답변** → 리스트 + 해결표시
- **공략/팁/후기** → 카드형
- **난구해결사** → Q&A 특수형 (공배치 상단, 해법 목록, 채택 해법 상단 고정)

---

## DB (Prisma)
- **CommunityBoard**: `id`, `slug`, `name`, `description`, `type`, `isActive`, `sortOrder`
- **CommunityPost**: `id`, `boardId`, `authorId`, `title`, `content`, `thumbnailUrl`, `viewCount`, `likeCount`, `commentCount`, `isSolved`, …
- **CommunityComment**: `id`, `postId`, `authorId`, `content`, `parentId`
- **CommunityPostLike**: `postId`, `userId`
- **TroubleShotPost**: `postId`(→CommunityPost), `sourceNoteId`(→BilliardNote), `layoutImageUrl`, `difficulty`, `isSolved`, `acceptedSolutionId`
- **TroubleShotSolution**: `troubleShotPostId`, `authorId`, `title`, `content`, `solutionImageUrl`, `voteCount`, `isAccepted`

---

## 데이터 규칙
- 목록: **최소 필드만** 조회 (select 최소화, 무거운 relation 분리)
- 상세: 필요한 것만 **개별 조회**
- `organization: true` **금지**

---

## 권한
- 비로그인: **읽기만**
- 로그인: 글/댓글/추천
- 수정/삭제: **작성자**
- 채택: **문제 작성자**

---

## 구현 순서
1. ✅ Board/Post/Comment (스키마: type, isActive, thumbnailUrl, likeCount, commentCount, isSolved, TroubleShot*)
2. 🔲 커뮤니티 메인 (허브 + 게시판 카드 + 난구해결사 강조 카드)
3. 🔲 자유게시판 (라우트 /community/free, 리스트형)
4. 🔲 다른 게시판 (qna/tips/reviews/trouble, UI 구분)
5. 🔲 난구해결사 (등록/해법/투표/채택, 당구노트 연동)

---

## 주의
- **당구노트는 커뮤니티가 아님** (마이페이지)
- **난구해결사**는 대표 게시판 유지
- **UI 통일 금지** (게시판별 다르게)
