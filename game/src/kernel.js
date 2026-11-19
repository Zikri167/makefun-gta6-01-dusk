// kernel.js — game clock, keyboard/mouse input, camera rig, resize.
// The clock is the game's own time: it accumulates dt and never reads
// performance.now(), so replays and screenshots stay deterministic.
import * as THREE from 'three';
import { clamp, wrapAngle, angleLerp } from './util.js';

export function createClock() {
  return { t: 0, dt: 0, tick(rawDt) { this.dt = Math.min(rawDt, 0.05); this.t += this.dt; } };
}

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(), // edge-triggered: codes pressed since last consume
    mouseDX: 0,
    mouseDY: 0,
    mouseDown: false,
    clicked: false,
    locked: false,
    anyKey: false,
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    input.pressed.add(e.code);
    input.anyKey = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    input.clicked = true;
    if (e.button === 0 && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (input.locked) {
      input.mouseDX += e.movementX || 0;
      input.mouseDY += e.movementY || 0;
    }
  });
  return input;
}

export function keyDown(input, code) {
  return input.keys.has(code);
}

// Edge-triggered press: true once per physical keydown, even if the frame
// rate is low (a short tap between two frames is never lost).
export function wasPressed(input, code) {
  if (!input.pressed.has(code)) return false;
  input.pressed.delete(code);
  return true;
}

export function consumeClick(input) {
  const c = input.clicked;
  input.clicked = false;
  return c;
}

export function consumeMouse(input) {
  const dx = input.mouseDX;
  const dy = input.mouseDY;
  input.mouseDX = 0;
  input.mouseDY = 0;
  return { dx, dy };
}

// Third-person camera rig: orbit on foot, chase behind the car.
// yaw is the heading the camera looks along; pitch clamps the height.
export function createCameraRig(camera) {
  return {
    camera,
    yaw: Math.PI * 0.75,
    pitch: 0.32,
    distance: 9,
    target: new THREE.Vector3(0, 1.6, 0),
    shake: 0,
    update(S, dt) {
      const m = consumeMouse(S.input);
      this.yaw -= m.dx * 0.0028;
      this.pitch = clamp(this.pitch + m.dy * 0.0022, 0.05, 1.1);
      const p = S.player;
      let wantYaw = this.yaw;
      let wantDist = 9;
      let wantPitch = this.pitch;
      if (p.inCar && p.car) {
        // Chase cam: swing behind the car's heading.
        wantYaw = p.car.heading + Math.PI;
        wantDist = 11 + p.car.speed * 0.12;
        wantPitch = 0.30;
        this.yaw = angleLerp(this.yaw, wantYaw, 1 - Math.exp(-3.2 * dt));
      }
      const tx = p.pos.x;
      const tz = p.pos.z;
      const ty = p.inCar ? 1.8 : 1.7;
      this.target.set(tx, ty, tz);
      const d = wantDist;
      const cx = tx + Math.sin(this.yaw) * Math.cos(wantPitch) * d;
      const cz = tz + Math.cos(this.yaw) * Math.cos(wantPitch) * d;
      const cy = ty + Math.sin(wantPitch) * d + 1.2;
      const shakeAmp = this.shake > 0 ? this.shake * 0.25 : 0;
      this.shake = Math.max(0, this.shake - dt * 2.2);
      const wob = S.clock.t * 13;
      camera.position.set(
        cx + Math.sin(wob) * shakeAmp,
        Math.max(cy, 1.1),
        cz + Math.cos(wob * 1.3) * shakeAmp,
      );
      camera.lookAt(this.target.x, this.target.y, this.target.z);
      p.camYaw = this.yaw;
    },
  };
}

export function fitRenderer(renderer, camera) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

export function installResize(renderer, camera) {
  window.addEventListener('resize', () => fitRenderer(renderer, camera));
}
