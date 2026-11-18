# api-bbq-telestration — 프로젝트별 wasm 샌드박스 함수 샘플

과거 `src/lambda/*`(AWS Lambda PoC, CIE-16130)가 추구하던 목적(프로젝트별 개별 실행 단위)을
처음엔 **자체 K8s 클러스터 + OpenFaaS + Kata RuntimeClass** 로 구현하려 했으나, 해당 환경에서
Kata(경량 VM, Firecracker/QEMU)가 요구하는 중첩 가상화(nested virtualization)를 노드가
지원하지 않는 것으로 확인돼(`plans/openfaas-kata-migration.md` §3.0) **완전히 폐기**됐다.
대신 지금은 **QuickJS(WASM으로 컴파일된 JS 엔진)를 projects 프로세스 안에 내장**해 실행하는
방식으로 대체됐다 — Docker 이미지 빌드도, K8s 배포도, 별도 게이트웨이도 필요 없다.

`src/api/root`/`src/api/projects` 공유 번들 호스트(단일 `dist/main.js`)와 달리, 이 트리는
**한 프로젝트 = 한 코드 파일(handler.ts)** 로 독립 배포되지만, 실행 단위는 컨테이너/파드가
아니라 projects 프로세스 안의 in-process 샌드박스(문자열 하나)다.

> 과거에는 이 실행 모델이 `src/openfaas/bbq-telestration` 이라는 별도 디렉토리에 있었다. "openfaas"
> 브랜딩/디렉토리를 없애고 `src/api/<name>` 하나로 통합하기로 결정되어(§`.context/decisions.md`
> 참고) 지금은 이 디렉토리(`src/api/bbq-telestration`)가 canonical 스캐폴드 템플릿이다. 엔드포인트
> (`/openfaas/deploy-wasm` → `/wasm/deploy`), 클래스명(`Openfaas*` → `Wasm*`), DB 테이블
> (`openfaas_gateway__routes` → `wasm_gateway__routes`), env(`OPENFAAS_*` → `WASM_*`)까지
> "openfaas" 이름을 전부 걷어냈다(구 이름은 폴백으로 계속 인식). 또한 예전엔 이 프로젝트에
> `app.controller.ts`/`app.module.ts`/`index.ts`/`items.service.ts` 같은 레거시 NestJS 파일이
> 병존했으나(그 `onModuleInit`이 부팅 시 테이블을 자동 생성해줬다) 전부 삭제됐다 — 아래
> "테이블 생성" 섹션 참고.

## 왜 컨테이너/K8s 대신 WASM 인가

- **인프라 제약**: Kata RuntimeClass 는 이 환경(EKS 노드)에서 동작 불가능한 것으로 실측
  확인됐다 — `/dev/kvm` 미지원. Docker-in-Docker 대안도 EKS+simploy 플랫폼 제약으로 불가능.
- **콜드스타트 없음**: QuickJS 컨텍스트 생성은 밀리초 단위 — 파드 스케줄링/이미지 pull 이 없다.
- **격리**: 컨테이너/커널 공유가 전혀 없다 — capability 기반 모델(`env.db`, `env.log`,
  옵트인 `env.fetch`)만 guest 코드에 노출되고, 그 외 Node 내장 모듈/네트워크/파일시스템은
  애초에 존재하지 않는다(`platform:'neutral'` 번들이 강제).
- **트레이드오프**: 매 요청마다 코드를 새 QuickJS 컨텍스트에서 재평가한다(바이트코드 캐싱 없음,
  `plans/wasm-gateway-sandbox.md` §6 참고) — CPU 바운드 대량 작업엔 부적합, 가벼운 CRUD/프록시용.

## 전체 흐름

