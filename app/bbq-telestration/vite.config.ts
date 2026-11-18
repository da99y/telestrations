import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 디렉터리 이름 = projectName = CloudFront 하위 경로
const projectName = basename(dirname(fileURLToPath(import.meta.url)));

// API_TARGET=beta 면 beta 도메인으로, 그 외엔 로컬 projects API(:4001)로 프록시한다.
// 사용처: pnpm dev (local) / pnpm dev:beta (beta)
const apiProxyTarget =
  process.env.API_TARGET === 'beta'
    ? {
        target: 'https://mockingbird-platform-api.betawoowa.in',
        changeOrigin: true,
        secure: true,
      }
    : 'http://localhost:4001';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'standalone' ? '/' : `/app/${projectName}/`,
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    // mockingbird-local.betawoowa.in 같은 사내 hosts 매핑(127.0.0.1) 로 접속할 수 있도록
    // 모든 인터페이스에서 listen + 임의 호스트 허용. (Vite 5 기본은 localhost 만.)
    host: true,
    allowedHosts: ['mockingbird-local.betawoowa.in', '.betawoowa.in', 'localhost', '127.0.0.1', '.ngrok-free.dev', '.ngrok-free.app'],
    // 로컬 dev: 프론트(:5173) → projects API(:4001) 프록시. /api/bbq-telestration/* 로 도달한다.
    proxy: {
      '/api': apiProxyTarget,
    },
  },
}));
// force rebuild 1780932281
