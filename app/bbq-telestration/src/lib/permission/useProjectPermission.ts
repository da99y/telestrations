import { useEffect, useState } from 'react';
import { useUser } from '../internal-common-bff';
import { permissionFetch, PROJECT_NAME } from './permissionApi';

// 서버 등록 권한 게이트 런타임 판정 — `GET /projects/:name/access-check?email=&scope=` 가
// 게이트(project_permissions) + 자체 멤버십(permission_group_members)을 한 번에 판정해
// 돌려준다. 등록은 mcp `set_permission` 또는 `POST /projects/:name/permissions`.
//
// 조회 실패/미등록은 fail-open(열림) — 권한 서비스 장애로 앱 전체가 잠기지 않게 하려는
// 결정이다(scope 생략 시 앱 전체 기본 scope 판정).

export interface ProjectPermissionState {
  loading: boolean;
  gated: boolean;
  allowed: boolean;
  requiredGroups: string[];
}

export function useProjectPermission(scope?: string): ProjectPermissionState {
  const { user } = useUser();
  const email = user?.email ?? '';
  const [state, setState] = useState<ProjectPermissionState>({
    loading: true,
    gated: false,
    allowed: true,
    requiredGroups: [],
  });

  useEffect(() => {
    if (!email) return;
    let mounted = true;
    const qs = `email=${encodeURIComponent(email)}${scope ? `&scope=${encodeURIComponent(scope)}` : ''}`;
    permissionFetch<{ gated: boolean; allowed: boolean; requiredGroups: string[] }>(
      `/projects/${encodeURIComponent(PROJECT_NAME)}/access-check?${qs}`,
    )
      .then((b) => {
        if (mounted)
          setState({ loading: false, gated: !!b.gated, allowed: !!b.allowed, requiredGroups: b.requiredGroups ?? [] });
      })
      .catch(() => {
        // fail-open — 위 주석 참고.
        if (mounted) setState({ loading: false, gated: false, allowed: true, requiredGroups: [] });
      });
    return () => {
      mounted = false;
    };
  }, [email, scope]);

  return state;
}
