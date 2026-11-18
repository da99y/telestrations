// 연습용 가상 참가자의 그림·추측. 받은 단어에 맞는 그림(이모지 스케치)을 그리고,
// 가상 참가자가 그린 그림을 다시 받으면 그럴듯하게 맞히거나 비슷한 것으로 틀린다.

// 제시어(handler.ts WORDS)마다 그림 재료와 "비슷하게 틀린 답"
const ITEMS: Record<string, { e: string[]; near: string[] }> = {
  '삼겹살': { e: ['🥓'], near: ['베이컨', '목살', '고기'] },
  '떡볶이': { e: ['🌶️', '🍢'], near: ['어묵', '매운 떡', '분식'] },
  '김밥': { e: ['🍙', '🥕'], near: ['주먹밥', '초밥', '도시락'] },
  '짜장면': { e: ['🍜', '🖤'], near: ['짬뽕', '국수', '라면'] },
  '치킨': { e: ['🍗'], near: ['닭다리', '통닭', '튀김'] },
  '피자': { e: ['🍕'], near: ['피자 한 조각', '치즈', '토스트'] },
  '햄버거': { e: ['🍔'], near: ['버거', '샌드위치', '마카롱'] },
  '라면': { e: ['🍜'], near: ['국수', '짬뽕', '우동'] },
  '초밥': { e: ['🍣'], near: ['회', '김밥', '연어'] },
  '붕어빵': { e: ['🐟', '🔥'], near: ['생선구이', '물고기', '잉어빵'] },
  '호떡': { e: ['🥞'], near: ['팬케이크', '전', '핫케이크'] },
  '수박': { e: ['🍉'], near: ['수박바', '참외', '과일'] },
  '바나나': { e: ['🍌'], near: ['바나나킥', '노란 과일', '플랜틴'] },
  '아보카도': { e: ['🥑'], near: ['키위', '배', '망고'] },
  '계란말이': { e: ['🍳', '🌀'], near: ['계란프라이', '오믈렛', '스크램블'] },
  '핫도그': { e: ['🌭'], near: ['소시지빵', '콘도그', '소시지'] },
  '팥빙수': { e: ['🍧'], near: ['빙수', '아이스크림', '슬러시'] },
  '마카롱': { e: ['🧁', '🎨'], near: ['컵케이크', '쿠키', '케이크'] },
  '소시지': { e: ['🌭', '🔥'], near: ['핫도그', '프랑크', '꼬치'] },
  '마시멜로': { e: ['🍡', '🔥'], near: ['떡꼬치', '구운 마시멜로', '경단'] },
  '옥수수': { e: ['🌽'], near: ['군옥수수', '콘', '팝콘'] },
  '감자칩': { e: ['🥔', '🍟'], near: ['감자튀김', '과자', '감자'] },
  '컵라면': { e: ['🥤', '🍜'], near: ['라면', '우동', '컵누들'] },
  '삼각김밥': { e: ['🍙'], near: ['주먹밥', '김밥', '오니기리'] },
  '바나나우유': { e: ['🍌', '🥛'], near: ['우유', '바나나', '딸기우유'] },
  '요구르트': { e: ['🥛', '🦠'], near: ['우유', '유산균', '야쿠르트'] },
  '아이스크림콘': { e: ['🍦'], near: ['소프트아이스크림', '아이스크림', '콘'] },
  '식빵': { e: ['🍞'], near: ['토스트', '빵', '샌드위치'] },
  '두부': { e: ['🧈', '⬜'], near: ['치즈', '버터', '묵'] },
  '대파': { e: ['🌿', '🥬'], near: ['파', '쪽파', '부추'] },
  '양파': { e: ['🧅'], near: ['마늘', '샬롯', '양배추'] },
  '계란 한 판': { e: ['🥚', '🥚', '🥚'], near: ['계란', '달걀', '메추리알'] },
  '생수 묶음': { e: ['💧', '💧', '🥤'], near: ['물', '생수', '음료수'] },
  '두루마리 휴지': { e: ['🧻'], near: ['휴지', '키친타월', '물티슈'] },
  '칫솔': { e: ['🪥'], near: ['치약', '양치', '빗'] },
  '치약': { e: ['🪥', '🫧'], near: ['칫솔', '양치', '연고'] },
  '샴푸': { e: ['🧴', '🫧'], near: ['린스', '바디워시', '로션'] },
  '고무장갑': { e: ['🧤'], near: ['장갑', '목장갑', '설거지'] },
  '건전지': { e: ['🔋'], near: ['배터리', '충전기', '보조배터리'] },
  '우산': { e: ['☂️'], near: ['양산', '비', '장마'] },
  '콜라': { e: ['🥤'], near: ['사이다', '탄산음료', '주스'] },
  '탄산수': { e: ['🫧', '💧'], near: ['사이다', '물', '거품'] },
  '냉동만두': { e: ['❄️', '🥟'], near: ['만두', '군만두', '교자'] },
  '즉석밥': { e: ['🍚'], near: ['밥', '쌀밥', '공기밥'] },
  '참치캔': { e: ['🥫', '🐟'], near: ['통조림', '꽁치캔', '스팸'] },
  '조미김': { e: ['🟩', '🍙'], near: ['김', '김자반', '미역'] },
  '곰젤리': { e: ['🐻', '🍬'], near: ['젤리', '사탕', '곰돌이'] },
  '초콜릿': { e: ['🍫'], near: ['초코바', '카카오', '과자'] },
  '아이스커피': { e: ['🧊', '☕'], near: ['아메리카노', '커피', '라떼'] },
  '양꼬치': { e: ['🍢', '🔥'], near: ['꼬치', '닭꼬치', '바베큐'] },
};
// 추측으로 들어온 말은 낱말 조각으로 그림 재료를 찾는다.
const KEYWORDS: [string, string[]][] = [
  ['고기', ['🥩']], ['베이컨', ['🥓']], ['빵', ['🍞']], ['우유', ['🥛']], ['커피', ['☕']], ['과일', ['🍎']],
  ['아이스크림', ['🍦']], ['물', ['💧']], ['면', ['🍜']], ['국수', ['🍜']], ['계란', ['🥚']], ['달걀', ['🥚']],
  ['밥', ['🍚']], ['김', ['🍙']], ['휴지', ['🧻']], ['꼬치', ['🍢']], ['튀김', ['🍤']], ['과자', ['🍪']],
  ['사탕', ['🍬']], ['케이크', ['🍰']], ['쿠키', ['🍪']], ['생선', ['🐟']], ['물고기', ['🐟']], ['닭', ['🍗']],
  ['떡', ['🍡']], ['만두', ['🥟']], ['치즈', ['🧀']], ['감자', ['🥔']], ['파', ['🌿']], ['마늘', ['🧄']],
  ['장갑', ['🧤']], ['배터리', ['🔋']], ['비', ['☔']], ['음료', ['🥤']], ['주스', ['🧃']], ['불', ['🔥']],
];
const FALLBACK = ['🍽️', '🥡', '🛒', '🍱'];
const RANDOM_GUESS = ['외계인?', '모르겠어요…', '돌멩이', '구름', '고양이', '불꽃놀이', '버섯', '눈사람'];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const drawnFrom = new Map<string, string>(); // 가상 참가자가 그린 그림 → 원래 단어

