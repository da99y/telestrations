// 그림 그리고 맞추기(텔레스트레이션) — 판·참가자·스케치북 칸·띵작/망작 투표 API.
// QuickJS wasm 샌드박스에서 실행된다(Node 내장 모듈·fetch 없음, env.db 만 사용).
// 로그인 정보 대신 브라우저가 만든 랜덤 key 로 "나"를 구분하고, key 는 응답에 절대 싣지 않는다.
//
// 진행(서버 시계 기준, 요청이 올 때마다 advance() 가 필요한 만큼 넘긴다):
//   lobby → running(칸 1..steps-1: 그리기/추측 번갈아) → voting(모두 각자 폰으로 구경·투표, vote_sec) → 결과
//   칸은 시간이 끝나거나(+넘김 3초) 전원이 내면 바로 다음 칸으로 넘어간다.
// 스케치북 b 의 k 번째 칸은 자리(seat) (b + k - 1) % N 인 사람이 채운다 — 1칸은 주인이 자기 제시어를 그린다.
// 맞춤·전달·완주 점수 + 띵작(+1)·망작(-1) 표로 상위·하위를 뽑는다(results 참고).
//
// 테이블은 matches/seats/pages/marks2/openers/hosts(2026-10-14 개편 — 이전 games/players/entries/votes/marks 는 더 안 쓴다).

type Req = { method: string; path: string; query: Record<string, string | string[]>; body: unknown };
type Env = { db: { query: (sql: string, params?: unknown[]) => { rows: Record<string, unknown>[] } }; log: (...args: unknown[]) => void };
type Game = {
  id: number; status: string; steps: number; dSec: number; gSec: number; voteSec: number; penalty: number;
  words: string[]; tier: string; curStep: number; stepStart: number | null; voteEnd: number | null; mode: string;
};
type Player = { id: number; key: string; nick: string; joinedAt: number; seat: number | null; team: string | null };
type Phase =
  | { kind: 'none' | 'lobby' | 'done' }
  | { kind: 'wait'; k: number; startsAt: number }
  | { kind: 'step'; k: number; editing: boolean; endsAt: number }
  | { kind: 'voting'; endsAt: number };

