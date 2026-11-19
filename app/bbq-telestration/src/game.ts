// 텔레스트레이션 화면 로직. 서버 상태를 1.5초마다 받아와 그린다. 칸 진행(시간 끝 또는 전원 제출)과
// 투표 마감은 서버가 정하고, 화면은 서버 시계 오프셋으로 남은 시간만 계산한다.
// 그림 내용은 state 에 싣지 않고 필요할 때 /task, /books, /book 으로 따로 받는다.
import { ApiError, apiClient } from './lib/apiClient';
import { botDrawing, botGuess, rememberBotDrawing } from './bots';

type Game = {
  id: number; status: string; steps: number; dSec: number; gSec: number; tier?: string;
  curStep: number; stepStart: number | null; books: number; mode: string;
};
type Player = { away?: boolean; id: number; nick: string; seat: number | null; joinedAt: number; team?: string | null };
type Result = { id: number; nick: string; team?: string | null; guess: number; draw: number; book: number; score: number };
type TeamResult = { team: string; score: number; members: Result[] };
type State = {
  now: number; game: Game | null; players: Player[]; meId: number | null; host: boolean; hostClaimable: boolean; canOpen?: boolean;
  submitted?: number; results?: Result[]; teamResults?: TeamResult[];
};
type Phase =
  | { kind: 'none' | 'lobby' | 'done' }
  | { kind: 'starting'; left: number }
  | { kind: 'wait'; k: number; left: number }
  | { kind: 'step'; k: number; editing: boolean; left: number; dur: number };
type Task = { step: number; kind: 'draw' | 'guess'; book: number; ownerNick: string; prev: { kind: string; content: string } | null; mine: string | null; isFirst: boolean };
type BookEntry = { id: number; step: number; kind: string; content: string; mine: boolean; authorNick?: string; matched?: boolean };

const BASE = '/api/bbq-telestration';
const POLL_MS = 1500;
const KEY_STORAGE = 'telestration-key';
const NICK_STORAGE = 'telestration-nick';
const COLORS = [
  { c: '#1f1a17', n: '검정' }, { c: '#e23f2c', n: '빨강' }, { c: '#ff8a3d', n: '주황' }, { c: '#f2c230', n: '노랑' },
  { c: '#4c9a36', n: '초록' }, { c: '#2b6f8c', n: '파랑' }, { c: '#8a4426', n: '갈색' }, { c: '#ffffff', n: '지우개' },
];
const SIZES = [4, 10, 22];
const TIER_LABEL: Record<string, string> = { easy: '하', medium: '중', hard: '상', core: '코어전용' };

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
function num(id: string, lo: number, hi: number, def: number) {
  const el = $<HTMLInputElement>(id); const v = Math.max(lo, Math.min(hi, parseInt(el.value) || def)); el.value = String(v); return v;
}
function load(k: string) { try { return localStorage.getItem(k) || ''; } catch { return ''; } }
function store(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* 이번 방문 동안만 유지 */ } }

// 이 브라우저를 구분하는 랜덤 키. 로그인 정보 대신 쓴다.
let memoryKey = '';
function myKey() {
  const saved = load(KEY_STORAGE);
  if (saved) return saved;
  if (!memoryKey) {
    memoryKey = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    store(KEY_STORAGE, memoryKey);
  }
  return memoryKey;
}
const errText = (e: unknown, def: string) => (e instanceof ApiError ? (e.body as { error?: string } | undefined)?.error : undefined) || def;

/* ---------- state ---------- */
let st: State | null = null;
let offset = 0; // 서버 시계 - 내 시계
let polling = false, failures = 0, renaming = false, lastKey = '';
let confirmAction = '';
const now = () => Date.now() + offset;

async function poll() {
  if (polling) return; polling = true;
  const t0 = Date.now();
  let res: State;
  try { res = await apiClient.get<State>(`${BASE}/state?key=${encodeURIComponent(myKey())}`); }
  catch {
    polling = false;
    if (++failures >= 3) notice('연결이 불안정해요', '자동으로 다시 연결하고 있어요. 계속 이러면 새로고침해 주세요.');
    return;
  }
  polling = false;
  offset = res.now - (t0 + Date.now()) / 2;
  st = res; failures = 0; render();
}

