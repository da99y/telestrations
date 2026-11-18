# api-bbq-telestration — 작업 로그 (journal)

> append-only. **새 엔트리는 맨 위에** 추가한다. 지우지 말 것 (히스토리).

---

## 2026-10-15 (7) — jessi.kim (Claude Code) — 자동 칸 수 상한 제거

**한 일**: 칸 수 자동(사람 수만큼)일 때 최대 8칸 상한(MAX_AUTO_ACTIONS)을 없앴다 — 스케치북이 참가자 전원을 한 바퀴 돈다(steps = 인원 + 1). 직접 설정 칸 수도 2~8 → 2~99칸, 단 시작할 때 참가 인원을 넘으면 인원 수로 줄인다.

**이유/배경**: 사람 수만큼 고르면 제한 없이 모두 거치길 원함.

**다음 단계**: 베타에서 확인.

---

## 2026-10-15 (6) — jessi.kim (Claude Code) — 제시어 난이도·중복 방지

**한 일**: 제시어를 하(230)·중(158)·상(109)으로 나누고(각 약 80% 음식·배민·B마트), 진행자가 판을 열 때 난이도를 고른다(/host/new `tier`, 모집 중엔 matches.words 에 {"tier":...}). `used` 테이블(word pk, tier)로 한 번 나온 제시어는 그 단계를 다 쓸 때까지 다시 안 낸다. /state 에 tier.

**이유/배경**: 제시어가 적어 여러 판 하면 겹치고, 난이도가 섞여 들쑥날쑥했다. 제시어 바꾸기(2중 택1)는 로컬에서 만들어 봤다가 넣지 않기로 했다.

**다음 단계**: 베타에서 확인.

---

## 2026-10-15 (5) — jessi.kim (Claude Code) — 자리 비움

**한 일**: `presence` 테이블(seat_id, seen_at): /state 마다 갱신, 15초(AWAY_MS) 넘게 없으면 자리 비움(bot- 키는 항상 있음). 시작할 때 자리 비운 사람 제외 — 자리(seat)를 주지 않음. 칸 넘김 "전원 제출"은 화면을 보고 있는 사람만 기준.

**이유/배경**: 참가하기만 누르고 자리를 비운 사람까지 판에 포함되는 문제.

**다음 단계**: 베타에서 확인.

---

## 2026-10-15 (4) — jessi.kim (Claude Code) — 지난 판 그림 보기

**한 일**: "지난 게임 결과"에서 판을 펼치면 그 판의 스케치북 레인(이름·표·정답 표시)을 한 권씩 받아 보여준다. /book 에 gameId(최근 30판 중 끝난 판) 지원.

**이유/배경**: 새 판이 열리면 결과 화면이 사라져 이전 판 그림을 볼 방법이 없었다.

**다음 단계**: 없음.

---

## 2026-10-15 (3) — jessi.kim (Claude Code) — 그림 레인 한 권씩 받기, 투표 개수 제한 없앰

**한 일**: 투표·결과 레인을 /allbooks 한 번 대신 /book 한 권씩(병렬)으로 받는다 — 그림 dataURL 이 커서 한 번에 받으면 응답 크기 제한에 걸려 결과 화면 그림이 안 보이던 것으로 추정. /book 결과 모드에도 matched. 띵작·망작 개수 제한 제거(한 칸에 하나, 내 칸 제외는 유지).

**이유/배경**: 결과 화면에서 마지막 판 그림들이 안 보인다는 제보, 투표 제한을 없애 달라는 요청.

**다음 단계**: 베타에서 6명 이상으로 결과 화면 그림 확인.

---

## 2026-10-15 (2) — jessi.kim (Claude Code)

**한 일**: 점수 제도: 맞춤(추측이 앞사람이 그린 말과 같으면 추측자 +1)·전달(그린 사람 +1)·완주(마지막 추측 = 처음 제시어면 주인 +1) + 띵작 +1 / 망작 −1. 비교는 공백·문장부호 제거. /allbooks 결과 모드에 matched. 명작 → 띵작으로 이름 변경.

