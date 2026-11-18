# bbq-telestration — 작업 로그 (journal)

> append-only. **새 엔트리는 맨 위에** 추가한다. 지우지 말 것 (히스토리).
> 엔트리 템플릿:
>
> ```
> ## YYYY-MM-DD — <작업자>
> **한 일**: 무엇을 바꿨나 (커밋/배포 단위)
> **이유/배경**: 왜 했나
> **다음 단계**: 이어서 할 일 (다음 작업자가 여기서 시작)
> ```

---

## 2026-10-15 (7) — jessi.kim (Claude Code) — 넓은 화면 대응

**한 일**: 화면 최대 너비 480px → 720px(게임 메뉴와 같게). 그림판은 min(100%, max(320px, 100vh − 440px))로 화면 높이에 맞춰 커져 제출 버튼이 밀려나지 않는다.

**이유/배경**: 데스크톱에서 게임 메뉴는 넓은데 이 게임만 좁았다.

**다음 단계**: 없음.

---

## 2026-10-15 (6) — jessi.kim (Claude Code) — 제시어 난이도 선택

**한 일**: 새 판 열기에 난이도(하·중·상) 라디오 추가, 모집 중 상태에 "난이도 X" 표시, 규칙 설명 문구 수정.

**이유/배경**: 판마다 난이도를 골라 하도록.

**다음 단계**: 베타에서 확인.

---

## 2026-10-15 (5) — jessi.kim (Claude Code) — 자리 비움

**한 일**: 화면이 가려지면 폴링을 멈춤(→ 서버가 자리 비움 판단), 참가자 칩에 "자리 비움" 표시, 모집 중 상태에 "자리 비움 n명은 시작하면 빠져요".

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

**한 일**: 👑띵작 / 💩망작으로 이름 변경, 결과판에 점수와 내역(맞춤·전달·완주·👑·💩), 결과 레인에 "정답! +1". 별명 안내 문구·혼자 연습 버튼 제거.

**이유/배경**: 사용자 요청(점수 제도 추가, 투표 이름 변경, 안내 간소화).

**다음 단계**: 베타에서 한 판 시험.

---

## 2026-10-14 (7) — jessi.kim (Claude Code) — 진행자 메뉴 간소화

**한 일**: 칸 수를 "사람 수만큼(최대 8칸) / 직접 설정" 두 가지로. 진행자 단계 안내(hSteps)와 가상 참가자 설명 문구 제거. 판이 없을 땐 메뉴 제목을 "새 판을 열어볼까요?"로, 상태 줄은 숨김. "상위·하위 인원" → "뽑을 인원".

**이유/배경**: 안내 문구가 너무 길다는 피드백.

**다음 단계**: 없음.

---

## 2026-10-14 (6) — jessi.kim (Claude Code) — 명작·망작 2표씩, 스와이프 레인, 칸 수 자동

**한 일**: 투표 화면을 제시어별 레인(옆으로 스와이프, scroll-snap)으로 바꾸고 칸마다 명작/망작 버튼. 결과 화면도 같은 레인(이름·표 수 공개). 카드 크기 축소. 칸 수 입력 0=자동.

**이유/배경**: 명작·망작을 2표씩 주고 싶다, 하나씩 펼치지 말고 키워드별로 스와이프하며 투표하고 싶다, 5명인데 그리기 2번·맞추기 1번뿐이었다(기본 4칸 고정 때문)는 피드백.

**다음 단계**: 베타에서 5명 이상으로 한 판.

---

## 2026-10-14 (5) — jessi.kim (Claude Code) — 누구나 새 판·지난 결과·상위/하위

**한 일**: 진행자 고정(hosts) 대신 판을 연 사람이 진행자(`openers` 테이블, 예전 hosts 도 인정). 진행 중인 판이 없으면 누구나 `/host/new`. `/history`(최근 10판, 오래된 판부터 N번째)와 화면 맨 아래 "지난 게임 결과" 목록. 결과를 뒷정리 담당 → 상위·하위 k명(겹치지 않게 최대 절반씩)으로, 바베큐 문구 제거("오더그로스팀 미니 게임"). 망작 표 → 명작 표(많이 받으면 상위권). 이름 "오더그로스 텔레스트레이션".

**이유/배경**: 결과가 나온 뒤 다른 기기에서 새 판을 못 여는 문제, 지난 판 결과 보기 요청, 바베큐 말고도 쓰고 싶다는 요청.

