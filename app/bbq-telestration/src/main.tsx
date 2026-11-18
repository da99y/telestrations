import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthGate } from './AuthGate';
import { AccessDeniedToast } from './lib/permission/AccessDeniedToast';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

// 로컬 개발에서만 AuthGate 를 건너뛸 수 있는 옵션(2026-08-03, 사용자 요청) — Windows 는 회사
// 지급 PC 라 로컬 관리자 권한이 없어 `mockingbird-local.betawoowa.in` hosts 매핑을 못 하는
// 경우가 흔하고, 그 도메인 없이는 BFF 로그인 리다이렉트가 정상 동작하지 않는다(§CLAUDE.md
// 2.3/4.5 — 지금까지는 이 문서가 "그때는 <AuthGate> 래퍼를 직접 지우고 확인하라"고 안내했다).
// 이 스위치는 그 수동 삭제를 프로젝트 루트의 `.env.local`(git 추적 안 됨, 개인 로컬 설정)
// 한 줄로 대체한다: `VITE_SKIP_AUTH=true`.
//
// ⚠️ `import.meta.env.DEV` 가드가 핵심 안전장치다 — vite 는 빌드 시점에 이 값을 정적으로
// `false` 로 치환해 아래 삼항식의 `skipAuthInDev` 분기 자체를 죽은 코드로 제거한다. 즉
// `VITE_SKIP_AUTH` 가 어떤 값이든(실수로 `.env.beta` 등 커밋되는 파일에 들어가도) **배포
// 산출물(`vite build --mode beta`)에는 이 우회가 절대 섞여 들어갈 수 없다** — 로컬 dev
// 서버(`pnpm dev`)에서만 의미가 있다.
const skipAuthInDev = import.meta.env.VITE_SKIP_AUTH === 'true';

createRoot(root).render(
  <React.StrictMode>
    {skipAuthInDev ? (
      <App />
    ) : (
      <AuthGate>
        <App />
      </AuthGate>
    )}
    {/* API 403(access_denied) 넛지 — 어느 화면에서 호출했든 자동으로 뜬다(2026-08-10).
        AuthGate 안이 아니라 형제로 둔다 — AuthGate 가 로그인 확인 중 App 을 안 그려도
        토스트 자체는(로그인 이후에나 발생할 이벤트라 실질적 영향 없음) 항상 마운트돼 있게. */}
    <AccessDeniedToast />
  </React.StrictMode>,
);