```
[클라이언트가 코드 작성]  src/api/bbq-telestration/src/handler.ts
        │  export function handle(req, env) { ... }
        │
        │  POST <root>/wasm/deploy { "name": "bbq-telestration" }   (AdTokenGuard — 토큰 필요)
        ▼
[root 호스트]  ① repo sparse clone(handler.ts 만) → ② esbuild 번들(platform:'neutral', 단일 문자열)
        │      ③ POST <projects>/api/projects/wasm-routes 로 번들 코드를 등록
        │         (mockingbird_projects.wasm_gateway__routes.code, TEXT 컬럼 — 이 호출이
        │         곧 배포 완료다. 별도 CI/Docker 빌드·status 폴링 필요 없음)
        ▼
[projects 호스트 = 게이트웨이]  GET https://.../api/bbq-telestration/...
        │      wasm 라우트(code) 있음 → WasmSandboxRuntimeService 가 QuickJS 컨텍스트에서
        │         in-process 로 즉시 실행 (네트워크 홉 없음)
        │      라우트 없음 → 기존 공유 번들 모듈로 폴백 (무변경)
        ▼
[QuickJS 샌드박스]  handle(req, env) 실행 → { status, headers?, body } 반환
```

## 테이블 생성 (배포 전 필수 — 자동 생성 없음)

`env.db.query(sql, params)`는 `sql-scope-guard.ts`가 DDL(`CREATE`/`ALTER`/`DROP` 등)을
항상 차단하도록 설계돼 있어서, **handler.ts 코드 자체로는 테이블을 만들 수 없다.** 예전엔
레거시 NestJS 모델의 `items.service.ts`에 있던 `onModuleInit`이 서버 부팅 시 알아서
`CREATE TABLE IF NOT EXISTS`를 실행해줬지만, 그 파일들은 전부 삭제됐고 이 bbq-telestration 템플릿에도
더 이상 없다 — **새 프로젝트를 스캐폴드하면 테이블이 자동으로 생기지 않는다.**

배포 전에 root의 admin API로 명시적으로 먼저 만들어야 한다:

```bash
ROOT=https://mockingbird-platform-rootapi.betawoowa.in   # 로컬 dev면 http://localhost:4000
TOKEN=<발급받은 토큰>   # POST /auth/token 으로 발급, 또는 ~/.mockingbird/token

curl -X POST "$ROOT/projects-admin/tables" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "project": "bbq-telestration",
    "table": "items",
    "columns": [
      { "name": "id", "type": "serial", "primaryKey": true },
      { "name": "name", "type": "text", "notNull": true },
      { "name": "payload", "type": "jsonb" },
      { "name": "created_at", "type": "timestamptz", "default": "NOW()" }
    ]
  }'
```

- `mockingbird_projects."bbq_telestration__items"`가 idempotent하게(`CREATE TABLE IF NOT EXISTS`)
  만들어진다 — 여러 번 호출해도 안전.
- 컬럼 타입은 `text`/`integer`/`bigint`/`boolean`/`jsonb`/`timestamptz`/`serial`/`bigserial`만
  허용(화이트리스트). `project`/`table`/컬럼명은 `^[a-z_][a-z0-9_]*$` + 48자 이하만 허용.
- 만든 테이블 목록 확인(인증 불필요): `GET "$ROOT/projects-admin/tables?project=bbq-telestration"`.
- 스키마를 바꾸거나 테이블을 추가할 때도 매번 이 엔드포인트를 다시 호출하면 된다.

**새 프로젝트 시작 순서**: ① scaffold(`handler.ts`만 있는 상태) → ② 필요한 테이블을
`POST /projects-admin/tables`로 미리 생성 → ③ `POST /wasm/deploy`로 배포 → ④ handler.ts 안
`env.db.query`로 사용.

## 코드 규약

- `src/handler.ts` 가 `export function handle(req, env) { ... }` 를 export 해야 한다
  (`default export` 도 인식).
- `req`: `{ method, path, query, headers, body }`.
- `env.db.query(sql, params)`: **이 프로젝트 소유 테이블(`<project>__*`)만** 허용된다 — SQL
  스코프 가드(`sql-scope-guard.ts`)가 DDL/스택 쿼리/다른 프로젝트 테이블 참조를 즉시 차단한다.
  → **이 샌드박스에서는 새 테이블을 만들 수 없다** — 위 "테이블 생성" 섹션대로 배포 전에
  `POST /projects-admin/tables`로 미리 만들어둬야 한다.