**다음 단계**: 베타에서 다른 기기로 새 판 열기 + 지난 결과 확인.

---

## 2026-10-14 (4) — jessi.kim (Claude Code) — 진행자 안내·게임 메뉴 버튼

**한 일**: 투표 중엔 그린 사람 이름을 숨기고(서버도 안 내려줌, 내 칸만 mine 표시) 결과 화면에서 스케치북 다시 보기로 이름·받은 표 공개. 시작 카운트다운 중엔 참가 버튼 숨김, 진행자가 참가 안 하고 시작하면 한 번 더 확인. 그리기 기본 40초. "← 게임 메뉴" 버튼, 진행자 단계 안내 + "혼자 연습 한 판 열기".

**이유/배경**: 가상 참가자로 연습할 때 뭘 눌러야 할지 헷갈린다는 피드백, 모아보기(bbq-games)로 돌아가는 버튼 요청.

**다음 단계**: 베타에서 "혼자 연습 한 판 열기"로 한 판 시험.

---

## 2026-10-14 (3) — jessi.kim (Claude Code) — 텔레스트레이션 빠른 진행 개편

**한 일**: 빠른 진행 개편: 모두 내면 바로 다음 칸, 공개는 각자 폰에서 동시에 구경(요약 카드 그리드 → 눌러서 펼치기) + 투표 제한시간 후 자동 결과, 기본값 4칸·그리기 45초·추측 20초·투표 180초. 가상 참가자 그림을 단어에 맞는 이모지 스케치로(bots.ts), 가상 참가자끼리는 그럴듯하게 맞히거나 비슷하게 틀린다. 진행자 메뉴는 그리는 동안 숨김.

**이유/배경**: 14명이면 한 권씩 넘겨 보는 공개가 10분 이상 걸려서 더 빠르게 즐기고 싶다는 요청. 가상 참가자 그림이 너무 터무니없다는 피드백.

**다음 단계**: 베타에서 진행자 + 가상 참가자로 한 판 돌려 보기.

---

## 2026-10-14 (2) — jessi.kim (Claude Code) — 연습용 가상 참가자 + 민트·블랙 테마

