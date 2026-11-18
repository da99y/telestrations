// ─────────────────────────────────────────────────────────────────────────
// dev-server.mjs — DEV 전용 "1인 projects 호스트" 흉내기.
//
// 왜 필요한가: `src/api/projects`(모든 프로젝트가 공유하는 실제 projects 호스트)와
// `src/api/root`(git/wasm 배포 컨트롤 플레인)는 sparse pull 로 로컬에 받아올 방법이
// 없다(parts=app|api 어느 조합도 root 는 절대 포함하지 않고, parts=api 를 opt-in
// 하지 않으면 projects 도 없다). 그래도 이 프로젝트 하나만은 진짜 HTTP 로 로컬에서
// 검증하고 싶을 때, 이 스크립트가 projects 호스트가 하는 일(esbuild 번들 → QuickJS
// 실행 → 응답)을 이 프로젝트 폴더 안에서만 재현한다.
//
// App 의 vite proxy(`/api` → `localhost:4001`, 이번 BFF 전환과 무관하게 로컬은 항상
// 이 대상 — vite.config.ts 변경 없음)가 그대로 이 서버를 가리키게 되므로, App 쪽 설정도
// 하나도 안 건드리고 바로 붙는다.
//
// 실행 모델은 WasmSandboxRuntimeService
// (src/api/projects/src/wasm-gateway/wasm-sandbox-runtime.service.ts)를 최대한
// 그대로 재현한다 — capability prelude(env.db/env.log/env.fetch), search_path=
// mockingbird_projects, `${project}__*` 테이블 네이밍. 다만 몇 가지는 의도적으로 축소했다:
//   - env.fetch: WASM_FETCH_ALLOWLIST_<PROJECT> 로 opt-in 하는 것까진 동일하지만,
//     fetch-guard.ts 의 SSRF 차단(사설/루프백/메타데이터 IP)과 fetch-secrets.ts 의
//     서버사이드 시크릿 주입은 없다 — 로컬 신뢰 경계 안이라 생략. 실제 방어는 beta 의
//     projects 호스트가 한다. 시크릿이 필요한 호출(jeminhee 의 Langfuse 등)은 로컬에서
//     env 로 직접 넣어 테스트해야 한다(아래 참고).
//   - sql-scope-guard 같은 프로젝트 간 SQL 격리 검사는 생략했다 — 이 서버는 애초에
//     이 프로젝트 하나만 알고 있어서 다른 프로젝트 테이블을 건드릴 방법이 없다.
//   - 진짜 projects 호스트의 PGlite 와 절대 안 섞이도록 별도 데이터 디렉토리
//     (`.../mockingbird/pglite/dev-<project>`)를 쓴다.
//
// 사용:
//   pnpm dev:server                 # :4001 (PORT env 로 변경 가능)
//   curl http://localhost:4001/api/<project>/...
//
// handler.ts 저장 시 esbuild watch 가 자동 재번들한다 — 서버 재시작 불필요.
// 테이블은 같은 디렉토리의 tables.local.json 을 시작 시 읽어 idempotent 하게 생성한다
// (파일 포맷은 `POST <root>/projects-admin/tables` 의 `columns` 와 동일 — 나중에 진짜
// beta 에 반영할 때 그대로 복사해서 쓰면 된다). 파일이 없으면(DB 안 쓰는 프로젝트) 스킵.
// ─────────────────────────────────────────────────────────────────────────
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { context as esbuildContext } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { newAsyncContext, shouldInterruptAfterDeadline } from 'quickjs-emscripten';

const dir = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4001);

