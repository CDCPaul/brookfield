# Brookfield Court Booking — 설계 문서

- 작성일: 2026-08-13
- 대상: Brookfield Village (Lapu-Lapu City, Cebu, Philippines) 주민 및 Homeowners Association

## 1. 배경과 목적

Brookfield 빌리지의 테니스/피클볼 코트는 매일 오전 6~9시에 주민에게 무료로 개방된다.
현재는 예약 체계가 없어서 (1) 주민이 자리가 있는지 미리 알 수 없고, (2) 어소시에이션이
누가 얼마나 쓰는지 파악할 수 없다.

이 프로젝트는 주민이 휴대폰으로 잔여 슬롯을 확인하고 예약하며, 어소시에이션이 이를
관리·집계할 수 있는 **모바일 전용 웹앱**을 만든다.

**비목표 (이번 범위 아님)**: 유료 시간대 예약, 결제, 주민 계정/비밀번호 로그인, 푸시 알림.

## 2. 코트 운영 규칙

물리적으로는 하나의 공간이며, 요일에 따라 테니스 또는 피클볼로 전환해서 쓴다.
따라서 두 종목이 같은 날에 겹치는 경우는 없다.

| 요일 | 종목 | 코트 수 | 하루 정원 |
|---|---|---|---|
| 월·수·금·일 | Tennis | 1 | 3건 |
| 화·목·토 | Pickleball | 4 | 12건 |

슬롯은 1시간 단위 3개로 고정한다.

| slot_index | 시간 |
|---|---|
| 0 | 06:00 – 07:00 |
| 1 | 07:00 – 08:00 |
| 2 | 08:00 – 09:00 |

모든 날짜·시간 판정은 **Asia/Manila (UTC+8, DST 없음)** 기준이다.

## 3. 주민 식별 방식

주민 계정과 비밀번호는 만들지 않는다. 예약 시 다음 4개를 입력한다.

- **Phase** (영문·숫자 혼용 가능: `2`, `2A`, `Phase 3`)
- **Block**
- **Lot**
- **이름 (Full name)**
- **휴대폰 번호** — 우천/공사로 인한 취소 시 어소시에이션이 연락하기 위해 필수로 받는다

Phase/Block/Lot은 **정규화**해서 하나의 유닛으로 취급한다. 정규화 규칙:

1. 유니코드 NFKC 정규화
2. 앞뒤 공백 제거, 내부 연속 공백을 1칸으로 축소
3. 대문자 변환
4. `PHASE`, `PH`, `BLOCK`, `BLK`, `LOT` 같은 접두 라벨과 `-`, `.`, `#` 제거
5. 남은 문자열에서 공백 제거

예: `Phase 2A` / `ph-2a` / `2 A` → 모두 `2A`

`unit_key = normalize(phase) + "|" + normalize(block) + "|" + normalize(lot)` 를 유닛의 고유 키로 쓴다.
첫 예약 시 유닛 레코드가 자동 생성되고, 이후 관리자 명단에 누적된다.

예약이 확정되면 **6자리 예약 코드**(대문자+숫자, 혼동되는 `0/O/1/I` 제외)를 발급한다.
브라우저 localStorage에 마지막으로 입력한 유닛 정보를 저장해 "My Bookings" 화면이 자동으로
본인 예약을 불러오게 한다.

**의도된 트레이드오프**: PIN이 없으므로 타인의 Phase/Block/Lot과 이름을 아는 사람은 그 예약을
취소할 수 있다. 마을 규모와 진입 마찰을 고려한 결정이며, 모든 취소는 `cancelled_by`와 함께
기록되어 관리자가 추적할 수 있다.

## 4. 예약 규칙 (서버에서 강제)

1. 예약 가능 기간: 오늘 ~ **7일 후**까지 (Manila 기준, 총 8일치 달력)
2. 요일과 종목이 일치해야 한다
3. 이미 시작 시간이 지난 슬롯은 예약 불가
4. 한 유닛 **하루 최대 1건**
5. 한 유닛 **주 최대 2건** — 주는 **월요일 시작, 일요일 종료** (Manila 기준)
6. 블랙리스트 유닛은 예약 불가
7. 관리자가 폐쇄한 날짜/슬롯/코트는 예약 불가
8. 동일 (날짜, 종목, 코트, 슬롯)에 활성 예약은 1건만

4·5·1의 수치와 on/off는 `settings` 테이블에서 관리자가 조정할 수 있다.

취소한 예약은 해당 유닛의 한도 계산에서 제외된다. 즉 취소하면 그 횟수를 되찾는다.

## 5. 데이터 모델 (Postgres 18 / Neon)

### units
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | serial PK | |
| phase, block, lot | text | 사용자가 입력한 원본 표기 |
| unit_key | text UNIQUE | 정규화 키 |
| is_blocked | boolean default false | 블랙리스트 |
| blocked_reason | text nullable | |
| created_at | timestamptz | |

### bookings
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | serial PK | |
| code | text UNIQUE | 6자리 예약 코드 |
| booking_date | date | Manila 기준 날짜 |
| slot_index | smallint | 0/1/2 |
| sport | text | `tennis` \| `pickleball` |
| court_no | smallint | tennis=1, pickleball=1..4 |
| unit_id | int FK → units | |
| booker_name | text | |
| phone | text | |
| status | text | `booked` \| `cancelled` \| `no_show` |
| cancelled_at | timestamptz nullable | |
| cancelled_by | text nullable | `resident` \| `admin` |
| cancel_reason | text nullable | |
| created_at | timestamptz | |