function phase(): Phase {
  const g = st?.game;
  if (!g) return { kind: 'none' };
  if (g.status === 'lobby') return { kind: 'lobby' };
  if (g.status === 'finished') return { kind: 'done' };
  if (g.status === 'voting') return { kind: 'done' };
  const start = g.stepStart ?? now();
  if (now() < start) return g.curStep === 1 ? { kind: 'starting', left: (start - now()) / 1000 } : { kind: 'wait', k: g.curStep, left: (start - now()) / 1000 };
  const dur = g.curStep % 2 === 1 ? g.dSec : g.gSec;
  const left = (start + dur * 1000 - now()) / 1000;
  return { kind: 'step', k: g.curStep, editing: left > 0, left, dur };
}
const phaseKey = (ph: Phase) => ph.kind + ('k' in ph ? `${ph.k}${'editing' in ph && ph.editing ? 'e' : 'w'}` : '');
const meOf = () => st?.players.find((p) => p.id === st?.meId);
const seatedCount = () => (st?.players ?? []).filter((p) => p.seat != null).length;

/* ---------- screens ---------- */
const SCREENS = ['notice', 'lobby', 'draw', 'guess', 'wait', 'result'];
let shown = 'notice';
function show(id: string) {
  document.getElementById('history')?.toggleAttribute('data-off', ['draw','guess','wait'].includes(id));
  if (shown === id) return;
  shown = id; SCREENS.forEach((s) => ($('#' + s).hidden = s !== id)); window.scrollTo({ top: 0 });
  if (st) renderHost(phase());
}
function notice(t: string, b: string) { $('#nTitle').textContent = t; $('#nBody').textContent = b; show('notice'); }

function render() {
  if (!st) return;
  void loadHistory();
  const ph = phase();
  lastKey = phaseKey(ph);
  renderHost(ph);
  runBots(ph);
  const seated = meOf()?.seat != null;

  if (ph.kind === 'none' || ph.kind === 'lobby' || ph.kind === 'starting' || renaming) { renderLobby(ph); return; }
  if (ph.kind === 'step' || ph.kind === 'wait') {
    if (!seated) { renderLobby(ph); return; }
    if (ph.kind === 'step' && ph.editing) { void ensureTask(ph.k); return; }
    renderWait(ph); return;
  }
  renderResult();
}

function renderLobby(ph: Phase) {
  const me = meOf(), list = (st?.players ?? []).slice().sort((a, b) => a.joinedAt - b.joinedAt);
  const lobby = ph.kind === 'lobby' || ph.kind === 'starting';
  const running = ph.kind === 'step' || ph.kind === 'wait';
  $('#joinPanel').hidden = !(ph.kind === 'lobby' && (!me || renaming));
  $('#joinedPanel').hidden = !(lobby && me && !renaming);
  $('#waitGame').hidden = lobby && !(ph.kind === 'starting' && !me);
  $('#waitTitle').textContent = ph.kind === 'starting' && !me ? '곧 시작해요 · 이번 판은 구경 모드' : running ? '이번 판은 이미 시작했어요' : '아직 열린 판이 없어요';
  $('#waitSub').textContent = st?.host && (running || ph.kind === 'starting')
    ? '진행자님은 이번 판에 참가하지 않았어요. 위 진행자 메뉴에서 진행 상황을 볼 수 있고, 다 그리면 스케치북 구경과 결과는 같이 볼 수 있어요.'
    : running || ph.kind === 'starting' ? '다 그리고 나면 스케치북 구경은 같이 할 수 있어요. 다음 판에 꼭 함께해요!' : '진행자가 새 판을 열면 여기서 바로 참가할 수 있어요.';
  $('#joinTitle').textContent = renaming ? '별명 바꾸기' : '별명으로 참가하기';
  $('#join').textContent = renaming ? '바꾸기' : '참가하기';
  if (me) $('#joinedTitle').textContent = ph.kind === 'starting' ? `${Math.ceil(ph.left)}초 뒤 시작! 펜 준비하세요` : `${me.nick} 님, 참가 완료!`;
  $('#cnt').textContent = list.length ? list.length + '명' : '';
  const isTeamMode = st?.game?.mode === 'team';
  $('#chips').innerHTML = list.length ? list.map((p) => {
    const badge = isTeamMode && p.team ? ` <span class="teamBadge ${p.team}">${p.team}팀</span>` : '';
    return `<li class="${p.id === st!.meId ? 'me' : ''}${p.away ? ' away' : ''}">${esc(p.nick)}${badge}${p.away ? ' · 자리 비움' : ''}</li>`;
  }).join('') : '<li>아직 아무도 없어요</li>';
  show('lobby');
}

