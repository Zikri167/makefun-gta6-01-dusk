// boot.js — Verde Heat entry point: renderer, scene, camera, wiring of
// every system, and the main loop. All gameplay time comes from the
// game's own clock (accumulated dt), never from wall time.
import * as THREE from 'three';
import { createClock, createInput, createCameraRig, fitRenderer, installResize, keyDown, wasPressed } from './kernel.js';
import { createSky } from './sky.js';
import { buildTown, updateTown } from './town.js';
import { buildCars, updateCars } from './cars.js';
import { buildCrowd, updateCrowd } from './crowd.js';
import { buildHero, updateHero, exitCar } from './hero.js';
import { createLaw } from './law.js';
import { createJobs } from './jobs.js';
import { buildRooms } from './rooms.js';
import { createFight } from './fight.js';
import { createHud } from './face.js';
import { createTunes } from './tunes.js';
import { createProgress } from './progress.js';
import { applyShot, markShotReady } from './shots.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const S = {
  scene, camera, renderer,
  clock: createClock(),
  input: createInput(canvas),
  flags: { started: false, paused: false, busted: false, wasted: false },
  timeOfDay: 'day',
  ePressed: false,
  shotMode: null,
  frames: 0,
};

// Wire every system onto S.
S.sky = createSky(S);
buildTown(S);
buildCars(S);
buildCrowd(S);
buildHero(S);
S.law = createLaw(S);
S.jobs = createJobs(S);
buildRooms(S);
S.fight = createFight(S);
S.tunes = createTunes();
S.progress = createProgress();
S.progress.load();
S.rig = createCameraRig(camera);
createHud(S);
fitRenderer(renderer, camera);
installResize(renderer, camera);

// Restore a previous save into the job chain's cash display.
S.jobs.cash = S.progress.cash || 0;
if (S.progress.bestCash > 0) {
  S.hud.savedEl.textContent = 'Saved progress: ' + S.progress.jobsDone + ' jobs done, best cash $' + S.progress.bestCash + '.';
}

S.startGame = () => {
  S.tunes.ensure();
  S.flags.started = true;
  S.flags.paused = false;
  S.flags.busted = false;
  S.flags.wasted = false;
  S.hud.hideOverlays();
  S.input.clicked = false;
  if (S.jobs.done === 0 && S.jobs.index === 0 && S.jobs.stage === 0 && !S.jobs.beacon) {
    S.jobs.startMission(S, 0);
  }
  S.progress.plays += 1;
  S.progress.save(S);
};

S.togglePause = () => {
  if (!S.flags.started || S.flags.busted || S.flags.wasted) return;
  S.flags.paused = !S.flags.paused;
  S.hud.showPause(S.flags.paused);
  S.tunes.engine(0, false);
};

S.resetRun = () => {
  const p = S.player;
  if (p.inCar) exitCar(S);
  p.pos.x = 0;
  p.pos.z = 120;
  p.hp = p.maxHp;
  p.ammo = 24;
  p.reserveAmmo = 96;
  p.sheltered = false;
  p.mesh.visible = true;
  p.mesh.position.set(0, 0, 120);
  S.law.clearWanted(S);
  S.law.wanted = 0;
  S.jobs.hideBeacon(S);
  S.jobs.index = 0;
  S.jobs.stage = 0;
  S.jobs.done = 0;
  S.jobs.cash = 0;
  S.jobs.timerActive = false;
  S.rooms.inside = null;
  S.flags.busted = false;
  S.flags.wasted = false;
  S.flags.paused = false;
  S.flags.started = true;
  S.hud.hideOverlays();
  S.jobs.startMission(S, 0);
};

// Debug / playtest surface: live state plus safe helpers. No cheating of
// mission logic — warp only moves Rico; jobs still complete by the rules.
window.__game = {
  S,
  get cash() { return S.jobs.cash; },
  get jobsDone() { return S.jobs.done; },
  get mission() { return S.jobs.index + 1; },
  get stage() { return S.jobs.stage; },
  get wanted() { return S.law.wanted; },
  get hp() { return S.player.hp; },
  get inCar() { return S.player.inCar; },
  get speed() { return Math.abs(S.player.inCar && S.player.car ? S.player.car.speed : S.player.speed); },
  get carName() { return S.player.car ? S.player.car.name : null; },
  get started() { return S.flags.started; },
  get paused() { return S.flags.paused; },
  get busted() { return S.flags.busted; },
  get wasted() { return S.flags.wasted; },
  get sheltered() { return S.player.sheltered; },
  get inside() { return S.rooms.inside; },
  get objective() { return S.jobs.objectiveText(); },
  get cops() { return S.law.cops.length; },
  get ammo() { return S.player.ammo; },
  get timeOfDay() { return S.timeOfDay; },
  get pos() { return { x: S.player.pos.x, z: S.player.pos.z }; },
  get colliders() { return S.buildingColliders; },
  get beacons() { return S.jobs.beacons; },
  get banner() {
    const b = document.querySelector('.hud-banner');
    return b && b.classList.contains('show') ? b.textContent : '';
  },
  warp(x, z) {
    const p = S.player;
    if (p.inCar && p.car) {
      p.car.x = x; p.car.z = z;
      p.car.mesh.position.set(x, 0, z);
    }
    p.pos.x = x; p.pos.z = z;
    p.mesh.position.set(x, 0, z);
  },
  setWanted(n) { S.law.wanted = n; },
  start() { S.startGame(); },
  pause() { S.togglePause(); },
};

// Screenshot staging (?shot=...) runs after the world exists.
applyShot(S);

let lastT = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const rawDt = lastT === 0 ? 0.016 : (ts - lastT) / 1000;
  lastT = ts;
  S.clock.tick(rawDt);
  const dt = S.clock.dt;

  // Global keys (edge-triggered, so a short tap is never lost).
  if (wasPressed(S.input, 'KeyP')) S.togglePause();
  if (wasPressed(S.input, 'KeyM')) {
    S.tunes.muted = !S.tunes.muted;
    S.hud.say(S.tunes.muted ? 'Sound muted.' : 'Sound on.');
  }

  S.sky.update(dt);
  updateTown(S, dt);
  if (S.flags.started && !S.flags.paused && !S.flags.busted && !S.flags.wasted) {
    updateHero(S, dt);
    updateCars(S, dt);
    updateCrowd(S, dt);
    S.law.update(S, dt);
    S.jobs.update(S, dt);
    S.rooms.update(S);
    S.fight.update(S, dt);
  }
  S.jobs.tickBeacon(S);
  S.rig.update(S, dt);
  S.hud.update(S, dt);
  renderer.render(scene, camera);

  S.frames += 1;
  if (S.shotMode && S.frames === 4) markShotReady(S);
  if (!S.shotMode && S.frames === 2) window.__shotReady = true;
}
requestAnimationFrame(frame);
