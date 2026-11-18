// 로컬 wasm 샌드박스 실행기 — src/api/projects/src/openfaas-gateway/wasm-sandbox-runtime.service.ts
// 의 실행 모델(QuickJS + capability injection)을 그대로 축소 재현한 로컬 테스트 도구.
// projects 호스트/실제 Postgres 없이 handler.ts 를 빠르게 반복 검증하려는 목적 — DB 는
// in-memory Map 으로 mock 한다(실제 서비스는 mockingbird_projects.bbq_telestration__* 테이블을 씀).
//
// 사용: pnpm --filter @mockingbird/api-bbq-telestration bundle:handler && \
//       pnpm --filter @mockingbird/api-bbq-telestration test:handler
import { newAsyncContext, shouldInterruptAfterDeadline } from 'quickjs-emscripten';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(dir, 'dist/handler.bundle.js');
if (!existsSync(bundlePath)) {
  console.error('dist/handler.bundle.js 가 없습니다 — 먼저 `pnpm bundle:handler` 를 실행하세요.');
  process.exit(1);
}
const code = readFileSync(bundlePath, 'utf8');

// 실제 서비스의 CAPABILITY_PRELUDE 와 동일한 형태(문자열 in/out 위에 얇은 JS 래퍼).
const CAPABILITY_PRELUDE = `
globalThis.env = {
  db: {
    query: function (sql, params) {
      var raw = __hostDbQuery(String(sql), JSON.stringify(params || []));
      return JSON.parse(raw);
    },
  },
  log: function () {
    try { __hostLog(JSON.stringify(Array.prototype.slice.call(arguments))); } catch (e) {}
  },
};
`;
const DRIVER_SUFFIX = `
;(function () {
  var req = JSON.parse(__REQUEST__);
  if (typeof handle !== 'function') {
    return JSON.stringify({ status: 500, body: { ok: false, error: "handle 함수가 없습니다." } });
  }
  var result = handle(req, env);
  return JSON.stringify(result == null ? { status: 204 } : result);
})()
`;

// mock DB — 실서비스는 mockingbird_projects."bbq_telestration__items" 를 쓰지만, 여기선 in-memory.
const mockItems = [];
let seq = 1;
async function mockQuery(sql, params) {
  if (/^\s*SELECT/i.test(sql)) return { rows: mockItems.slice(0, 50) };
  if (/^\s*INSERT/i.test(sql)) {
    const item = { id: seq++, name: params[0] };
    mockItems.unshift(item);
    return { rows: [item] };
  }
  return { rows: [] };
}

async function runOnce(request) {
  const context = await newAsyncContext();
  context.runtime.setMemoryLimit(64 * 1024 * 1024);
  context.runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + 5000));

  const dbQueryHandle = context.newAsyncifiedFunction('__hostDbQuery', async (sqlHandle, paramsHandle) => {
    const sql = context.getString(sqlHandle);
    const params = JSON.parse(context.getString(paramsHandle) || '[]');
    const result = await mockQuery(sql, params);
    return context.newString(JSON.stringify(result));
  });
  context.setProp(context.global, '__hostDbQuery', dbQueryHandle);
  dbQueryHandle.dispose();

  const logHandle = context.newFunction('__hostLog', (a) => console.log('[handler log]', context.getString(a)));
  context.setProp(context.global, '__hostLog', logHandle);
  logHandle.dispose();

  const reqHandle = context.newString(JSON.stringify(request));
  context.setProp(context.global, '__REQUEST__', reqHandle);
  reqHandle.dispose();

  const guestSource = [CAPABILITY_PRELUDE, code, DRIVER_SUFFIX].join('\n;\n');
  const evalResult = await context.evalCodeAsync(guestSource);
  const valueHandle = context.unwrapResult(evalResult);
  const raw = context.getString(valueHandle);
  valueHandle.dispose();
  context.dispose();
  return JSON.parse(raw);
}

const scenarios = [
  { method: 'GET', path: '/', query: {}, body: null },
  { method: 'GET', path: '/health', query: {}, body: null },
  { method: 'POST', path: '/items', query: {}, body: { name: 'local-test' } },
  { method: 'GET', path: '/items', query: {}, body: null },
];

for (const req of scenarios) {
  const res = await runOnce({ method: req.method, path: req.path, query: req.query, headers: {}, body: req.body });
  console.log(`${req.method} ${req.path} ->`, JSON.stringify(res));
}
