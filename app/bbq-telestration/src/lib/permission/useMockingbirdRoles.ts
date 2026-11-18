import { useEffect, useState } from 'react';
import { useUser } from '../internal-common-bff';
import { permissionFetch } from './permissionApi';

// internal-common-bff 의 useRoles('permissionGroupName') 대응 — 자체 멤버십 버전.
// BFF 세션의 email 로 mockingbird root 의 `GET /projects/my-roles?email=` 를 조회해 내가
// 속한 권한그룹 이름 목록을 받는다. 멤버십은 AMS 승인(또는 owner 수동 부여)으로 만들어진다
// — portal 관리 모달 참고.

export interface MockingbirdRolesState {
  loading: boolean;
  roles: string[];
  hasRole: (name: string) => boolean;
  hasAnyRole: (names: string[]) => boolean;
}

export function useMockingbirdRoles(): MockingbirdRolesState {
  const { user } = useUser();
  const email = user?.email ?? '';
  const [state, setState] = useState<{ loading: boolean; roles: string[] }>({ loading: true, roles: [] });

  useEffect(() => {
    if (!email) return; // AuthGate 가 먼저 로그인을 보장 — email 없으면 대기.
    let mounted = true;
    permissionFetch<{ roles: string[] }>(`/projects/my-roles?email=${encodeURIComponent(email)}`)
      .then((b) => {
        if (mounted) setState({ loading: false, roles: b.roles ?? [] });
      })
      .catch(() => {
        // 조회 실패 = 빈 목록(fail-open 여부는 호출부의 권한 정책이 결정).
        if (mounted) setState({ loading: false, roles: [] });
      });
    return () => {
      mounted = false;
    };
  }, [email]);

  return {
    loading: state.loading,
    roles: state.roles,
    hasRole: (name) => state.roles.includes(name),
    hasAnyRole: (names) => names.some((n) => state.roles.includes(n)),
  };
}
