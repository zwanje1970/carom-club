# 커뮤니티 신뢰도 레벨/점수/등급 시스템

## 개요

- **목표**: 단순 활동량이 아니라, 좋은 활동·인정받은 활동이 누적되어 신뢰도와 권한이 올라가도록 설계.
- **점수**: 게시글 작성, 댓글 좋아요 수신, 해법 등록·good/bad·채택, 대회 참가/취소/출석 등으로 부여·차감.
- **레벨**: 누적 점수 기준 1~15 자동 계산.
- **등급(티어)**: Lv1~2 입문, Lv3~4 일반, Lv5~6 활동, Lv7~8 숙련, Lv9~10 고수, Lv11~12 실전고수, Lv13~14 해결사, Lv15+ 마스터 해결사.

## 점수 규칙

| 행동 | 점수 |
|------|------|
| 일반 게시글 작성 | +2 (공지 제외) |
| 댓글 작성 | 0 |
| 댓글 좋아요 1개 수신 | +1 (자기 댓글 좋아요 불가, 게시글당 해당 작성자 최대 +3) |
| 해법 등록 | +4 |
| 해법 good 1개 | +1 |
| 해법 bad 1개 | -1 |
| 해법 채택(해법 작성자) | +6 |
| 해법 채택 시 질문자 | +2 |
| 시합 참가 신청 | +10 |
| 참가 취소 | -10 |
| 실제 참가 완료(출석) | +10 |

## 레벨 구간 (이상이면 해당 레벨)

- 0, 20, 50, 100, 160, 240, 340, 460, 600, 760, 940, 1160, 1440, 1800, 2200  
- Lv1: 0 이상, Lv2: 20 이상, … Lv15: 2200 이상

## 등급명

- 입문 (Lv1~2)
- 일반 (Lv3~4)
- 활동 (Lv5~6)
- 숙련 (Lv7~8)
- 고수 (Lv9~10)
- 실전고수 (Lv11~12)
- 해결사 (Lv13~14)
- 마스터 해결사 (Lv15+)

## 등급 색상 (배지)

- 입문: #94a3b8
- 일반: #64748b
- 활동: #0ea5e9
- 숙련: #8b5cf6
- 고수: #f59e0b
- 실전고수: #ef4444
- 해결사: #10b981
- 마스터 해결사: #eab308

## 권한 기준 (MIN_LEVEL)

| 상수 | 레벨 | 설명 |
|------|------|------|
| POST_CREATE | 1 | 일반 게시글 작성 |
| COMMENT_LIKE | 2 | 댓글 / 좋아요 |
| NANGU_POST_CREATE | 3 | 당구해결사(난구) 문제 등록 |
| NANGU_SOLUTION_CREATE | 4 | 해법 등록 |
| EXTENDED | 6 | 추가 기능 확장 |
| EXPERT_DISPLAY | 10 | 고수 표시 강조 |
| SOLVER_BADGE | 13 | 해결사 배지 강조 |

## 해법 정렬

1. 채택된 해법 우선  
2. good − bad 점수 높은 순  
3. 동점 시 작성자 레벨 보정  
4. 최신순  

## 구현 요약

- **DB**: `User.communityScore`, `CommunityScoreLog`, `NanguSolution.goodCount`/`badCount`, `NanguPost.adoptedSolutionId`, `NanguSolutionVote`(good/bad 투표)
- **API**:  
  - `GET /api/community/me/score` — 내 점수·레벨·등급  
  - `POST /api/community/nangu/solutions/[solutionId]/vote` — good/bad 투표 (body: `{ vote: "good" | "bad" }`)  
  - `POST /api/community/nangu/[id]/solutions/[solutionId]/adopt` — 질문자가 해법 채택  
- **UI**: `CommunityLevelBadge` — 닉네임 옆 Lv·등급명·색상 표시 (난구 상세 등에서 사용)

## 마이그레이션

`prisma/migrations/20260409000000_community_score_and_nangu_votes/migration.sql` 적용 후 `npx prisma generate` 실행.

## 적용 전/후 체크

1. **마이그레이션**: `npx prisma migrate deploy` 또는 migration.sql 수동 적용  
2. **Prisma client**: `npx prisma generate`  
3. **확인 포인트**
   - 게시글 작성 시 +2점 반영
   - 댓글 좋아요 시 수신자 +1, 게시글당 해당 작성자 최대 +3
   - 해법 good/bad 중복투표 방지, 변경/취소 시 goodCount·badCount·점수 정상 반영
   - 채택 시 해법 작성자 +6, 질문자 +2
   - 난구 상세에서 레벨/등급 배지 노출
   - 해법 목록 정렬: 채택 > good−bad > 작성자 레벨 보정 > 최신순