**이유/배경**: 사용자 요청(점수 제도 추가, 투표 이름 변경, 안내 간소화).

**다음 단계**: 베타에서 한 판 시험.

---

## 2026-10-14 (6) — jessi.kim (Claude Code) — 명작·망작 2표씩, 스와이프 레인, 칸 수 자동

**한 일**: 명작 2표·망작 2표(marks2 테이블, kind good|bad, 한 칸엔 한 종류만). 점수 = 받은 명작 − 망작. /allbooks(레인용 전체 스케치북). 칸 수 0=자동: 시작할 때 min(인원, 8)+1.

**이유/배경**: 명작·망작을 2표씩 주고 싶다, 하나씩 펼치지 말고 키워드별로 스와이프하며 투표하고 싶다, 5명인데 그리기 2번·맞추기 1번뿐이었다(기본 4칸 고정 때문)는 피드백.

**다음 단계**: 베타에서 5명 이상으로 한 판.

---

## 2026-10-14 (5) — jessi.kim (Claude Code) — 누구나 새 판·지난 결과·상위/하위

**한 일**: 진행자 고정(hosts) 대신 판을 연 사람이 진행자(`openers` 테이블, 예전 hosts 도 인정). 진행 중인 판이 없으면 누구나 `/host/new`. `/history`(최근 10판, 오래된 판부터 N번째)와 화면 맨 아래 "지난 게임 결과" 목록. 결과를 뒷정리 담당 → 상위·하위 k명(겹치지 않게 최대 절반씩)으로, 바베큐 문구 제거("오더그로스팀 미니 게임"). 망작 표 → 명작 표(많이 받으면 상위권). 이름 "오더그로스 텔레스트레이션".

**이유/배경**: 결과가 나온 뒤 다른 기기에서 새 판을 못 여는 문제, 지난 판 결과 보기 요청, 바베큐 말고도 쓰고 싶다는 요청.

**다음 단계**: 베타에서 다른 기기로 새 판 열기 + 지난 결과 확인.

---

## 2026-10-14 (3) — jessi.kim (Claude Code) — 텔레스트레이션 빠른 진행 개편

**한 일**: 빠른 진행 개편: 테이블을 matches/seats/pages/marks 로 새로 만들고(컬럼 추가가 안 돼서), cur_step·step_start 를 두어 advance() 가 시간 끝 또는 전원 제출 시 다음 칸으로 넘긴다(cur_step 비교 UPDATE). 진행자 넘기기 공개 대신 voting(vote_end) 단계 + /books 요약 엔드포인트.

**이유/배경**: 14명이면 한 권씩 넘겨 보는 공개가 10분 이상 걸려서 더 빠르게 즐기고 싶다는 요청. 가상 참가자 그림이 너무 터무니없다는 피드백.

**다음 단계**: 베타에서 진행자 + 가상 참가자로 한 판 돌려 보기.

---

## 2026-10-14 — jessi.kim (Claude Code) — 바베큐 텔레스트레이션 최초 구현

**한 일**: handler.ts 를 판·참가자·칸·투표 API 로 교체하고 games/players/entries/votes/hosts 테이블 정의 추가.

**이유/배경**: 오더그로스팀 워크샵에서 다 같이 폰으로 하는 그림 이어 그리기 게임. 망작 투표로 바베큐 뒷정리 담당을 정한다.

**다음 단계**: 워크샵 전에 3~4명으로 베타에서 한 판 시험(그림 업로드 속도 확인). 필요하면 제시어 추가.

---

## 2026-07-08 — jaewonlee6512 (Claude 세션, 3) — dev-server.mjs 추가: root/projects 없이 로컬 실제 HTTP 서빙

