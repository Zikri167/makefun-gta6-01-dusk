// face.js — HUD, minimap, menus, banners and dialogs.
// All DOM, no WebGL: cash, HP, wanted stars, objective + distance,
// speed, a live 2D minimap, start / pause / Busted / Wasted screens.
import { formatCash, dist2D } from './util.js';

function el(tag, cls, parent, text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export function createHud(S) {
  const root = document.getElementById('hud');
  const hud = {
    root,
    bannerT: 0,
    msgT: 0,
    hintT: 0,
    starFlashT: 0,
  };

  // Top-left: cash + HP.
  const tl = el('div', 'hud-tl', root);
  hud.cashEl = el('div', 'hud-cash', tl, '$0');
  const hpWrap = el('div', 'hud-hp', tl);
  el('span', 'hud-hp-label', hpWrap, 'HP');
  hud.hpBar = el('div', 'hud-hp-bar', hpWrap);
  hud.hpFill = el('div', 'hud-hp-fill', hud.hpBar);

  // Top-right: wanted stars.
  hud.starsEl = el('div', 'hud-stars', root, '☆☆☆☆☆');

  // Top-centre: objective.
  hud.objEl = el('div', 'hud-objective', root, '');

  // Bottom-right: speed + minimap.
  const br = el('div', 'hud-br', root);
  hud.speedEl = el('div', 'hud-speed', br, '0 mph');
  hud.map = el('canvas', 'hud-map', br);
  hud.map.width = 180;
  hud.map.height = 180;
  hud.mapCtx = hud.map.getContext('2d');

  // Bottom-left: ammo + controls reminder.
  const bl = el('div', 'hud-bl', root);
  hud.ammoEl = el('div', 'hud-ammo', bl, 'AMMO 24');
  el('div', 'hud-keys', bl, 'WASD move/drive · E enter car · Space brake · Click shoot · R reload · P pause');

  // Centre message + hint + banner.
  hud.msgEl = el('div', 'hud-msg', root, '');
  hud.hintEl = el('div', 'hud-hint', root, '');
  hud.bannerEl = el('div', 'hud-banner', root, '');
  hud.bannerTitle = el('div', 'hud-banner-title', hud.bannerEl, '');
  hud.bannerSub = el('div', 'hud-banner-sub', hud.bannerEl);

  // Overlays: start, pause, busted, wasted.
  hud.startEl = el('div', 'overlay overlay-start', root);
  el('h1', 'game-title', hud.startEl, 'VERDE HEAT');
  el('p', 'game-sub', hud.startEl, 'Costa Verde — a sun-soaked city that pays in cash and costs in heat.');
  el('p', 'game-story', hud.startEl, 'Rico Vega just got out. Fixer Mara Voss has four jobs for him — a fare, a hot car, a harbor run, and one last sundown drop. Finish them all and the city is his.');
  const startBtn = el('button', 'big-btn', hud.startEl, 'START ENGINE');
  startBtn.id = 'start-btn';
  el('p', 'game-controls', hud.startEl, 'WASD move / drive · Mouse look · E enter car or door · Space handbrake · Click shoot · R reload · Shift run · P pause · M mute');
  hud.savedEl = el('p', 'game-saved', hud.startEl, '');

  hud.pauseEl = el('div', 'overlay overlay-pause hidden', root);
  el('h1', '', hud.pauseEl, 'PAUSED');
  el('p', '', hud.pauseEl, 'Costa Verde waits for no one. Press P to keep driving.');
  const resumeBtn = el('button', 'big-btn', hud.pauseEl, 'RESUME');
  resumeBtn.id = 'resume-btn';

  hud.bustedEl = el('div', 'overlay overlay-busted hidden', root);
  el('h1', '', hud.bustedEl, 'BUSTED');
  el('p', '', hud.bustedEl, 'The Costa Verde police took Rico in. Mara Voss is not impressed.');
  const bustedBtn = el('button', 'big-btn', hud.bustedEl, 'TRY AGAIN');
  bustedBtn.id = 'busted-btn';

  hud.wastedEl = el('div', 'overlay overlay-wasted hidden', root);
  el('h1', '', hud.wastedEl, 'WASTED');
  el('p', '', hud.wastedEl, 'Rico went down in Costa Verde. The city keeps his cash — almost.');
  const wastedBtn = el('button', 'big-btn', hud.wastedEl, 'TRY AGAIN');
  wastedBtn.id = 'wasted-btn';

  hud.say = (text) => {
    hud.msgEl.textContent = text;
    hud.msgT = 4;
    hud.msgEl.classList.add('show');
  };
  hud.hint = (text) => {
    hud.hintEl.textContent = text;
    hud.hintT = 0.12;
    hud.hintEl.classList.add('show');
  };
  hud.banner = (title, sub = '') => {
    hud.bannerTitle.textContent = title;
    hud.bannerSub.textContent = sub;
    hud.bannerEl.classList.add('show');
    hud.bannerT = 3.2;
  };
  hud.flashStars = () => { hud.starFlashT = 0.6; };
  hud.showBusted = () => { hud.bustedEl.classList.remove('hidden'); };
  hud.showWasted = () => { hud.wastedEl.classList.remove('hidden'); };
  hud.hideOverlays = () => {
    hud.startEl.classList.add('hidden');
    hud.pauseEl.classList.add('hidden');
    hud.bustedEl.classList.add('hidden');
    hud.wastedEl.classList.add('hidden');
  };
  hud.showPause = (on) => { hud.pauseEl.classList.toggle('hidden', !on); };

  hud.update = (S2, dt) => {
    const p = S2.player;
    hud.cashEl.textContent = formatCash(S2.jobs.cash);
    const hpPct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
    hud.hpFill.style.width = hpPct + '%';
    hud.hpFill.style.background = hpPct > 50 ? '#4da34d' : hpPct > 25 ? '#d8a93a' : '#c0392b';
    const w = S2.law.wanted;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < w ? '★' : '☆';
    hud.starsEl.textContent = stars;
    hud.starsEl.classList.toggle('hot', w > 0);
    hud.starsEl.classList.toggle('flash', hud.starFlashT > 0);
    hud.starFlashT = Math.max(0, hud.starFlashT - dt);
    hud.objEl.textContent = S2.jobs.objectiveText();
    const target = S2.jobs.targetPos();
    if (target) {
      const d = Math.round(dist2D(p.pos.x, p.pos.z, target.x, target.z));
      hud.objEl.textContent += '  ·  ' + d + 'm';
    }
    hud.speedEl.textContent = p.inCar ? Math.round(Math.abs(p.car.speed) * 2.2) + ' mph' : Math.round(p.speed * 2.2) + ' mph';
    hud.ammoEl.textContent = p.reloading ? 'RELOADING…' : 'AMMO ' + p.ammo + ' / ' + p.reserveAmmo;
    if (hud.msgT > 0) {
      hud.msgT -= dt;
      if (hud.msgT <= 0) hud.msgEl.classList.remove('show');
    }
    if (hud.hintT > 0) {
      hud.hintT -= dt;
      if (hud.hintT <= 0) hud.hintEl.classList.remove('show');
    }
    if (hud.bannerT > 0) {
      hud.bannerT -= dt;
      if (hud.bannerT <= 0) hud.bannerEl.classList.remove('show');
    }
    drawMinimap(S2, hud);
  };

  // Buttons.
  startBtn.addEventListener('click', () => S.startGame());
  resumeBtn.addEventListener('click', () => S.togglePause());
  bustedBtn.addEventListener('click', () => S.resetRun());
  wastedBtn.addEventListener('click', () => S.resetRun());

  S.hud = hud;
  return hud;
}

function drawMinimap(S, hud) {
  const ctx = hud.mapCtx;
  if (!ctx) return;
  const W = 180;
  const H = 180;
  const scale = W / 520; // world -260..260 mapped onto the canvas
  const toX = (x) => (x + 260) * scale;
  const toY = (z) => (z + 260) * scale;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#20262b';
  ctx.fillRect(0, 0, W, H);
  // Sea.
  ctx.fillStyle = '#1d6f9e';
  ctx.fillRect(0, toY(180), W, H - toY(180));
  // Roads.
  ctx.strokeStyle = '#3d434a';
  ctx.lineWidth = 3;
  for (const x of [-150, -90, -30, 30, 90, 150]) {
    ctx.beginPath(); ctx.moveTo(toX(x), toY(-210)); ctx.lineTo(toX(x), toY(180)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(-210), toY(x)); ctx.lineTo(toX(210), toY(x)); ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = '#7a828c';
  for (const c of S.buildingColliders) {
    ctx.fillRect(toX(c.minX), toY(c.minZ), (c.maxX - c.minX) * scale, (c.maxZ - c.minZ) * scale);
  }
  // Harbor containers.
  ctx.fillStyle = '#8a6a3d';
  for (const c of S.colliders) {
    if (c.kind === 'prop') ctx.fillRect(toX(c.minX), toY(c.minZ), (c.maxX - c.minX) * scale, (c.maxZ - c.minZ) * scale);
  }
  // Mission target.
  const target = S.jobs.targetPos();
  if (target) {
    const pulse = 4 + Math.sin(S.clock.t * 4) * 1.5;
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.arc(toX(target.x), toY(target.z), pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Cops.
  ctx.fillStyle = '#3d7ac9';
  for (const cop of S.law.cops) {
    ctx.beginPath();
    ctx.arc(toX(cop.x), toY(cop.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = S.player;
  ctx.save();
  ctx.translate(toX(p.pos.x), toY(p.pos.z));
  ctx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) * 0 + (Math.PI - p.heading) * 0);
  ctx.rotate(-p.heading + Math.PI);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
}
