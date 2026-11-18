// 정적 자산 URL 헬퍼.
//
// Vite 의 `import.meta.env.BASE_URL`(= vite.config 의 `base: /<projectName>/`) 을 prefix 로 붙여
// 빌드/배포된 자산 경로(`/<projectName>/...`)를 만든다. 앞에 `/` 가 있어도 중복되지 않도록 정규화.
//
// 사용 예: assetUrl('logo.png') → '/bbq-telestration/logo.png' (base=/bbq-telestration/)
//          assetUrl('/icons/x.svg') → '/bbq-telestration/icons/x.svg'

export function assetUrl(path: string): string {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${import.meta.env.BASE_URL}${normalized}`;
}