**한 일**: 사용자가 "sparse pull(app+api)만으로 로컬 개발이 되냐"를 반복 질문하다가, root/projects
가 어떤 조합으로도 sparse pull 되지 않는다는 것(그래서 `handler.ts` 혼자서는 HTTP 서빙이 원천
불가능하다는 것)을 확인한 뒤 "그럼 dev 전용 래핑 유틸을 만들어야 하지 않겠냐"고 제안. 사용자가
"bbq-telestration + 기존 8개 프로젝트 전체 백포트"를 선택해 다음을 추가했다:
1. `dev-server.mjs` — projects 호스트(게이트웨이 미들웨어 + `WasmSandboxRuntimeService`)가
   하는 일을 이 프로젝트 폴더 안에서만 재현하는 DEV 전용 Node HTTP 서버. esbuild `context()` +
   `watch()`로 `src/handler.ts` 저장 시 자동 재번들, `@electric-sql/pglite`로 로컬 영속 DB
   (`.../mockingbird/pglite/dev-<project>`, 진짜 projects 호스트 데이터와 절대 안 섞이게 분리),
   capability prelude(`env.db`/`env.log`/`env.fetch`)는 `wasm-sandbox-runtime.service.ts`와
   동일 형태로 재현(단 SSRF 가드/시크릿 자동 주입은 생략 — dev 전용, 로컬 신뢰 경계). `/api/<project>/*`
   만 서빙해 App 의 vite proxy(`localhost:4001`) 계약과 그대로 호환.
2. `tables.local.json` — `POST /projects-admin/tables`와 동일한 `{table, columns}` 포맷으로
   시작 시 idempotent 테이블 생성(`projects-admin.service.ts`의 타입 화이트리스트/식별자 검증
   로직을 그대로 복제).
3. `package.json`에 `dev:server` 스크립트 + `@electric-sql/pglite` devDependency 추가.
4. README.md "로컬 개발" 섹션 전면 개편(로직만 반복 vs 진짜 라우팅 두 갈래로 분리), "구성 파일"
   표에 두 파일 추가.
5. 실제로 `node dev-server.mjs` 를 sandbox 에서 띄워 GET `/`, POST `/items`, GET `/items`,
   `/api/projects/health` 전부 curl 로 왕복 검증 완료(재번들 로그·PGlite 영속 확인).

**이유**: root(git credential 보유)와 projects(공유 단일 번들 호스트)는 설계상 sparse pull 로
개발자 PC 에 절대 내려가지 않는다 — 그런데 `handler.ts` 자체는 서버가 아니라 함수라서 이 둘
없이는 실제 HTTP 검증이 원천적으로 불가능했다(로직만 QuickJS mock 으로 돌려보는 `test:handler`
뿐이었음). 매번 "root 를 거쳐 beta 에 배포해서 확인"하거나 "풀 모노레포를 통째로 받아서 root 까지
같이 띄우라"고 안내하는 건 sparse-pull 아키텍처의 취지(가벼움, root 격리)에 반해서, root/projects
가 없어도 이 프로젝트 폴더 하나만으로 실제 라우팅+DB 를 확인할 수 있는 자체완결형 대체재를 만들었다.

**다음 단계**: 8개 실 프로젝트(baemin-web-monitor, bff-pull-test-1780929139, jeminhee,
mockingbird-test2, tech-div, voc-report, wooluck, wooluck2)에 동일 `dev-server.mjs` 백포트 +
각자 실제 handler.ts 의 테이블 구조에 맞는 `tables.local.json` 작성(진행 중), 4개 메인 문서에도
이 흐름 반영. 이후 전부 커밋+push 필요(지금까지는 로컬 워킹트리 수정만 된 상태).