// 제시어: 진행자가 판을 열 때 난이도(하·중·상)를 고른다. 단계마다 약 80%가 음식·배민·B마트 관련 말이다.
// 한 번 나온 제시어는 used 에 남겨 다음 판에 안 낸다(그 단계를 다 쓰면 그 단계만 다시 푼다).
const WORDS: Record<string, string[]> = {
  easy: [ // 하 — 그리기 쉬운 음식·물건·동물
    // 음식·배민·B마트
    '삼겹살', '김밥', '짜장면', '짬뽕', '치킨', '피자', '햄버거', '라면', '초밥', '붕어빵',
    '호떡', '수박', '바나나', '아보카도', '핫도그', '팥빙수', '소시지', '옥수수', '감자칩', '컵라면',
    '삼각김밥', '식빵', '두부', '대파', '양파', '계란', '콜라', '사이다', '만두', '즉석밥',
    '참치캔', '초콜릿', '아이스크림', '딸기', '포도', '사과', '귤', '복숭아', '체리', '레몬',
    '파인애플', '키위', '멜론', '당근', '브로콜리', '토마토', '고구마', '감자', '버섯', '마늘',
    '고추', '오이', '새우', '오징어', '문어', '꽃게', '생선', '우유', '치즈', '버터',
    '도넛', '케이크', '쿠키', '사탕', '젤리', '팝콘', '와플', '마카롱', '커피', '녹차',
    '맥주', '와인', '소주', '우동', '냉면', '김치', '순대', '스테이크', '샐러드', '샌드위치',
    '토스트', '핫케이크', '쌀', '케첩', '마요네즈', '물', '요구르트', '감자튀김', '계란프라이', '주먹밥',
    '피망', '바게트', '크루아상', '프레첼', '막대사탕', '솜사탕', '닭다리', '새우튀김', '계란말이', '김',
    '고등어', '오렌지', '배', '감', '블루베리', '참외', '밤', '땅콩', '호두', '아몬드',
    '배추', '가지', '호박', '파프리카', '상추', '깻잎', '콩나물', '연근', '무', '소고기',
    '돼지고기', '베이컨', '햄', '참치', '조개', '굴', '떡국', '미역국', '잔치국수', '칼국수',
    '푸딩', '마시멜로', '껌', '오렌지주스', '레모네이드', '밀크티', '얼음', '꽈배기', '단팥빵', '크림빵',
    '롤케이크', '카스텔라', '치즈케이크', '유부초밥', '떡꼬치', '빙수', '빵', '밥', '군밤', '방울토마토',
    '딸기우유', '초코우유', '떡', '피클', '단무지', '소금빵', '메론빵', '치킨너겟', '미트볼', '비엔나소시지',
    '시리얼', '딸기잼', '건포도', '한라봉', '청포도', '표고버섯', '완두콩', '사과주스', '포도주스', '초코바',
    '쌀과자', '닭가슴살', '샤인머스캣', '젓가락', '숟가락', '포크', '접시', '냄비', '프라이팬', '국자',
    '빨대', '도마', '컵', '주전자',
    // 그 밖의 말
    '우산', '칫솔', '휴지', '고무장갑', '건전지', '안경', '가방', '모자', '열쇠', '전구',
    '선풍기', '냉장고', '스마트폰', '노트북', '의자', '풍선', '선물상자', '고양이', '강아지', '토끼',
    '곰', '펭귄', '기린', '코끼리', '사자', '돼지', '닭', '거북이', '나비', '고래',
    '해', '달', '별', '구름', '무지개', '눈사람', '나무', '꽃', '자전거', '자동차',
    '버스', '비행기', '로켓', '양', '소', '말',
  ],
  medium: [ // 중 — 메뉴 이름·장면·직업
    // 음식·배민·B마트
    '계란 한 판', '두루마리 휴지', '바나나우유', '아이스아메리카노', '장바구니', '오토바이', '라이더', '회전초밥', '치킨무', '양념치킨',
    '반반치킨', '짜장면 곱빼기', '탕수육', '페퍼로니 피자', '김치찌개', '된장찌개', '부대찌개', '비빔밥', '불고기', '갈비',
    '삼계탕', '족발', '보쌈', '곱창', '닭발', '마라탕', '쌀국수', '타코', '카레', '오므라이스',
    '돈가스', '짬짜면', '호빵', '군고구마', '버블티', '밀크셰이크', '컵케이크', '생일 케이크', '도시락', '전자레인지',
    '에어프라이어', '밥솥', '냉동실', '쇼핑카트', '쿠폰', '영수증', '앞치마', '요리사', '푸드트럭', '아이스박스',
    '건배', '아침밥', '생크림 케이크', '핫초코', '과일바구니', '김치볶음밥', '제육볶음', '오징어볶음', '낙지볶음', '닭갈비',
    '찜닭', '감자탕', '해장국', '순두부찌개', '콩국수', '물냉면', '비빔냉면', '짜장밥', '볶음밥', '잡채',
    '떡갈비', '동그랑땡', '파전', '김치전', '계란찜', '뚝배기', '가래떡', '인절미', '피시앤칩스', '샤브샤브',
    '라멘', '돈부리', '연어덮밥', '팬케이크', '프렌치토스트', '과일화채', '팥죽', '호박죽', '전복죽', '카페라떼',
    '녹차라떼', '딸기라떼', '생맥주', '하이볼', '막걸리', '닭꼬치', '소떡소떡', '콘치즈', '치즈스틱', '크래커',
    '아이스티', '소금', '설탕', '후추', '간장', '고추장', '된장', '식용유', '참기름', '송편',
    '라볶이', '김말이', '튀김', '닭강정', '치즈볼', '망고', '어묵', '시금치', '자두', '꼬마김밥',
    '양상추', '양배추', '꿀', '계란빵', '떡볶이',
    // 그 밖의 말
    '롤러코스터', '회전목마', '놀이공원', '영화관', '노래방', '볼링', '텐트', '모닥불', '해수욕장', '수영장',
    '스키', '낚시', '등산', '크리스마스 트리', '산타클로스', '할로윈 호박', '결혼식', '우주비행사', '외계인', '로봇',
    '유령', '마법사', '해적', '공룡', '유니콘', '소방관', '경찰관', '의사', '엘리베이터', '신호등',
    '지하철', '공항', '등대',
  ],
  hard: [ // 상 — 한 단어지만 떠올리거나 그리기 까다로운 것
    // 음식·배민·B마트
    '탕후루', '크로플', '라자냐', '빠에야', '훠궈', '딤섬', '나초', '부리또', '케밥', '에그타르트',
    '티라미수', '판나코타', '젤라또', '츄러스', '베이글', '스콘', '마들렌', '휘낭시에', '크레페', '타르트',
    '수플레', '퐁듀', '감바스', '리조또', '라따뚜이', '포케', '브리오슈', '곶감', '약과', '식혜',
    '수정과', '깍두기', '동치미', '육회', '물회', '꼬막', '전복', '성게', '가리비', '장어',
    '산낙지', '랍스터', '연어알', '아스파라거스', '콜리플라워', '셀러리', '두리안', '망고스틴', '리치', '용과',
    '석류', '무화과', '자몽', '라임', '코코넛', '올리브', '땅콩버터', '그래놀라', '오트밀', '와사비',
    '트러플', '캐비어', '마라샹궈', '꿔바로우', '양장피', '팔보채', '짜사이', '월병', '타코야키', '오코노미야키',
    '마카다미아', '피스타치오', '두유', '탄산수', '찐빵', '소보로빵', '쫄면', '누룽지', '약밥', '초코파이',
    '미역', '수제비', '육개장', '설렁탕', '갈비탕', '크림파스타', '토마토파스타', '연어', '메추리알', '그라탕',
    '생강',
    // 그 밖의 말
    '오로라', '메아리', '신기루', '그림자', '카멜레온', '공작새', '고슴도치', '너구리', '미어캣', '플라밍고',
    '해파리', '오리너구리', '나무늘보', '아르마딜로', '개미핥기', '회오리', '블랙홀', '소용돌이',
  ],  core: [ // 코어 도메인 전용 — 뷰티·앱 서비스·업무 용어
    '여드름', '리프팅', '레이저제모', '요정귀', '중안부', '보톡스', '다크서클', '브이라인', '쌍꺼풀', '팔자주름',
    '이중턱', '지방흡입', '라미네이트', '입술필러', '앱예약', '바비톡', '강남언니', '여신티켓', '에러', '로딩',
    '깃허브', '버그', '핫픽스', '지라', '스프린트', '스크럼', '와이어프레임', '피그마', '슬랙', '커피',
    '담배', '민대기', '최권열', '김수빈', '조한진', '임수현', '박효근',
  ],
};
const MAX_PLAYERS = 40;
const MAX_NICK = 10;
const MAX_GUESS = 30;
const MAX_DRAWING = 400_000; // dataURL 길이
const START_DELAY_MS = 5000;
const HANDOFF_MS = 1500; // 다음 칸이 열리기 전 "넘기는 중" 시간
const BUFFER_MS = 3000; // 칸 마감 뒤 늦게 도착한 제출을 받아주는 시간