function renderWait(ph: Phase) {
  const n = seatedCount();
  if (ph.kind === 'wait') {
    $('#wEyebrow').textContent = `${ph.k - 1}칸 끝`;
    $('#wTitle').textContent = '다음 사람에게 넘기는 중…';
    $('#wSub').textContent = '곧 다음 칸이 열려요.';
    $('#wProg').hidden = true;
  } else if (ph.kind === 'step') {
    $('#wEyebrow').textContent = `${ph.k}칸 마감`;
    $('#wTitle').textContent = '남은 사람을 기다리는 중…';
    $('#wSub').textContent = `제출 ${st!.submitted ?? 0} / ${n}명 · 모두 내면 바로 넘어가요`;
    $('#wProg').hidden = false;
    $('#wBar').style.width = (n ? ((st!.submitted ?? 0) / n) * 100 : 0) + '%';
  }
  show('wait');
}

/* ---------- task (draw / guess) ---------- */
let task: Task | null = null, taskKey = '', taskLoading = false;
let dirty = false, autoSent = false, submitting = false;

async function ensureTask(k: number) {
  const key = `${st!.game!.id}:${k}`;
  if (taskKey === key && task) { showTask(); return; }
  if (taskLoading) return;
  taskLoading = true;
  try {
    const t = await apiClient.get<Task>(`${BASE}/task?key=${encodeURIComponent(myKey())}`);
    if (t.step !== k) return;
    task = t; taskKey = key; dirty = false; autoSent = false;
    setupTask();
    showTask();
  } catch (e) {
    notice('칸을 불러오지 못했어요', errText(e, '잠시 뒤 자동으로 다시 시도해요.'));
  } finally { taskLoading = false; }
}

function stepLabel(k: number) { return `${k} / ${(st?.game?.steps ?? 1) - 1}칸 · ${task?.ownerNick ?? ''}의 스케치북`; }

function setupTask() {
  if (!task) return;
  if (task.kind === 'draw') {
    resetCanvas();
    if (task.mine) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, cv.width, cv.height); img.src = task.mine; }
    const p = task.prev;
    $('#dPrompt').innerHTML = task.isFirst
      ? `내 제시어 <b>${esc(p?.content)}</b>그림으로만 설명해 주세요. 글자는 안 돼요!`
      : p?.kind === 'guess' ? `앞사람의 추측 <b>${esc(p.content)}</b>이걸 그려 주세요`
      : `앞사람 추측이 없어서 원래 제시어를 그려요 <b>${esc(p?.content)}</b>`;
    $('#dNote').textContent = '다 그렸으면 제출! 모두 내면 바로 다음 칸으로 넘어가요.';
  } else {
    const img = $<HTMLImageElement>('#gImg');
    const has = task.prev?.kind === 'draw';
    img.hidden = !has; $('#gNoImg').hidden = has;
    if (has) img.src = task.prev!.content;
    $<HTMLInputElement>('#gText').value = task.mine ?? '';
    $('#gNote').textContent = '적었으면 제출! 모두 내면 바로 다음 칸으로 넘어가요.';
  }
}

function showTask() {
  if (!task) return;
  const ph = phase();
  if (ph.kind !== 'step') return;
  if (task.kind === 'draw') { $('#dStep').textContent = stepLabel(task.step); show('draw'); }
  else { $('#gStep').textContent = stepLabel(task.step); show('guess'); }
  updateClock(ph);
}

function updateClock(ph: Phase) {
  if (ph.kind !== 'step' || !task) return;
  const pre = task.kind === 'draw' ? 'd' : 'g';
  $(`#${pre}Left`).textContent = Math.max(0, Math.ceil(ph.left)) + '초';
  $(`#${pre}Bar`).style.width = Math.max(0, (ph.left / ph.dur) * 100) + '%';
}

async function submitTask(auto: boolean) {
  if (!task || submitting) return;
  const ph = phase();
  if (ph.kind !== 'step' || ph.k !== task.step) return;
  let content: string;
  if (task.kind === 'draw') content = cv.toDataURL('image/jpeg', 0.72);
  else {
    content = $<HTMLInputElement>('#gText').value.trim();
    if (!content) { if (!auto) { $('#gNote').textContent = '추측을 적어 주세요.'; return; } content = '모르겠어요…'; }
  }
  submitting = true;
  const note = $(task.kind === 'draw' ? '#dNote' : '#gNote');
  try {
    await apiClient.post(`${BASE}/submit`, { key: myKey(), step: task.step, content });
    task.mine = content; dirty = false;
    note.textContent = auto ? '시간 끝! 자동으로 제출했어요.' : '제출했어요. 다른 사람을 기다리는 동안 고쳐서 다시 낼 수 있어요.';
    void poll();
  } catch (e) {
    note.textContent = errText(e, '제출하지 못했어요. 다시 눌러 주세요.');
  } finally { submitting = false; }
}

/* ---------- canvas ---------- */
let cv: HTMLCanvasElement, ctx: CanvasRenderingContext2D;
let color = COLORS[0].c, size = SIZES[1], drawing = false, last: { x: number; y: number } | null = null;
const undoStack: ImageData[] = [];

