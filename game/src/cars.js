// cars.js — vehicles: arcade driving physics, traffic AI on the road grid,
// parked cars that can be stolen, and the procedural car model.
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { clamp, wrapAngle, angleLerp, dist2D } from './util.js';
import { AVENUES, STREETS, collideCircle } from './town.js';

const CAR_COLORS = [0xc0392b, 0x2e6fb0, 0xd8d8d8, 0x222222, 0x3d7a4d, 0xd8a93a, 0x7a4da3, 0x9aa4ad];
const SPORT_COLOR = 0xff6a00; // Vantara GT — the orange sport car of job 2.

export function buildCarMesh(color, sport = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.7 });
  const bodyLen = sport ? 4.6 : 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, bodyLen), paint);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, sport ? 2.0 : 2.2), glass);
  cabin.position.set(0, 1.08, sport ? -0.2 : 0.1);
  g.add(cabin);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.35), paint);
  spoiler.position.set(0, 1.0, -bodyLen / 2 + 0.25);
  if (sport) g.add(spoiler);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
  }
  // Headlights + taillights.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffedb0, emissiveIntensity: 0.7 });
  for (const wx of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    h.position.set(wx, 0.62, bodyLen / 2 + 0.02);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xcc2222, emissiveIntensity: 0.7 }));
    t.position.set(wx, 0.62, -bodyLen / 2 - 0.02);
    g.add(t);
  }
  g.userData.bodyLen = bodyLen;
  return g;
}

function makeCar(S, x, z, heading, color, opts = {}) {
  const mesh = buildCarMesh(color, !!opts.sport);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  S.scene.add(mesh);
  const car = {
    mesh, x, z, heading,
    speed: 0,
    color,
    sport: !!opts.sport,
    parked: !!opts.parked,
    traffic: !!opts.traffic,
    stolen: false,
    target: null,
    waitT: 0,
    hp: 100,
    name: opts.name || 'Sedan',
    id: S.cars.length,
  };
  S.cars.push(car);
  return car;
}

function randomRoadPoint(rng) {
  // A point on a random avenue or street, inside the city.
  if (rng.chance(0.5)) {
    return { x: rng.pick(AVENUES) + rng.range(-2, 2), z: rng.range(-180, 180) };
  }
  return { x: rng.range(-180, 180), z: rng.pick(STREETS) + rng.range(-2, 2) };
}

export function buildCars(S) {
  const rng = makeRng(21 + 7);
  S.cars = [];
  // 10 traffic cars on the roads.
  for (let i = 0; i < 10; i++) {
    const p = randomRoadPoint(rng);
    const c = makeCar(S, p.x, p.z, rng.range(0, Math.PI * 2), rng.pick(CAR_COLORS), { traffic: true });
    c.target = randomRoadPoint(rng);
    c.speed = rng.range(5, 9);
  }
  // 8 parked cars, one of them the orange Vantara GT at (90,-150).
  const parkedSpots = [
    { x: 90, z: -150, sport: true, name: 'Vantara GT' },
    { x: -30, z: 156, name: 'Coupe' },
    { x: 30, z: -156, name: 'Sedan' },
    { x: -90, z: 36, name: 'Hatch' },
    { x: 150, z: -96, name: 'SUV' },
    { x: -150, z: 96, name: 'Sedan' },
    { x: 90, z: 156, name: 'Coupe' },
    { x: -30, z: -96, name: 'Van' },
  ];
  for (const s of parkedSpots) {
    const color = s.sport ? SPORT_COLOR : rng.pick(CAR_COLORS);
    makeCar(S, s.x, s.z, rng.range(0, Math.PI * 2), color, { parked: true, sport: s.sport, name: s.name });
  }
  S.vantara = S.cars.find((c) => c.name === 'Vantara GT');
  return S;
}

