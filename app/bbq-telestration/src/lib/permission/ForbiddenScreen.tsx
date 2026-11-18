import { AccessRequestButton } from './AccessRequestButton';

// 공용 접근 불가 안내 화면. 접근 요청 버튼을 기본 렌더한다.

interface Props {
  // 이 화면을 열기 위해 필요한 권한그룹(있으면 첫 번째를 요청에 실어 보낸다).
  requiredGroups?: string[];
}

export function ForbiddenScreen({ requiredGroups }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        textAlign: 'center',
        padding: 24,
        background: '#0f1115',
        color: '#e8e9eb',
        fontFamily: '-apple-system, "Apple SD Gothic Neo", sans-serif',
      }}
    >
      <div style={{ fontSize: 36 }}>🔒</div>
      <div style={{ fontSize: 17, fontWeight: 700 }}>접근 권한이 없습니다</div>
      <div style={{ fontSize: 13, color: '#8b93a5', maxWidth: 380, lineHeight: 1.6 }}>
        이 화면을 보려면 필요한 권한이 없어요. 아래에서 접근을 요청하면 관리자 승인 후 자동으로
        반영돼요.
        {requiredGroups && requiredGroups.length > 0 && (
          <>
            <br />
            필요 권한: <code style={{ color: '#c6c9d2' }}>{requiredGroups.join(', ')}</code>
          </>
        )}
      </div>
      <AccessRequestButton permissionGroup={requiredGroups?.[0]} />
    </div>
  );
}
