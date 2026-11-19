// hero.js — Rico Vega on foot: movement, collision, entering and exiting
// cars, and the driving input that feeds the arcade car physics.
import * as THREE from 'three';
import { clamp, dist2D } from './util.js';
import { keyDown, wasPressed } from './kernel.js';
import { nearestCar, driveStep } from './cars.js';
import { collideCircle } from './town.js';
import { scarePeds } from './crowd.js';

function buildHeroMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x1f6f5c, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98f66, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.76, 0.38), jacket);
  torso.position.y = 1.16;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
  head.position.y = 1.8;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8a93a, roughness: 0.7 }));
  cap.position.y = 2.0;
  g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.82, 0.26), pants);
  legL.position.set(-0.17, 0.41, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.64, 0.2), jacket);
  armL.position.set(-0.44, 1.16, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.44;
  g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export function buildHero(S) {
  const mesh = buildHeroMesh();
  mesh.position.set(0, 0, 120);
  S.scene.add(mesh);
  S.player = {
    mesh,
    pos: { x: 0, z: 120 },
    heading: Math.PI,
    camYaw: Math.PI * 0.75,
    hp: 100,
    maxHp: 100,
    inCar: false,
    car: null,
    speed: 0,
    moving: false,
    sheltered: false,
    ammo: 24,
    reserveAmmo: 96,
    reloading: false,
    reloadT: 0,
  };
  return S;
}

export function enterCar(S, car) {
  const p = S.player;
  p.inCar = true;
  p.car = car;
  car.traffic = false;
  car.parked = false;
  p.mesh.visible = false;
  if (!car.stolen && car !== S.vantara) {
    // Stealing any parked car that is not yours draws the law.
    if (car.parkedBefore !== false) { /* parked cars are not owned by Rico */ }
  }
  S.hud.say(car.sport ? 'Vantara GT — nice ride, Rico.' : 'Car jacked. The law noticed.');
  return car;
}

export function exitCar(S) {
  const p = S.player;
  if (!p.car) return;
  const car = p.car;
  // Step out to the side of the car.
  const side = Math.cos(car.heading);
  const sideZ = -Math.sin(car.heading);
  p.pos.x = car.x + side * 2.2;
  p.pos.z = car.z + sideZ * 2.2;
  p.pos.x = clamp(p.pos.x, S.bounds.minX, S.bounds.maxX);
  p.pos.z = clamp(p.pos.z, S.bounds.minZ, S.bounds.maxZ);
  p.inCar = false;
  p.car = null;
  p.mesh.visible = true;
  p.mesh.position.set(p.pos.x, 0, p.pos.z);
  p.heading = car.heading;
}

export function updateHero(S, dt) {
  const p = S.player;
  const input = S.input;
  if (S.flags.paused || S.flags.busted || S.flags.wasted || !S.flags.started) return;

  // E: enter / exit car, or use a room portal (edge-triggered).
  if (wasPressed(input, 'KeyE')) {
    if (p.inCar) {
      exitCar(S);
    } else if (S.rooms.tryUsePortal(S)) {
      // Portal handled it.
    } else {
      const car = nearestCar(S, p.pos.x, p.pos.z, 4.5);
      if (car) {
        const wasParked = car.parked;
        enterCar(S, car);
        if (wasParked) {
          car.stolen = true;
          S.law.addWanted(S, 1, 'car stolen');
        }
      }
    }
  }

  if (p.inCar && p.car) {
    updateDriving(S, dt);
    return;
  }

  // --- On foot ---
  const fwd = (keyDown(input, 'KeyW') || keyDown(input, 'ArrowUp') ? 1 : 0)
    - (keyDown(input, 'KeyS') || keyDown(input, 'ArrowDown') ? 1 : 0);
  const strafe = (keyDown(input, 'KeyD') || keyDown(input, 'ArrowRight') ? 1 : 0)
    - (keyDown(input, 'KeyA') || keyDown(input, 'ArrowLeft') ? 1 : 0);
  const run = keyDown(input, 'ShiftLeft') || keyDown(input, 'ShiftRight');
  const speed = run ? 9.5 : 5.2;
  // Movement is relative to the camera yaw.
  const cy = p.camYaw;
  const mx = Math.sin(cy) * -fwd + Math.cos(cy) * strafe;
  const mz = Math.cos(cy) * -fwd + -Math.sin(cy) * strafe;
  const ml = Math.sqrt(mx * mx + mz * mz);
  p.moving = ml > 0.01;
  if (p.moving) {
    const nx = mx / ml;
    const nz = mz / ml;
    p.pos.x += nx * speed * dt;
    p.pos.z += nz * speed * dt;
    p.heading = Math.atan2(nx, nz);
    p.speed = speed;
    // Scare nearby peds when sprinting through a crowd.
    if (run) scarePeds(S, p.pos.x, p.pos.z, 2.5);
  } else {
    p.speed = 0;
  }
  // Inside a room (x ~ 2000) the city bounds do not apply; the room's
  // own walls bound Rico instead.
  if (!p.sheltered) {
    p.pos.x = clamp(p.pos.x, S.bounds.minX, S.bounds.maxX);
    p.pos.z = clamp(p.pos.z, S.bounds.minZ, S.bounds.maxZ);
  }
  collideCircle(S, p.pos, 0.55);
  p.mesh.position.set(p.pos.x, 0, p.pos.z);
  p.mesh.rotation.y = p.heading;
  // Walk-cycle swing from the game clock.
  const swing = p.moving ? Math.sin(S.clock.t * (run ? 11 : 7)) * 0.55 : 0;
  p.mesh.userData.legL.rotation.x = swing;
  p.mesh.userData.legR.rotation.x = -swing;
  p.mesh.userData.armL.rotation.x = -swing * 0.7;
  p.mesh.userData.armR.rotation.x = swing * 0.7;

  // Reload.
  if (keyDown(input, 'KeyR') && p.ammo < 24 && !p.reloading && p.reserveAmmo > 0) {
    p.reloading = true;
    p.reloadT = 1.1;
    S.tunes.blip(520, 0.06);
  }
  if (p.reloading) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      const need = 24 - p.ammo;
      const take = Math.min(need, p.reserveAmmo);
      p.ammo += take;
      p.reserveAmmo -= take;
      p.reloading = false;
    }
  }
}

