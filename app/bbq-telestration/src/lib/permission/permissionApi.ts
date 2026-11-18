// 권한 런타임 공용 헬퍼 — 사내 백오피스 인증권한(auth-admin) 대신, 권한그룹 멤버십의
// 진실은 mockingbird root DB(permission_group_members)가 소유한다. 로그인 자체는 여전히
// internal-common-bff(AD 로그인) — 그 세션의 email 을 신원으로 삼아 root 의 공개
// 엔드포인트로 권한을 조회한다(useRoles 유사 모델).
//
// 호출 경로:
//  - 배포: admin-bff 경유(https://mockingbird.admin-bff.betawoowa.in — /projects 는 BFF
//    프록시 allowlist 에 이미 등록됨, 세션 쿠키 forward 때문에 credentials:'include')
//  - 로컬 dev: root API 직접(http://localhost:4000 — root CORS allowlist 에 localhost 포함).
//    root 를 안 띄우고 개발하면 조회 실패 → fail-open(열림)이라 개발이 막히지 않는다.

export const PERMISSION_API_BASE = import.meta.env.DEV
  ? 'http://localhost:4000'
  : 'https://mockingbird.admin-bff.betawoowa.in';

// 프로젝트 이름은 vite base(/app/<name>/)에서 파생 — 하드코딩 금지(base 변경 시 자동 추종).
export const PROJECT_NAME: string = (() => {
  const m = /^\/app\/([^/]+)\//.exec(import.meta.env.BASE_URL);
  return m ? m[1] : 'bbq-telestration';
})();

export async function permissionFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PERMISSION_API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body;
}
