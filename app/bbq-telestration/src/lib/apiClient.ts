// 공통 API 클라이언트 — named clients 패턴.
//
// 한 앱이 여러 백엔드(서로 다른 호스트)를 호출할 수 있으므로 baseURL 을 호출처마다 분리한다.
// 각 named client 는 `createClient({ baseURL })` 로 생성. baseURL 은 `.env.*` 의 VITE_*_BASE 가 결정.
//
// - 로컬 dev: env 비우면 baseURL='' → 상대경로 → Vite proxy(/api → :4001) 가 same-origin 으로 받아준다.
// - 베타 빌드: `.env.beta` 의 VITE_API_BASE 가 admin-bff 절대 URL(`https://mockingbird.admin-bff.
//   betawoowa.in`)로 주입돼 번들에 박힌다 — projects API(`mockingbird-platform-api.betawoowa.in`)
//   를 직접 호출하지 않는다. BFF 가 `/api` 요청을 내부적으로 projects API 로 프록시한다.
//   그래서 모든 요청에 `credentials: 'include'`(아래 request())를 걸어 세션 쿠키를 BFF 로
//   forward 해야 한다 — 없으면 BFF 가 세션을 못 읽어 인증이 깨진다.
//
// 이 앱은 mockingbird projects API 한 곳만 쓰므로 `projectsApi` 하나만 export.
// 여러 백엔드를 쓰는 앱은 (tech-div 처럼) 호출처마다 named client 를 추가한다.
//
// ⭐ 2026-08-10 — 모든 요청에 `X-Mockingbird-App` 헤더로 이 App 자신의 프로젝트 이름을 싣는다.
// projects 게이트웨이(WasmGatewayMiddleware)가 "이 API 를 그 API 의 App 자신이 호출했는지"를
// 판정하는 데 쓴다(`WASM_GATEWAY_APP_IDENTITY_MODE`, 기본 off — 트레이드오프/롤아웃 방식은
// projects 쪽 `.context/decisions.md` "2026-08-10" 참고). vite base(/app/<name>/)에서 파생 —
// 하드코딩 금지, base 변경 시 자동 추종(lib/permission/permissionApi.ts 의 PROJECT_NAME 과
// 동일한 파생 방식).
//
// ⭐ 2026-08-10 — 로그인돼 있으면 `Authorization: Bearer <mockingbird 토큰>` 도 함께 싣는다.
// projects 게이트웨이가 이 토큰을 root 에 재검증해 진짜 email 을 얻고 access-check(§CLAUDE.md
// 3.6)를 돌리는 데 쓴다(`WASM_GATEWAY_USER_ACCESS_MODE`, 기본 off). 토큰 발급/캐시는
// `lib/permission/apiToken.ts` — 로그인 전이거나 발급 실패면 헤더 없이 요청하고, 게이트웨이가
// off/warn 모드면 그래도 통과한다(enforce 모드에서만 막힘).

import { getApiToken } from './permission/apiToken';
import { notifyAccessDenied } from './permission/accessDeniedBus';

const CALLER_APP_NAME: string = (() => {
  const m = /^\/app\/([^/]+)\//.exec(import.meta.env.BASE_URL);
  return m ? m[1] : 'bbq-telestration';
})();

export interface ApiClientOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

// 게이트웨이가 access_denied 로 막았을 때 응답 body 에 함께 실어보내는 정보
// (wasm-gateway.middleware.ts 의 rejectOrWarn `extra` 참고, 2026-08-10). 다른 실패(500 등)
// 응답엔 이 필드들이 없다 — `code === 'access_denied'` 로만 판별한다.
interface AccessDeniedBody {
  ok: false;
  error: string;
  code: 'access_denied';
  project: string;
  scope: string;
  requiredGroups: string[];
}

function isAccessDeniedBody(v: unknown): v is AccessDeniedBody {
  return !!v && typeof v === 'object' && (v as { code?: unknown }).code === 'access_denied';
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
    // 아래 3개는 access_denied 응답일 때만 채워진다 — 화면이 직접 catch 해서 커스텀 UI를
    // 만들고 싶을 때 쓴다(자동 넛지는 <AccessDeniedToast/> 가 별도로 처리, 2026-08-10).
    public readonly code?: string,
    public readonly scope?: string,
    public readonly requiredGroups?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClient {
  readonly baseUrl: string;
  get<T>(path: string, options?: ApiClientOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: ApiClientOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: ApiClientOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: ApiClientOptions): Promise<T>;
  delete<T>(path: string, options?: ApiClientOptions): Promise<T>;
}

export function createClient(config: { baseURL: string | undefined }): ApiClient {
  const baseUrl = (config.baseURL ?? '').replace(/\/$/, '');

  async function request<T>(path: string, options: ApiClientOptions = {}): Promise<T> {
    const { body, headers, ...rest } = options;
    const token = await getApiToken();
    const init: RequestInit = {
      credentials: 'include',
      ...rest,
      headers: {
        ...headers,
        'X-Mockingbird-App': CALLER_APP_NAME,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    if (body !== undefined) {
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
      init.headers = { 'content-type': 'application/json', ...init.headers };
    }

    const res = await fetch(`${baseUrl}${path}`, init);
    const contentType = res.headers.get('content-type') ?? '';
    const parsed: unknown = contentType.includes('application/json')
      ? await res.json().catch(() => undefined)
      : await res.text().catch(() => undefined);

    if (!res.ok) {
      if (res.status === 403 && isAccessDeniedBody(parsed)) {
        // 화면이 아무것도 안 해도 넛지가 뜨게 한다(전역 버스) — 개별 catch 로 커스텀 UI를
        // 만들고 싶은 화면은 아래 throw 되는 ApiError 의 code/scope/requiredGroups 를 쓰면 된다.
        notifyAccessDenied({
          project: parsed.project,
          scope: parsed.scope,
          requiredGroups: parsed.requiredGroups,
          path,
          at: Date.now(),
        });
        throw new ApiError(
          res.status,
          parsed.error || `${rest.method ?? 'GET'} ${path} 실패: ${res.status}`,
          parsed,
          parsed.code,
          parsed.scope,
          parsed.requiredGroups,
        );
      }
      throw new ApiError(res.status, `${rest.method ?? 'GET'} ${path} 실패: ${res.status}`, parsed);
    }
    return parsed as T;
  }

  return {
    baseUrl,
    get: <T>(path: string, options?: ApiClientOptions) => request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, body?: unknown, options?: ApiClientOptions) =>
      request<T>(path, { ...options, method: 'POST', body }),
    put: <T>(path: string, body?: unknown, options?: ApiClientOptions) =>
      request<T>(path, { ...options, method: 'PUT', body }),
    patch: <T>(path: string, body?: unknown, options?: ApiClientOptions) =>
      request<T>(path, { ...options, method: 'PATCH', body }),
    delete: <T>(path: string, options?: ApiClientOptions) => request<T>(path, { ...options, method: 'DELETE' }),
  };
}

// ── named clients ──────────────────────────────────────────────────────────
// mockingbird projects API (이 모노레포의 `src/api/<name>` 들이 마운트되는 호스트)
export const projectsApi = createClient({ baseURL: import.meta.env.VITE_API_BASE });

// 후방호환: 기존 `import { apiClient }` 사용처용. 신규 코드는 named client 사용 권장.
export const apiClient = projectsApi;