const ok = (body: Record<string, unknown>, status = 200) => ({ status, body: { ok: true, ...body } });
const bad = (message: string, status = 400) => ({ status, body: { ok: false, error: message } });

function readKey(v: unknown) {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' && /^[A-Za-z0-9-]{16,80}$/.test(s) ? s : null;
}
function readInt(v: unknown, lo: number, hi: number, def: number) {
  const n = typeof v === 'number' ? v : Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n))) : def;
}
function parseJson<T>(v: unknown, def: T): T {
  if (typeof v !== 'string') return def;
  try { return JSON.parse(v) as T; } catch { return def; }
}
function shuffle<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const kindOf = (k: number) => (k % 2 === 1 ? 'draw' : 'guess');
const durOf = (g: Game, k: number) => (kindOf(k) === 'draw' ? g.dSec : g.gSec) * 1000;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const numOrNull = (v: unknown) => (v == null ? null : Number(v));

// matches.words 는 모집 중엔 {"tier":"easy"}(고른 난이도), 시작하면 제시어 배열이다.
const TIERS = ['easy', 'medium', 'hard', 'core'];
function wordsOf(v: unknown) { const x = parseJson<unknown>(v, []); return Array.isArray(x) ? (x as string[]) : []; }
function tierOf(v: unknown) { const x = parseJson<{ tier?: string } | unknown[]>(v, []); const t = !Array.isArray(x) && x ? x.tier : undefined; return t && TIERS.includes(t) ? t : 'easy'; }

function currentGame(env: Env): Game | null {
  const { rows } = env.db.query(
    `SELECT id, status, steps, d_sec, g_sec, vote_sec, penalty, words, cur_step, step_start, vote_end, mode FROM bbq_telestration__matches ORDER BY id DESC LIMIT 1`,
    [],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id), status: String(r.status), steps: Number(r.steps), dSec: Number(r.d_sec), gSec: Number(r.g_sec),
    voteSec: Number(r.vote_sec), penalty: Number(r.penalty), words: wordsOf(r.words), tier: tierOf(r.words),
    curStep: Number(r.cur_step ?? 0), stepStart: numOrNull(r.step_start), voteEnd: numOrNull(r.vote_end), mode: String(r.mode ?? 'individual'),
  };
}
function recentGames(env: Env, n: number): Game[] {
  const { rows } = env.db.query(
    `SELECT id, status, steps, d_sec, g_sec, vote_sec, penalty, words, cur_step, step_start, vote_end, mode FROM bbq_telestration__matches ORDER BY id DESC LIMIT ${n}`,
    [],
  );
  return rows.map((r) => ({
    id: Number(r.id), status: String(r.status), steps: Number(r.steps), dSec: Number(r.d_sec), gSec: Number(r.g_sec),
    voteSec: Number(r.vote_sec), penalty: Number(r.penalty), words: wordsOf(r.words), tier: tierOf(r.words),
    curStep: Number(r.cur_step ?? 0), stepStart: numOrNull(r.step_start), voteEnd: numOrNull(r.vote_end), mode: String(r.mode ?? 'individual'),
  }));
}

function phaseOf(g: Game | null, now: number): Phase {
  if (!g || g.status === 'cancelled') return { kind: 'none' };
  if (g.status === 'lobby') return { kind: 'lobby' };
  if (g.status === 'finished') return { kind: 'done' };
  if (g.status === 'voting') return { kind: 'done' };
  const start = g.stepStart ?? now;
  if (now < start) return { kind: 'wait', k: g.curStep, startsAt: start };
  const end = start + durOf(g, g.curStep);
  return { kind: 'step', k: g.curStep, editing: now < end, endsAt: end };
}

function playersOf(env: Env, gameId: number): Player[] {
  const { rows } = env.db.query(
    `SELECT id, player_key, nick, joined_at, seat, team FROM bbq_telestration__seats WHERE game_id = $1 AND deleted_at IS NULL ORDER BY id ASC LIMIT ${MAX_PLAYERS}`,
    [gameId],
  );
  return rows.map((r) => ({ id: Number(r.id), key: String(r.player_key), nick: String(r.nick), joinedAt: Number(r.joined_at), seat: numOrNull(r.seat), team: r.team != null ? String(r.team) : null }));
}
const seated = (list: Player[]) => list.filter((p) => p.seat != null).sort((a, b) => a.seat! - b.seat!);
function submittedCount(env: Env, gameId: number, step: number) {
  const { rows } = env.db.query(`SELECT COUNT(*)::int AS n FROM bbq_telestration__pages WHERE game_id = $1 AND step = $2`, [gameId, step]);
  return Number(rows[0]?.n ?? 0);
}