**한 일**: 진행자 메뉴(모집 중)에 "연습용 가상 참가자" 추가 — 진행자 브라우저가 봇 키로 대신 참가·그리기(랜덤 낙서)·추측·투표한다(봇 목록은 localStorage `telestration-bots-<gameId>`). 테마 토큰을 민트(#3ee6c1)·블랙(#0b0d0c)으로 교체.

**이유/배경**: 혼자서도 시뮬레이션해 보고 싶다는 요청, 테마는 민트·블랙 요청.

**다음 단계**: 베타에서 진행자 + 가상 참가자로 한 판 돌려 보기.

---

## 2026-10-14 — jessi.kim (Claude Code) — 바베큐 텔레스트레이션 최초 구현

**한 일**: 템플릿 DB 테스트 화면을 게임 화면(game.html/css/ts)으로 교체 — 로비, 그림판, 추측, 넘김 대기, 스케치북 공개·망작 투표, 결과.

**이유/배경**: 오더그로스팀 워크샵에서 다 같이 폰으로 하는 그림 이어 그리기 게임. 망작 투표로 바베큐 뒷정리 담당을 정한다.

**다음 단계**: 워크샵 전에 3~4명으로 베타에서 한 판 시험(그림 업로드 속도 확인). 필요하면 제시어 추가.

---

## 2026-08-10 (2) — jaewonlee6512 (Claude 세션, Cowork) — apiToken.ts 신설 + apiClient.ts 에 Authorization: Bearer 추가

**한 일**: `lib/permission/apiToken.ts`(신규) — `useUser()`가 localStorage(`session` 키)에 저장한
wst/email 을 직접 읽어(React 훅 체인 없이 독립 동작) root `POST /auth/token` 을 호출, 발급받은
Mockingbird 토큰을 메모리에 캐시(만료 5분 전 재발급, 동시 호출은 in-flight promise 공유로 중복
발급 방지)한다. `apiClient.ts` 의 `request()` 가 이 토큰을 `Authorization: Bearer <token>` 으로
싣는다(토큰 없으면 헤더 생략 — 로그인 전/발급 실패 시에도 요청 자체는 계속 진행).

**이유/배경**: 사용자 요청 — projects 게이트웨이에 실사용자 단위 access-check
(`WASM_GATEWAY_USER_ACCESS_MODE`)를 새로 추가했는데(`src/api/projects/.context/decisions.md`
"2026-08-10 (2)"), 그 토큰을 실제로 들고 오는 클라이언트가 있어야 의미가 있다. 사용자가
"email 자진신고" 대신 "wst 기준 검증"을 제안했고, 이건 root 가 이미 갖고 있는 `/auth/token`
(portal "토큰 발급" 버튼과 동일 엔드포인트)을 App 이 로그인 시 한 번 호출해 재사용하는 것으로
구현했다 — wst 를 매 요청마다 보내는 게 아니라 그걸로 발급받은 진짜 비밀값(토큰)을 계속
재사용하는 구조.

**검증**: 로컬 모노레포 루트 `node_modules/.bin/tsc -p src/app/bbq-telestration/tsconfig.json --noEmit`
클린. 실제 토큰 발급/재검증 왕복(root 필요)은 이 세션(Cowork, 사내망 차단)에서 확인 못 함.

**다음 단계**:
1. `push_files` 로 `mockingbird/beta/bbq-telestration.git` 에 반영(이 항목과 함께 커밋).
2. 기존에 이미 scaffold 된 App들은 `apiToken.ts`/Authorization 헤더가 없다 — projects 가
   `enforce` 로 전환되기 전에 X-Mockingbird-App 과 함께 일괄 백포트 필요.
3. 베타에서 로그인한 상태로 실제 `/auth/token` 호출이 성공하는지, 발급된 토큰으로 API 를
   부를 때 `Authorization` 헤더가 admin-bff 를 거쳐서도 살아있는지 확인.

---

## 2026-08-10 — jaewonlee6512 (Claude 세션, Cowork) — apiClient.ts 에 X-Mockingbird-App 식별 헤더 추가

**한 일**: `src/lib/apiClient.ts` 의 `createClient().request()` 가 모든 요청에
`X-Mockingbird-App: <이 App 의 프로젝트명>` 헤더를 싣도록 수정. 프로젝트명은
`lib/permission/permissionApi.ts` 의 `PROJECT_NAME` 과 동일하게 vite base(`/app/<name>/`)에서
파생(하드코딩 아님, base 변경 시 자동 추종) — `CALLER_APP_NAME` 상수로 apiClient.ts 안에
독립적으로 둠(순환 의존 피하려 permissionApi.ts 를 import 하지 않고 같은 파생 로직을 복제).

**이유/배경**: 사용자 요청 — projects 게이트웨이(`src/api/projects/src/wasm-gateway/
wasm-gateway.middleware.ts`)에 App 단위 접근 제어(`X-Mockingbird-App` 헤더 검사,
`WASM_GATEWAY_APP_IDENTITY_MODE`, 기본 off)를 새로 추가했는데, 그 헤더를 실제로 보내는
클라이언트가 있어야 의미가 있다. 이 bbq-telestration 템플릿이 신규 scaffold 전부의 기본형이라 여기서
먼저 표준화. 상세 설계/트레이드오프는 `src/api/projects/.context/decisions.md` "2026-08-10" 참고.

**검증**: 로컬 모노레포 루트 `node_modules/.bin/tsc -p src/app/bbq-telestration/tsconfig.json --noEmit`
클린. 실제 요청에 헤더가 실려 서버까지 도달하는지(특히 베타의 admin-bff 경유 경로)는 이
세션(Cowork, 사내망 차단)에서 검증 못 함.

**다음 단계**:
1. §CLAUDE.md 7.5b — 이 로컬 폴더는 참고용 사본, `push_files` 로 `mockingbird/beta/bbq-telestration.git`
   에 직접 반영해야 신규 scaffold 가 상속받는다.
2. **기존에 이미 scaffold 된 App들은 이 헤더를 자동으로 상속받지 못한다** — projects 쪽이
   `enforce` 모드로 전환되기 전에 필요한 프로젝트마다 개별 `push_files` 백포트 필요(2026-08-04
   항목의 `lib/permission/*` 백포트와 동일한 성격의 TODO).
3. projects 게이트웨이가 `warn` 모드로 켜진 뒤, 이 헤더가 실제로 BFF 를 통과해 도착하는지
   베타에서 로그로 확인.

---

## 2026-08-04 — jaewonlee6512 (Claude 세션, Cowork) — 권한 라이브러리(lib/permission/*) 백포트 + 화면별 RouteGate 추가, 템플릿 그룹 레포에 push

**한 일**: mockingbird-showcase 앱에서 관리 화면(`/#/ask` scope)에 접근 제한을 걸었는데도
실제로 막히지 않는 문제를 조사하다가, showcase 의 AuthGate.tsx 는 `useProjectPermission()`
(scope 없음, 앱 전체 단위)만 판정하고 화면별(scope 지정) 게이팅은 어떤 화면에도 배선돼 있지
않다는 걸 확인했다. 사용자 요청으로 (1) showcase 에 화면 단위 게이트 `lib/permission/RouteGate.tsx`
를 신설해 App.tsx 의 4개 라우트(present/ask/questions/advanced) 모두 감쌌고, (2) "다른 곳에서도
동일하게 동작"하도록 이 bbq-telestration 템플릿에도 같은 권한 시스템을 백포트했다.

이 bbq-telestration 프로젝트는 auth-admin 폐기(2026-07-21) 이전 구조 그대로였다 — `lib/permission/*`
자체가 없고 AuthGate.tsx 도 `requiredPermissions`/서버 등록 게이트 없이 로그인 확인만 했다.
mockingbird-showcase 의 다음 파일들을 이 프로젝트 컨벤션에 맞게(PROJECT_NAME 폴백만 'bbq-telestration'
로 조정) 그대로 포팅:
- `lib/permission/permissionApi.ts`, `useProjectPermission.ts`, `useMockingbirdRoles.ts`,
  `RequirePermission.tsx`, `ForbiddenScreen.tsx`, `AccessRequestButton.tsx` — 자체 멤버십 기반
  동적/정적 권한 판정 세트.
- `lib/permission/RouteGate.tsx` — 신규. scope 를 받아 화면 단위로 게이팅하는 공용 컴포넌트.
  화면이 하나뿐인 이 템플릿 자체에는 아직 안 쓰지만(App.tsx 는 그대로), 화면을 나누는
  프로젝트가 이후 바로 꺼내 쓰도록 미리 심어둠.
- `AuthGate.tsx` — showcase 와 동일하게 `requiredPermissions` prop + 서버 등록 게이트(둘 다
  있으면 AND) 판정으로 교체. `main.tsx`/`skipAuthInDev` 스위치는 그대로 유지(무관).

**검증**: 로컬 모노레포(연결된 로컬 폴더) 루트 `node_modules/.bin/tsc` 로 `src/app/bbq-telestration`
전체 `tsc --noEmit` 클린 확인.

**push**: §CLAUDE.md 7.5b — 이 로컬 폴더는 신규 scaffold 의 실제 소스가 아니라 참고용 사본이고,
`GitService.scaffoldFromBbqTelestrationGroup` 이 클론하는 진짜 템플릿은 별도 그룹 레포
`mockingbird/beta/bbq-telestration.git` 다(2026-08-03 (2) 항목 참고). 그래서 코드 8개 파일을
`push_files`(localPath 경유, 텍스트 재입력 없이 파일 그대로 업로드)로 그 레포에 먼저 push —
`branch=develop, commit=5fa1b37ed4934fbd613fb41cf58c925338fa291e`. 이 `.context` 갱신은
뒤이어 별도 커밋으로 같은 레포에 push(README 프로토콜상 원래는 같은 push 여야 하나, 코드
검증을 먼저 마친 뒤 기록을 정리하며 순서가 나뉨).

**이유/배경**: 사용자가 "전반적으로 다 반자동이 되었으면 좋겠다"(관리 화면 scope 등록만으로
화면별 접근 제한이 걸리는 구조) + "bbq-telestration쪽에도 추가해주면 다른 곳에서도 동일하게 동작할
것"이라고 요청 — 이 bbq-telestration 이 `scaffold_project` 의 실제 템플릿이므로, 여기 심어두면 앞으로
scaffold 되는 모든 새 App 이 이 권한 시스템 + RouteGate 를 처음부터 상속받는다.

**다음 단계**: (1) 기존에 이미 scaffold 된 다른 App(e2e-test/lee-jae-won/test-editor 등,
mockingbird-showcase state.md TODO 에도 동일하게 언급됨)은 자동 반영 안 됨 — 필요하면 개별
`push_files` 로 백포트. (2) 이 템플릿을 실제로 scaffold 해서 새 프로젝트가 lib/permission/*
+ 갱신된 AuthGate.tsx 를 정상 상속하는지 다음 세션에서 확인. (3) 포털 시뮬레이션 가이드에도
"관리 화면에서 scope 등록 + 코드에서 RouteGate 로 실제 게이팅해야 적용된다"는 안내를 추가
(별도 작업, portal 레포에서 진행).

---

## 2026-08-03 (2) — jaewonlee6512 (Claude 세션, Cowork) — 위 스위치를 실제 템플릿 그룹 레포(mockingbird/beta/bbq-telestration.git)에 push

**한 일**: 사용자 요청 "이걸 bbq-telestration쪽에도 명시해줘야해 템플릿 레포에 푸시해줘". §CLAUDE.md
7.5b 에 따르면 이 로컬 모노레포의 `src/app/bbq-telestration` 는 신규 scaffold 의 실제 소스가 아니다 —
`GitService.scaffoldFromBbqTelestrationGroup` 이 클론하는 대상은 별도 GitLab 그룹 레포
`mockingbird/beta/bbq-telestration.git` 이라, 로컬 파일만 고치고 끝내면 새 프로젝트는 이 스위치를
전혀 상속받지 못한다. Cowork 샌드박스는 `git.baemin.in` 에 직접 못 닿지만(§7.6), 사용자가
로컬에 설치해둔 mockingbird Claude 플러그인의 MCP 서버는 사용자 호스트(VPN 경유)에서 실행되므로
`mcp__mockingbird__push_files` 툴로 대신 push 했다:
- `get_acl name=bbq-telestration` 로 먼저 소유권 확인(owner=jaewonlee6512@woowahan.com, 협업자 없음,
  public) — push 권한 문제 없음 확인.
- `push_files` 로 `src/app/bbq-telestration/src/main.tsx`+`src/app/bbq-telestration/src/vite-env.d.ts` 2개
  파일을 그대로 push. 결과: `branch=develop, commit=b94f8d553e3c32c00e7dbbe8231bb109e29e6878`.

**보류한 것**: `bbq-telestration` 프로젝트 자체의 `README.md`(scaffold 부트스트랩 문서, §7.5b
GUIDE_PATHS)에도 이 스위치를 명시해달라는 의도로 읽힐 수 있었으나, `pull_project` 로 그 파일을
받아보니 68,626자(98,140B)로 응답 크기 제한에 걸려 **전체 내용을 못 받았다**(중간에 잘림,
"POST {JENKINS_URL}/jo" 에서 끊김 확인). `push_files` 는 파일 전체 내용을 덮어쓰는 방식이라
불완전한 내용으로 push 하면 나머지 부분이 통째로 사라질 위험이 있어, 이번엔 코드 2개 파일만
push 하고 README 문서화는 보류했다.

**이유/배경**: "템플릿 레포에 푸시해줘"라는 요청 자체가 "로컬 수정만으로는 미래의 신규
scaffold 에 반영되지 않는다"는 이 세션에서 배운 구조(§7.5b)를 정확히 짚은 것이었다.

**검증**: push 응답의 commit SHA 로 성공 확인. **`pnpm dev`/`pull_project` 재조회로 실제 반영된
내용을 다시 읽어 대조하는 것까지는 이번 세션에서 안 함**(응답 크기 제한 때문에 어차피 이 두
파일만 다시 받기도 쉽지 않음 — 필요하면 다음 세션에서 `pull_project parts=app` 재호출 후 이
두 파일 섹션만 찾아 대조).

**다음 단계**: (1) 원하면 `README.md` 를 여러 번의 `pull_project` 호출로 안전하게 전체 확보한
뒤 `VITE_SKIP_AUTH` 안내를 추가해 같은 방식으로 push. (2) 신규 프로젝트를 하나 scaffold 해서
`main.tsx`/`vite-env.d.ts` 에 이 스위치가 실제로 상속되는지 확인. (3) 기존에 이미 만들어진
App 들에는 자동 반영이 안 되므로, 필요한 프로젝트가 있다면 그 프로젝트에 개별
`push_files` 로 동일하게 백포트.

---

## 2026-08-03 — jaewonlee6512 (Claude 세션, Cowork) — 로컬 개발에서만 AuthGate 를 건너뛸 수 있는 스위치 추가(Windows hosts 파일 제약 대응)

**한 일**: 사용자 요청 "앱 개발시 윈도우의 경우는 로컬일때 import.meta.env.DEV로 AuthGate를
waiver할수 있게 해줘 로컬개발에서만". `main.tsx` 에 `skipAuthInDev = import.meta.env.DEV &&
import.meta.env.VITE_SKIP_AUTH === 'true'` 를 두고, true 일 때만 `<AuthGate>` 래핑 없이 `<App/>`
을 직접 렌더하도록 삼항식으로 분기. `vite-env.d.ts` 의 `ImportMetaEnv` 에 `VITE_SKIP_AUTH?:
string` 선언 추가.

- **기본값은 여전히 로그인 필요**(true) — `VITE_SKIP_AUTH` 를 명시적으로 `'true'` 로 설정하지
  않으면 지금까지와 동일하게 AuthGate 가 정상 동작한다. 개발자가 프로젝트 루트에
  `.env.local`(루트 `.gitignore` 의 `.env.*` 패턴에 걸려 커밋되지 않음 — 개인 로컬 설정)을
  만들어 그 안에 `VITE_SKIP_AUTH=true` 한 줄만 넣으면 활성화된다.
- **`import.meta.env.DEV` 가드가 안전장치**: vite 가 빌드 시점에 이 값을 정적으로 `false` 로
  치환해 `skipAuthInDev` 분기 자체를 죽은 코드로 제거한다 — `VITE_SKIP_AUTH` 값이 어떤
  경로로든(예: 실수로 `.env.beta` 에 들어가도) **배포 산출물(`vite build --mode beta`)에는
  이 우회가 절대 반영될 수 없다.**

**이유/배경**: §CLAUDE.md 2.3/4.5 — Windows 는 회사 지급 PC 라 로컬 관리자 권한이 없어
`mockingbird-local.betawoowa.in` hosts 매핑을 못 하는 경우가 흔하고, 그 도메인 없이는 BFF
로그인 리다이렉트가 정상 동작하지 않는다. 지금까지 문서의 유일한 대응은 "`<AuthGate>` 래퍼를
직접 지우고 `localhost` 로 확인"(수동 코드 삭제, 재추가를 까먹기 쉬움)이었는데, 이 스위치는
그 수동 삭제를 env 한 줄로 대체해 필요할 때만 켜고 끌 수 있게 한다.

**검증**: `npx tsc --noEmit -p tsconfig.json`(bbq-telestration) exit 0, 클린. **vite build/브라우저
실측은 이 세션에서 불가**(리눅스 rollup 바이너리 없음, 반복되는 샌드박스 제약) — `pnpm dev`
로 `.env.local` 에 `VITE_SKIP_AUTH=true` 를 넣었을 때 실제로 AuthGate 화면을 건너뛰는지, 값을
빼면 다시 로그인 화면이 뜨는지, `vite build --mode beta` 산출물에 이 분기가 안 남는지(번들
grep)는 재현 가능한 환경에서 확인 필요.

**⚠️ 기존 App 은 자동 동기화 안 됨**: 이 변경은 scaffold 템플릿(`src/app/bbq-telestration`)에만 적용됨 —
새로 만드는 프로젝트만 자동 상속하고, 이미 만들어진 다른 App 들의 `main.tsx`/`vite-env.d.ts`
는 그대로다(BFF 세팅 등 다른 bbq-telestration 전용 변경과 동일한 트레이드오프, §CLAUDE.md 4.5 하단 경고
참고). 필요하면 개별 App 에 수동 백포트할 것.

**다음 단계**: (1) GitHub Desktop 에서 커밋·push(이 세션 동안 계속된 동시 편집 상황 — 커밋 전
`git log -1`/`git status` 로 외부 커밋 여부 확인). (2) 실제 `pnpm dev` 환경에서 스위치 on/off
동작 확인. (3) 필요하면 README/CLAUDE.md §4.5 에도 이 옵션을 문서화(현재는 코드 주석에만 있음).

---

## (템플릿) YYYY-MM-DD — <작업자>
**한 일**: bbq-telestration 프로젝트 스캐폴드 생성.
**이유/배경**: 신규 프로젝트 시작.
**다음 단계**: 첫 화면/엔드포인트 구현, `state.md` 최신화.