function resetCanvas() {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
  undoStack.length = 0;
}
function pos(e: PointerEvent) {
  const r = cv.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * cv.width) / r.width, y: ((e.clientY - r.top) * cv.height) / r.height };
}
function canDraw() { const ph = phase(); return ph.kind === 'step' && ph.editing && task?.kind === 'draw'; }
function line(a: { x: number; y: number }, b: { x: number; y: number }) {
  ctx.strokeStyle = color; ctx.lineWidth = color === '#ffffff' ? size * 2 : size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}
function setupCanvas() {
  cv = $<HTMLCanvasElement>('#cv');
  ctx = cv.getContext('2d')!;
  resetCanvas();
  cv.addEventListener('pointerdown', (e) => {
    if (!canDraw()) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    undoStack.push(ctx.getImageData(0, 0, cv.width, cv.height)); if (undoStack.length > 20) undoStack.shift();
    drawing = true; last = pos(e); line(last, { x: last.x + 0.01, y: last.y }); dirty = true;
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drawing || !last) return;
    const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    for (const ev of evs.length ? evs : [e]) { const p = pos(ev); line(last, p); last = p; }
  });
  const stop = () => { drawing = false; last = null; };
  cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);

  $('#colors').innerHTML = COLORS.map((c, i) => `<button class="sw${i === 0 ? ' on' : ''}" type="button" data-c="${c.c}" aria-label="${c.n}" style="background:${c.c}">${c.c === '#ffffff' ? '지우개' : ''}</button>`).join('');
  $('#sizes').innerHTML = SIZES.map((s) => `<button class="sz${s === size ? ' on' : ''}" type="button" data-s="${s}" aria-label="굵기 ${s}"><i style="width:${Math.min(22, s)}px;height:${Math.min(22, s)}px"></i></button>`).join('');
  $('#colors').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.sw'); if (!b) return;
    color = b.dataset.c!; document.querySelectorAll('.sw').forEach((x) => x.classList.toggle('on', x === b));
  });
  $('#sizes').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.sz'); if (!b) return;
    size = Number(b.dataset.s); document.querySelectorAll('.sz').forEach((x) => x.classList.toggle('on', x === b));
  });
  $('#undo').addEventListener('click', () => { const d = undoStack.pop(); if (d) { ctx.putImageData(d, 0, 0); dirty = true; } });
  $('#clear').addEventListener('click', () => {
    if (!canDraw()) return;
    undoStack.push(ctx.getImageData(0, 0, cv.width, cv.height));
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height); dirty = true;
  });
}

/* ---------- 결과: 스케치북 레인 ---------- */
// 그림이 커서 한 번에 받으면 응답 크기 제한에 걸릴 수 있어 /book 으로 한 권씩 받는다.
type LaneBook = { idx: number; word: string; ownerNick: string | null; team?: string | null; entries: BookEntry[] };
let lanes: LaneBook[] | null = null, lanesFor = '', lanesLoading = false;

async function loadLanes() {
  const key = `${st!.game!.id}`;
  if (lanesFor === key) return true;
  if (lanesLoading) return false;
  lanesLoading = true;
  try {
    const n = st!.game!.books;
    const got = await Promise.all(Array.from({ length: n }, (_, i) => apiClient.get<LaneBook>(`${BASE}/book?key=${encodeURIComponent(myKey())}&idx=${i}`)));
    lanes = got; lanesFor = key;
  } catch { /* 다음 폴링 때 다시 */ }
  lanesLoading = false;
  return lanesFor === key;
}

function lanesHTML(list: LaneBook[], steps = st!.game!.steps) {
  const total = steps - 1;
  return list.map((b) => {
    const owner = b.ownerNick ? `${esc(b.ownerNick)}의 스케치북` : `스케치북 ${b.idx + 1}`;
    const cards = [`<li class="slide word"><span class="lbl">처음 제시어</span><b>${esc(b.word)}</b><span class="lbl">${owner} · 옆으로 넘겨 보세요 →</span></li>`];
    for (let s = 1; s <= total; s++) {
      const e = b.entries.find((x) => x.step === s), kindLabel = s % 2 === 1 ? '그림' : '추측';
      if (!e) { cards.push(`<li class="slide"><span class="lbl">${s}칸 · ${kindLabel}</span><p class="said missing">시간 안에 못 냈어요</p></li>`); continue; }
      const body = e.kind === 'draw' ? `<div class="imgWrap"><img src="${esc(e.content)}" alt="${s}칸 그림" loading="lazy" onerror="this.parentNode.dataset.err='1'"></div>` : `<p class="said">“${esc(e.content)}”</p>`;
      const who = e.authorNick ? `<b>${esc(e.authorNick)}</b>의 ${kindLabel}` : e.mine ? `<b>내</b> ${kindLabel}` : kindLabel;
      const foot = e.matched ? '<div class="matched">정답! ✓</div>' : '';
      cards.push(`<li class="slide"><span class="lbl">${s}칸 · ${who}</span>${body}${foot}</li>`);
    }
    const tm = b.team === 'A' || b.team === 'B' ? b.team : '';
    return `<section class="lane${tm ? ' team ' + tm : ''}"><h3><span>${b.idx + 1}</span>${esc(b.word)}${tm ? `<span class="teamBadge ${tm}">${tm}팀</span>` : ''}</h3><ol class="track">${cards.join('')}</ol></section>`;
  }).join('');
}

