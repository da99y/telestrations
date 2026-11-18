/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  // 로컬 개발에서만 AuthGate 를 건너뛰는 스위치(main.tsx 참고) — `.env.local` 에만 넣는다.
  // `import.meta.env.DEV` 와 함께 검사되므로 배포 산출물에는 영향 없다.
  readonly VITE_SKIP_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
