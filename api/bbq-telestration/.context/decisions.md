# bbq-telestration — 결정 기록 (decisions / ADR, API)

> 되돌리기 어렵거나 논쟁적인 결정만 남긴다. append-only.
> 한 번 고정한 결정은 다시 논의하지 말고, 바꿀 거면 새 엔트리로 "대체됨"을 명시한다.
> 엔트리 템플릿:
>
> ```
> ## YYYY-MM-DD — <결정 한 줄>
> **맥락**: 어떤 상황이었나
> **결정**: 무엇으로 정했나
> **대안**: 고려했지만 버린 선택지
> **근거**: 왜 이걸 골랐나
> **영향**: 무엇이 바뀌나 / 주의점
> ```

---

## 2026-07-08 — "openfaas" 디렉토리/브랜딩 폐기, `src/api/bbq-telestration` 를 wasm 핸들러 스캐폴드로 통합
**맥락**: 기존에 canonical 스캐폴드 템플릿이 두 개로 나뉘어 있었다 — `src/api/bbq-telestration`(NestJS
라이브러리 스캐폴드, `app.controller.ts`/`app.module.ts`/`index.ts`/`items.service.ts`)과
`src/openfaas/bbq-telestration`(wasm 핸들러 스캐폴드, `src/handler.ts`). 8개 실 프로젝트는 이미 전부
wasm 모델로 전환 완료된 상태였고, `src/api/<name>` 의 NestJS 코드는 wasm 게이트웨이 미들웨어가
요청을 먼저 가로채면서 오래전부터 도달 불가능한 죽은 코드가 되어 있었다.
**결정**: "openfaas" 라는 별도 디렉토리/브랜딩을 없애고, `src/api/bbq-telestration` 하나를 wasm 핸들러
스캐폴드로 통합한다. 이제 신규 프로젝트의 `parts=api` scaffold(`scaffoldFromBbqTelestration`,
`git.service.ts` — 이 함수는 완전히 범용이라 `src/api/bbq-telestration` → `src/api/<name>` 를 그대로
복사할 뿐 코드 변경이 필요 없다)는 자동으로 wasm 핸들러 스타일 프로젝트를 생성하게 된다.
**대안**: `src/api/bbq-telestration`(NestJS)과 `src/openfaas/bbq-telestration`(wasm) 두 디렉토리를 그대로 유지하는
안 — 신규 참여자가 어느 쪽이 최신인지 매번 헷갈리는 혼란만 가중시킬 뿐이라 기각했다.
**근거**: "openfaas" 라는 이름이 실제로는 OpenFaaS(오픈소스 FaaS 게이트웨이)를 전혀 쓰지 않아
(Kata RuntimeClass 로 시도했다가 인프라 제약으로 폐기되고 QuickJS/WASM in-process 실행으로
대체됨) 이름 자체가 오해를 낳고 있었다. 또한 wasm 이 이제 유일한 신규 프로젝트 api 실행 모델이므로
"둘 중 하나를 고르는" 스캐폴드 분기 자체가 불필요해졌다.
**영향**: 옛 `src/api/bbq-telestration` 의 NestJS 스캐폴드 파일들(`app.controller.ts`/`app.module.ts`/
`index.ts`/`items.service.ts`/`tsconfig.lib.json`/`.npmrc`/`.DS_Store`)은 물리적으로 남아있으나
(샌드박스 unlink 제한으로 이 세션에서 삭제 못함 — 로컬 터미널에서 `rm` 필요) 더 이상 scaffold
복사 대상이 아니다. `src/openfaas/` 디렉토리 전체(`bbq-telestration` 포함 9개 프로젝트)도 이제 중복이라
로컬에서 삭제 필요. 이 결정 이후 새로 scaffold 되는 프로젝트는 처음부터 `src/api/<name>/src/handler.ts`
하나만 갖게 된다.


## 2026-10-14 — 브라우저 랜덤 키 + 서버 시계 시간표 + 그림은 별도 조회
wasm handler 는 요청자 신원을 받지 않아 브라우저 랜덤 키로 "나"와 진행자를 구분한다(majority-survival 과 같은 방식).
칸은 시작 시각 + 고정 시간표로 자동 진행하고, 공개만 진행자가 넘긴다. 그림 dataURL 은 커서 1.5초 폴링(state)에 싣지 않고 /task, /book 으로만 내려준다.
