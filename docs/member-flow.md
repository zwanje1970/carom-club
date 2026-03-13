# 회원 플로우 (Member Flow)

## 라우트

- `/`: 홈
- `/login`, `/signup`: 로그인·회원가입
- `/mypage`: 마이페이지 (프로필, 핸디/AVG/증빙 관리)
- `/tournaments`: 대회 목록
- `/tournaments/[id]`: 대회 상세·참가 신청
- `/community`: 커뮤니티

## 프로필 (MemberProfile)

- 로그인 사용자가 마이페이지에서 MemberProfile 생성/수정
- 핸디, AVG 입력
- AVG 증빙: 이미지 URL(avgProofUrl) 업로드 (Vercel Blob 등), 만료일(avgProofExpiresAt) 설정
- 증빙 만료 시 재제출 유도

## 참가 플로우

1. 대회 상세에서 참가 신청 → TournamentEntry (status: applied)
2. 참가비 결제 안내 → waiting_payment
3. 관리자 확정 또는 대기 → confirmed / waiting_list
4. 대회일 출석 처리 → TournamentAttendance
5. 취소/불참 시 → cancelled / absent