// 시간이 끝났거나(+넘김) 전원이 냈으면 다음 칸(또는 투표)으로 넘긴다. cur_step 비교 UPDATE 라 동시에 여러 요청이 와도 한 번만 넘어간다.
// 모집 중인 판은 참가자가 모두 LOBBY_IDLE_MS 넘게 화면에 없으면 버려진 걸로 보고 취소한다(진행자가 사라져도 다음 판을 열 수 있게).
const LOBBY_IDLE_MS = 5 * 60 * 1000;
function expireLobby(env: Env, g: Game, now: number): Game | null {
  const humans = playersOf(env, g.id).filter((p) => !p.key.startsWith('bot-'));
  if (!humans.length) return g;
  const seen: Record<number, number> = {};
  env.db.query(`SELECT seat_id, seen_at FROM bbq_telestration__presence WHERE game_id = $1`, [g.id]).rows.forEach((r) => { seen[Number(r.seat_id)] = Number(r.seen_at); });
  if (humans.some((p) => (seen[p.id] ?? 0) >= now - LOBBY_IDLE_MS)) return g;
  env.db.query(`UPDATE bbq_telestration__matches SET status = $1 WHERE id = $2 AND status = $3`, ['cancelled', g.id, 'lobby']);
  return currentGame(env);
}
function advance(env: Env, g: Game | null, now: number): Game | null {
  if (g && g.status === 'lobby') return expireLobby(env, g, now);
  if (!g || g.status !== 'running' || g.stepStart == null || now < g.stepStart) return g;
  const k = g.curStep, end = g.stepStart + durOf(g, k);
  const timeUp = now >= end + BUFFER_MS;
  // 화면을 보고 있는 참가자가 모두 냈으면 바로 넘긴다(자리 비운 사람은 기다리지 않는다).
  let allIn = false;
  if (!timeUp) {
    const seatedNow = seated(playersOf(env, g.id)), awayIds = awaySet(env, g.id, seatedNow, now);
    const present = seatedNow.filter((p) => !awayIds.has(p.id));
    const done = new Set(env.db.query(`SELECT author_id FROM bbq_telestration__pages WHERE game_id = $1 AND step = $2`, [g.id, k]).rows.map((r) => Number(r.author_id)));
    allIn = present.length > 0 && present.every((p) => done.has(p.id));
  }
  if (!timeUp && !allIn) return g;
  if (k + 1 < g.steps) {
    env.db.query(
      `UPDATE bbq_telestration__matches SET cur_step = $1, step_start = $2 WHERE id = $3 AND cur_step = $4 AND status = $5`,
      [k + 1, now + HANDOFF_MS, g.id, k, 'running'],
    );
  } else {
    env.db.query(
      `UPDATE bbq_telestration__matches SET status = $1 WHERE id = $2 AND cur_step = $3 AND status = $4`,
      ['finished', g.id, k, 'running'],
    );
  }
  return currentGame(env);
}

// 진행자 = 지금 판을 연 사람(openers). 예전에 "내가 진행자 하기"로 정한 브라우저(hosts)도 진행자로 친다.
function isHost(env: Env, key: string | null, gameId: number | null = null) {
  if (!key) return false;
  if (gameId != null && env.db.query(`SELECT 1 AS ok FROM bbq_telestration__openers WHERE game_id = $1 AND owner_key = $2`, [gameId, key]).rows.length) return true;
  const { rows } = env.db.query(`SELECT 1 AS ok FROM bbq_telestration__hosts WHERE owner_key = $1`, [key]);
  return rows.length > 0;
}
function hasHost(env: Env) {
  const { rows } = env.db.query(`SELECT COUNT(*)::int AS n FROM bbq_telestration__hosts`, []);
  return Number(rows[0]?.n ?? 0) > 0;
}

