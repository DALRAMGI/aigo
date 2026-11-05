# AIGO

사고 영상을 올리면 AI로 분석해 주고 DashPi 블랙박스를 판매하는 캡스톤 웹 서비스. FastAPI(`apps/api`) + Next.js(`apps/web`)를 Railway에 배포한다. 캡스톤 가상 서비스이며 결제는 토스 테스트 환경에서만 동작한다.

## 배포 주소

- 웹: https://web-production-aa0b9.up.railway.app
- API: https://api-production-68ccb.up.railway.app (상태 확인 `/api/v1/health`)

## 로컬 실행

Python 3.12(uv), Node 22(pnpm), ffmpeg, Postgres, S3 호환 저장소가 필요하다.

```bash
# 저장소: 실제 Bucket 대신 moto 서버를 쓸 수 있다. 버킷을 만들고 CORS(PUT, GET)를 열어 둔다.
cd apps/api
uv run --with 'moto[server]' moto_server -p 9100

# API와 worker: apps/api/.env.example을 .env로 복사해 값을 채운다. DATABASE_URL은 postgresql+psycopg:// 형식이다.
uv run alembic upgrade head && uv run python -m app.seed
uv run uvicorn app.main:create_app --factory --port 8000
uv run python -m app.worker

# 웹: apps/web/.env.example을 .env.local로 복사해 값을 채운다.
cd apps/web
pnpm install && pnpm dev --port 3100
```

## 테스트

```bash
cd apps/api && uv run pytest          # 느린 YOLO 테스트 제외: -m 'not model'
cd apps/web && pnpm vitest run && pnpm build

# 전체 시나리오. 창을 띄운 Chrome으로 돌고, 실제 OpenAI를 호출한다. 사고 장면이 있는 클립을 쓴다.
cd apps/web && E2E_VIDEO=<영상 경로> BASE_URL=<웹 주소> pnpm playwright test e2e/journey.spec.ts
```

API 응답을 바꾸면 타입을 다시 만든다.

```bash
cd apps/web && TOSS_SECRET_KEY=test_x DATABASE_URL=postgresql:///dashpi_test \
  uv run --project ../api python ../api/scripts/dump_openapi.py && pnpm gen:api
```

## 환경변수

api와 worker (`apps/api/.env.example`)

| 이름 | 설명 |
|------|------|
| `DATABASE_URL` | `postgresql+psycopg://...` |
| `S3_ENDPOINT_URL`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | 비공개 Bucket |
| `CLERK_SECRET_KEY`, `CLERK_JWT_KEY` | Clerk 토큰 검증 |
| `CLERK_AUTHORIZED_PARTIES` | 허용 출처 JSON 배열. 비우면 `WEB_ORIGIN` 하나 |
| `WEB_ORIGIN` | 웹 주소(CORS) |
| `TOSS_SECRET_KEY` | `test_`로 시작하지 않으면 서버가 시작되지 않는다 |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT` | 분석 모델 |
| `MAX_VIDEO_BYTES`, `MAX_VIDEO_SECONDS`, `USER_DAILY_LIMIT`, `GLOBAL_DAILY_LIMIT` | 영상과 하루 한도 |

web (`apps/web/.env.example`)

| 이름 | 설명 |
|------|------|
| `NEXT_PUBLIC_API_URL` | API 주소. 빌드 때 번들에 들어간다 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | 빌드 때 번들에 들어간다 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | `test_gck_` 테스트 키. 빌드 때 번들에 들어간다 |
| `CLERK_SECRET_KEY` | 서버 쪽 Clerk |

## Railway 배포

프로젝트 `AIGO`: `web`, `api`, `worker`, Postgres, Bucket `uploads`. 설정은 서비스에 들어 있고 저장소에는 Dockerfile만 있다(Railway가 설정 파일 경로 지정을 더는 받지 않는다).

| 서비스 | Root Directory | 시작 명령 | 상태 확인 |
|--------|----------------|-----------|-----------|
| web | `apps/web` | Dockerfile CMD | `/` |
| api | `apps/api` | Dockerfile CMD(마이그레이션, 시드, uvicorn) | `/api/v1/health` |
| worker | `apps/api` | `python -m app.worker` | 없음 |

```bash
railway up --service api --detach   # 저장소 루트에서 실행한다. web, worker도 같다.
```

`NEXT_PUBLIC_*`를 바꾸면 web을 다시 빌드해야 한다. Bucket CORS의 AllowedOrigins는 웹 주소와 `http://localhost:3100`만 허용한다.

## 평가 결과

<!-- TODO(Task 11): 평가 세트 결과를 넣는다. -->
Task 11 완료 후 채운다.

## 라이선스 안내

객체 추적에 쓰는 [ultralytics](https://github.com/ultralytics/ultralytics)(YOLO)는 AGPL-3.0이다. 이 서비스를 네트워크로 제공하면 AGPL-3.0의 소스 공개 의무가 적용되므로, 저장소 공개를 유지하거나 Ultralytics 기업 라이선스를 받아야 한다.
