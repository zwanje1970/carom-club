# 관리자 플로우 (Admin Flow)

## 라우트

- `/admin`: 대시보드
- `/admin/tournaments`: 대회 목록·생성·수정
- `/admin/participants`: 참가자 관리 (대회별)
- `/admin/brackets`: 대진표 편집
- `/admin/members`: 회원(조직 멤버) 관리
- `/admin/inquiries`: 문의 목록·답변
- `/admin/settings`: 사이트/조직 설정

## 권한

- OrganizationMember.role = OWNER | ADMIN 인 경우 해당 조직의 관리 기능
- User.role = ADMIN 인 경우 전역 관리 (필요 시)

## 주요 작업

1. **대회**: 생성, 규칙(대진/상금/참가조건) 설정, 상태 변경
2. **참가자**: 신청 목록, 결제 확인, 상태 변경(confirmed/waiting_list/cancelled/absent)
3. **대진표**: 라운드/조 생성, 참가자 배정, bracketData 저장
4. **회원**: 조직 멤버 초대/역할/상태 변경
5. **문의**: 답변 등록, replyAt 갱신