## 2026-07-08 — jaewonlee6512 (Claude 세션, 2) — "openfaas" 이름 전면 제거 + 레거시 NestJS 파일 삭제 + 테이블 생성 필수화 문서화
**한 일**:
1. 아래 항목(같은 날 첫 세션)에서 완료 못 했던 물리 삭제를 마무리했다 — `src/openfaas/` 전체,
   `src/api/root/src/openfaas/`, `src/api/projects/src/openfaas-gateway/`, 그리고 이 프로젝트를
   포함한 9개 프로젝트의 옛 NestJS 파일(`app.controller.ts`/`app.module.ts`/`index.ts`/
   `items.service.ts`/`tsconfig.lib.json`/`.npmrc`, jeminhee 는 추가로 `genai.service.ts`/
   `langfuse.service.ts`)을 전부 삭제했다(`mcp__cowork__allow_cowork_file_delete` 로 삭제 권한을
   받아 처리 — 이전엔 샌드박스 unlink 제약으로 못 지웠었다).
2. "openfaas" 이름을 코드 레벨까지 전부 걷어냈다 — 엔드포인트(`/openfaas/deploy-wasm` →
   `/wasm/deploy`, `/openfaas/status/:name` → `/wasm/status/:name`, 내부
   `/api/projects/openfaas-routes` → `/api/projects/wasm-routes`), 클래스/파일명
   (`OpenfaasService/Controller/Module` → `WasmService/Controller/Module`,
   `src/api/root/src/openfaas/` → `src/api/root/src/wasm/`, `OpenfaasGateway*`/`OpenfaasRoute*`
   → `WasmGateway*`/`WasmRoute*`, `src/api/projects/src/openfaas-gateway/` →
   `src/api/projects/src/wasm-gateway/`), DB 테이블(`openfaas_gateway__routes` →
   `wasm_gateway__routes` — `WasmRouteService.ensure()` 가 부팅 시 옛 테이블이 있으면 자동
   `RENAME` 마이그레이션), env(`OPENFAAS_FETCH_ALLOWLIST_*`/`OPENFAAS_WASM_*`/
   `OPENFAAS_ROUTE_TTL_MS`/`OPENFAAS_FUNCTION_NAME_PREFIX` → `WASM_*` 계열, 구 이름은 폴백으로
   계속 인식). root/projects 둘 다 `tsc --noEmit` 통과 확인.
3. 이 bbq-telestration 의 옛 NestJS 파일(`items.service.ts` 의 `onModuleInit`)이 지워지면서, "부팅 시
   테이블 자동 생성" 경로가 완전히 사라졌다는 걸 사용자가 지적해 이 README.md/state.md 에
   "테이블 생성(배포 전 필수)" 섹션을 새로 추가했다 — `POST <root>/projects-admin/tables` 를
   명시적으로 호출해야 함을 문서화(4개 메인 문서에도 동일하게 반영, 별도 커밋).
**이유**: 사용자가 "openfaas 라는 이름을 없애야 하지 않을까"를 명시적으로 요청했고, 처음엔
디렉토리 통합(`src/openfaas` → `src/api`)만 했으나 이어서 "전부 다른 이름으로 변경"을
선택해 엔드포인트/클래스/DB/env 까지 전부 정리했다. 테이블 생성 문서화는 레거시 파일 삭제의
부작용(새 프로젝트는 더 이상 테이블을 자동으로 못 받음)을 사용자가 직접 질문해 드러난 것.
**다음 단계**: 로컬에서 이 모든 변경사항을 커밋 + push 해야 실제로 sparse pull/scaffold 가
이 wasm 전용 모델을 내려준다(지금까지는 로컬 워킹트리 수정만 된 상태). push 후 새 프로젝트
스캐폴드 1회 실제로 해보고 `POST /projects-admin/tables` → `POST /wasm/deploy` → `GET
/api/<name>/items` e2e 를 검증해볼 것.

