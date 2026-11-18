import React from 'react';

import { ForbiddenScreen } from './ForbiddenScreen';
import { useProjectPermission } from './useProjectPermission';

// 라우트/화면 단위 반자동 게이트 — 화면을 이 컴포넌트로 감싸고 scope 이름만 넘기면, 관리
// 화면에서 그 scope 로 권한을 등록/해제하는 즉시(코드 재배포 없이) 적용된다.
//
// 왜 필요한가: AuthGate(../../AuthGate.tsx) 의 useProjectPermission() 은 scope 없이
// 호출돼 앱 전체 단위(서버 기본 scope)만 판정한다. 여러 화면/라우트가 있는 앱에서 화면별로
// 다른 권한을 걸려면, 그 화면을 감싸는 지점에서 scope 를 지정해 따로 조회해야 한다 —
// 관리 화면에서 특정 화면에 제한을 걸었는데 코드가 그 scope 를 아무 데서도 조회하지 않으면
// 등록 자체가 아무 효과도 내지 못한다(실제 사례: mockingbird-showcase `.context/journal.md`
// 2026-08-04 — `/#/ask` 를 관리 화면에서 막았지만 코드에 배선이 없어 그대로 뚫려 있었다).
//
// 쓰는 법: 라우트 분기가 있는 화면(App.tsx 등)에서 각 화면을 이걸로 감싸고, scope 이름은
// 그 화면의 경로 그대로 `/` 를 붙인 문자열로 정한다(예: 해시 라우트 `#/ask` → scope `/ask`).
// 관리 화면에서 등록할 때 이 표기와 정확히 일치해야 한다 — 다르면 미등록으로 간주돼 기존
// 정책대로 fail-open(통과) 된다. 화면이 하나뿐인 앱(이 bbq-telestration 템플릿처럼)은 이 컴포넌트
// 없이 AuthGate 만으로 충분하다 — 화면을 나누게 되면 이걸 꺼내 쓴다.
interface Props {
  scope: string;
  children: React.ReactNode;
}

export function RouteGate({ scope, children }: Props) {
  const { loading, gated, allowed, requiredGroups } = useProjectPermission(scope);

  // 권한 확인이 끝나기 전에는 콘텐츠를 렌더하지 않는다(AuthGate 와 동일한 체크-후-렌더 원칙).
  if (loading) {
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
        권한 확인 중...
      </div>
    );
  }
  if (gated && !allowed) {
    return <ForbiddenScreen requiredGroups={requiredGroups} />;
  }
  return <>{children}</>;
}
