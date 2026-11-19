// fight.js — pistol combat: hitscan shots from Rico, ammo, muzzle flash,
// tracer lines, and reactions from peds and police.
import * as THREE from 'three';
import { consumeClick, keyDown } from './kernel.js';
import { dist2D } from './util.js';
import { scarePeds } from './crowd.js';

export function createFight(S) {
  const fight = {
    cooldown: 0,
    tracers: [],
    flash: null,
    flashT: 0,

    shoot(S2) {
      const p = S2.player;
      if (p.inCar || p.reloading) return;
      if (p.ammo <= 0) {
        S2.hud.say('Out of ammo — press R to reload.');
        S2.tunes.clickSound();
        return;
      }
      if (this.cooldown > 0) return;
      this.cooldown = 0.28;
      p.ammo -= 1;
      S2.tunes.gunshot();
      S2.rig.shake = Math.max(S2.rig.shake, 0.25);
      // Hitscan: aim along the camera yaw from Rico's chest.
      const yaw = p.camYaw;
      const ox = p.pos.x;
      const oz = p.pos.z;
      const dx = -Math.sin(yaw);
      const dz = -Math.cos(yaw);
      const range = 60;
      // Muzzle flash.
      const flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffdd55 }),
      );
      flash.position.set(ox + dx * 1.2, 1.5, oz + dz * 1.2);
      S2.scene.add(flash);
      this.flash = flash;
      this.flashT = 0.06;
      // Tracer line.
      const endX = ox + dx * range;
      const endZ = oz + dz * range;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(ox + dx, 1.5, oz + dz),
        new THREE.Vector3(endX, 1.4, endZ),
      ]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
      S2.scene.add(line);
      this.tracers.push({ line, t: 0.09 });
      // Hit test: nearest ped or cop within a thin corridor of the ray.
      let hit = null;
      let hitD = range;
      const testTarget = (tx, tz, obj, kind) => {
        const rx = tx - ox;
        const rz = tz - oz;
        const along = rx * dx + rz * dz;
        if (along < 0 || along > range) return;
        const perp = Math.abs(rx * dz - rz * dx);
        if (perp < 1.4 && along < hitD) { hitD = along; hit = { obj, kind }; }
      };
      for (const ped of S2.peds) if (ped.state !== 'down') testTarget(ped.x, ped.z, ped, 'ped');
      for (const cop of S2.law.cops) testTarget(cop.x, cop.z, cop, 'cop');
      if (hit) {
        // Shorten the tracer to the hit point.
        const pts = [new THREE.Vector3(ox + dx, 1.5, oz + dz), new THREE.Vector3(ox + dx * hitD, 1.4, oz + dz * hitD)];
        line.geometry.setFromPoints(pts);
        if (hit.kind === 'ped') {
          hit.obj.state = 'down';
          hit.obj.mesh.rotation.x = Math.PI / 2;
          hit.obj.mesh.position.y = 0.4;
          S2.law.addWanted(S2, 1, 'pedestrian shot');
          S2.hud.say('You shot a pedestrian. Wanted up.');
        } else {
          hit.obj.hp -= 34;
          S2.law.addWanted(S2, 1, 'cop shot');
          S2.hud.say('You hit a cop. They are not happy.');
          if (hit.obj.hp <= 0) {
            S2.scene.remove(hit.obj.mesh);
            S2.law.cops = S2.law.cops.filter((c) => c !== hit.obj);
            S2.hud.say('Cop down.');
          }
        }
      }
      scarePeds(S2, ox, oz, 26);
    },

    update(S2, dt) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      if (this.flash) {
        this.flashT -= dt;
        if (this.flashT <= 0) {
          S2.scene.remove(this.flash);
          this.flash = null;
        }
      }
      for (let i = this.tracers.length - 1; i >= 0; i--) {
        const tr = this.tracers[i];
        tr.t -= dt;
        if (tr.t <= 0) {
          S2.scene.remove(tr.line);
          this.tracers.splice(i, 1);
        }
      }
      if (!S2.flags.started || S2.flags.paused) {
        S2.input.clicked = false;
        return;
      }
      if (consumeClick(S2.input)) this.shoot(S2);
    },
  };
  return fight;
}
