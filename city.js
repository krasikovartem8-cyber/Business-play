/* «Своё дело» — живая улица: инфографика состояния бизнеса на Canvas.
   Всё, с чем работает игрок, видно на экране: своё здание (растёт с уровнем), дома клиентов,
   конкуренты, прохожие-клиенты, сотрудники, основатель, курьеры, сезоны. Тап по объекту — подсказка. */
window.DeloCity = (() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const BIZ_STYLE = {
    cafe: { color: '#b5651d', roof: '#7a3f0f', sign: '☕' }, hostel: { color: '#3b82f6', roof: '#1e3a8a', sign: '🛏️' },
    shop: { color: '#8b5cf6', roof: '#4c1d95', sign: '🛍️' }, barber: { color: '#ef4444', roof: '#7f1d1d', sign: '✂️' },
    it: { color: '#14b8a6', roof: '#134e4a', sign: '💻' }, delivery: { color: '#f59e0b', roof: '#78350f', sign: '🛵' },
    fitness: { color: '#22c55e', roof: '#14532d', sign: '🏋️' }, bakery: { color: '#f97316', roof: '#7c2d12', sign: '🥐' },
    auto: { color: '#64748b', roof: '#1e293b', sign: '🔧' }, school: { color: '#ec4899', roof: '#831843', sign: '🎓' },
    custom: { color: '#eab308', roof: '#713f12', sign: '✨' },
  };
  const SEASONS = ['зима', 'зима', 'весна', 'весна', 'весна', 'лето', 'лето', 'лето', 'осень', 'осень', 'осень', 'зима'];
  const SKY = { 'зима': ['#9fb7d9', '#e6eef8'], 'весна': ['#5aa9e6', '#cfe9ff'], 'лето': ['#3b8fe0', '#bfe3ff'], 'осень': ['#d98a4b', '#f7d9b0'] };
  const REMARKS = {
    high: ['Здесь лучшее место в городе!', 'Опять сюда, как всегда', 'Друзьям посоветовал', 'Сервис — огонь', 'Возьму ещё раз'],
    mid: ['Нормально, но дороговато', 'Посмотрим, что тут', 'Вроде неплохо', 'Ещё подумаю', 'Сосед хвалил'],
    low: ['Читал плохие отзывы…', 'Пойду к конкуренту', 'В прошлый раз ждал час', 'Что-то тут не то', 'Дорого и хамят'],
  };

  let cv, ctx, W = 0, H = 0, DPR = 1, raf = 0, running = false;
  let S = null;                       // снимок состояния игры
  let people = [], coins = [], flakes = [], tooltip = null, vehicles = [], t0 = performance.now();
  let objects = [];                   // кликабельные зоны: {x, y, w, h, text}

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    const ro = new ResizeObserver(resize); ro.observe(cv);
    resize();
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
      const hit = objects.slice().reverse().find(o => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
      if (hit) { tooltip = { x: clamp(x, 60, W - 60), y: Math.max(28, hit.y - 8), text: typeof hit.text === 'function' ? hit.text() : hit.text, until: performance.now() + 2800 }; }
    });
  }
  function resize() {
    if (!cv) return;
    DPR = Math.min(devicePixelRatio || 1, 3);
    W = cv.clientWidth || 360; H = cv.clientHeight || 190;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  /* Обновление снимка состояния из игры */
  function update(G, biz, stageInfo) {
    S = { name: G.name, biz: G.biz, stage: G.stage, stageName: stageInfo.name, month: G.month, demand: G.demand, rep: G.rep, team: G.team, energy: G.energy,
      cash: G.cash, competitor: !!G.flags.competitor, bigRival: G.stage >= 3, online: !!G.flags.online || G.biz === 'delivery' || G.biz === 'shop', manager: !!G.flags.manager, ended: G.ended };
    const want = clamp(Math.round(S.demand / 7), 1, 14);
    while (people.length < want) people.push(newPerson(true));
    if (people.length > want) people.length = want;
    start();
  }
  function start() { if (!running) { running = true; t0 = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function newPerson(anywhere) {
    const dir = Math.random() < .5 ? 1 : -1;
    return { x: anywhere ? rnd(W) : (dir > 0 ? -12 : W + 12), dir, speed: rnd(34, 18), color: pick(['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#e5e7eb']),
      skin: pick(['#f5d0b0', '#e0ac82', '#c68642', '#8d5524']), phase: rnd(TAU), target: null, decided: false, bubble: null };
  }

  /* ---------- Геометрия сцены ---------- */
  function layout() {
    const ground = H - 26;                      // линия тротуара
    const yourW = clamp(W * (0.22 + S.stage * 0.03), 80, W * 0.4);
    const floors = 1 + S.stage;
    const floorH = S.stage >= 4 ? 17 : 22;
    const your = { x: W / 2 - yourW / 2, w: yourW, h: floors * floorH + 18, floors, floorH };
    your.y = ground - your.h;
    const comps = [];
    if (S.competitor) comps.push({ x: your.x + your.w + 14, w: 64, h: 52, y: ground - 52, big: false });
    if (S.bigRival) comps.push({ x: your.x - 14 - 74, w: 74, h: 70 + S.stage * 6, y: ground - 70 - S.stage * 6, big: true });
    const houses = [];
    const hw = 46;
    for (let x = 8; x < W - hw; x += hw + 10) {
      const overlaps = [your, ...comps].some(b => x + hw > b.x - 6 && x < b.x + b.w + 6);
      if (!overlaps) houses.push({ x, w: hw, h: 34 + ((x / 37) | 0) % 3 * 6, y: 0 });
    }
    houses.forEach(h => h.y = ground - h.h);
    return { ground, your, comps, houses };
  }

  /* ---------- Отрисовка ---------- */
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (!S || !W) return;
    const t = (now - t0) / 1000, dt = 1 / 60;
    objects = [];
    const season = SEASONS[(S.month - 1) % 12];
    const L = layout();

    // Небо и солнце
    const sky = ctx.createLinearGradient(0, 0, 0, L.ground); sky.addColorStop(0, SKY[season][0]); sky.addColorStop(1, SKY[season][1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = season === 'зима' ? '#fff7d6' : '#ffe27a'; ctx.beginPath(); ctx.arc(W - 46, 34, 16, 0, TAU); ctx.fill();
    ctx.globalAlpha = .35; ctx.beginPath(); ctx.arc(W - 46, 34, 24, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    objects.push({ x: W - 70, y: 8, w: 50, h: 50, text: `Сейчас ${season}. Сезон влияет на настроение улицы и на события: летом и зимой бывает несезон.` });
    // Облака
    for (let i = 0; i < 3; i++) { const cx = ((t * 8 + i * 140) % (W + 120)) - 60, cy = 22 + i * 14; ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, TAU); ctx.arc(cx + 12, cy - 4, 12, 0, TAU); ctx.arc(cx + 26, cy, 9, 0, TAU); ctx.fill(); }
    // Дальний город: растёт с уровнем
    ctx.fillStyle = 'rgba(40,50,90,.28)';
    const n = 6 + S.stage * 3;
    for (let i = 0; i < n; i++) { const bw = 14 + (i * 7) % 12, bh = 20 + ((i * 13) % 5) * 9 + S.stage * 4, bx = (i / n) * W; ctx.fillRect(bx, L.ground - 22 - bh, bw, bh + 22); }
    // Земля, тротуар, дорога
    ctx.fillStyle = season === 'зима' ? '#e8eef5' : '#b9c3d6'; ctx.fillRect(0, L.ground, W, 8);
    ctx.fillStyle = '#3a3f52'; ctx.fillRect(0, L.ground + 8, W, H - L.ground - 8);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.setLineDash([10, 10]); ctx.lineDashOffset = -t * 20; ctx.beginPath(); ctx.moveTo(0, L.ground + 18); ctx.lineTo(W, L.ground + 18); ctx.stroke(); ctx.setLineDash([]);

    drawBranches(L);
    for (const h of L.houses) drawHouse(h, t, season);
    for (const c of L.comps) drawCompetitor(c, t);
    drawYour(L.your, t, season);
    drawStaff(L.your, t);
    drawFounder(L.your, t);
    updatePeople(L, dt, t);
    updateVehicles(L, dt, t);
    updateCoins(dt);
    weather(season, dt);
    drawTooltip(now);
  }

  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function windowGrid(x, y, w, h, cols, rows, litFrac, tone) {
    const cw = w / cols, ch = h / rows;
    let k = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const lit = ((k * 7919) % 100) / 100 < litFrac; k++;
      ctx.fillStyle = lit ? (tone || '#ffe9a3') : 'rgba(20,25,45,.55)';
      ctx.fillRect(x + c * cw + cw * .25, y + r * ch + ch * .22, cw * .5, ch * .5);
    }
  }

  function drawHouse(h, t, season) {
    ctx.fillStyle = '#d9c4a5'; ctx.fillRect(h.x, h.y, h.w, h.h);
    ctx.fillStyle = season === 'зима' ? '#f3f6fa' : '#8a4b3b'; ctx.beginPath(); ctx.moveTo(h.x - 4, h.y); ctx.lineTo(h.x + h.w / 2, h.y - 16); ctx.lineTo(h.x + h.w + 4, h.y); ctx.closePath(); ctx.fill();
    windowGrid(h.x, h.y + 4, h.w, h.h - 10, 2, 1, .6 + .3 * Math.sin(t * .7 + h.x), '#fff1b8');
    ctx.fillStyle = '#5b3a29'; ctx.fillRect(h.x + h.w / 2 - 5, h.y + h.h - 12, 10, 12);
    objects.push({ x: h.x, y: h.y - 16, w: h.w, h: h.h + 16, text: () => `Здесь живут ваши клиенты. Спрос ${S.demand}: чем он выше, тем больше людей выходит на улицу и идёт к вам.` });
  }

  function drawCompetitor(c, t) {
    ctx.fillStyle = c.big ? '#4b3a6b' : '#6b5b7b'; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = '#2b2140'; ctx.fillRect(c.x - 3, c.y - 6, c.w + 6, 6);
    windowGrid(c.x, c.y + 6, c.w, c.h - 22, c.big ? 3 : 2, c.big ? 3 : 1, .8, '#c7b6ff');
    ctx.fillStyle = '#1b1530'; ctx.fillRect(c.x + c.w / 2 - 6, c.y + c.h - 14, 12, 14);
    // Вывеска
    ctx.fillStyle = '#ff5c8a'; roundRect(c.x + 4, c.y - 20, c.w - 8, 14, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(c.big ? 'СЕТЬ-ГИГАНТ' : 'КОНКУРЕНТ', c.x + c.w / 2, c.y - 9);
    // Скидка мигает
    if (Math.sin(t * 4) > 0) { ctx.fillStyle = '#ffd166'; ctx.font = 'bold 8px sans-serif'; ctx.fillText('−30%', c.x + c.w / 2, c.y + 4 + (c.big ? 0 : 0)); }
    objects.push({ x: c.x, y: c.y - 22, w: c.w, h: c.h + 22, text: () => c.big
      ? `Крупная сеть пришла на ваш рынок (уровень «${S.stageName}»). Она давит ценой и рекламой — вашу долю держит репутация ${S.rep} и команда.`
      : `Конкурент по соседству. Переманивает примерно ${Math.round((100 - S.rep) / 2)}% прохожих: чем выше ваша репутация (${S.rep}), тем меньше к нему заходят.` });
  }

  function drawYour(b, t, season) {
    const st = BIZ_STYLE[S.biz] || BIZ_STYLE.custom;
    // Тень и корпус
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = st.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = st.roof; ctx.fillRect(b.x - 5, b.y - 7, b.w + 10, 8);
    if (S.stage >= 4) { ctx.fillStyle = st.roof; ctx.fillRect(b.x + b.w / 2 - 3, b.y - 26, 6, 20); ctx.fillStyle = '#ff5c5c'; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y - 27, 3 + Math.sin(t * 6), 0, TAU); ctx.fill(); }
    // Окна: доля горящих = команда
    const litFrac = .25 + S.team / 100 * .75;
    for (let f = 0; f < b.floors; f++) windowGrid(b.x, b.y + 6 + f * b.floorH, b.w, b.floorH - 4, Math.max(2, Math.round(b.w / 26)), 1, litFrac);
    // Витрина и дверь
    ctx.fillStyle = 'rgba(190,230,255,.85)'; ctx.fillRect(b.x + 6, b.y + b.h - 22, b.w - 30, 16);
    ctx.fillStyle = '#2b1d12'; ctx.fillRect(b.x + b.w - 20, b.y + b.h - 22, 14, 22);
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(b.x + b.w - 9, b.y + b.h - 11, 1.5, 0, TAU); ctx.fill();
    // Вывеска с названием
    const sw = Math.min(b.w + 20, 150);
    ctx.fillStyle = '#fff'; roundRect(b.x + b.w / 2 - sw / 2, b.y - 26, sw, 16, 5); ctx.fill();
    ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    let label = st.sign + ' ' + S.name.toUpperCase(); if (label.length > 18) label = label.slice(0, 17) + '…';
    ctx.fillText(label, b.x + b.w / 2, b.y - 14);
    // Звёзды репутации
    const stars = Math.round(S.rep / 20); ctx.font = '9px sans-serif';
    for (let i = 0; i < 5; i++) { ctx.fillStyle = i < stars ? '#ffd166' : 'rgba(255,255,255,.35)'; ctx.fillText('★', b.x + b.w / 2 - 20 + i * 10, b.y - 30); }
    // Флаг / зелень по сезону
    if (season === 'зима') { ctx.fillStyle = '#fff'; ctx.fillRect(b.x - 5, b.y - 10, b.w + 10, 4); }
    const branches = Math.min(Math.max(0, S.stage - 1), 3);
    objects.push({ x: b.x - 6, y: b.y - 36, w: b.w + 12, h: b.h + 36, text: () => `${S.name} — уровень «${S.stageName}»: ${b.floors} этаж${b.floors === 1 ? '' : b.floors < 5 ? 'а' : 'ей'}. Горящие окна — команда (${S.team}), звёзды — репутация (${S.rep}).${branches ? ` Филиалов: ${branches}.` : ''}` });
  }
  function L_ground() { return H - 26; }
  function drawBranches(L) {
    const st = BIZ_STYLE[S.biz] || BIZ_STYLE.custom;
    const branches = Math.min(Math.max(0, S.stage - 1), 3);
    const spots = [W * 0.14, W * 0.86, W * 0.32];
    for (let i = 0; i < branches; i++) { const bx = spots[i] - 16, bh = 44 + i * 8, by = L.ground - 22 - bh;
      ctx.fillStyle = st.color; ctx.fillRect(bx, by, 32, bh + 22); ctx.fillStyle = st.roof; ctx.fillRect(bx - 2, by - 4, 36, 4);
      windowGrid(bx, by + 4, 32, bh - 6, 2, 2, .8);
      ctx.fillStyle = '#fff'; roundRect(bx - 4, by - 16, 40, 10, 3); ctx.fill(); ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ФИЛИАЛ', bx + 16, by - 8);
      objects.push({ x: bx - 4, y: by - 16, w: 40, h: bh + 38, text: () => `Филиал ${S.name} в другом районе или городе. Филиалов: ${branches} — каждый уровень роста добавляет масштаб и расходы.` }); }
  }

  function person(x, y, color, skin, phase, scale = 1, hat) {
    const step = Math.sin(phase) * 3 * scale;
    ctx.fillStyle = color; ctx.fillRect(x - 4 * scale, y - 14 * scale, 8 * scale, 10 * scale);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, y - 18 * scale, 4 * scale, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2b2b3a'; ctx.fillRect(x - 3 * scale, y - 4 * scale, 2.5 * scale, 4 * scale + step); ctx.fillRect(x + 0.5 * scale, y - 4 * scale, 2.5 * scale, 4 * scale - step);
    if (hat) { ctx.fillStyle = hat; ctx.fillRect(x - 5 * scale, y - 22 * scale, 10 * scale, 3 * scale); ctx.fillRect(x - 3 * scale, y - 25 * scale, 6 * scale, 3 * scale); }
  }

  function drawStaff(b, t) {
    const n = clamp(Math.round(S.team / 20), 0, 5);
    for (let i = 0; i < n; i++) { const x = b.x + 12 + i * 12, y = L_ground() + 2; person(x, y, '#e2e8f0', '#e0ac82', t * 2 + i, .9); ctx.fillStyle = BIZ_STYLE[S.biz]?.color || '#eab308'; ctx.fillRect(x - 3, y - 10, 6, 5); }
    if (n) objects.push({ x: b.x + 4, y: L_ground() - 24, w: 12 * n + 8, h: 26, text: () => `Команда ${S.team}: ${n} сотрудник${n === 1 ? '' : n < 5 ? 'а' : 'ов'} у входа. Сильная команда снижает расходы и переживает кризисы; слабая — уходит.` });
  }

  function drawFounder(b, t) {
    const x = b.x + b.w + 8, y = L_ground() + 2;
    const tired = S.energy < 35;
    person(x, y + (tired ? 2 : 0), '#1f2937', '#f5d0b0', tired ? 0 : t * 1.5, 1, '#374151');
    ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    if (tired) { ctx.fillStyle = '#fff'; ctx.fillText('z' + (Math.sin(t * 3) > 0 ? 'z' : ''), x + 6, y - 26 - Math.sin(t * 2) * 2); }
    else if (S.energy > 75) { ctx.fillStyle = '#ffd166'; ctx.fillText('✦', x + 6, y - 26 - Math.sin(t * 4) * 2); }
    if (S.manager) { person(x + 14, y, '#94a3b8', '#c68642', t * 1.2 + 2, .8); ctx.fillStyle = '#fff'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('упр.', x + 14, y - 24); }
    objects.push({ x: x - 10, y: y - 30, w: S.manager ? 34 : 20, h: 32, text: () => tired ? `Это вы. Энергия ${S.energy}: вы выгораете. Делегируйте или отдохните, иначе тело решит за вас.` : `Это вы, основатель. Энергия ${S.energy}.${S.manager ? ' Рядом управляющий — он снимает с вас рутину.' : ' Пока вы один тянете всё сами.'}` });
  }

  function updatePeople(L, dt, t) {
    const door = { x: L.your.x + L.your.w - 13 }, comp = L.comps.find(c => !c.big), rival = L.comps.find(c => c.big);
    for (const p of people) {
      if (!p.decided && Math.random() < dt * .5) {
        p.decided = true;
        const toComp = (comp || rival) && Math.random() < (100 - S.rep) / 220 + (rival ? .1 : 0);
        p.target = toComp ? (comp ? comp.x + comp.w / 2 : rival.x + rival.w / 2) : (Math.random() < S.demand / 130 ? door.x : null);
        if (!p.target && Math.random() < .35) p.bubble = { text: pick(REMARKS[S.rep >= 65 ? 'high' : S.rep >= 40 ? 'mid' : 'low']), until: t + 2.5 };
      }
      if (p.target != null) p.dir = Math.sign(p.target - p.x) || 1;
      p.x += p.dir * p.speed * dt; p.phase += dt * 9;
      if (p.target != null && Math.abs(p.x - p.target) < 3) {
        if (p.target === door.x) coins.push({ x: p.x, y: L.ground - 16, life: 1 });
        Object.assign(p, newPerson(false));
      } else if (p.x < -14 || p.x > W + 14) Object.assign(p, newPerson(false));
      person(p.x, L.ground + 6, p.color, p.skin, p.phase, .85);
      if (p.bubble && p.bubble.until > t) { ctx.font = '8px sans-serif'; const tw = ctx.measureText(p.bubble.text).width + 8; const bx = clamp(p.x - tw / 2, 2, W - tw - 2);
        ctx.fillStyle = 'rgba(255,255,255,.95)'; roundRect(bx, L.ground - 32, tw, 12, 4); ctx.fill(); ctx.fillStyle = '#1a1a2e'; ctx.textAlign = 'left'; ctx.fillText(p.bubble.text, bx + 4, L.ground - 23); }
      objects.push({ x: p.x - 8, y: L.ground - 18, w: 16, h: 26, text: () => p.target === door.x ? 'Клиент идёт к вам. Каждый вошедший — монетка в кассу.' : p.target != null ? 'Этот пошёл к конкуренту. Поднимайте репутацию — и таких будет меньше.' : pick(REMARKS[S.rep >= 65 ? 'high' : S.rep >= 40 ? 'mid' : 'low']) });
    }
  }

  function updateVehicles(L, dt, t) {
    if (S.online && vehicles.length === 0 && Math.random() < dt * .25) vehicles.push({ x: -30, y: L.ground + 24, speed: 70 + rnd(40) });
    for (const v of vehicles) { v.x += v.speed * dt;
      ctx.fillStyle = BIZ_STYLE[S.biz]?.color || '#eab308'; roundRect(v.x, v.y - 12, 26, 10, 3); ctx.fill();
      ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(v.x + 6, v.y, 3.5, 0, TAU); ctx.arc(v.x + 20, v.y, 3.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('доставка', v.x + 13, v.y - 5);
      objects.push({ x: v.x, y: v.y - 14, w: 26, h: 18, text: 'Онлайн-заказы и доставка: клиенты, которые не ходят по улице, но платят.' }); }
    vehicles = vehicles.filter(v => v.x < W + 40);
  }

  function updateCoins(dt) {
    for (const c of coins) { c.y -= 22 * dt; c.life -= dt * .8; ctx.globalAlpha = Math.max(0, c.life); ctx.fillStyle = '#ffd166'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('₽', c.x, c.y); }
    ctx.globalAlpha = 1; coins = coins.filter(c => c.life > 0);
  }

  function weather(season, dt) {
    if (season !== 'зима' && season !== 'осень') { flakes.length = 0; return; }
    while (flakes.length < 40) flakes.push({ x: rnd(W), y: rnd(H), v: rnd(30, 12), a: rnd(TAU) });
    for (const f of flakes) { f.y += f.v * dt; f.x += Math.sin(f.a += dt) * .4; if (f.y > H) { f.y = -4; f.x = rnd(W); }
      ctx.fillStyle = season === 'зима' ? 'rgba(255,255,255,.9)' : pick(['#d97706', '#b45309', '#f59e0b']); ctx.beginPath(); ctx.arc(f.x, f.y, season === 'зима' ? 1.6 : 2, 0, TAU); ctx.fill(); }
  }

  function drawTooltip(now) {
    if (!tooltip) return; if (now > tooltip.until) { tooltip = null; return; }
    ctx.font = '11px sans-serif'; const words = tooltip.text.split(' '), lines = []; let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > Math.min(W - 24, 260)) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line);
    const tw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16, th = lines.length * 14 + 10;
    const x = clamp(tooltip.x - tw / 2, 6, W - tw - 6), y = clamp(tooltip.y - th - 6, 6, H - th - 6);
    ctx.fillStyle = 'rgba(20,23,49,.95)'; roundRect(x, y, tw, th, 8); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; lines.forEach((l, i) => ctx.fillText(l, x + 8, y + 16 + i * 14));
  }

  return { init, update, start, stop };
})();