function updateDriving(S, dt) {
  const p = S.player;
  const car = p.car;
  const input = S.input;
  const throttle = (keyDown(input, 'KeyW') || keyDown(input, 'ArrowUp') ? 1 : 0)
    - (keyDown(input, 'KeyS') || keyDown(input, 'ArrowDown') ? 1 : 0);
  const steer = (keyDown(input, 'KeyA') || keyDown(input, 'ArrowLeft') ? 1 : 0)
    - (keyDown(input, 'KeyD') || keyDown(input, 'ArrowRight') ? 1 : 0);
  const brake = keyDown(input, 'Space');
  const before = { x: car.x, z: car.z };
  driveStep(S, car, dt, throttle, steer, brake);
  const moved = dist2D(before.x, before.z, car.x, car.z);
  p.pos.x = car.x;
  p.pos.z = car.z;
  p.speed = Math.abs(car.speed);
  p.heading = car.heading;
  // Hitting a pedestrian while speeding is a crime.
  if (Math.abs(car.speed) > 8) {
    for (const ped of S.peds) {
      if (ped.state !== 'down' && dist2D(ped.x, ped.z, car.x, car.z) < 2.4) {
        ped.state = 'down';
        ped.mesh.rotation.x = Math.PI / 2;
        ped.mesh.position.y = 0.4;
        S.law.addWanted(S, 1, 'pedestrian hit');
        S.hud.say('You hit someone. The cops are coming.');
        S.tunes.thud();
      }
    }
    scarePeds(S, car.x, car.z, 14);
  }
  // Engine sound follows speed.
  S.tunes.engine(Math.abs(car.speed) / 34, throttle !== 0);
  void moved;
}