## 2026-07-08 — jaewonlee6512 (Claude 세션) — `.context` 이관: `src/openfaas/bbq-telestration` → `src/api/bbq-telestration`
**한 일**: "openfaas" 디렉토리/브랜딩을 없애고 `api` 하나로 통합하기로 한 결정에 따라, 실제 코드
(`package.json`/`esbuild.handler.mjs`/`src/handler.ts`/`tsconfig.json`/`wasm-local-test.mjs`/
`README.md`)뿐 아니라 **이 `.context/` 폴더 자체도 `src/openfaas/bbq-telestration/.context/` 내용으로
교체**했다(패키지명만 `@mockingbird/api-bbq-telestration` 로 조정, 그 외 코드는 그대로). 이 시점부터
`src/api/bbq-telestration/.context/`는 wasm 샌드박스 아키텍처 히스토리를 담는다.
**이유/배경**: 이관 전 `src/api/bbq-telestration/.context/`는 옛 NestJS 라이브러리 스캐폴드(`app.controller.ts`
+ `app.module.ts` + `index.ts` 가 전부이던 시절)의 히스토리만 담고 있었고, 실제로 참고 가치가 있는
현재 아키텍처 문서는 전부 `src/openfaas/bbq-telestration/.context/` 에 있었다. 두 개를 병존시키는 대신
실제로 유효한 쪽으로 완전히 교체하는 게 다음 작업자에게 덜 혼란스럽다고 판단했다. 이관 전
`src/api/bbq-telestration/.context/` 의 옛 NestJS 시절 히스토리는 이 교체로 대체(superseded)됐다 —
그 내용을 다시 옮기지는 않았다(코드 자체가 이제 dead code 이므로 이력 보존 가치가 낮음).
**다음 단계**: `decisions.md` 에 이 통합 결정을 ADR 로 기록(완료, 아래 항목 참고). 물리적으로
남은 옛 NestJS 파일들(`app.controller.ts`, `app.module.ts`, `index.ts`, `items.service.ts`,
`tsconfig.lib.json`, `.npmrc`, `.DS_Store`)은 샌드박스 제약(unlink 차단)으로 이 세션에서 못
지웠다 — 로컬 터미널에서 `rm` 필요. `src/openfaas/bbq-telestration` 원본 디렉토리도 이제 중복이므로
함께 삭제 대상. 아래는 `src/openfaas/bbq-telestration/.context/journal.md` 에서 그대로 옮겨온 이전 히스토리.

## 2026-07-07 — jaewonlee6512 (Claude 세션, 7) — WASM 샌드박스용 handler.ts PoC 추가
**한 일**: Kata 가 이 환경에서 불가능한 것으로 최종 확인된 뒤, 새 실행 규약(게이트웨이 내장
WASM 샌드박스, `plans/wasm-gateway-sandbox.md`)의 PoC 를 이 디렉토리에 추가했다.
`src/handler.ts`(export function handle(req, env) — `/`, `/health`, `GET/POST /items` 구현,
`env.db.query` 로 `bbq_telestration__items` 조회/삽입), `esbuild.handler.mjs`(IIFE 번들 + `globalThis.handle`
footer), `wasm-local-test.mjs`(DB in-memory mock 으로 로컬에서 실제 QuickJS 실행/검증).
`package.json` 에 `quickjs-emscripten` devDependency 와 `bundle:handler`/`test:handler` 스크립트 추가.
**이유/배경**: 새 실행 엔진(`WasmSandboxRuntimeService`, projects 쪽)이 실제로 동작하는지 보여줄
샘플이 필요했고, 기존 Kata PoC(`src/main.ts`, NestJS+of-watchdog)는 QuickJS 안에서 실행 불가능한
규약(HTTP 서버 listen, Node 내장 모듈)이라 재사용할 수 없어 별도 파일로 신규 작성했다.
**검증**: 이 세션에서 `/tmp` 에 이 디렉토리를 그대로 복사해 `npm install esbuild quickjs-emscripten`
후 `node esbuild.handler.mjs && node wasm-local-test.mjs` 실행 — 4개 시나리오 전부 기대한 JSON
응답 확인(로그 포함). 실제 repo 안에서는 pnpm install 이 mount 권한 문제로 안 돼 직접 실행은
못 함 — 정상 환경에서 `pnpm install` 후 동일하게 재현될 것으로 예상(코드는 100% 동일).
**다음 단계**: (1) 정상 pnpm 환경에서 `pnpm --filter @mockingbird/api-bbq-telestration bundle:handler`
/ `test:handler` 재확인. (2) root/projects 를 로컬에 띄우고 `POST <root>/openfaas/deploy-wasm
{name:'bbq-telestration'}` 실제 호출 → `GET /api/bbq-telestration/items` 로 진짜 PGlite/Postgres 까지 왕복 확인
(현재는 mock DB 로만 검증됨 — `bbq_telestration__items` 테이블이 아직 어디서도 `CREATE TABLE` 되지
않는다는 점 주의, ensure 단계 추가 필요). (3) `src/main.ts`(Kata PoC)는 그대로 두되 신규
프로젝트에는 `handler.ts` 규약을 권장하는 걸 온보딩 문서에 반영.

