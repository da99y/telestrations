// API 게이트웨이가 403(access_denied)으로 막았을 때 화면 어디서든(어느 컴포넌트가 그
// apiClient 호출을 했는지 몰라도) 넛지를 띄울 수 있게 하는 아주 작은 pub/sub.
//
// 왜 필요한가(2026-08-10, 사용자 요청 — "api가 막히면 어떻게 진행이돼? 막혔다는 넛지와 권한
// 요청이 필요할텐데") — 화면 자체는 정상 렌더링됐는데(화면 단위 게이트를 통과했거나 그 화면엔
// 게이트가 없거나) 그 화면이 호출하는 특정 API 경로에만 스코프 게이트가 걸려 있으면, 기존
// apiClient.ts 는 그냥 ApiError 를 던지고 끝이었다 — 화면마다 매번 catch 해서 안내 UI를 새로
// 만들어야 했다. 대신 apiClient.ts 가 이 버스로 이벤트를 쏘고, 앱에 한 번만 마운트해두는
// <AccessDeniedToast/>(같은 폴더) 가 구독해서 자동으로 넛지+접근 요청 버튼을 띄운다 — 화면
// 코드는 아무것도 안 해도 된다(단, 필요하면 여전히 개별 catch 로 커스텀 UI 를 만들 수 있다 —
// ApiError 에도 같은 정보가 실려 있다, apiClient.ts 참고).

export interface AccessDeniedEvent {
  project: string;
  scope: string;
  requiredGroups: string[];
  path: string; // 어떤 API 요청이 막혔는지(디버깅/표시용)
  at: number;
}

type Listener = (event: AccessDeniedEvent) => void;

const listeners = new Set<Listener>();

export function onAccessDenied(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyAccessDenied(event: AccessDeniedEvent): void {
  for (const listener of listeners) listener(event);
}