부분 유니크 인덱스로 중복 예약을 DB 레벨에서 차단한다:

```sql
CREATE UNIQUE INDEX bookings_slot_unique
  ON bookings (booking_date, sport, court_no, slot_index)
  WHERE status = 'booked';
```

두 명이 동시에 같은 슬롯을 눌러도 한 명만 성공하고, 나머지는 유니크 위반을
"방금 다른 분이 예약했습니다" 메시지로 변환해 보여준다.

### closures
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | serial PK | |
| date_from, date_to | date | 포함 범위 |
| slot_index | smallint nullable | null = 해당일 전 슬롯 |
| court_no | smallint nullable | null = 전 코트 |
| reason | text | 우천/공사/행사 |
| created_at | timestamptz | |

폐쇄를 등록해도 기존 예약은 자동 취소되지 않는다. 관리자 화면에서 영향받는 예약 목록을
보여주고 일괄 취소할지 물어본다.

### settings
`key text PK, value jsonb` 단순 키-값. 초기값:

```
max_per_day    = 1
max_per_week   = 2
advance_days   = 7
limits_enabled = true
```

## 6. 화면

### 주민용 (모바일 전용, 하단 탭)

1. **Today** — 오늘의 종목, 슬롯별 잔여 자리, 바로 예약 버튼. 운영 시간 종료 후에는 내일 안내로 전환
2. **Book** — 8일치 가로 스크롤 날짜 선택 → 슬롯 목록(잔여 수) → 피클볼이면 Court 1~4 선택 →
   이름·Phase·Block·Lot·전화번호 입력 → 확인 → 예약 코드 표시
3. **My Bookings** — 다가오는 예약 목록과 취소. 저장된 유닛 정보가 없으면 조회 폼 표시
4. **Rules** — 운영 시간, 요일별 종목, 예약 한도 안내 (영어)

UI 언어는 **영어 전용**. 모바일 전용이므로 최대 폭 `480px` 컨테이너에 큰 탭 타겟을 쓴다.

### 관리자용 (`/admin`)

0. **Login** — 비밀번호 1개 (`ADMIN_PASSWORD` 환경변수). 검증 후 서명된 httpOnly 쿠키 발급, 7일 유효
1. **Bookings** — 날짜 선택 → 슬롯 × 코트 격자, 각 칸에 예약자 이름/유닛/전화번호, 강제 취소
2. **Closures** — 기간·슬롯·코트 단위 폐쇄 등록/해제
3. **Units** — 유닛 검색, 예약 이력, 블랙리스트 지정/해제, 노쇼 표시
4. **Stats** — 월별 총 예약 수, 종목별·슬롯별 분포, 이용 상위 유닛, 노쇼율. **CSV 다운로드**

## 7. 기술 구성

- **Next.js 16 App Router + TypeScript**, Server Actions로 변경 처리
- **Tailwind CSS + shadcn/ui**
- **Neon Postgres (ap-southeast-1) + Drizzle ORM** (`@neondatabase/serverless`)
- 관리자 세션: `jose`로 서명한 JWT를 httpOnly·SameSite=Lax 쿠키에 저장, middleware에서 `/admin/*` 보호
- 배포: **Vercel** (Neon Auth는 사용하지 않음 — 주민 계정이 없으므로 불필요)

### 모듈 경계

| 파일 | 책임 | 의존성 |
|---|---|---|
| `lib/time.ts` | Manila 기준 오늘 날짜, 슬롯 시작 시각, 주 경계 계산 | 없음 (순수) |
| `lib/schedule.ts` | 날짜 → 종목·코트 수·슬롯 목록 매핑 | `lib/time.ts` |
| `lib/unit-key.ts` | Phase/Block/Lot 정규화 | 없음 (순수) |
| `lib/rules.ts` | 예약 가능 여부 판정 (한도, 기간, 폐쇄, 과거 시간) | 위 3개 (순수) |
| `lib/db/schema.ts` | Drizzle 테이블 정의 | drizzle |
| `lib/queries.ts` | 가용성 조회, 예약 생성/취소 | schema, rules |
| `app/**` | 화면과 Server Action | queries |

`lib/time.ts`, `lib/schedule.ts`, `lib/unit-key.ts`, `lib/rules.ts`는 DB에 의존하지 않는 순수
함수로 두고 **Vitest 단위 테스트**를 붙인다. 시간대·주 경계·한도 계산이 이 프로젝트에서
버그가 날 확률이 가장 높은 지점이다.

## 8. 오류 처리

| 상황 | 처리 |
|---|---|
| 슬롯 동시 예약 경합 | 유니크 위반 → "Someone just booked this slot" + 잔여 재조회 |
| 한도 초과 | 어떤 한도인지 명시 ("This unit already has a booking on Aug 15") |
| 과거 슬롯 | 목록에서 비활성 표시, 서버에서도 거부 |
| 블랙리스트 | "Please contact the association office" — 사유는 노출하지 않음 |
| DB 연결 실패 | 예약 화면은 오류 배너 표시, 읽기 화면은 재시도 안내 |
| 잘못된 예약 코드/유닛 | "No upcoming bookings found for this unit" |

## 9. 향후 확장 (지금 만들지 않음)

유료 시간대(9시 이후)를 나중에 붙일 수 있도록 슬롯 정의를 코드 상수가 아닌 확장 가능한
형태로 둔다. 추가 시 `bookings`에 `fee_amount`, `payment_status` 컬럼과 `slot_rules` 테이블을
더하는 것으로 대응하며, 이번 스키마를 갈아엎지 않는다.
