import { useState } from 'react';
import { useUser } from '../internal-common-bff';
import { permissionFetch, PROJECT_NAME } from './permissionApi';

// 접근 요청 버튼("구글 드라이브식"). 제출하면 서버가 즉시 AMS(승인관리시스템) 승인
// 요청서를 만들고(owner 가 승인자), 승인되면 자체 멤버십 DB 에 자동 반영된다 — 새로고침하면
// 접근 가능.

interface Props {
  permissionGroup?: string; // 생략 시 서버가 표준 이름(app-<name> 등)으로 채운다.
  reason?: string;
  // 어느 scope 를 향한 요청인지(예: '/admin') — 생략하면 서버가 '_root'(앱 전체)로 본다.
  // scope 를 정확히 넘겨야 승인 시 그 scope 에 실제 등록된 권한그룹으로 부여된다(2026-08-10 —
  // scope 없이 제출하면 항상 '_root' 취급돼, API 경로별로 다른 scope 를 쓰는 게이트에 대한
  // 요청이 잘못된 scope 로 기록될 수 있다. §CLAUDE.md 3.7 / access-requests.service.ts 참고).
  scope?: string;
}

export function AccessRequestButton({ permissionGroup, reason, scope }: Props) {
  const { user } = useUser();
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (!user?.email) return null;

  const submit = () => {
    setPhase('sending');
    setMessage('');
    permissionFetch<{ request?: { amsRequestId?: string | null } }>(
      `/projects/${encodeURIComponent(PROJECT_NAME)}/access-requests`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          username: user.username,
          displayName: user.displayUsername,
          permissionGroup: permissionGroup || undefined,
          scope: scope || undefined,
          reason: reason || undefined,
        }),
      },
    )
      .then((b) => {
        setPhase('sent');
        setMessage(
          b.request?.amsRequestId
            ? '요청을 보냈어요 — 관리자가 승인관리시스템(AMS)에서 승인하면 자동 반영돼요.'
            : '요청을 보냈어요 — 관리자(owner)가 승인하면 반영돼요.',
        );
      })
      .catch((err: Error) => {
        setPhase('error');
        setMessage(`요청 실패: ${err.message}`);
      });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        disabled={phase === 'sending' || phase === 'sent'}
        onClick={submit}
        style={{
          padding: '9px 18px',
          background: '#6d5bff',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          cursor: phase === 'sent' ? 'default' : 'pointer',
          opacity: phase === 'sending' ? 0.7 : 1,
        }}
      >
        {phase === 'sent' ? '요청 완료 ✓' : phase === 'sending' ? '요청 보내는 중…' : '접근 요청 보내기'}
      </button>
      {message && <span style={{ fontSize: 12.5, color: '#8b93a5' }}>{message}</span>}
    </div>
  );
}