// ── 프로젝트 이름: package.json "@mockingbird/api-<name>" → <name> (없으면 폴더명) ──
function resolveProjectName() {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const m = /^@mockingbird\/api-(.+)$/.exec(pkg.name ?? '');
    if (m) return m[1];
  } catch {}
  return dir.split(/[\\/]/).pop();
}
// 실제 호스트의 normalizeProject 와 동일 규칙 — 물리 테이블/스키마 이름이 beta 와 일치해야
// "여기서 되던 게 beta 에선 이름이 달라서 안 됨" 같은 삽질을 안 한다.
function normalizeProject(name) {
  const safe = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!safe || /^[0-9]/.test(safe)) throw new Error(`잘못된 프로젝트 이름: '${name}'`);
  return safe;
}
const RAW_PROJECT = resolveProjectName();
const PROJECT = normalizeProject(RAW_PROJECT);
console.log(`[dev-server] project = ${RAW_PROJECT} (table prefix: ${PROJECT}__)`);

// ── PGlite 로컬 데이터 디렉토리 (진짜 projects 호스트 데이터와 절대 안 섞이게 dev- 접두) ──
function defaultPgliteBase() {
  if (process.env.PGLITE_PATH) return process.env.PGLITE_PATH;
  const home = homedir();
  if (platform() === 'win32') {
    return join(process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), 'mockingbird', 'pglite');
  }
  if (platform() === 'darwin') return join(home, 'Library', 'Caches', 'mockingbird', 'pglite');
  return join(process.env.XDG_CACHE_HOME ?? join(home, '.cache'), 'mockingbird', 'pglite');
}
const pglitePath = join(defaultPgliteBase(), `dev-${PROJECT}`);
mkdirSync(pglitePath, { recursive: true });

const db = new PGlite(pglitePath);
await db.query(`CREATE SCHEMA IF NOT EXISTS "mockingbird_projects"`);
await db.query(`SET search_path TO "mockingbird_projects", public`);
console.log(`[dev-server] PGlite -> ${pglitePath}`);

// ── tables.local.json 으로 테이블 idempotent 생성 ──────────────────────────
// projects-admin.service.ts 의 createTable() 과 동일한 타입 화이트리스트/식별자 검증.
const ALLOWED_TYPES = new Set(['text', 'integer', 'bigint', 'boolean', 'jsonb', 'timestamptz', 'serial', 'bigserial']);
const IDENT_RE = /^[a-z_][a-z0-9_]*$/;

function requireIdent(value, field) {
  if (typeof value !== 'string' || !IDENT_RE.test(value) || value.length > 48) {
    throw new Error(`invalid ${field}: must match /^[a-z_][a-z0-9_]*$/ and <=48 chars`);
  }
  return value;
}