/* ---------- result ---------- */
let laneTeam = ''; // 결과 화면 스케치북 팀 필터('' = 전체)
function renderResult() {
  show('result');
  $('#rLanes').dataset.team = laneTeam;
  // 팀전 결과 점수 박스
  const tr = st?.teamResults;
  const rts = $('#rTeamScore');
  if (tr && tr.length >= 2) {
    const sorted = tr.slice().sort((a, b) => b.score - a.score);
    rts.hidden = false;
    rts.innerHTML = `<div class="teamScoreWrap">${sorted.map((t) => `<button type="button" class="teamBox ${t.team}${laneTeam === t.team ? ' on' : ''}" data-team="${t.team}" aria-pressed="${laneTeam === t.team}">${t.team}팀<br><span class="teamPt">${t.score}점</span></button>`).join('<span class="teamVs">vs</span>')}</div>`;
  } else {
    rts.hidden = true;
  }
  void (async () => {
    if (await loadLanes() && $('#rLanes').dataset.for !== lanesFor) { $('#rLanes').innerHTML = lanesHTML(lanes!); $('#rLanes').dataset.for = lanesFor; }
  })();
}

/* ---------- host ---------- */
function renderHost(ph: Phase) {
  $('#claimBox').hidden = !st!.hostClaimable;
  // 진행자도 그리는 동안엔 메뉴가 그림판을 밀어내지 않게 숨긴다.
  $('#host').hidden = !(st!.host || st!.canOpen) || shown === 'draw' || shown === 'guess';
  if (!st!.host) $('#hostBar').hidden = true;
  if (!st!.host && !st!.canOpen) return;
  const g = st!.game, n = st!.players.length, seatedN = seatedCount();
  $('#hStat').textContent = ph.kind === 'none' ? '열린 판 없음'
    : ph.kind === 'lobby' ? `모집 중 · 난이도 ${TIER_LABEL[g?.tier ?? 'easy'] ?? '하'} · 참가 ${n}명${awayCount() ? ` · 자리 비움 ${awayCount()}명은 시작하면 빠져요` : ''}`
    : ph.kind === 'starting' ? '곧 시작해요'
    : ph.kind === 'wait' ? `${ph.k} / ${g!.steps - 1}칸 준비 중`
    : ph.kind === 'step' ? `${ph.k} / ${g!.steps - 1}칸 · 제출 ${st!.submitted ?? 0} / ${seatedN}명 · 자동 진행 중`
    : '결과 발표됨';
  const idle = ph.kind === 'none' || ph.kind === 'done';
  $('#hTitle').textContent = idle ? '새 판을 열어볼까요?' : '진행자 메뉴';
  $('#hTitle').classList.toggle('htitle', idle);
  $('#hStat').hidden = idle;
  $('#hSettings').hidden = !idle; $('#hNew').hidden = !idle;
  // 팀 배정 패널: 팀전 + 로비 단계에서만 표시
  const isTeam = st!.game?.mode === 'team' || (!st!.game && $<HTMLInputElement>('#modeTeam').checked);
  $('#hTeam').hidden = !isTeam || ph.kind !== 'lobby';
  if (isTeam && ph.kind === 'lobby') renderTeamAssign();
  $('#hBots').hidden = ph.kind !== 'lobby';
  $('#hCopy').hidden = ph.kind !== 'lobby';
  const main = $<HTMLButtonElement>('#hMain');
  main.hidden = ph.kind !== 'lobby';
  const teamUnassigned = ph.kind === 'lobby' && st!.game?.mode === 'team'
    ? (st!.players ?? []).filter((p) => !p.away && p.team !== 'A' && p.team !== 'B').length
    : 0;
  main.disabled = ph.kind === 'lobby' && (n < 2 || teamUnassigned > 0);
  main.className = 'btn hot';
  const hostOut = ph.kind === 'lobby' && !meOf();
  main.textContent = n < 2 ? '2명 이상 모이면 시작할 수 있어요'
    : teamUnassigned > 0 ? `팀 미배정 ${teamUnassigned}명 → 모두 배정해야 시작해요`
    : hostOut ? (confirmAction === 'start' ? '진행자는 빼고 시작할까요? 한 번 더 누르기' : '시작! (진행자도 하려면 먼저 아래에서 참가)') : '시작!';
  const cancel = $('#hCancel');
  cancel.hidden = idle;
  cancel.textContent = confirmAction === 'cancel' ? '정말 이 판을 취소할까요? 한 번 더 누르기' : '이 판 취소하기';
  // 그리기·추측 중엔 메뉴 대신 화면 아래 작은 줄에서 중단할 수 있다.
  $('#hostBar').hidden = !st!.host || !(shown === 'draw' || shown === 'guess');
  $('#hbStat').textContent = $('#hStat').textContent;
  const hb = $('#hbCancel');
  hb.textContent = confirmAction === 'cancel' ? '정말 중단할까요? 한 번 더 누르기' : '게임 중단하기';
  hb.className = 'btn small' + (confirmAction === 'cancel' ? ' warn' : ' ghost');
}

