// town.js — Costa Verde city generation: districts, avenues, blocks,
// buildings + colliders, street lamps, palms, props, beach and sea.
// The world is fully deterministic from seed 21.
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { clamp, pushOutOfBox } from './util.js';

export const AVENUES = [-150, -90, -30, 30, 90, 150];
export const STREETS = [-150, -90, -30, 30, 90, 150];
export const ROAD_W = 12;
export const WORLD_SEED = 21;

const BLOCK_CENTERS = [-120, -60, 0, 60, 120];

function box(w, h, d, color, x, y, z, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.85,
    metalness: opts.metal ?? 0.05,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.glow ?? 0,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  return m;
}

export function buildTown(S) {
  const rng = makeRng(WORLD_SEED);
  const scene = S.scene;
  S.colliders = [];
  S.buildingColliders = [];
  S.lampHeads = [];

  const addCollider = (minX, maxX, minZ, maxZ, kind) => {
    const c = { minX, maxX, minZ, maxZ, kind };
    S.colliders.push(c);
    if (kind === 'building') S.buildingColliders.push(c);
    return c;
  };

  // --- Ground: city slab, sand beach, sea ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshStandardMaterial({ color: 0x55584e, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -10);
  scene.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 70),
    new THREE.MeshStandardMaterial({ color: 0xe2cb8f, roughness: 1 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.05, 205);
  scene.add(beach);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 220),
    new THREE.MeshStandardMaterial({ color: 0x1d6f9e, roughness: 0.25, metalness: 0.35 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, 350);
  scene.add(sea);
  S.seaMesh = sea;

  // Boardwalk strip along the marina.
  const walk = box(420, 0.3, 14, 0xb99a6b, 0, 0.15, 172);
  scene.add(walk);

  // --- Roads: avenues (N-S) and streets (E-W) ---
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.95 });
  for (const x of AVENUES) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 420), roadMat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.06, 0);
    scene.add(r);
    // Centre dashes.
    for (let z = -195; z < 200; z += 12) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 5),
        new THREE.MeshStandardMaterial({ color: 0xd8c95a, roughness: 0.8 }),
      );
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.09, z);
      scene.add(dash);
    }
  }
  for (const z of STREETS) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(420, ROAD_W), roadMat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(0, 0.06, z);
    scene.add(r);
    for (let x = -195; x < 200; x += 12) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 0.6),
        new THREE.MeshStandardMaterial({ color: 0xd8c95a, roughness: 0.8 }),
      );
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.09, z);
      scene.add(dash);
    }
  }

  // --- Buildings per block ---
  const paletteDowntown = [0x8a9bb0, 0x6f7f95, 0xa8b6c4, 0x7d8aa0];
  const paletteHills = [0xe8d9b8, 0xd9b48a, 0xc9a06a, 0xf0e2c8];
  const paletteHarborEdge = [0x9a8a76, 0x7a6a58];
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x223344, emissive: 0xffc861, emissiveIntensity: 0.25, roughness: 0.4,
  });
  S.sky.registerLamp(windowMat);

  const plazaBlock = { x: 0, z: 60 }; // Market Square: open plaza, no building.
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      if (bx === plazaBlock.x && bz === plazaBlock.z) {
        // Plaza: fountain + benches, no collider in the middle.
        const rim = new THREE.Mesh(
          new THREE.CylinderGeometry(5, 5.6, 1.1, 20),
          new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.7 }),
        );
        rim.position.set(0, 0.55, 60);
        scene.add(rim);
        const water = new THREE.Mesh(
          new THREE.CylinderGeometry(4.2, 4.2, 0.4, 20),
          new THREE.MeshStandardMaterial({ color: 0x3fa7c9, roughness: 0.2, metalness: 0.3 }),
        );
        water.position.set(0, 0.9, 60);
        scene.add(water);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const bench = box(3, 0.5, 1, 0x7a5a38, Math.cos(a) * 10, 0.4, 60 + Math.sin(a) * 10, { ry: -a });
          scene.add(bench);
        }
        continue;
      }
      const downtown = Math.abs(bx) <= 60 && Math.abs(bz) <= 60;
      const hills = bz <= -90;
      const w = downtown ? rng.range(26, 34) : rng.range(20, 30);
      const d = downtown ? rng.range(26, 34) : rng.range(20, 30);
      const h = downtown ? rng.range(28, 64) : hills ? rng.range(8, 14) : rng.range(10, 22);
      const palette = downtown ? paletteDowntown : hills ? paletteHills : paletteHarborEdge;
      const color = rng.pick(palette);
      const b = box(w, h, d, color, bx, h / 2, bz);
      scene.add(b);
      const roof = box(w * 0.9, 1, d * 0.9, 0x3c4148, bx, h + 0.5, bz);
      scene.add(roof);
      // Window strips on the two street-facing sides.
      const floors = Math.max(1, Math.floor(h / 6));
      for (let f = 0; f < floors; f++) {
        const wy = 3 + f * 6;
        if (wy > h - 2) break;
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 1.6), windowMat);
        strip.position.set(bx, wy, bz + d / 2 + 0.06);
        scene.add(strip);
        const strip2 = strip.clone();
        strip2.position.set(bx, wy, bz - d / 2 - 0.06);
        strip2.rotation.y = Math.PI;
        scene.add(strip2);
      }
      // Rooftop AC box for taller towers.
      if (h > 30) {
        scene.add(box(4, 2, 4, 0x5a6068, bx + w / 4, h + 2, bz));
      }
      addCollider(bx - w / 2, bx + w / 2, bz - d / 2, bz + d / 2, 'building');
    }
  }

  // --- Harbor district (east, x > 150): docks, containers, crane ---
  const dock = box(70, 0.8, 300, 0x6a6f75, 195, 0.4, 0);
  scene.add(dock);
  const containerColors = [0xc95a3d, 0x3d7ac9, 0x4da34d, 0xd8a93a, 0x8a5ac9];
  // Container rows at x = 205 and x = 168, keeping the x=190 lane clear.
  for (let i = 0; i < 8; i++) {
    const z = -120 + i * 32;
    const c1 = box(10, 3.4, 3.2, rng.pick(containerColors), 205, 1.7, z, { ry: 0 });
    scene.add(c1);
    addCollider(200, 210, z - 1.8, z + 1.8, 'prop');
    if (i % 2 === 0) {
      const c2 = box(10, 3.4, 3.2, rng.pick(containerColors), 205, 5.1, z);
      scene.add(c2);
    }
    const c3 = box(3.2, 3.4, 10, rng.pick(containerColors), 168, 1.7, z + 14);
    scene.add(c3);
    addCollider(166.2, 169.8, z + 9, z + 19, 'prop');
  }
  // Crane: two legs + jib.
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xd8a93a, roughness: 0.6, metalness: 0.4 });
  for (const dz of [-8, 8]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(2, 34, 2), craneMat);
    leg.position.set(185, 17, -30 + dz);
    scene.add(leg);
  }
  const jib = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 46), craneMat);
  jib.position.set(185, 33, -8);
  scene.add(jib);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  hook.position.set(185, 26, 8);
  scene.add(hook);
  S.craneHook = hook;

  // --- Street lamps along every avenue and street ---
  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.25,
  });
  S.sky.registerLamp(lampGlowMat);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.6 });
  const lampPositions = [];
  for (const x of AVENUES) {
    for (let z = -180; z <= 180; z += 60) lampPositions.push([x + 7, z]);
  }
  for (const z of STREETS) {
    for (let x = -180; x <= 180; x += 60) lampPositions.push([x, z + 7]);
  }
  for (const [x, z] of lampPositions) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 8), poleMat);
    pole.position.set(x, 3.5, z);
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), lampGlowMat);
    head.position.set(x, 7.1, z);
    scene.add(head);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), poleMat);
    arm.position.set(x - 0.7, 6.9, z);
    scene.add(arm);
  }

  // --- Palms along the marina promenade and scattered in hills ---
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8a4d, roughness: 0.9 });
  const palm = (x, z) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 6, 8), trunkMat);
    trunk.position.y = 3;
    trunk.rotation.z = rng.range(-0.08, 0.08);
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.2, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4, 6.4, Math.sin(a) * 1.4);
      leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    scene.add(g);
  };
  for (let x = -180; x <= 180; x += 30) palm(x, 166);
  for (let i = 0; i < 10; i++) palm(rng.range(-140, 140), rng.range(-170, -100));

  // --- Props: crates and hydrants near blocks ---
  for (let i = 0; i < 24; i++) {
    const bx = rng.pick(BLOCK_CENTERS) + rng.range(-18, 18);
    const bz = rng.pick(BLOCK_CENTERS) + rng.range(-18, 18);
    if (Math.abs(bx) < 4 && Math.abs(bz - 60) < 4) continue;
    const crate = box(1.6, 1.6, 1.6, 0x8a6a3d, bx, 0.8, bz, { ry: rng.range(0, 3) });
    scene.add(crate);
  }

  // World bounds used by movement code.
  S.bounds = { minX: -215, maxX: 232, minZ: -215, maxZ: 238 };
  return S;
}

export function updateTown(S, dt) {
  // Gentle sea shimmer driven by the game clock (deterministic).
  if (S.seaMesh) {
    S.seaMesh.position.y = 0.02 + Math.sin(S.clock.t * 0.5) * 0.05;
  }
  if (S.craneHook) {
    S.craneHook.position.y = 26 + Math.sin(S.clock.t * 0.35) * 1.2;
  }
}

export function collideCircle(S, pos, r) {
  // Resolve a circle against every collider; returns true if pushed.
  let hit = false;
  for (const c of S.colliders) {
    if (pos.x > c.minX - r && pos.x < c.maxX + r && pos.z > c.minZ - r && pos.z < c.maxZ + r) {
      if (pushOutOfBox(pos, r, c)) hit = true;
    }
  }
  return hit;
}
