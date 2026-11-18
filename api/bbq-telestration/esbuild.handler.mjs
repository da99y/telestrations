// wasm 샌드박스 규약 번들러 — src/handler.ts 를 IIFE 로 번들해 `globalThis.handle` 로 노출한다.
// src/main.ts(Kata/of-watchdog 용, esbuild.mjs)와는 별개 산출물이다.
// root 의 OpenfaasService.deployWasm() 이 배포 시 이 로직을 in-memory 로 그대로 재현하므로,
// 이 스크립트는 로컬에서 "배포되면 어떤 코드가 실제로 샌드박스에 들어가는지" 미리 보는 용도다
// (wasm-local-test.mjs 가 이 산출물을 QuickJS 로 직접 실행해 로컬 검증까지 해준다).
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));

const result = await build({
  entryPoints: [path.join(dir, 'src/handler.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: '__mod__',
  // Node 내장 모듈(fs/net/http/process 등)을 쓰면 여기서 번들 에러가 난다 — 의도된 방어.
  // QuickJS 샌드박스에는 그런 API 자체가 없기 때문에, 배포 전에 로컬에서 걸러내는 게 낫다.
  platform: 'neutral',
  target: 'es2020',
  minify: true,
  footer: {
    js: 'globalThis.handle = (typeof __mod__ !== "undefined" && (__mod__.handle || __mod__.default)) || undefined;',
  },
  logLevel: 'info',
});

const code = result.outputFiles[0].text;
const outPath = path.join(dir, 'dist/handler.bundle.js');
await import('node:fs').then((fs) => fs.promises.mkdir(path.dirname(outPath), { recursive: true }));
await import('node:fs').then((fs) => fs.promises.writeFile(outPath, code));

// eslint-disable-next-line no-console
console.log(`[esbuild] bundled -> dist/handler.bundle.js (${Buffer.byteLength(code, 'utf8')} bytes)`);
