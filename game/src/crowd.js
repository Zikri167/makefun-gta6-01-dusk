// crowd.js — pedestrians: wandering walkers who flee from speeding cars
// and gunfire, with a simple procedural walker model.
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { clamp, dist2D } from './util.js';
import { collideCircle } from './town.js';

const SHIRT_COLORS = [0xd84d4d, 0x4d7ad8, 0x4dd87a, 0xd8c94d, 0x9a4dd8, 0xe8e8e8, 0x333333, 0xd88a4d];

function buildPedMesh(color) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2c3a4a, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirt);
  torso.position.y = 1.15;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.78;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), pants);
  legL.position.set(-0.16, 0.4, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), shirt);
  armL.position.set(-0.42, 1.15, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export function buildCrowd(S) {
  const rng = makeRng(21 + 13);
  S.peds = [];
  for (let i = 0; i < 14; i++) {
    // Spawn on sidewalks: near a road, offset from its centre line.
    let x;
    let z;
    if (rng.chance(0.5)) {
      x = rng.pick([-150, -90, -30, 30, 90, 150]) + rng.pick([-8, 8]);
      z = rng.range(-170, 170);
    } else {
      x = rng.range(-170, 170);
      z = rng.pick([-150, -90, -30, 30, 90, 150]) + rng.pick([-8, 8]);
    }
    const mesh = buildPedMesh(rng.pick(SHIRT_COLORS));
    mesh.position.set(x, 0, z);
    S.scene.add(mesh);
    S.peds.push({
      mesh, x, z,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.0, 1.8),
      state: 'walk', // walk | flee | down
      fleeT: 0,
      targetX: x,
      targetZ: z,
      panicFrom: null,
      retargetT: rng.range(0, 4),
    });
  }
  return S;
}

export function scarePeds(S, x, z, radius) {
  for (const p of S.peds) {
    if (p.state === 'down') continue;
    if (dist2D(p.x, p.z, x, z) < radius) {
      p.state = 'flee';
      p.fleeT = 4;
      p.panicFrom = { x, z };
    }
  }
}

export function updateCrowd(S, dt) {
  const rng = S.crowdRng || (S.crowdRng = makeRng(99));
  for (const p of S.peds) {
    if (p.state === 'down') continue;
    // Flee: run away from the panic source.
    if (p.state === 'flee') {
      p.fleeT -= dt;
      const dx = p.x - p.panicFrom.x;
      const dz = p.z - p.panicFrom.z;
      const d = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
      p.heading = Math.atan2(dx / d, dz / d);
      p.speed = 5.2;
      if (p.fleeT <= 0) { p.state = 'walk'; p.speed = 1.4; }
    } else {
      // Wander: pick a new nearby target every few seconds.
      p.retargetT -= dt;
      if (p.retargetT <= 0) {
        p.retargetT = rng.range(3, 7);
        const a = rng.range(0, Math.PI * 2);
        p.targetX = clamp(p.x + Math.cos(a) * rng.range(10, 30), -200, 200);
        p.targetZ = clamp(p.z + Math.sin(a) * rng.range(10, 30), -200, 200);
      }
      const dx = p.targetX - p.x;
      const dz = p.targetZ - p.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 1) p.heading = Math.atan2(dx, dz);
      // Flee from a fast car nearby.
      for (const c of S.cars) {
        if (Math.abs(c.speed) > 12 && dist2D(p.x, p.z, c.x, c.z) < 10) {
          p.state = 'flee';
          p.fleeT = 3.5;
          p.panicFrom = { x: c.x, z: c.z };
          break;
        }
      }
    }
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    p.x += fx * p.speed * dt;
    p.z += fz * p.speed * dt;
    p.x = clamp(p.x, S.bounds.minX, S.bounds.maxX);
    p.z = clamp(p.z, S.bounds.minZ, S.bounds.maxZ);
    collideCircle(S, p, 0.5);
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    // Walk-cycle swing, driven by the game clock.
    const swing = Math.sin(S.clock.t * (p.state === 'flee' ? 11 : 6)) * 0.5;
    p.mesh.userData.legL.rotation.x = swing;
    p.mesh.userData.legR.rotation.x = -swing;
    p.mesh.userData.armL.rotation.x = -swing * 0.7;
    p.mesh.userData.armR.rotation.x = swing * 0.7;
  }
}