## 2026-07-07 — jaewonlee6512 (Claude 세션, 6) — root→projects 연동 코드 마무리
**한 일**: (1) 사용자 요청으로 AWS Lambda PoC 삭제 + 공유 게이트웨이를 `lambda-gateway` →
`openfaas-gateway` 로 리네임(별도 root/projects `.context` 참고). (2) `plans/…§4.2.1` 에
"미구현" 으로 남아있던 admin URL/invoke URL 분리를 구현 — `OpenfaasService` 에
`OPENFAAS_GATEWAY_URL`(admin REST, internal ALB) 과 `OPENFAAS_GATEWAY_INVOKE_URL`(projects 에
등록되는 in-cluster invoke 주소) 를 분리하고, `deployToGateway()` 가 projects 로 보내는
`invokeUrl` 은 후자 기준으로 계산하도록 수정(미설정시 GATEWAY_URL 로 폴백).
**이유/배경**: "root 에서 트리거해서 projects 에서 불러올 수 있게 구현해달라"는 요청 — 실제로
root(트리거)→CI(빌드)→콜백(게이트웨이 배포+라우트 등록)→projects(프록시) 흐름 자체는 이미
전부 구현돼 있었고, 남은 코드 갭은 이 URL 분리뿐이었다.
**다음 단계**: 코드 레벨은 이걸로 완결 — 이제부터는 순수 인프라 작업만 남음: (1)
`infra/openfaas/*` 를 실제 K8s 클러스터에 적용(RuntimeClass, 노드 라벨/taint, helm install),
(2) root 에 `OPENFAAS_GATEWAY_URL`/`OPENFAAS_GATEWAY_INVOKE_URL`/`OPENFAAS_BASIC_AUTH` env 주입.
Cowork 샌드박스는 클러스터 접근이 없어 이 두 단계는 사람이 직접 해야 한다(CLAUDE.md §7.6).

## 2026-07-07 — jaewonlee6512 (Claude 세션, 5) — 진짜 원인 발견
**한 일**: 3번째 push 실패 로그(`An image does not exist locally with the tag: ...`)를 보고
레지스트리 경로/이름 문제가 아니라는 걸 확인. `.dockerize-arm64`/`.dockerize-multiarch` 가
`BUILDKIT_DRIVER=remote` 를 쓰는데, remote 드라이버로 빌드하면 결과가 로컬 docker 이미지
스토어에 안 실린다 — `docker build` 따로 + `docker push` 따로(2-step) 하면 push 가 로컬에
그 태그 이미지가 없다며 항상 실패한다. 기존에 성공하던 `dockerize-root`/`dockerize-projects` 는
전부 `docker build --push ...` 처럼 **한 명령에 --push 를 붙여** 원격에서 레지스트리로 바로
스트리밍하는 패턴이었음 — `deploy-openfaas.mjs` 의 `buildAndPushImage()` 를 동일하게
`docker build --push -f ... -t ...` 한 줄로 수정(별도 `docker push` 호출 제거).
**이유/배경**: 지난 3번의 실패(3-depth → 4-depth → flat, SERVICE/ROLE 변경까지) 전부 레지스트리
경로/이름 가설로 접근했으나 전부 헛다리였음 — 매번 정확히 같은 지점(`docker push` 커맨드)에서
"로컬에 이미지 없음"으로 실패한 게 결정적 단서. 레지스트리 경로/네이밍 자체는 문제 없었다.
**다음 단계**: 재태그 push 후 `docker build --push` 로 실제 push 가 성공하는지 확인. 성공하면
`OPENFAAS_REGISTRY`(현재 `wcr.baemin.in/mockingbird/mockingbird-projects-simploy` 로 실험 중 —
기존 projects 배포 이미지와 레포를 공유하는 형태라 태그 prefix(`openfaas-fn_*` vs `api-beta_*`)로만
구분됨, 필요시 전용 레포로 분리 검토)와 `-SNAPSHOT` 리텐션 태그가 의도대로 동작하는지 확인.