function renderTeamAssign() {
  const players = (st?.players ?? []).filter((p) => !p.away).sort((a, b) => a.joinedAt - b.joinedAt);
  const aCount = players.filter((p) => p.team === 'A').length;
  const bCount = players.filter((p) => p.team === 'B').length;
  $('#hTeamList').innerHTML = `<div class="teamCount">A팀 ${aCount}명 / B팀 ${bCount}명</div>`
    + players.map((p) => `<div class="teamAssignRow" data-id="${p.id}">
      <span class="nick">${esc(p.nick)}</span>
      <button class="teamBtn A${p.team === 'A' ? ' on' : ''}" data-team="A" data-sid="${p.id}">A팀</button>
      <button class="teamBtn B${p.team === 'B' ? ' on' : ''}" data-team="B" data-sid="${p.id}">B팀</button>
    </div>`).join('');
}

async function hostCall(path: string, data: Record<string, unknown> = {}) {
  $('#hErr').hidden = true;
  try { await apiClient.post(`${BASE}/host/${path}`, { ...data, key: myKey() }); }
  catch (e) { $('#hErr').textContent = errText(e, '처리하지 못했어요. 잠시 뒤 다시 눌러 주세요.'); $('#hErr').hidden = false; }
  await poll();
}
function confirmTwice(action: string, run: () => void) {
  if (confirmAction !== action) {
    confirmAction = action; if (st) renderHost(phase());
    setTimeout(() => { if (confirmAction === action) { confirmAction = ''; if (st) renderHost(phase()); } }, 4000);
    return;
  }
  confirmAction = ''; run();
}

const phaseName = () => phase().kind;

// 화면을 안 보고 있는 참가자 수(서버가 15초 기준으로 알려준다)
const awayCount = () => (st?.players ?? []).filter((p) => p.away).length;

/* ---------- 지난 게임 결과 ---------- */
type Hist = { no: number; id: number; at: number | null; count: number; board: { nick: string; label: string }[]; mode?: string };
let hist: Hist[] = [], histFor = '', histOpen = -1;
async function loadHistory() {
  const key = `${st?.game?.id ?? ''}:${st?.game?.status ?? ''}:${phaseName()}`;
  if (histFor === key) return;
  histFor = key;
  try { hist = (await apiClient.get<{ history: Hist[] }>(`${BASE}/history`)).history; } catch { histFor = ''; return; }
  renderHistory();
}
// 지난 판 스케치북(펼쳤을 때만 한 권씩 받아온다)
const histLanes = new Map<number, LaneBook[] | 'loading' | 'error'>();
async function loadHistLanes(h: Hist) {
  if (histLanes.has(h.id)) return;
  histLanes.set(h.id, 'loading');
  try {
    const got = await Promise.all(Array.from({ length: h.count }, (_, i) => apiClient.get<LaneBook>(`${BASE}/book?key=${encodeURIComponent(myKey())}&gameId=${h.id}&idx=${i}`)));
    histLanes.set(h.id, got);
  } catch { histLanes.set(h.id, 'error'); }
  if (histOpen === h.id) renderHistory();
}
function histLanesHTML(h: Hist) {
  const v = histLanes.get(h.id);
  if (!v || v === 'loading') { void loadHistLanes(h); return '<p class="hint">그림 불러오는 중…</p>'; }
  if (v === 'error') return '<p class="hint">그림을 불러오지 못했어요. 접었다 다시 펼쳐 보세요.</p>';
  const steps = Math.max(2, ...v.flatMap((b) => b.entries.map((e) => e.step))) + 1;
  return `<div class="lanes">${lanesHTML(v, steps)}</div>`;
}