function itemFor(text: string) {
  const t = text.replace(/[“”"'?!.…\s]/g, '');
  const hit = Object.keys(ITEMS).find((w) => w.replace(/\s/g, '') === t);
  if (hit) return ITEMS[hit].e;
  const kw = KEYWORDS.find(([k]) => t.includes(k));
  return kw ? kw[1] : [pick(FALLBACK)];
}

export async function botDrawing(text: string): Promise<string> {
  const c = document.createElement('canvas'); c.width = c.height = 480;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 480, 480);
  // 바닥 그림자 — 손으로 그린 것처럼 살짝 삐뚤게
  x.strokeStyle = '#c9c4bd'; x.lineWidth = 6; x.lineCap = 'round';
  x.beginPath(); x.ellipse(240 + rand(-10, 10), 400, 150 + rand(-20, 20), 22, rand(-0.05, 0.05), 0, Math.PI * 2); x.stroke();
  const parts = itemFor(text);
  const size = parts.length === 1 ? 250 : parts.length === 2 ? 170 : 130;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  parts.forEach((e, i) => {
    const cx = parts.length === 1 ? 240 : 240 + (i - (parts.length - 1) / 2) * (size * 1.05);
    x.save(); x.translate(cx + rand(-12, 12), 230 + rand(-14, 14)); x.rotate(rand(-0.18, 0.18));
    x.fillText(e, 0, 0); x.restore();
  });
  return c.toDataURL('image/jpeg', 0.7);
}

export function rememberBotDrawing(dataUrl: string, text: string) { drawnFrom.set(dataUrl, text); }

export function botGuess(drawing: string | null): string {
  const src = drawing ? drawnFrom.get(drawing) : undefined;
  if (!src) return pick(RANDOM_GUESS);
  const r = Math.random();
  const key = Object.keys(ITEMS).find((w) => w === src);
  if (r < 0.65 || !key) return src;
  return pick(ITEMS[key].near);
}

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
