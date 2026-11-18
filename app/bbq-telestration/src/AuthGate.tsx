import React from 'react';

import { useSession, useUser } from './lib/internal-common-bff';
import { ForbiddenScreen } from './lib/permission/ForbiddenScreen';
import { useMockingbirdRoles } from './lib/permission/useMockingbirdRoles';
import { useProjectPermission } from './lib/permission/useProjectPermission';

// 로컬 dev 는 http (해당 host 에 https 인증서 미발급). 빌드는 https.
const BFF_HOST = !import.meta.env.DEV
  ? 'https://mockingbird.admin-bff.betawoowa.in'
  : 'http://mockingbird.admin-bff.betawoowa.in';

interface Props {
  children: React.ReactNode;
  // 앱 전체를 이 권한그룹 중 하나라도 있어야 통과(OR)시키는 정적 게이트(코드 하드코딩).
  // 자체 멤버십(mockingbird DB, useMockingbirdRoles) 기준으로 대조한다.
  requiredPermissions?: string[];
}

/**
 * 진입점에서 BFF 세션 확인 후 children 을 렌더한다.
 * 미인증(401) → BFF 로그인 페이지로 즉시 리다이렉트.
 * 권한 없음(403/유저 error) → BFF 가 안내하는 redirectUrl 로 이동.
 *
 * 접근 권한(로그인 이후):
 *  1. 서버 등록 게이트 — useProjectPermission() 이 GET /projects/:name/access-check 로
 *     판정(등록은 mcp set_permission 또는 POST /projects/:name/permissions). 코드 재배포
 *     없이 즉시 적용, 미등록/조회실패는 fail-open.
 *  2. requiredPermissions prop(정적) — 자체 멤버십 목록(useMockingbirdRoles)과 대조.
 *  둘 다 있으면 AND(더 엄격한 쪽이 이김).
 *
 * 화면 일부만 막고 싶으면 앱 전체를 감싸는 이 컴포넌트 대신 화면 안에서
 * ./lib/permission/RequirePermission(정적) 이나 ./lib/permission/RouteGate(서버 등록,
 * scope 지정 — 화면/라우트가 여러 개인 앱에서 씀) 를 쓴다. 자세한 배선 방법은 그 두 파일의
 * 주석 참고.
 */
export function AuthGate({ children, requiredPermissions }: Props) {
  useSession(BFF_HOST, {
    onUnauthorized: (loginUrl) => {
      window.location.href = loginUrl;
    },
    onForbidden: (redirectUrl) => {
      window.location.href = redirectUrl;
    },
  });
  const { user } = useUser();
  const registry = useProjectPermission();
  const roles = useMockingbirdRoles();

  const needStatic = !!requiredPermissions && requiredPermissions.length > 0;

  if (!user) {
    return <Splash label="인증 확인 중..." />;
  }
  // 권한 확인이 끝나기 전에는 콘텐츠를 렌더하지 않는다(체크-후-렌더).
  if (registry.loading || (needStatic && roles.loading)) {
    return <Splash label="권한 확인 중..." />;
  }
  if (registry.gated && !registry.allowed) {
    return <ForbiddenScreen requiredGroups={registry.requiredGroups} />;
  }
  if (needStatic && !roles.hasAnyRole(requiredPermissions!)) {
    return <ForbiddenScreen requiredGroups={requiredPermissions} />;
  }

  return <>{children}</>;
}

function Splash({ label }: { label: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {label}
    </div>
  );
}