- `env.log(...args)`: 서버 로그로 전달.
- `env.fetch(url, options)` (옵트인, 기본 전면 차단): 외부 HTTP 호출이 필요한 경우에만 —
  projects 호스트 env 에 `WASM_FETCH_ALLOWLIST_<PROJECT>=host1,host2` 를 설정해야 동작한다
  (예전 이름 `OPENFAAS_FETCH_ALLOWLIST_*` 는 폴백으로 계속 인식).
  SSRF 가드(private/loopback/metadata IP 차단)와 서버사이드 시크릿 주입(guest 코드는 시크릿을
  볼 수 없음)이 적용된다 — `src/api/projects/src/wasm-gateway/{fetch-guard,fetch-secrets}.ts`.
- Node 내장 모듈(fs/net/http/process 등)은 import 자체가 esbuild 번들 단계에서 에러가 난다
  (`platform:'neutral'` 이 의도적으로 막음) — HTTP 서버를 직접 띄우는 방식이 아니다.
- **외부 npm 라이브러리**: `package.json` 의 `dependencies` 에 추가하면 `handler.ts` 에서
  import 해서 쓸 수 있다. `POST /wasm/deploy` 가 sparse-checkout 직후 esbuild 번들 전에
  `pnpm install --prod --ignore-scripts` 를 한 번 실행해 `node_modules` 를 만들어준다
  (`dependencies` 가 없으면 완전히 스킵 — 배포 속도 무변화). **순수 JS/ESM·CJS 이고 Node
  내장 모듈에 의존하지 않는 패키지만** 실제로 번들된다 — 그 외엔 위 `platform:'neutral'`
  가드가 배포 시점에 즉시 에러로 걸러준다. `--ignore-scripts` 는 `package.json` 의
  `postinstall` 같은 라이프사이클 스크립트로 root 서버에서 임의 코드 실행을 시도하는 걸
  막는 보안장치라 항상 강제된다. 로컬은 `pnpm bundle:handler`/`test:handler`/`dev:server`
  가 워크스페이스 `node_modules` 를 그대로 보므로 별도 설치 단계 없이 검증된다.

## 배포

```bash
curl -X POST "$ROOT/wasm/deploy" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{ "name": "bbq-telestration" }'
```

응답이 오면 배포가 이미 끝난 상태다(동기 완료, status 폴링 불필요). 등록된 라우트 확인:

```bash
curl "$PROJECTS/api/projects/wasm-routes"   # codeBytes 로 등록 여부/크기 확인
curl "$ROOT/wasm/status/bbq-telestration"            # 최근 배포 결과(in-memory, PoC — 재시작 시 유실)
```

## 로컬 개발

두 단계로 나뉜다 — 로직만 빠르게 반복할지, 진짜 HTTP 라우팅까지 볼지.

### 1) 로직만 반복 (root/projects/DB 전부 불필요)

```bash
pnpm bundle:handler   # esbuild 로 로컬 handler.ts 즉시 번들 (dist/handler.bundle.js)
pnpm test:handler     # 실제와 동일한 QuickJS + capability prelude 로 로컬 실행 (DB 는 in-memory mock)
```
`wasm-local-test.mjs` 안 `scenarios` 배열에 원하는 요청을 추가해서 검증하면 된다.

### 2) 진짜 HTTP 라우팅 + 영속 DB (root/projects 없이)

`src/api/root`(git/wasm 배포)와 `src/api/projects`(공유 게이트웨이 호스트)는 sparse pull 로
로컬에 받아올 방법이 없다 — `parts=app|api` 어느 조합도 root 는 절대 포함하지 않고,
`parts=api` opt-in 을 안 했으면 projects 도 없다. 그래도 이 프로젝트 하나만은 실제 HTTP 로
로컬에서 확인하고 싶을 때 `dev-server.mjs`를 쓴다 — projects 호스트가 하는 일(esbuild 번들 →
QuickJS 실행 → 응답)을 이 프로젝트 폴더 안에서만 재현하는 DEV 전용 유틸이다.

