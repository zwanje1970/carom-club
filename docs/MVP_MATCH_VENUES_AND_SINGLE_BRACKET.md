# 당구장 대회 MVP: 경기장 및 단판 토너먼트

## 개요

사용자/관리자 화면에서 **권역** 대신 **경기장** 용어를 사용하며, 대회에 여러 경기장 슬롯(1경기장, 2경기장 …)을 두고, 참가 마감 후 단판 토너먼트 대진표를 생성하는 MVP를 적용했다.

## 구현 범위 (이번 작업)

- **경기장 데이터**: `TournamentMatchVenue` 모델 (tournamentId, venueNumber, displayLabel, venueName, address, phone, sortOrder)
- **대회 상태**: `CLOSED`(참가 마감), `BRACKET_GENERATED`(대진 생성됨) 추가
- **대회 생성/수정**: 경기장 수(1/2/4/8 또는 직접 입력) 설정 시 N개 슬롯 생성, 각 슬롯에 경기장명·주소·전화 입력
- **API**: `GET/PATCH /api/admin/tournaments/[id]/match-venues` (경기장 목록 조회·일괄 저장)
- **대진표 생성 정책**
  - 단판 토너먼트: **참가 마감(CLOSED)** 이후에만 생성 가능
  - CONFIRMED 참가자만 대진 대상
  - 생성 후 대회 상태를 `BRACKET_GENERATED`로 변경, 이후 참가 확정/반려 수정 불가
- **경기장 표시**: 대회 상세(클라이언트/공개), 대진표 관리, 공개 대회 상세에서 `[1경기장] 이름 / 주소 / 전화` 형태로 표시
- **탭 라벨**: 클라이언트 대회 관리에서 "부/권역" → "경기장"으로 통일

## 제외 (이번 작업에서 미구현)

- 연맹대회용 경기장 분산 토너먼트
- 권역/경기장별 예선 후 본선 구조
- 랭킹/부수 시드 분산, 더블 엘리미네이션 상세, 리그전
- 지도 연동, 길찾기

## 마이그레이션

`TournamentMatchVenue` 테이블 추가용 마이그레이션이 `prisma/migrations`에 포함되어 있다.  
DB가 이미 다른 마이그레이션으로 채워져 있는 경우:

- 개발: `npx prisma migrate dev --name match_venues` 로 스키마 반영 후 마이그레이션 생성·적용
- 또는 해당 마이그레이션 SQL을 수동 실행

## 참고

- 연맹대회용 대진표·권역 구조는 기존 `TournamentZone` / `TournamentFinalMatch` 등으로 별도 설계·문서화
- 내부 코드에 zone/권역이 남아 있어도 되며, 점진적으로 venue/matchVenue 등으로 정리 가능