async function ensureTablesFromFile() {
  const file = join(dir, 'tables.local.json');
  if (!existsSync(file)) {
    console.log('[dev-server] tables.local.json 없음 — 테이블 생성 스킵 (DB 안 쓰는 프로젝트면 정상).');
    return;
  }
  const spec = JSON.parse(readFileSync(file, 'utf8'));
  for (const t of spec.tables ?? []) {
    const table = requireIdent(t.table, 'table');
    const tableName = `${PROJECT}__${table}`;
    const seen = new Set();
    const columnSql = (t.columns ?? []).map((col) => {
      const name = requireIdent(col.name, 'columns[].name');
      if (seen.has(name)) throw new Error(`duplicate column: ${name}`);
      seen.add(name);
      if (!ALLOWED_TYPES.has(col.type)) throw new Error(`unsupported type: ${col.type}`);
      const parts = [`"${name}"`, col.type.toUpperCase()];
      if (col.primaryKey) parts.push('PRIMARY KEY');
      if (col.notNull) parts.push('NOT NULL');
      if (col.default !== undefined) parts.push(`DEFAULT ${col.default}`);
      return parts.join(' ');
    });
    const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnSql.join(',\n  ')}\n)`;
    await db.query(sql);
    console.log(`[dev-server] table ready: mockingbird_projects.${tableName}`);
  }
}
await ensureTablesFromFile();

// ── handler.ts 번들 — esbuild.handler.mjs 와 동일 설정. watch 로 저장 시 자동 재번들 ──
let currentCode = '';
const buildCtx = await esbuildContext({
  entryPoints: [join(dir, 'src/handler.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: '__mod__',
  platform: 'neutral', // Node 내장 모듈 쓰면 여기서 에러 — beta 배포 전 로컬에서 먼저 걸러짐.
  target: 'es2020',
  footer: {
    js: 'globalThis.handle = (typeof __mod__ !== "undefined" && (__mod__.handle || __mod__.default)) || undefined;',
  },
  plugins: [
    {
      name: 'capture-output',
      setup(build) {
        build.onEnd((result) => {
          const text = result.outputFiles?.[0]?.text;
          if (text) {
            currentCode = text;
            console.log(`[dev-server] handler 재번들 완료 (${Buffer.byteLength(text, 'utf8')} bytes)`);
          } else if (result.errors?.length) {
            console.error('[dev-server] 번들 실패 — 이전 코드로 계속 서빙합니다:', result.errors);
          }
        });
      },
    },
  ],
});
await buildCtx.rebuild(); // 최초 1회
await buildCtx.watch(); // 이후 src/handler.ts 저장할 때마다 자동 재번들

// ── capability prelude — WasmSandboxRuntimeService 와 동일 형태 ───────────
const CAPABILITY_PRELUDE = `
globalThis.env = {
  db: {
    query: function (sql, params) {
      return JSON.parse(__hostDbQuery(String(sql), JSON.stringify(params || [])));
    },
  },
  log: function () {
    try { __hostLog(JSON.stringify(Array.prototype.slice.call(arguments))); } catch (e) {}
  },
  fetch: function (url, options) {
    return JSON.parse(__hostFetch(String(url), JSON.stringify(options || {})));
  },
};
`;
const DRIVER_SUFFIX = `
;(function () {
  var req = JSON.parse(__REQUEST__);
  if (typeof handle !== 'function') {
    return JSON.stringify({ status: 500, body: { ok: false, error: "handle 함수가 없습니다 — 'export function handle(req, env)' 형태로 작성하세요." } });
  }
  var result = handle(req, env);
  return JSON.stringify(result == null ? { status: 204 } : result);
})()
`;

// env.fetch 는 실제와 동일하게 WASM_FETCH_ALLOWLIST_<PROJECT> (구 OPENFAAS_FETCH_ALLOWLIST_<PROJECT>
// 폴백) 로만 opt-in. ⚠️ SSRF 가드/시크릿 주입은 없다 — dev 전용, 로컬 신뢰 경계 안에서만 사용.
function allowedFetchHosts() {
  const upper = PROJECT.toUpperCase();
  const raw =
    process.env[`WASM_FETCH_ALLOWLIST_${upper}`] ?? process.env[`OPENFAAS_FETCH_ALLOWLIST_${upper}`] ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function runHandler(request) {
  const context = await newAsyncContext();
  context.runtime.setMemoryLimit(64 * 1024 * 1024);
  context.runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + 5000));

  const dbHandle = context.newAsyncifiedFunction('__hostDbQuery', async (sqlH, paramsH) => {
    const sql = context.getString(sqlH);
    const params = JSON.parse(context.getString(paramsH) || '[]');
    const result = await db.query(sql, params);
    return context.newString(JSON.stringify({ rows: result.rows }));
  });
  context.setProp(context.global, '__hostDbQuery', dbHandle);
  dbHandle.dispose();

  const fetchHandle = context.newAsyncifiedFunction('__hostFetch', async (urlH, optH) => {
    const url = context.getString(urlH);
    const options = JSON.parse(context.getString(optH) || '{}');
    const hosts = allowedFetchHosts();
    let hostname = '';
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      // invalid URL — hostname 빈 문자열로 두면 아래에서 자연히 차단됨
    }
    if (!hosts.has(hostname)) {
      return context.newString(
        JSON.stringify({
          status: 0,
          body: null,
          error: `fetch 차단: '${hostname}' (WASM_FETCH_ALLOWLIST_${PROJECT.toUpperCase()} 에 없음)`,
        }),
      );
    }
    try {
      const method = (options.method ?? 'GET').toUpperCase();
      const hasBody = !['GET', 'HEAD'].includes(method) && options.body !== undefined;
      const res = await fetch(url, {
        method,
        headers: options.headers,
        body: hasBody ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
      });
      const text = await res.text();
      let body = text;
      try {
        body = JSON.parse(text);
      } catch {
        // JSON 아니면 원문 텍스트 그대로
      }
      const headers = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      return context.newString(JSON.stringify({ status: res.status, headers, body }));
    } catch (err) {
      return context.newString(JSON.stringify({ status: 0, body: null, error: String(err) }));
    }
  });
  context.setProp(context.global, '__hostFetch', fetchHandle);
  fetchHandle.dispose();

  const logHandle = context.newFunction('__hostLog', (a) => console.log(`[handler:${PROJECT}]`, context.getString(a)));
  context.setProp(context.global, '__hostLog', logHandle);
  logHandle.dispose();

  const reqHandle = context.newString(JSON.stringify(request));
  context.setProp(context.global, '__REQUEST__', reqHandle);
  reqHandle.dispose();

  const guestSource = [CAPABILITY_PRELUDE, currentCode, DRIVER_SUFFIX].join('\n;\n');
  const evalResult = await context.evalCodeAsync(guestSource);
  const valueHandle = context.unwrapResult(evalResult);
  const raw = context.getString(valueHandle);
  valueHandle.dispose();
  context.dispose();
  return JSON.parse(raw);
}

// ── 정적 파일 서빙 (standalone 모드: 빌드된 프론트엔드를 함께 서빙) ──────────
const STATIC_DIR = join(dir, '../../app/bbq-telestration/dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function serveStatic(res, filePath) {
  const mime = MIME[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': mime, 'cache-control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=31536000' });
  createReadStream(filePath).pipe(res);
}

// ── HTTP 서버: /api/<project>/* 처리 + 정적 파일 서빙 ─────────────────────────
const server = createServer(async (req, res) => {
  try {
    const original = req.url || '/';

    // CORS (Railway 등 외부 접속 허용)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Mockingbird-App');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (original === '/api/projects/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'api-projects-dev-server', project: RAW_PROJECT }));
      return;
    }

    const m = original.match(/^\/api\/([^/?]+)/);
    if (!m || normalizeProject(m[1]) !== PROJECT) {
      // API 요청이 아닌 경우 — 빌드된 프론트엔드 정적 파일 서빙 (standalone)
      if (existsSync(STATIC_DIR)) {
        const urlPath = original.split('?')[0];
        const candidate = join(STATIC_DIR, urlPath);
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          serveStatic(res, candidate); return;
        }
        // SPA fallback: index.html
        const index = join(STATIC_DIR, 'index.html');
        if (existsSync(index)) { serveStatic(res, index); return; }
      }
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: `이 dev-server 는 '${RAW_PROJECT}' 만 서빙합니다 (요청: ${original})` }));
      return;
    }

    const prefix = m[0];
    const rest = original.slice(prefix.length) || '/';
    const [pathOnly, queryString] = rest.split('?');
    const query = {};
    if (queryString) {
      for (const [k, v] of new URLSearchParams(queryString)) {
        const existing = query[k];
        if (existing === undefined) query[k] = v;
        else query[k] = Array.isArray(existing) ? [...existing, v] : [existing, v];
      }
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    let body = null;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }

    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) headers[k] = Array.isArray(v) ? v.join(',') : v;

    const result = await runHandler({ method: req.method, path: pathOnly || '/', query, headers, body });
    res.writeHead(result.status ?? 200, { 'content-type': 'application/json', ...(result.headers ?? {}) });
    res.end(JSON.stringify(result.body ?? {}));
  } catch (err) {
    console.error('[dev-server] 요청 처리 실패:', err);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'dev-server 내부 오류' }));
  }
});

server.listen(PORT, () => {
  console.log(`[dev-server] http://localhost:${PORT}/api/${RAW_PROJECT}/*`);
  console.log(`[dev-server] health:  http://localhost:${PORT}/api/projects/health`);
});

process.on('SIGINT', async () => {
  await buildCtx.dispose();
  await db.close();
  server.close(() => process.exit(0));
});