type Page = { id: number; book: number; step: number; authorId: number; kind: string; content: string };
// guessContentOnly=true 이면 guess 칸만 content 를 로드한다(draw 칸 JPEG 는 빈 문자열).
// 점수 계산(results/summaryOf)처럼 draw content 가 불필요한 곳에서 QuickJS 64MB 한계를 피한다.
function pagesOf(env: Env, gameId: number, book: number | null, withContent: boolean, guessContentOnly = false): Page[] {
  const cols = withContent
    ? guessContentOnly
      ? "id, book, step, author_id, kind, CASE WHEN kind = 'guess' THEN content ELSE '' END AS content"
      : 'id, book, step, author_id, kind, content'
    : 'id, book, step, author_id, kind';
  const { rows } = book == null
    ? env.db.query(`SELECT ${cols} FROM bbq_telestration__pages WHERE game_id = $1 ORDER BY step ASC`, [gameId])
    : env.db.query(`SELECT ${cols} FROM bbq_telestration__pages WHERE game_id = $1 AND book = $2 ORDER BY step ASC`, [gameId, book]);
  return rows.map((r) => ({ id: Number(r.id), book: Number(r.book), step: Number(r.step), authorId: Number(r.author_id), kind: String(r.kind), content: withContent ? String(r.content) : '' }));
}
// 점수(결과 화면·지난 결과 공통):
//  - 맞춤: 추측이 앞사람이 보고 그린 말(제시어나 그 앞 추측)과 같으면 추측한 사람 +1
//  - 전달: 그 경우 그림을 그린 사람도 +1(뒷사람이 맞히게 그렸으니까)
//  - 완주: 스케치북의 마지막 추측이 처음 제시어와 같으면 스케치북 주인 +1
// 같은지는 띄어쓰기·문장부호를 빼고 비교한다. 동점이면 판마다 정해지는 추첨 순서.
const norm = (t: string) => t.replace(/[\s.,!?~'"“”…·]/g, '').toLowerCase();
function bookScores(g: Game, pages: Page[]) {
  const pts: Record<number, { guess: number; draw: number; book: number }> = {};
  const add = (id: number, k: 'guess' | 'draw' | 'book') => { (pts[id] ??= { guess: 0, draw: 0, book: 0 })[k]++; };
  const matched = new Set<number>(); // 맞힌 추측 칸 id
  const books = new Map<number, Page[]>();
  pages.forEach((e) => { const l = books.get(e.book) ?? []; l.push(e); books.set(e.book, l); });
  books.forEach((list, b) => {
    const at = (k: number) => list.find((e) => e.step === k);
    // 추측 칸 k 의 정답 = 그림 칸 k-1 을 그린 사람이 받은 말(그 앞의 가장 가까운 추측, 없으면 제시어)
    const textBefore = (k: number) => { for (let s = k - 1; s >= 1; s--) { const e = at(s); if (e?.kind === 'guess') return e.content; } return g.words[b] ?? ''; };
    let lastGuess: Page | undefined;
    list.filter((e) => e.kind === 'guess').sort((x, y) => x.step - y.step).forEach((e) => {
      lastGuess = e;
      const drew = at(e.step - 1);
      if (!drew || drew.kind !== 'draw') return;
      if (norm(e.content) && norm(e.content) === norm(textBefore(e.step - 1))) { add(e.authorId, 'guess'); add(drew.authorId, 'draw'); matched.add(e.id); }
    });
    if (lastGuess && norm(lastGuess.content) === norm(g.words[b] ?? '')) { const owner = list.find((e) => e.step === 1)?.authorId; if (owner != null) add(owner, 'book'); }
  });
  return { pts, matched };
}
function results(env: Env, g: Game, list: Player[]) {
  const pages = pagesOf(env, g.id, null, true, true); // draw JPEG 제외 — guess 텍스트만으로 점수 계산
  const { pts } = bookScores(g, pages);
  return seated(list)
    .map((p) => {
      const x = pts[p.id] ?? { guess: 0, draw: 0, book: 0 };
      return { id: p.id, nick: p.nick, team: p.team, guess: x.guess, draw: x.draw, book: x.book, score: x.guess + x.draw + x.book };
    })
    .sort((a, b) => b.score - a.score || hash(g.id + ':' + a.id) - hash(g.id + ':' + b.id));
}
function teamResults(res: ReturnType<typeof results>) {
  const groups: Record<string, { score: number; members: typeof res }> = {};
  for (const r of res) {
    const t = r.team ?? 'none';
    if (!groups[t]) groups[t] = { score: 0, members: [] };
    groups[t].score += r.score;
    groups[t].members.push(r);
  }
  return Object.entries(groups).map(([team, v]) => ({ team, score: v.score, members: v.members }));
}

// 지난 판 요약(결과 화면과 같은 계산 — 점수 순).
function summaryOf(env: Env, g: Game, now: number): Summary | null {
  if (phaseOf(g, now).kind !== 'done') return null;
  const res = results(env, g, playersOf(env, g.id));
  if (!res.length) return null;
  let board: { nick: string; label: string }[];
  if (g.mode === 'team') {
    const tr = teamResults(res);
    board = tr.map((t) => ({ nick: `${t.team}팀`, label: `${t.score}점` }));
  } else {
    board = res.map((r) => ({ nick: r.nick, label: `${r.score}점` }));
  }
  return { id: g.id, at: g.stepStart, count: res.length, board, mode: g.mode };
}
type Summary = { id: number; at: number | null; count: number; board: { nick: string; label: string }[]; mode: string };

// 화면을 보고 있는지: /state 를 부를 때마다 seen_at 을 갱신하고, AWAY_MS 동안 없으면 자리 비움.
// 앱은 화면이 가려지면 폴링을 멈춘다. 가상 참가자(bot- 키)는 진행자 화면이 대신 움직이니 항상 있는 걸로 친다.
const AWAY_MS = 15000;
function touch(env: Env, gameId: number, seatId: number, now: number) {
  const { rows } = env.db.query(`UPDATE bbq_telestration__presence SET seen_at = $1 WHERE seat_id = $2 RETURNING seat_id`, [now, seatId]);
  if (!rows.length) env.db.query(`INSERT INTO bbq_telestration__presence (game_id, seat_id, seen_at) VALUES ($1, $2, $3)`, [gameId, seatId, now]);
}
function awaySet(env: Env, gameId: number, list: { id: number; key: string }[], now: number) {
  const seen: Record<number, number> = {};
  env.db.query(`SELECT seat_id, seen_at FROM bbq_telestration__presence WHERE game_id = $1`, [gameId]).rows.forEach((r) => { seen[Number(r.seat_id)] = Number(r.seen_at); });
  return new Set(list.filter((p) => !p.key.startsWith('bot-') && (seen[p.id] ?? 0) < now - AWAY_MS).map((p) => p.id));
}

// 고른 난이도에서 n 개를 고른다(이미 나온 제시어는 빼고, 모자라면 그 단계만 다시 푼다).
function pickWords(env: Env, tier: string, n: number) {
  const pool = WORDS[tier] ?? WORDS.easy;
  const used = new Set(env.db.query(`SELECT word FROM bbq_telestration__used WHERE tier = $1 AND deleted_at IS NULL`, [tier]).rows.map((r) => String(r.word)));
  let fresh = pool.filter((w) => !used.has(w));
  if (fresh.length < n) {
    env.db.query(`UPDATE bbq_telestration__used SET deleted_at = NOW() WHERE tier = $1 AND deleted_at IS NULL`, [tier]);
    fresh = pool.slice();
  }
  let out = shuffle(fresh).slice(0, n);
  while (out.length < n) out = out.concat(shuffle(pool).slice(0, n - out.length)); // 제시어 수가 참가자보다 적은 난이도는 되풀이해서 채운다
  out.forEach((w) => {
    const { rows } = env.db.query(`UPDATE bbq_telestration__used SET deleted_at = NULL WHERE word = $1 RETURNING word`, [w]);
    if (!rows.length) env.db.query(`INSERT INTO bbq_telestration__used (word, tier) VALUES ($1, $2)`, [w, tier]);
  });
  return out;
}

let dbMigrated = false;
export function handle(req: Req, env: Env) {
  if (!dbMigrated) {
    dbMigrated = true;
    env.db.query(`ALTER TABLE bbq_telestration__matches ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'individual'`);
    env.db.query(`ALTER TABLE bbq_telestration__seats ADD COLUMN IF NOT EXISTS team TEXT`);
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const now = Date.now();

  if (req.path === '/health') return ok({});

  // 화면 전체 상태(그림 내용은 빼고). 앱이 1.5초마다 부른다.
  if (req.method === 'GET' && req.path === '/state') {
    const key = readKey(req.query.key);
    const g = advance(env, currentGame(env), now), ph = phaseOf(g, now);
    const host = isHost(env, key, g?.id ?? null), hostClaimable = false, canOpen = !g || ph.kind === 'none' || ph.kind === 'done';
    if (!g || ph.kind === 'none') return ok({ now, game: null, players: [], meId: null, host, hostClaimable, canOpen });
    const list = playersOf(env, g.id), me = list.find((p) => p.key === key);
    if (me) touch(env, g.id, me.id, now);
    const away = awaySet(env, g.id, list, now);
    const out: Record<string, unknown> = {
      now, host, hostClaimable, canOpen, meId: me ? me.id : null,
      game: {
        id: g.id, status: g.status, steps: g.steps, dSec: g.dSec, gSec: g.gSec, voteSec: g.voteSec, penalty: g.penalty, tier: g.tier,
        curStep: g.curStep, stepStart: g.stepStart, voteEnd: g.voteEnd, books: g.status === 'lobby' ? 0 : seated(list).length, mode: g.mode,
      },
      players: list.map((p) => ({ id: p.id, nick: p.nick, seat: p.seat, joinedAt: p.joinedAt, away: away.has(p.id), team: p.team })),
    };
    if (ph.kind === 'step' || ph.kind === 'wait') out.submitted = submittedCount(env, g.id, g.curStep);
    if (ph.kind === 'done') {
      const res = results(env, g, list);
      out.results = res;
      if (g.mode === 'team') out.teamResults = teamResults(res);
    }
    return ok(out);
  }

  if (req.method === 'POST' && req.path === '/join') {
    const key = readKey(body.key);
    const nick = typeof body.nick === 'string' ? body.nick.trim().slice(0, MAX_NICK) : '';
    if (!key) return bad('잘못된 요청이에요.');
    if (!nick) return bad('별명을 적어 주세요.');
    const g = currentGame(env), ph = phaseOf(g, now);
    if (!g || ph.kind === 'none' || ph.kind === 'done') return bad('지금은 열린 판이 없어요.', 409);
    const { rows: updated } = env.db.query(
      `UPDATE bbq_telestration__seats SET nick = $1, deleted_at = NULL WHERE game_id = $2 AND player_key = $3 RETURNING id`,
      [nick, g.id, key],
    );
    if (updated.length) return ok({});
    if (ph.kind !== 'lobby') return bad('이미 시작한 판이에요. 다음 판에 함께해 주세요.', 409);
    const { rows: cnt } = env.db.query(`SELECT COUNT(*)::int AS n FROM bbq_telestration__seats WHERE game_id = $1 AND deleted_at IS NULL`, [g.id]);
    if (Number(cnt[0]?.n ?? 0) >= MAX_PLAYERS) return bad('참가 인원이 가득 찼어요.', 409);
    env.db.query(`INSERT INTO bbq_telestration__seats (game_id, player_key, nick, joined_at) VALUES ($1, $2, $3, $4)`, [g.id, key, nick, now]);
    return ok({});
  }

  // 지금 내가 채울 칸 + 앞사람이 남긴 것.
  if (req.method === 'GET' && req.path === '/task') {
    const key = readKey(req.query.key);
    const g = advance(env, currentGame(env), now), ph = phaseOf(g, now);
    if (!g || (ph.kind !== 'step' && ph.kind !== 'wait')) return bad('지금은 채울 칸이 없어요.', 409);
    const list = seated(playersOf(env, g.id)), me = list.find((p) => p.key === key);
    if (!me) return bad('이번 판 참가자가 아니에요.', 403);
    const n = list.length, k = g.curStep;
    let book: number;
    if (g.mode === 'team') {
      const aList = list.filter((p) => p.team === 'A'), bList = list.filter((p) => p.team === 'B');
      const isA = me.team === 'A';
      const teamOffset = isA ? 0 : aList.length;
      const teamSize = isA ? aList.length : bList.length;
      const myTeamSeat = me.seat! - teamOffset;
      book = teamOffset + mod(myTeamSeat - (k - 1), teamSize);
    } else {
      book = mod(me.seat! - (k - 1), n);
    }
    const pages = pagesOf(env, g.id, book, true);
    const mine = pages.find((e) => e.step === k);
    const kind = kindOf(k);
    // 그리기 칸엔 가장 최근 글(추측 또는 제시어), 추측 칸엔 가장 최근 그림을 보여준다.
    let prev: { kind: string; content: string } | null = null;
    for (let s = k - 1; s >= 1 && !prev; s--) {
      const e = pages.find((x) => x.step === s);
      if (e && e.kind === (kind === 'draw' ? 'guess' : 'draw')) prev = { kind: e.kind, content: e.content };
    }
    if (!prev && kind === 'draw') prev = { kind: 'word', content: g.words[book] ?? '' };
    return ok({ step: k, kind, book, ownerNick: list[book]?.nick ?? '', prev, mine: mine ? mine.content : null, isFirst: k === 1 });
  }

  if (req.method === 'POST' && req.path === '/submit') {
    const key = readKey(body.key);
    const g = currentGame(env);
    if (!g || g.status !== 'running' || Number(body.step) !== g.curStep || g.stepStart == null || now < g.stepStart || now >= g.stepStart + durOf(g, g.curStep) + BUFFER_MS) {
      return bad('이 칸은 이미 마감됐어요.', 409);
    }
    const list = seated(playersOf(env, g.id)), me = list.find((p) => p.key === key);
    if (!me) return bad('이번 판 참가자가 아니에요.', 403);
    const k = g.curStep, kind = kindOf(k);
    let book: number;
    if (g.mode === 'team') {
      const aList = list.filter((p) => p.team === 'A'), bList = list.filter((p) => p.team === 'B');
      const isA = me.team === 'A';
      const teamOffset = isA ? 0 : aList.length;
      const teamSize = isA ? aList.length : bList.length;
      const myTeamSeat = me.seat! - teamOffset;
      book = teamOffset + mod(myTeamSeat - (k - 1), teamSize);
    } else {
      book = mod(me.seat! - (k - 1), list.length);
    }
    let content = typeof body.content === 'string' ? body.content : '';
    if (kind === 'draw') {
      if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(content) || content.length > MAX_DRAWING) return bad('그림을 저장하지 못했어요.');
    } else {
      content = content.trim().slice(0, MAX_GUESS);
      if (!content) return bad('추측을 적어 주세요.');
    }
    const { rows: updated } = env.db.query(
      `UPDATE bbq_telestration__pages SET content = $1, author_id = $2 WHERE game_id = $3 AND book = $4 AND step = $5 RETURNING id`,
      [content, me.id, g.id, book, k],
    );
    if (!updated.length) {
      env.db.query(
        `INSERT INTO bbq_telestration__pages (game_id, book, step, author_id, kind, content) VALUES ($1, $2, $3, $4, $5, $6)`,
        [g.id, book, k, me.id, kind, content],
      );
    }
    advance(env, g, now);
    return ok({});
  }

  // 공개용 요약: 스케치북마다 처음 제시어 + 마지막 칸.
  if (req.method === 'GET' && req.path === '/books') {
    const g = currentGame(env), ph = phaseOf(g, now);
    if (!g || ph.kind !== 'done') return bad('아직 공개 전이에요.', 409);
    const list = seated(playersOf(env, g.id));
    const last: Record<number, Page> = {};
    pagesOf(env, g.id, null, true).forEach((e) => { if (!last[e.book] || e.step > last[e.book].step) last[e.book] = e; });
    return ok({
      books: list.map((p, idx) => ({ idx, ownerNick: p.nick, word: g.words[idx] ?? '', last: last[idx] ? { kind: last[idx].kind, content: last[idx].content, step: last[idx].step } : null })),
    });
  }

  // 스케치북 한 권(제시어 + 칸 전부). 투표 중에도 그린 사람 이름을 보여준다.
  // 결과가 나오면 받은 띵작·망작 표 수도 추가로 보여준다.
  // gameId 를 주면 끝난 지난 판(최근 30판 안)의 스케치북도 볼 수 있다.
  if (req.method === 'GET' && req.path === '/book') {
    const gid = readInt(req.query.gameId, 0, 1e9, 0);
    const g = gid ? recentGames(env, 30).find((x) => x.id === gid) ?? null : currentGame(env), ph = phaseOf(g, now);
    if (gid && ph.kind !== 'done') return bad('끝난 판만 볼 수 있어요.', 409);
    if (!g || ph.kind !== 'done') return bad('아직 공개 전이에요.', 409);
    const all = playersOf(env, g.id), list = seated(all), idx = readInt(req.query.idx, 0, Math.max(0, list.length - 1), 0);
    const me = all.find((p) => p.key === readKey(req.query.key));
    const nick: Record<number, string> = {};
    list.forEach((p) => { nick[p.id] = p.nick; });
    // 맞춤 표시는 이 권만 보고 계산한다(bookScores 는 권별로 독립).
    const raw = pagesOf(env, g.id, idx, true), matched = bookScores(g, raw).matched;
    const pages = raw.map((e) => ({
      id: e.id, step: e.step, kind: e.kind, content: e.content, mine: !!me && e.authorId === me.id,
      authorNick: nick[e.authorId] ?? '', matched: matched.has(e.id),
    }));
    return ok({ idx, word: g.words[idx] ?? '', ownerNick: list[idx]?.nick ?? '', team: g.mode === 'team' ? list[idx]?.team ?? null : null, entries: pages });
  }

  // 스케치북 전부.
  if (req.method === 'GET' && req.path === '/allbooks') {
    const g = currentGame(env), ph = phaseOf(g, now);
    if (!g || ph.kind !== 'done') return bad('아직 공개 전이에요.', 409);
    const all = playersOf(env, g.id), list = seated(all);
    const me = all.find((p) => p.key === readKey(req.query.key));
    const nick: Record<number, string> = {};
    list.forEach((p) => { nick[p.id] = p.nick; });
    const pages = pagesOf(env, g.id, null, true);
    const matched = bookScores(g, pages).matched;
    return ok({
      books: list.map((p, idx) => ({
        idx, word: g.words[idx] ?? '', ownerNick: p.nick, team: g.mode === 'team' ? p.team : null,
        entries: pages.filter((e) => e.book === idx).map((e) => ({
          id: e.id, step: e.step, kind: e.kind, content: e.content, mine: !!me && e.authorId === me.id,
          authorNick: nick[e.authorId] ?? '', matched: matched.has(e.id),
        })),
      })),
    });
  }

  // 지난 게임 결과(최근 10판, 오래된 판부터 1번째).
  if (req.method === 'GET' && req.path === '/history') {
    const items = recentGames(env, 30).reverse().map((g) => summaryOf(env, g, now)).filter((x): x is Summary => !!x);
    return ok({ history: items.map((x, i) => ({ no: i + 1, ...x })).reverse().slice(0, 10) });
  }

  // ── 진행자 ────────────────────────────────────────────────
  // 진행자는 처음 "내가 진행자 하기"를 누른 브라우저 하나뿐이다.
  if (req.method === 'POST' && req.path === '/host/claim') {
    const key = readKey(body.key);
    if (!key) return bad('잘못된 요청이에요.');
    if (isHost(env, key)) return ok({ host: true });
    const { rows } = env.db.query(
      `INSERT INTO bbq_telestration__hosts (owner_key) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM bbq_telestration__hosts) RETURNING owner_key`,
      [key],
    );
    if (!rows.length) return bad('이미 진행자가 정해져 있어요.', 403);
    return ok({ host: true });
  }

  if (req.method === 'POST' && req.path.startsWith('/host/')) {
    const hostKey = readKey(body.key);
    const g = currentGame(env), ph = phaseOf(g, now);

    // 새 판은 진행 중인 판이 없으면 누구나 연다. 연 사람이 그 판의 진행자가 된다.
    if (req.path === '/host/new') {
      if (!hostKey) return bad('잘못된 요청이에요.');
      if (g && ph.kind !== 'none' && ph.kind !== 'done') return bad('진행 중인 판이 있어요. 먼저 끝내 주세요.', 409);
      const gameMode = body.mode === 'team' ? 'team' : 'individual';
      const { rows: made } = env.db.query(
        `INSERT INTO bbq_telestration__matches (status, steps, d_sec, g_sec, vote_sec, penalty, words, cur_step, mode) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        ['lobby', readInt(body.steps, 0, 100, 0), readInt(body.dSec, 20, 180, 40), readInt(body.gSec, 10, 90, 20), readInt(body.voteSec, 30, 600, 180), readInt(body.penalty, 1, 10, 3), JSON.stringify({ tier: TIERS.includes(String(body.tier)) ? String(body.tier) : 'easy' }), 0, gameMode],
      );
      env.db.query(`INSERT INTO bbq_telestration__openers (game_id, owner_key) VALUES ($1, $2)`, [Number(made[0].id), hostKey]);
      return ok({});
    }
    if (!isHost(env, hostKey, g?.id ?? null)) return bad('진행자만 할 수 있어요.', 403);
    if (!g) return bad('열린 판이 없어요.', 409);

    if (req.path === '/host/start') {
      if (ph.kind !== 'lobby') return bad('이미 시작했어요.', 409);
      // 시작하는 순간 화면을 보고 있는 사람만 자리를 받는다(나머지는 이번 판 구경).
      const everyone = playersOf(env, g.id), awayIds = awaySet(env, g.id, everyone, now), list = everyone.filter((p) => !awayIds.has(p.id));
      if (list.length < 2) return bad('화면을 보고 있는 사람이 2명 이상이어야 시작할 수 있어요.', 409);
      if (g.mode === 'team') {
        const unassigned = list.filter((p) => p.team !== 'A' && p.team !== 'B');
        if (unassigned.length) return bad(`팀 미배정 참가자가 ${unassigned.length}명 있어요. 모두 팀에 배정해 주세요.`, 409);
        // 팀전: A팀 먼저(joinedAt순), 그다음 B팀(joinedAt순) → seat 0,1,...
        const aTeam = list.filter((p) => p.team === 'A').sort((a, b) => a.joinedAt - b.joinedAt);
        const bTeam = list.filter((p) => p.team === 'B').sort((a, b) => a.joinedAt - b.joinedAt);
        [...aTeam, ...bTeam].forEach((p, i) => env.db.query(`UPDATE bbq_telestration__seats SET seat = $1 WHERE id = $2`, [i, p.id]));
        const totalBooks = aTeam.length + bTeam.length;
        const words = pickWords(env, g.tier, totalBooks);
        const teamSteps = Math.max(aTeam.length, bTeam.length);
        const steps = Math.min(g.steps || Infinity, teamSteps + 1); // +1은 제시어 칸
        env.db.query(
          `UPDATE bbq_telestration__matches SET status = $1, cur_step = $2, step_start = $3, words = $4, steps = $5 WHERE id = $6`,
          ['running', 1, now + START_DELAY_MS, JSON.stringify(words), steps, g.id],
        );
      } else {
        // 개인전: 자리는 무작위로 섞어서 정한다(옆자리 친한 사람끼리 이어지지 않게).
        shuffle(list).forEach((p, i) => env.db.query(`UPDATE bbq_telestration__seats SET seat = $1 WHERE id = $2`, [i, p.id]));
        const words = pickWords(env, g.tier, list.length);
        // 칸 수 0 = 자동: 스케치북이 모든 사람을 한 바퀴 돈다. 직접 정해도 참가 인원을 넘지 않는다. +1 은 제시어 칸.
        const steps = Math.min(g.steps || Infinity, list.length + 1);
        env.db.query(
          `UPDATE bbq_telestration__matches SET status = $1, cur_step = $2, step_start = $3, words = $4, steps = $5 WHERE id = $6`,
          ['running', 1, now + START_DELAY_MS, JSON.stringify(words), steps, g.id],
        );
      }
      return ok({});
    }
    if (req.path === '/host/team') {
      if (ph.kind !== 'lobby') return bad('로비에서만 팀을 배정할 수 있어요.', 409);
      const seatId = readInt(body.seatId, 0, 1e9, 0);
      const team = body.team === 'A' ? 'A' : body.team === 'B' ? 'B' : null;
      env.db.query(`UPDATE bbq_telestration__seats SET team = $1 WHERE id = $2 AND game_id = $3`, [team, seatId, g.id]);
      return ok({});
    }
    if (req.path === '/host/cancel') {
      env.db.query(`UPDATE bbq_telestration__matches SET status = $1 WHERE id = $2`, ['cancelled', g.id]);
      return ok({});
    }
  }

  return bad('없는 경로예요.', 404);
}