## 2026-07-07 — jaewonlee6512 (Claude 세션, 4)
**한 일**: 사내 이미지 레지스트리 정책 확인(`wcr.baemin.in/<SERVICE>/<ROLE>/{optional-name}`,
태그 제약 없음, 테스트 이미지는 `*-SNAPSHOT`). "sub-path 라 push 실패"라는 이전 가설이 틀렸음을
인지 — SERVICE/ROLE 을 실제 서비스 이름(`mockingbird-platform`/`mockingbird-platform-api`)으로
맞추고, 함수명은 경로가 아니라 태그로 구분(`openfaas-fn_<name>_<ts>-SNAPSHOT`)하는 걸로 최종
정리. `deploy-openfaas.mjs` imageTag 를 `${REGISTRY}:${tag}-SNAPSHOT`으로, `.gitlab-ci.yml`
after_script 의 콜백 IMAGE 계산식도 동일하게 맞춤. 로컬 sandbox 에서 `docker push` 재현 시도 —
docker 바이너리 자체가 없고 `wcr.baemin.in` 도 네트워크 프록시에서 403 으로 막혀 불가 확인.
**이유/배경**: 사용자가 실제 사내 레지스트리 운영 정책 문서를 공유 — 이전 두 번의 실패가 경로
depth 때문이라는 내 가설은 근거가 약했고, 정책상 sub-path 는 정상 지원됨이 확인됨.
**다음 단계**: 사용자가 push 하면 새 `openfaas-fn_bbq-telestration_*` 태그로 재테스트 → `docker push`
통과 여부 확인 → 실패 시 SERVICE/ROLE 프로비저닝(레지스트리 프로젝트/권한) 문제로 좁혀서
인프라팀에 문의 필요.

## 2026-07-07 — jaewonlee6512 (Claude 세션, 3)
**한 일**: beta 실측 — `dockerize-openfaas-fn` 잡이 `docker push
wcr.baemin.in/mockingbird/openfaas-functions/bbq-telestration:...` 에서 실패(`Command failed`, pipeline
4433872). 레지스트리 경로를 다른 이미지들(`mockingbird-root-simploy` 등)과 동일한 단일
depth 로 단순화: `OPENFAAS_REGISTRY` 기본값/CI 변수를 `wcr.baemin.in/mockingbird/openfaas-functions`
→ `wcr.baemin.in/mockingbird` 로 변경(`scripts/deploy-openfaas.mjs`, `.gitlab-ci.yml`). 결과
이미지 태그는 `wcr.baemin.in/mockingbird/<name>:<tag>` 형태가 된다.
**이유/배경**: 사용자가 실제 job 로그에서 push 실패를 확인하고, 레지스트리(Harbor 추정)의
기존 관례(모든 이미지가 `mockingbird/` 프로젝트 바로 아래 flat 네이밍)와 다른 3-depth 경로가
push 를 막았을 가능성을 제기 — 관례에 맞춰 단순화.
**다음 단계**: 재태그(`openfaas-fn_bbq-telestration_*`) push 후 `dockerize-openfaas-fn` 파이프라인이
`docker push` 단계를 통과하는지 GitLab 에서 재확인. 통과하면 `after_script` 콜백
(`POST /openfaas/build-status`)이 실제로 root 에 도달하는지, 그리고 root 의
`OPENFAAS_GATEWAY_URL`/`OPENFAAS_BASIC_AUTH` 미설정으로 그 다음 단계(게이트웨이 배포)가
어디서 실패하는지 확인 필요 — 클러스터에 OpenFaaS/Kata 자체가 아직 없으므로 여기서 막힐 것으로
예상됨(`infra/openfaas/` 매니페스트 적용이 선행돼야 함).

