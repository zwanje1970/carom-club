# 도메인 모델 (Domain Model)

## 개요

주요 엔티티와 관계를 정의한다.

## 사용자·프로필

- **User**: 로그인 계정 (이름, 아이디, 비밀번호, 이메일, 전화, 역할)
- **MemberProfile**: 1:1, 회원 전용 프로필
  - 핸디(handicap), AVG(avg), AVG 증빙 URL(avgProofUrl), 증빙 만료일(avgProofExpiresAt)

## 조직 (멀티 조직)

- **Organization**: slug, name, type(CLUB|FEDERATION|VENUE|OTHER)
- **OrganizationMember**: 조직–사용자 N:M, role(OWNER|ADMIN|MEMBER|GUEST), status(ACTIVE|PENDING|SUSPENDED|LEFT)

## 대회

- **Tournament**: 조직 소속, 기본정보(이름, slug, 일정, 상태)
- **TournamentRule**: 1:1, 대진표 타입/최대 참가수, 상금·참가비, 참가조건
- **TournamentEntry**: 참가 신청, 상태 enum(applied, waiting_payment, confirmed, waiting_list, cancelled, absent)
- **TournamentAttendance**: 출석 여부
- **TournamentRound / TournamentGroup / TournamentGroupMember / TournamentResult**: 라운드·조·대진·결과

## 문의

- **Inquiry**: 사용자 문의, 제목/내용/답변/답변일시