function renderHistory() {
  $('#history').hidden = !hist.length;
  const t = (ms: number | null) => (ms ? new Date(ms).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '');
  $('#histList').innerHTML = hist.map((h) => `<li><button class="histItem" type="button" data-id="${h.id}" aria-expanded="${histOpen === h.id}"><b>${h.no}번째 게임</b><span>${t(h.at)} · ${h.count}명 ${histOpen === h.id ? '▲' : '▼'}</span></button>`
    + (histOpen === h.id ? `<ol class="board">${h.board.map((b, i) => `<li><span class="rk">${i + 1}</span><span class="nm">${esc(b.nick)}</span><span class="pt">${esc(b.label)}</span></li>`).join('')}</ol>${histLanesHTML(h)}` : '')
    + '</li>').join('');
}

// 진행 중인 폴링이 끝나길 기다렸다가 새로 받아온다(방금 바꾼 상태를 확실히 반영하려고).
async function refresh() { while (polling) await new Promise((r) => setTimeout(r, 80)); await poll(); }

/* ---------- 연습용 가상 참가자 ----------
   진행자 브라우저가 가상 참가자의 키를 들고 대신 참가·제출·투표한다(서버는 일반 참가자와 똑같이 다룬다).
   그림은 받은 단어에 맞는 그림(bots.ts), 추측은 가상 참가자가 그린 그림이면 그럴듯하게 맞히거나 비슷하게 틀린다.
   진행자 화면이 닫히면 가상 참가자도 멈춘다. */
type Bot = { key: string; nick: string };
const botDone = new Set<string>();
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const botsKey = () => `telestration-bots-${st?.game?.id ?? ''}`;
function loadBots(): Bot[] { try { return JSON.parse(localStorage.getItem(botsKey()) || '[]') as Bot[]; } catch { return []; } }

async function addBots(n: number) {
  const gid = st?.game?.id; if (!gid) return;
  const bots = loadBots();
  for (let i = 0; i < n; i++) {
    const no = bots.length + 1;
    const bot = { key: `bot-${gid}-${no}-${Math.random().toString(36).slice(2, 12)}`, nick: `가상${no}` };
    try { await apiClient.post(`${BASE}/join`, { key: bot.key, nick: bot.nick }); bots.push(bot); }
    catch (e) { $('#hErr').textContent = errText(e, '가상 참가자를 추가하지 못했어요.'); $('#hErr').hidden = false; break; }
  }
  try { localStorage.setItem(botsKey(), JSON.stringify(bots)); } catch { /* 저장 못 하면 이번 화면에서만 움직인다 */ }
  await refresh();
}

async function botAct(bot: Bot, step: number) {
  try {
    const t = await apiClient.get<Task>(`${BASE}/task?key=${encodeURIComponent(bot.key)}`);
    if (t.step !== step) return;
    let content: string;
    if (t.kind === 'draw') { const text = t.prev?.content ?? ''; content = await botDrawing(text); rememberBotDrawing(content, text); }
    else content = botGuess(t.prev?.kind === 'draw' ? t.prev.content : null);
    await apiClient.post(`${BASE}/submit`, { key: bot.key, step, content });
  } catch { /* 가상 참가자는 실패해도 조용히 넘어간다 */ }
}
function runBots(ph: Phase) {
  if (!st?.host) return;
  const bots = loadBots();
  if (!bots.length) return;
  const gid = st.game?.id;
  for (const bot of bots) {
    if (ph.kind === 'step' && ph.editing) {
      const k = `${gid}:${bot.key}:${ph.k}`;
      if (botDone.has(k)) continue;
      botDone.add(k);
      // 사람처럼 칸 시간의 20~70% 쯤 걸려서 낸다.
      setTimeout(() => void botAct(bot, ph.k), (0.2 + Math.random() * 0.5) * Math.max(2, ph.left - 1) * 1000);
    }
  }
}

/* ---------- loop ---------- */
function tick() {
  if (!st?.game) return;
  const ph = phase(), key = phaseKey(ph);
  if (key !== lastKey) { confirmAction = ''; render(); void poll(); return; }
  if (ph.kind === 'step' && ph.editing) {
    updateClock(ph);
    // 마감 직전에 아직 안 낸(또는 고친) 내용을 자동 제출한다.
    if (task && task.step === ph.k && ph.left < 0.8 && !autoSent && (dirty || task.mine == null)) { autoSent = true; void submitTask(true); }
  } else if (ph.kind === 'starting' && shown === 'lobby' && meOf()) {
    $('#joinedTitle').textContent = `${Math.ceil(ph.left)}초 뒤 시작! 펜 준비하세요`;
  }
}