```bash
pnpm dev:server   # :4001 (PORT env 로 변경 가능). handler.ts 저장 시 자동 재번들.
curl http://localhost:4001/api/bbq-telestration/items
```

- App 의 vite proxy(`/api` → `localhost:4001`)가 그대로 이 서버를 가리키므로 App 쪽 설정은
  하나도 안 건드리고 바로 붙는다.
- 테이블은 같은 디렉토리의 `tables.local.json`을 시작 시 읽어 idempotent 하게 생성한다 —
  포맷은 `POST <root>/projects-admin/tables`의 `columns`와 동일해서, 나중에 진짜 beta 에도
  반영하려면 그 배열을 그대로 그 API 에 보내면 된다. 파일이 없으면(DB 안 쓰는 프로젝트) 스킵.
- DB는 진짜 projects 호스트의 PGlite 와 섞이지 않도록 별도 데이터 디렉토리
  (`.../mockingbird/pglite/dev-bbq-telestration`)에 영속된다 — 서버 재시작해도 데이터 유지.
- `env.fetch`를 쓰는 프로젝트(jeminhee 등)는 `WASM_FETCH_ALLOWLIST_<PROJECT>` env 만 동일하게
  주면 되지만, SSRF 가드/시크릿 자동 주입은 없다(dev 전용, 신뢰 경계 안 — 시크릿은 로컬 env 로
  직접 넣어 테스트).
- 이 파일은 root/projects 소스 없이 `src/api/<name>` 폴더 하나만으로 완결되므로, `parts=app,api`
  로 sparse pull 만 받은 개발자도 그대로 쓸 수 있다(scaffold 로 새 프로젝트를 만들면 자동 포함).

## 구성 파일

| 파일 | 역할 |
| ---- | ---- |
| `src/handler.ts` | **유일한 엔트리** — `export function handle(req, env)` |
| `esbuild.handler.mjs` | 로컬 번들 미리보기용(`pnpm bundle:handler`) — 실제 배포 시엔 root 가 동일 옵션으로 번들 |
| `wasm-local-test.mjs` | 로직만 반복 검증(`pnpm test:handler`) — DB in-memory mock, 서버/root/projects 불필요 |
| `dev-server.mjs` | **DEV 전용** :4001 HTTP 서버(`pnpm dev:server`) — root/projects 없이 진짜 라우팅+영속 PGlite 로 이 프로젝트만 서빙 |
| `tables.local.json` | `dev-server.mjs`가 시작 시 읽는 로컬 테이블 스키마(`POST /projects-admin/tables`와 동일 포맷) |
| `src/api/root/src/wasm/` | `POST /wasm/deploy` 컨트롤 플레인(예전 이름 `openfaas/`) |
| `src/api/projects/src/wasm-gateway/` | 라우트 저장(`code` 컬럼) + 게이트웨이 미들웨어 + WasmSandboxRuntimeService(QuickJS) (예전 이름 `openfaas-gateway/`) |
| `src/api/root/src/projects-admin/` | `POST /projects-admin/tables` — 배포 전 테이블 생성 admin API |

## 운영 전 보완 (PoC → 실서비스)

- **바이트코드 캐싱 없음**: 매 요청 코드 재파싱/재평가 — CPU 바운드 대량 트래픽엔 별도 캐싱 레이어 검토.
- **status 는 in-memory**: root 인스턴스 재시작/다중 replica 시 유실·불일치 가능 — 필요해지면
  `mockingbird_root` 스키마 테이블로 옮긴다.
- **코드 텍스트 크기**: `wasm_gateway__routes.code` 는 Postgres TEXT 컬럼 — 매우 큰 번들이
  누적되면 WAL/복제 쓰기 증폭 우려가 있어(TOAST 는 diff 없이 풀 로우 재작성) 필요 시 배포
  시점 크기 가드를 추가한다.
- **테이블 자동 생성 없음**: 위 "테이블 생성" 섹션 참고 — `POST /projects-admin/tables`를
  매번 명시적으로 호출해야 한다(레거시 NestJS `onModuleInit` 패턴은 완전히 제거됨).
