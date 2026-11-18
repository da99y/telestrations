import React from 'react';
import { ForbiddenScreen } from './ForbiddenScreen';
import { useMockingbirdRoles } from './useMockingbirdRoles';

// 화면/라우트 일부만 게이트하는 세분화 버전(앱 전체는 AuthGate 의 requiredPermissions).
// 자체 멤버십(useMockingbirdRoles) 기준 대조. permissions 중 하나라도 있으면 통과(OR).

interface Props {
  permissions: string[];
  children: React.ReactNode;
  // 미통과 시 대체 렌더(기본: 공용 ForbiddenScreen).
  fallback?: React.ReactNode;
}

export function RequirePermission({ permissions, children, fallback }: Props) {
  const { loading, hasAnyRole } = useMockingbirdRoles();

  if (permissions.length === 0) return <>{children}</>;
  if (loading) {
    return (
      <div style={{ padding: 24, color: '#888', fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
        권한 확인 중...
      </div>
    );
  }
  if (!hasAnyRole(permissions)) {
    return <>{fallback ?? <ForbiddenScreen requiredGroups={permissions} />}</>;
  }
  return <>{children}</>;
}