function bind() {
  const syncSteps = () => { $('#steps').hidden = !$<HTMLInputElement>('#stepsManual').checked; };
  $('#stepsAuto').addEventListener('change', syncSteps); $('#stepsManual').addEventListener('change', syncSteps);
  $('#rTeamScore').addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('.teamBox')?.dataset.team;
    if (!t) return;
    laneTeam = laneTeam === t ? '' : t;
    renderResult();
  });
  $('#histList').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.histItem'); if (!b) return;
    const id = Number(b.dataset.id); histOpen = histOpen === id ? -1 : id;
    if (histLanes.get(id) === 'error') histLanes.delete(id);
    renderHistory();
  });
  setupCanvas();
  $<HTMLInputElement>('#nick').value = load(NICK_STORAGE);
  $('#join').addEventListener('click', async () => {
    const nick = $<HTMLInputElement>('#nick').value.trim(), err = $('#joinErr');
    if (!nick) { err.textContent = '별명을 적어 주세요.'; err.hidden = false; return; }
    err.hidden = true; $<HTMLButtonElement>('#join').disabled = true; store(NICK_STORAGE, nick);
    try { await apiClient.post(`${BASE}/join`, { key: myKey(), nick }); renaming = false; }
    catch (e) { err.textContent = errText(e, '참가하지 못했어요. 잠시 뒤 다시 눌러 주세요.'); err.hidden = false; }
    $<HTMLButtonElement>('#join').disabled = false;
    await poll();
  });
  $('#rename').addEventListener('click', () => { renaming = true; $<HTMLInputElement>('#nick').value = meOf()?.nick || ''; render(); });

  $('#dSubmit').addEventListener('click', () => void submitTask(false));
  $('#gSubmit').addEventListener('click', () => void submitTask(false));
  $('#gText').addEventListener('input', () => { dirty = true; });
  $('#gText').addEventListener('keydown', (e) => { if (e.key === 'Enter') void submitTask(false); });

  $('#claimHost').addEventListener('click', () => hostCall('claim'));
  $('#addBots').addEventListener('click', async () => {
    const b = $<HTMLButtonElement>('#addBots'); b.disabled = true;
    await addBots(num('#botCount', 1, 20, 5));
    b.disabled = false;
  });
  const newGame = () => hostCall('new', {
    mode: document.querySelector<HTMLInputElement>('input[name=mode]:checked')?.value ?? 'individual',
    tier: document.querySelector<HTMLInputElement>('input[name=tier]:checked')?.value ?? 'easy',
    steps: $<HTMLInputElement>('#stepsManual').checked ? num('#steps', 2, 99, 4) + 1 : 0 /* 0 = 사람 수만큼, +1 은 제시어 칸 */, dSec: num('#dSec', 20, 180, 40), gSec: num('#gSec', 10, 90, 20),
  });
  // 팀 배정 버튼 클릭
  $('#hTeamList').addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.teamBtn'); if (!btn) return;
    const seatId = Number(btn.dataset.sid), team = btn.dataset.team;
    if (!seatId || !team) return;
    await hostCall('team', { seatId, team });
  });
  // 모드 radio 변경 시 팀 배정 패널 토글
  document.querySelectorAll<HTMLInputElement>('input[name=mode]').forEach((r) => {
    r.addEventListener('change', () => { if (st) renderHost(phase()); });
  });
  $('#hNew').addEventListener('click', () => void newGame());
  $('#hMain').addEventListener('click', () => {
    if (meOf()) void hostCall('start'); else confirmTwice('start', () => void hostCall('start'));
  });
  $('#hCancel').addEventListener('click', () => confirmTwice('cancel', () => void hostCall('cancel')));
  $('#hCopy').addEventListener('click', async () => {
    const btn = $('#hCopy'), url = location.origin + location.pathname;
    try { await navigator.clipboard.writeText(url); btn.textContent = '복사했어요!'; }
    catch { btn.textContent = url; } // 복사 권한이 없으면 주소를 그대로 보여 준다
    setTimeout(() => { btn.textContent = '게임 링크 복사'; }, 2000);
  });
  $('#hbCancel').addEventListener('click', () => confirmTwice('cancel', () => void hostCall('cancel')));
}

export function initGame() {
  bind();
  void poll();
  // 화면이 가려지면(다른 탭·앱, 화면 꺼짐) 폴링을 멈춘다 → 서버가 15초 뒤 자리 비움으로 본다.
  setInterval(() => { if (document.visibilityState !== 'hidden') void poll(); }, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void poll(); });
  setInterval(tick, 250);
}