// Nearest drivable car within range of a point (used for E to enter).
export function nearestCar(S, x, z, maxD = 4.5) {
  let best = null;
  let bestD = maxD;
  for (const c of S.cars) {
    const d = dist2D(x, z, c.x, c.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function driveStep(S, car, dt, throttle, steer, brake) {
  // Arcade bicycle-ish model: speed, heading, drift on handbrake.
  const maxSpeed = car.sport ? 34 : 26;
  const accel = throttle > 0 ? 14 : throttle < 0 ? -9 : 0;
  car.speed += accel * dt;
  if (throttle === 0) car.speed = damp0(car.speed, dt);
  if (brake) car.speed = damp0(car.speed, dt, 6);
  car.speed = clamp(car.speed, -9, maxSpeed);
  const grip = brake ? 0.45 : 1;
  const steerRate = 1.9 * clamp(Math.abs(car.speed) / 8, 0.25, 1) * grip;
  car.heading += steer * steerRate * dt * (car.speed >= 0 ? 1 : -1);
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  car.x += fx * car.speed * dt;
  car.z += fz * car.speed * dt;
  // Building collision: slide along walls, lose speed on impact.
  const before = { x: car.x, z: car.z };
  collideCircle(S, car, 1.9);
  if (car.x !== before.x || car.z !== before.z) {
    car.speed *= 0.55;
    if (S.player.inCar && S.player.car === car) S.rig.shake = Math.max(S.rig.shake, 0.5);
  }
  car.x = clamp(car.x, S.bounds.minX, S.bounds.maxX);
  car.z = clamp(car.z, S.bounds.minZ, S.bounds.maxZ);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Wheels spin (visual only, driven by the game clock through speed).
  car.mesh.rotation.z = brake ? Math.sin(S.clock.t * 30) * 0.01 : 0;
}

function damp0(v, dt, rate = 2.2) {
  return v * Math.exp(-rate * dt);
}

function trafficStep(S, car, dt) {
  if (!car.target) car.target = randomRoadPoint(makeRng((S.clock.t * 1000 | 0) + car.id * 97 + 5));
  const dx = car.target.x - car.x;
  const dz = car.target.z - car.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 4) {
    car.target = randomRoadPoint(makeRng((S.clock.t * 1000 | 0) + car.id * 131 + 11));
    return;
  }
  const want = Math.atan2(dx, dz);
  const diff = wrapAngle(want - car.heading);
  const steer = clamp(diff * 1.4, -1, 1);
  // Ease toward a cruising speed; slow down for a sharp turn.
  const cruise = Math.abs(diff) > 0.9 ? 3 : 8;
  const throttle = car.speed < cruise ? 1 : 0;
  // Keep distance from the car ahead: brake if another car is close in front.
  let blocked = false;
  for (const o of S.cars) {
    if (o === car) continue;
    const od = dist2D(car.x, car.z, o.x, o.z);
    if (od < 7) {
      const ahead = (o.x - car.x) * Math.sin(car.heading) + (o.z - car.z) * Math.cos(car.heading);
      if (ahead > 0) { blocked = true; break; }
    }
  }
  driveStep(S, car, dt, blocked ? 0 : throttle, steer, blocked);
  // Avoid piling into buildings at intersections: nudge back if stuck.
  if (car.speed < 0.5 && Math.abs(diff) > 1.2) car.heading += diff * dt * 0.5;
}

export function updateCars(S, dt) {
  for (const car of S.cars) {
    if (car.traffic) trafficStep(S, car, dt);
    else if (car === S.player.car) {
      // Player-driven: handled by hero.js input; nothing here.
    }
  }
  // Gentle car-car separation so traffic does not stack.
  for (let i = 0; i < S.cars.length; i++) {
    for (let j = i + 1; j < S.cars.length; j++) {
      const a = S.cars[i];
      const b = S.cars[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 0.01 && d < 3.6) {
        const push = (3.6 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        if (!a.traffic || a === S.player.car) { a.x -= nx * push; a.z -= nz * push; }
        if (!b.traffic || b === S.player.car) { b.x += nx * push; b.z += nz * push; }
        a.mesh.position.set(a.x, 0, a.z);
        b.mesh.position.set(b.x, 0, b.z);
      }
    }
  }
}

export { driveStep };
