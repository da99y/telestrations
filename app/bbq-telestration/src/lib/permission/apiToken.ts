// projects API 호출에 실을 Mockingbird Bearer 토큰 관리 — 실사용자 단위 접근 제어(2026-08-10,
// 사용자 요청 "wst 기준으로도 검증할 수 없을까?")의 클라이언트 축.
//
// root 의 `POST /auth/token`(portal "토큰 발급" 버튼과 동일한 엔드포인트, §CLAUDE.md 7.4)을
// 이 App 이 조용히 호출해 토큰을 얻는다 — 이미 BFF 세션에서 받은 wst/email(useUser())을 그대로
// 넘기면 root 가 검증(또는 이 환경의 알려진 폴백대로 프론트 신고를 신뢰)한 뒤 서버 세션
// (`api_tokens` 테이블)에 묶인 불투명 토큰을 발급한다. 이후 projects 게이트웨이가
// `Authorization: Bearer` 로 받은 이 토큰을 root 의 `GET /auth/me` 로 **재검증**해 진짜 email
// 을 얻는다(`WASM_GATEWAY_USER_ACCESS_MODE`, 기본 off — 상세는
// `src/api/projects/.context/decisions.md` "2026-08-10 (2)").
//
// 세션은 useUser()가 localStorage(`session` 키)에 저장한다 — 이 모듈은 React 훅 체인을 타지
// 않고 그 storage 를 직접 읽어 완전히 독립적으로 동작한다(apiClient.ts 는 컴포넌트가 아니라
// 평범한 모듈이라 훅을 쓸 수 없다).

const SESSION_KEY = 'session';

const ROOT_API_BASE = import.meta.env.DEV
  ? 'http://localhost:4000'
  : 'https://mockingbird-platform-rootapi.betawoowa.in';

interface StoredSession {
  wst?: string;
  email?: string;
  username?: string;
  displayUsername?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

// 만료 5분 전부터는 이미 만료된 것으로 간주해 재발급을 유도한다(경계값에서 401 을 맞고서야
// 재발급하는 왕복을 줄인다).
const EXPIRY_SKEW_MS = 5 * 60 * 1000;

let cached: CachedToken | null = null;
let inFlight: Promise<string | null> | null = null;

function readSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

async function requestToken(session: StoredSession): Promise<string | null> {
  try {
    const res = await fetch(`${ROOT_API_BASE}/auth/token`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        wst: session.wst,
        email: session.email,
        username: session.username,
        displayName: session.displayUsername,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; token?: string; expiresAt?: string }
      | null;
    if (!body?.ok || !body.token) return null;
    cached = {
      token: body.token,
      expiresAt: body.expiresAt ? Date.parse(body.expiresAt) : Date.now() + 24 * 60 * 60 * 1000,
    };
    return cached.token;
  } catch {
    return null; // 네트워크 실패 — 호출부(apiClient)는 Authorization 헤더 없이 요청을 진행한다.
  }
}

// 캐시된 토큰이 있으면 그대로, 없거나 곧 만료면 root 에서 새로 발급받는다. 로그인 전이면(wst
// 없음) null — apiClient 가 Authorization 헤더 없이 요청하고, 게이트웨이가 off/warn 모드면
// 그래도 통과한다(enforce 모드에서만 401).
export async function getApiToken(): Promise<string | null> {
  if (cached && cached.expiresAt - EXPIRY_SKEW_MS > Date.now()) return cached.token;

  const session = readSession();
  if (!session?.wst || !session?.email) return null;

  if (inFlight) return inFlight;
  inFlight = requestToken(session).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

// 로그아웃 등으로 세션이 바뀌었을 때 강제로 재발급을 유도하려면 호출한다.
export function clearApiToken(): void {
  cached = null;
}
