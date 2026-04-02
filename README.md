# KPI Mgmt

Next.js(App Router) + Prisma(PostgreSQL) 기반 KPI 관리 시스템입니다. 요구사항·수용 기준은 저장소 루트의 [`REQUIREMENTS.md`](./REQUIREMENTS.md)를 기준으로 합니다.

## 사전 요구

- Node.js 20+
- PostgreSQL

## 환경 변수

[`./.env.example`](./.env.example)을 참고해 `.env`를 만듭니다.

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `AUTH_SECRET` | 세션 JWT 서명용 비밀값(운영에서 필수) |
| `ALLOWED_EMAIL_DOMAIN` | 로그인 이메일 도메인(선택, 기본 `@kpcqa.or.kr`) |
| `ALLOWED_ADMIN_IPS` | 관리자 API·설정 저장 허용 IP(쉼표 구분). **비우면 개발에선 전체 허용, production에선 관리자 쓰기가 거부**될 수 있음 |

## 데이터베이스

```bash
npx prisma db push
npm run db:seed
```

- 스키마 변경 후 `npx prisma generate`가 필요하면 위 명령 전에 실행합니다.
- 시드 사용자는 초기 비밀번호가 사번과 동일하게 해시되어 있으며, **`mustChangePassword=true`** 로 첫 로그인 시 비밀번호 변경 화면으로 이동합니다.

### 비밀번호 CLI 재설정(강제 초기화)

DB에 `passwordHash`가 비어 있거나, 초기값으로 되돌리고 싶을 때 프로젝트 루트에서 `prisma/set-user-password.js`를 실행합니다. 앱 로그인 API와 동일하게 **bcrypt(라운드 10)** 로 해시합니다.

**전제:** `.env`에 `DATABASE_URL`이 있어야 합니다. Node.js 20 이상에서는 `--env-file=.env`로 불러올 수 있습니다.

| 명령 | 설명 |
|------|------|
| `node --env-file=.env prisma/set-user-password.js` | 기본: `user001@kpcqa.or.kr` → 비밀번호 `2026000001`, `mustChangePassword=true` |
| `node --env-file=.env prisma/set-user-password.js --email user001@kpcqa.or.kr --password 2026000001` | 이메일·비밀번호 지정 |
| `node --env-file=.env prisma/set-user-password.js --email user@kpcqa.or.kr --password 새비밀번호 --no-must-change` | 다음 로그인 시 비밀번호 변경 강제 없음 |
| `node prisma/set-user-password.js --help` | 옵션 도움말 |

**npm 스크립트** (`package.json`의 `scripts`에 `"db:set-password": "node prisma/set-user-password.js"` 가 있을 때):

```bash
npm run db:set-password
npm run db:set-password -- --email user001@kpcqa.or.kr --password 2026000001
```

인자는 npm에 넘길 때 **`--` 뒤**에 붙입니다. `Missing script: db:set-password` 가 나오면 위 한 줄을 `package.json`에 추가하거나, `node --env-file=.env prisma/set-user-password.js` 형태로 직접 실행하면 됩니다.

Node 20 미만 등 `--env-file`을 쓸 수 없으면, 셸에서 `DATABASE_URL`을 설정한 뒤 같은 인자로 `node prisma/set-user-password.js` 를 실행합니다.

시스템 관리자로 로그인 가능한 경우에는 관리자 화면의 사용자 비밀번호 재설정으로도 동일하게 처리할 수 있습니다(재설정 후 기본적으로 다음 로그인에서 비밀번호 변경 요구).

## 개발·빌드

```bash
npm install
npm run dev
npm run build
npm start
```
## 실행시 접속 포트변경
$env:PORT=4000; npm run start



## 주요 경로

- `/login` — 로그인 (`?next=` 로 원래 경로 복귀)
- `/dashboard` — 일반 업무 화면
- `/admin` — 시스템 관리(로그인·비밀번호 정책 통과 후, 역할·IP 통과 필요)
- `/account/change-password` — 비밀번호 변경(정책에 의해 강제될 때)

## 관리자 기능

- 사용자 목록·역할·소속·등급단·시스템 관리자 플래그 수정, 비밀번호 재설정(재설정 시 **다음 로그인에서 비밀번호 변경** 요구).
- CSV 또는 **Excel(.xlsx) 첫 시트**를 CSV로 변환 후 Import API와 동일 규칙으로 반영.
- 감사 로그 조회(`/api/admin/audit`).

`dept` / `subDept` 값은 DB 조직 코드 사전(`OrgDeptCode` / `OrgSubDeptCode`)의 **labelKo**와 맞추는 것을 권장합니다. 관리자 화면에서는 코드 사전을 불러와 콤보로 선택할 수 있습니다.

### Import와 수동 수정 병행 규칙

- Import는 **같은 `employeeNo` 또는 같은 `email`** 이 이미 있으면 해당 사용자 행을 **갱신(upsert 성격)** 하고, 없으면 **신규 생성**합니다.
- 관리자 화면에서 PATCH로 저장한 내용은, 이후 **동일 키로 Import가 다시 돌면 Import 컬럼이 덮어씁니다.** 운영상 “마지막에 성공한 반영이 유효”에 가깝습니다.

### 비밀번호 강제 변경 중 API

- `User.mustChangePassword=true` 이면 **`/api/auth/me`**, **`POST /api/auth/logout`**, **`POST /api/auth/change-password`** 만 사용 가능합니다.
- 그 외 업무·조회·관리자 API는 **403** 과 본문 `code: "MUST_CHANGE_PASSWORD"` 로 거절됩니다.

### 직원 목록의 역할·직급 표시

- `/api/staff-directory` 는 `OrgRoleCode` / `OrgGradeCode` 활성 행을 읽어 **`permissionKey`·`mapsToGrade`** 로 표시 문자열을 정합니다. 사전에 행이 없으면 이전과 동일한 **fallback 한글**을 씁니다.

## 보안·운영 메모

- HTTPS 배포 시 쿠키 `Secure`는 `NODE_ENV=production`에서 적용됩니다.
- 운영 환경에서는 `AUTH_SECRET`을 강하게 설정하고, `ALLOWED_ADMIN_IPS`로 관리자 API를 사내망 등으로 제한하세요.
- 백업·권한 일괄 변경 전 DB 스냅샷 등은 `REQUIREMENTS.md` 비기능 항목을 참고하세요.
