// sky.js — time-of-day system: sun, sky colour, fog and street lights.
// setTimeOfDay('day' | 'dusk') blends the whole scene between two presets
// driven by the game's own clock, never by wall time.
import * as THREE from 'three';
import { lerp } from './util.js';

const PRESETS = {
  day: {
    sunColor: 0xfff2d0, sunIntensity: 2.6, sunPos: [120, 180, 60],
    sky: 0x7ec8ee, fogNear: 220, fogFar: 900, hemiSky: 0xbfe3ff, hemiGround: 0x8a7a5a,
    hemiIntensity: 0.85, lampGlow: 0.0, ambient: 0.35,
  },
  dusk: {
    sunColor: 0xff8a3d, sunIntensity: 1.5, sunPos: [-190, 42, 90],
    sky: 0x2e3a5e, fogNear: 140, fogFar: 620, hemiSky: 0x6a5a8a, hemiGround: 0x3a2f28,
    hemiIntensity: 0.5, lampGlow: 1.0, ambient: 0.16,
  },
};

export function createSky(S) {
  const scene = S.scene;
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
  sun.position.set(120, 180, 60);
  sun.castShadow = false;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.85);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);
  scene.background = new THREE.Color(0x7ec8ee);
  scene.fog = new THREE.Fog(0x7ec8ee, 220, 900);
  const sky = {
    mode: 'day',
    blend: 0, // 0 = full day, 1 = full dusk
    target: 0,
    sun, hemi, ambient,
    lampMats: [],
    registerLamp(mat) { this.lampMats.push(mat); },
    setMode(mode) {
      this.mode = mode;
      this.target = mode === 'dusk' ? 1 : 0;
    },
    update(dt) {
      // Ease toward the target preset.
      const rate = 1 - Math.exp(-1.6 * dt);
      this.blend += (this.target - this.blend) * rate;
      const b = this.blend;
      const A = PRESETS.day;
      const B = PRESETS.dusk;
      const cA = new THREE.Color(A.sky);
      const cB = new THREE.Color(B.sky);
      cA.lerp(cB, b);
      scene.background.copy(cA);
      scene.fog.color.copy(cA);
      scene.fog.near = lerp(A.fogNear, B.fogNear, b);
      scene.fog.far = lerp(A.fogFar, B.fogFar, b);
      const sc = new THREE.Color(A.sunColor);
      sc.lerp(new THREE.Color(B.sunColor), b);
      sun.color.copy(sc);
      sun.intensity = lerp(A.sunIntensity, B.sunIntensity, b);
      sun.position.set(
        lerp(A.sunPos[0], B.sunPos[0], b),
        lerp(A.sunPos[1], B.sunPos[1], b),
        lerp(A.sunPos[2], B.sunPos[2], b),
      );
      const hs = new THREE.Color(A.hemiSky);
      hs.lerp(new THREE.Color(B.hemiSky), b);
      const hg = new THREE.Color(A.hemiGround);
      hg.lerp(new THREE.Color(B.hemiGround), b);
      hemi.color.copy(hs);
      hemi.groundColor.copy(hg);
      hemi.intensity = lerp(A.hemiIntensity, B.hemiIntensity, b);
      ambient.intensity = lerp(A.ambient, B.ambient, b);
      const glow = lerp(A.lampGlow, B.lampGlow, b);
      for (const m of this.lampMats) m.emissiveIntensity = 0.25 + glow * 2.4;
    },
  };
  return sky;
}

export function setTimeOfDay(S, mode) {
  S.sky.setMode(mode);
  S.timeOfDay = mode;
}
