# api-bbq-telestration — 현재 상태

> 작업 끝낼 때 이 파일을 "지금 사실"에 맞게 갱신한다. 오래된 내용은 지운다.
> 최종 갱신: 2026-10-15 / jessi.kim (Claude Code)

## 한 줄 요약
`src/handler.ts` wasm 함수 하나로 텔레스트레이션 판·참가자·칸(entries)·망작 투표를 처리한다.
칸 진행과 제출 마감은 서버 시계로 판정한다. 제시어(하 230·중 158·상 109, 약 80% 음식·배민·B마트)도 여기 있다. 진행자가 판을 열 때 난이도를 고르고, `used` 테이블로 다 쓸 때까지 같은 단계 제시어가 겹치지 않는다.

## 규칙
- 스케치북 b 의 k 칸(1부터) = 자리 (b + k - 1) % N. 홀수 칸 그리기, 짝수 칸 추측.
- 칸 시간 = 그리기 d_sec / 추측 g_sec + 넘김 3초(이 동안 늦은 제출도 받는다).
- 망작 표: 1인 3표, 내 칸 제외, 공개된 스케치북만. 표 빼기는 soft delete(deleted_at).
- 결과: 받은 표 내림차순, 동점은 hash(gameId:playerId) 추첨.

## 엔드포인트
- `GET /state?key=` · `POST /join` · `GET /task?key=` · `POST /submit {key,step,content}`
- `GET /book?idx=` · `POST /vote {key,entryId,on}`
- 진행자: `POST /host/claim|new|start|show {idx}|finish|cancel`

## 테이블 (MCP create_table, 정의는 tables.local.json — 베타는 deleted_at 자동 추가)
- `bbq_telestration__matches` / `__seats`(seat) / `__pages`(content: 그림 dataURL 또는 추측) / `__marks2` / `__openers` / `__hosts` / `__presence` / `__used`(나온 제시어)

## 검증
- 로컬 `pnpm dev:server`(PGlite)로 claim→new→join→start→task→submit(마감·형식 거부)→show→book→vote(본인·한도·취소)→finish 흐름 curl 확인.
