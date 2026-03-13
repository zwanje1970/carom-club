# 대회 엔진 (Tournament Engine)

## 개요

대회 생성부터 참가·대진·결과까지의 흐름을 담당하는 로직 영역.

## 데이터 구조

- **Tournament**: 대회 마스터 (일정, 상태)
- **TournamentRule**: 대진표 타입(bracketType), 최대 참가수(maxEntries), 상금/참가비/참가조건
- **TournamentEntry**: 참가 단위, 상태( applied → waiting_payment → confirmed / waiting_list / cancelled / absent )
- **TournamentRound**: 라운드 단위, bracketData(JSON)
- **TournamentGroup**: 조 단위 (예선 그룹 등)
- **TournamentGroupMember**: 조별 참가자 배정
- **TournamentResult**: 조별 순위/점수

## 주요 플로우

1. **대회 생성**: Tournament + TournamentRule 생성
2. **참가 신청**: TournamentEntry 생성 (status: applied)
3. **결제 대기/확정**: waiting_payment → confirmed 또는 waiting_list
4. **대진표 생성**: TournamentRound/Group/GroupMember 생성, bracketData 갱신
5. **출석/결과**: TournamentAttendance, TournamentResult 반영

## 상태 전이

- applied: 신청 완료
- waiting_payment: 결제 대기
- confirmed: 확정
- waiting_list: 대기
- cancelled: 취소
- absent: 불참
