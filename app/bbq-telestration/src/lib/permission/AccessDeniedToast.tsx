import { useEffect, useState } from 'react';
import { AccessRequestButton } from './AccessRequestButton';
import { onAccessDenied, type AccessDeniedEvent } from './accessDeniedBus';

// API 가 403(access_denied)으로 막히면 화면 어디서든 자동으로 뜨는 넛지(2026-08-10, 사용자
// 요청 — "api가 막히면 어떻게 진행이돼? 막혔다는 넛지와 권한 요청이 필요할텐데"). `main.tsx`
// 에 한 번만 마운트해두면 끝 — 개별 화면이 apiClient 호출을 catch 할 필요가 없다
// (accessDeniedBus.ts 참고, apiClient.ts 가 403 응답을 감지해 이 버스로 이벤트를 쏜다).
//
// 같은 scope 로 반복 차단되면(예: 화면이 재시도하는 경우) 매번 새 토스트를 쌓지 않고 기존
// 토스트의 타임스탬프만 갱신한다 — 스팸 방지.

export function AccessDeniedToast() {
  const [event, setEvent] = useState<AccessDeniedEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    return onAccessDenied((next) => {
      setEvent(next);
      setDismissed(false);
    });
  }, []);

  if (!event || dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 9999,
        maxWidth: 340,
        background: '#1a1c22',
        color: '#e8e9eb',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        fontFamily: '-apple-system, "Apple SD Gothic Neo", sans-serif',
      }}
      role="alert"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🔒</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>API 접근이 거부됐어요</div>
          <div style={{ fontSize: 12, color: '#a5abb8', marginTop: 4, lineHeight: 1.5 }}>
            {event.scope === '_root' ? '이 앱 전체' : <code>{event.scope}</code>}에 접근할 권한이
            없어서 요청이 막혔어요.
            {event.requiredGroups.length > 0 && (
              <>
                {' '}
                필요 권한: <code>{event.requiredGroups.join(', ')}</code>
              </>
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            <AccessRequestButton scope={event.scope} permissionGroup={event.requiredGroups[0]} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="닫기"
          style={{
            background: 'none',
            border: 'none',
            color: '#a5abb8',
            fontSize: 14,
            cursor: 'pointer',
            padding: 2,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
