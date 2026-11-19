// law.js — wanted level, police spawn / chase / ram, Busted and Wasted,
// and the cooldown that lets Rico cool off while sheltered or hidden.
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { clamp, dist2D, wrapAngle } from './util.js';
import { buildCarMesh } from './cars.js';

const MAX_COPS = 6;

function buildCopMesh() {
  const g = buildCarMesh(0x1a1a22, false);
  // Light bar.
  const barMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.4), barMat);
  bar.position.set(0, 1.42, 0.1);
  g.add(bar);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 }));
  red.position.set(-0.3, 1.52, 0.1);
  g.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 2 }));
  blue.position.set(0.3, 1.52, 0.1);
  g.add(blue);
  g.userData.red = red;
  g.userData.blue = blue;
  return g;
}

export function createLaw(S) {
  const law = {
    wanted: 0,
    cops: [],
    cooldownT: 0,
    bustT: 0,
    sirenT: 0,
    rng: makeRng(21 + 31),

    addWanted(S2, n, why) {
      const before = this.wanted;
      this.wanted = clamp(this.wanted + n, 0, 5);
      if (this.wanted > before) {
        S2.hud.flashStars();
        S2.hud.say('Wanted level ' + this.wanted + ' — ' + why + '.');
        S2.tunes.sirenBurst();
        this.cooldownT = 0;
      }
      return this.wanted;
    },

    clearWanted(S2) {
      this.wanted = 0;
      this.despawnAll(S2);
    },

    despawnAll(S2) {
      for (const c of this.cops) S2.scene.remove(c.mesh);
      this.cops = [];
    },

    spawnCop(S2) {
      if (this.cops.length >= MAX_COPS) return;
      const p = S2.player;
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(35, 55);
      const x = clamp(p.pos.x + Math.cos(a) * d, -200, 200);
      const z = clamp(p.pos.z + Math.sin(a) * d, -200, 200);
      const mesh = buildCopMesh();
      mesh.position.set(x, 0, z);
      S2.scene.add(mesh);
      this.cops.push({ mesh, x, z, heading: 0, speed: 0, hp: 60, bustHold: 0 });
      S2.hud.say('Police on your tail.');
    },

    update(S2, dt) {
      const p = S2.player;
      // Spawn cops up to the wanted level (1 cop per star, capped).
      const wantCops = Math.min(this.wanted, 3) + (this.wanted >= 4 ? 2 : 0) + (this.wanted >= 5 ? 1 : 0);
      if (this.wanted > 0 && !p.sheltered && this.cops.length < wantCops && S2.flags.started && !S2.flags.busted && !S2.flags.wasted) {
        this.spawnCop(S2);
      }
      if (this.wanted === 0 && this.cops.length > 0) this.despawnAll(S2);

      // Cooldown: sheltered in a room, or no cop close for a while.
      const anyNear = this.cops.some((c) => dist2D(c.x, c.z, p.pos.x, p.pos.z) < 45);
      if (this.wanted > 0 && (p.sheltered || !anyNear)) {
        this.cooldownT += dt;
        if (this.cooldownT > 9) {
          this.cooldownT = 0;
          this.wanted -= 1;
          S2.hud.say(this.wanted === 0 ? 'You lost them. Clean.' : 'Heat dropping… wanted ' + this.wanted + '.');
          if (this.wanted === 0) this.despawnAll(S2);
        }
      } else {
        this.cooldownT = 0;
      }

      // Siren ambience while wanted.
      if (this.wanted > 0) {
        this.sirenT -= dt;
        if (this.sirenT <= 0) {
          this.sirenT = 2.6;
          S2.tunes.sirenBurst();
        }
      }

      // Chase behaviour. Sheltered Rico is out of reach: cops idle outside.
      if (p.sheltered) {
        for (const cop of this.cops) cop.speed = Math.max(0, cop.speed - 12 * dt);
        return;
      }
      for (const cop of this.cops) {
        const dx = p.pos.x - cop.x;
        const dz = p.pos.z - cop.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const wantHeading = Math.atan2(dx, dz);
        const diff = wrapAngle(wantHeading - cop.heading);
        const topSpeed = p.inCar ? 30 : 11;
        cop.speed = clamp(cop.speed + (d > 6 ? 9 : -6) * dt, 0, topSpeed);
        cop.heading += clamp(diff * 1.6, -1.6, 1.6) * dt * clamp(Math.abs(cop.speed) / 6, 0.3, 1);
        cop.x += Math.sin(cop.heading) * cop.speed * dt;
        cop.z += Math.cos(cop.heading) * cop.speed * dt;
        cop.x = clamp(cop.x, S2.bounds.minX, S2.bounds.maxX);
        cop.z = clamp(cop.z, S2.bounds.minZ, S2.bounds.maxZ);
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
        // Flashing light bar from the game clock.
        const on = Math.sin(S2.clock.t * 9) > 0;
        cop.mesh.userData.red.material.emissiveIntensity = on ? 2.5 : 0.2;
        cop.mesh.userData.blue.material.emissiveIntensity = on ? 0.2 : 2.5;

        if (d < 3.2) {
          if (p.inCar && p.car) {
            // Ram the player's car: shove it and shake the camera.
            const push = 3.2 - d;
            const nx = dx / Math.max(d, 0.01);
            const nz = dz / Math.max(d, 0.01);
            p.car.x += nx * push * 0.6;
            p.car.z += nz * push * 0.6;
            p.car.speed *= 0.82;
            S2.rig.shake = Math.max(S2.rig.shake, 0.8);
            S2.tunes.thud();
            cop.speed *= 0.5;
          } else {
            // On foot: hold still next to Rico to bust him.
            cop.bustHold += dt;
            if (cop.bustHold > 2.0) {
              S2.flags.busted = true;
              S2.hud.showBusted();
              S2.tunes.bustedJingle();
              return;
            }
          }
        } else {
          cop.bustHold = Math.max(0, cop.bustHold - dt);
        }
        // Cop bumps damage Rico on foot.
        if (!p.inCar && d < 1.8) {
          p.hp -= 12 * dt;
          S2.rig.shake = Math.max(S2.rig.shake, 0.4);
        }
      }

      // Wasted check.
      if (p.hp <= 0 && !S2.flags.wasted) {
        p.hp = 0;
        S2.flags.wasted = true;
        S2.hud.showWasted();
        S2.tunes.wastedJingle();
      }
    },
  };
  return law;
}