## 2026-07-07 — jaewonlee6512 (Claude 세션, 2)
**한 일**: beta 실측(sparse-checkout 버그 → docker ENOENT)을 거쳐 이미지 빌드 책임을
root → GitLab CI(`dockerize-openfaas-fn`)로 이전. 이 디렉토리(`main.ts`/`esbuild.mjs`)는
변경 없음 — CI 러너가 그대로 실행. 자세한 내용은 `.context/decisions.md`, `state.md`,
`plans/openfaas-kata-migration.md` v2.
**이유/배경**: root 컨테이너에 docker 없음 확인, S3 아카이브도 CI 위임 구조에선 중복이라 제거.
**다음 단계**: `POST /openfaas/deploy` 재호출 후 GitLab 파이프라인에서 `dockerize-openfaas-fn`
잡이 실제로 도는지 확인.

## 2026-07-07 — jaewonlee6512 (Claude 세션)
**한 일**: OpenFaaS+Kata PoC 스캐폴드 신규 생성. `src/openfaas/bbq-telestration`(main.ts/app.module.ts/app.controller.ts/esbuild.mjs/package.json/tsconfig.json), `scripts/deploy-openfaas.mjs`(esbuild 번들 → S3 `api/<name>/` 아카이브 → OCI 이미지 build/push → OpenFaaS 게이트웨이 REST 배포), `scripts/openfaas-function.Dockerfile`(of-watchdog http mode 템플릿), root API `src/api/root/src/openfaas/`(모듈/컨트롤러/서비스, `LambdaService` 패턴 그대로 미러링), `pnpm-workspace.yaml` 에 `src/openfaas/*` 추가.
**이유/배경**: 기존 `src/api/*` 공유 번들 호스트(모든 프로젝트가 단일 `dist/main.js`)의 확장성 한계(프로젝트 1000개 시 번들/이미지 비대화)와, 이미 존재하던 `src/lambda/*`(AWS Lambda, CIE-16130) 방식의 계정 쿼터(함수 1,000개/동시성 1,000 공유) 한계를 동시에 검토한 끝에, 자체 K8s + OpenFaaS + Kata RuntimeClass 로 "프로젝트별 개별 격리 실행 단위"를 재현하는 대안을 PoC 로 만들었다. S3 는 요청대로 `mockingbird-app-artifacts` 버킷의 `api/` 프리픽스를 쓰되, 실제 런타임 fetch 경로는 S3 가 아니라 컨테이너 레지스트리(OCI 이미지)로 설계 — Lambda 의 zip-in-S3 방식과 의도적으로 다르게 뺐다(레이어 캐싱/dedup 이 유리).
**다음 단계**: (1) 클러스터에 Kata RuntimeClass + OpenFaaS 게이트웨이 실제 설치(별도 인프라 설계 문서 참고). (2) `KATA_ANNOTATION_KEY` 가 설치된 faas-netes 버전에서 실제로 파드에 반영되는지 `kubectl get pod -o jsonpath='{.spec.runtimeClassName}'` 로 검증 — 안 먹으면 helm `functions.runtimeClassName=kata` 전역 기본값으로 전환. (3) `node scripts/deploy-openfaas.mjs deploy --name=bbq-telestration --dry-run` 로컬 드라이런 실행 확인. (4) root `RootModule` 에 `OpenfaasModule` 등록 후 `pnpm dev:api` 로 `/openfaas/deploy` 라우트 뜨는지 확인.
