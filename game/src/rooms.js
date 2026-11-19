// rooms.js — interiors: the Voss office and the chop garage, built as
// separate rooms far east of the city (x ~ 2000), reached through glowing
// door portals. Exiting drops Rico 4–5 m from the door (exitDrop), never
// back on top of the portal, so there is no enter-exit loop.
import * as THREE from 'three';
import { dist2D } from './util.js';

const OFFICE = { cx: 2000, cz: 0, doorX: 30, doorZ: -90, name: 'office' };
const GARAGE = { cx: 2150, cz: 0, doorX: 150, doorZ: 30, name: 'garage' };

function roomShell(S, cx, cz, w, d, floorColor, wallColor) {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.3, d),
    new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.9 }),
  );
  floor.position.set(cx, 0.15, cz);
  g.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.85 });
  const mkWall = (ww, hh, dd, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), wallMat);
    m.position.set(x, hh / 2, z);
    g.add(m);
    return m;
  };
  // North / south / west / east walls (south wall has the door gap handled
  // by two segments; the exit marker sits in the gap).
  mkWall(w, 4, 0.6, cx, cz - d / 2);
  mkWall(w / 2 - 1.5, 4, 0.6, cx - w / 4 - 0.75, cz + d / 2);
  mkWall(w / 2 - 1.5, 4, 0.6, cx + w / 4 + 0.75, cz + d / 2);
  mkWall(0.6, 4, d, cx - w / 2, cz);
  mkWall(0.6, 4, d, cx + w / 2, cz);
  // Ceiling beams (open sky above, beams only, so light still reads).
  for (let i = -1; i <= 1; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x3a2f24, roughness: 0.9 }));
    beam.position.set(cx, 4.1, cz + i * (d / 3));
    g.add(beam);
  }
  S.scene.add(g);
  // Wall colliders (registered in the shared list; far from the city).
  const add = (minX, maxX, minZ, maxZ) => S.colliders.push({ minX, maxX, minZ, maxZ, kind: 'room' });
  add(cx - w / 2 - 0.3, cx + w / 2 + 0.3, cz - d / 2 - 0.3, cz - d / 2 + 0.3);
  add(cx - w / 2 - 0.3, cx - w / 2 + 0.3, cz - d / 2, cz + d / 2);
  add(cx + w / 2 - 0.3, cx + w / 2 + 0.3, cz - d / 2, cz + d / 2);
  add(cx - w / 2, cx - 1.5, cz + d / 2 - 0.3, cz + d / 2 + 0.3);
  add(cx + 1.5, cx + w / 2, cz + d / 2 - 0.3, cz + d / 2 + 0.3);
  return g;
}

function buildOffice(S) {
  roomShell(S, OFFICE.cx, OFFICE.cz, 18, 13, 0x6a4a2f, 0x8a6a4a);
  const cx = OFFICE.cx;
  const cz = OFFICE.cz;
  // Desk at the room centre — the finale drop point.
  const desk = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.0, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.7 }));
  desk.position.set(cx, 0.8, cz - 1);
  S.scene.add(desk);
  const cash = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x2f8a4d, emissive: 0x1a5a2d, emissiveIntensity: 0.6 }));
  cash.position.set(cx - 0.8, 1.5, cz - 1);
  S.scene.add(cash);
  // Safe against the north wall.
  const safe = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.4, metalness: 0.7 }));
  safe.position.set(cx + 6, 1.6, cz - 5.4);
  S.scene.add(safe);
  // Rug, chairs, lamp, painting.
  const rug = new THREE.Mesh(new THREE.BoxGeometry(6, 0.06, 4),
    new THREE.MeshStandardMaterial({ color: 0x7a1f2b, roughness: 1 }));
  rug.position.set(cx, 0.34, cz + 1.5);
  S.scene.add(rug);
  for (const dx of [-1.4, 1.4]) {
    const chair = new THREE.Mesh(new THREE.BoxGeometry(1, 1.1, 1),
      new THREE.MeshStandardMaterial({ color: 0x3a2f4a, roughness: 0.8 }));
    chair.position.set(cx + dx, 0.85, cz + 1.2);
    S.scene.add(chair);
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffd880, emissiveIntensity: 1.6 });
  S.sky.registerLamp(lampMat);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), lampMat);
  lamp.position.set(cx, 3.6, cz);
  S.scene.add(lamp);
  const painting = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x2f6f8a, roughness: 0.6 }));
  painting.position.set(cx - 5, 2.4, cz - 6.1);
  S.scene.add(painting);
}

function buildGarage(S) {
  roomShell(S, GARAGE.cx, GARAGE.cz, 20, 14, 0x3c4148, 0x5a5f66);
  const cx = GARAGE.cx;
  const cz = GARAGE.cz;
  // Workbench along the north wall.
  const bench = new THREE.Mesh(new THREE.BoxGeometry(6, 1.0, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x6a4a2f, roughness: 0.8 }));
  bench.position.set(cx - 4, 0.8, cz - 5.6);
  S.scene.add(bench);
  // Tyre stacks.
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14), tyreMat);
    t.position.set(cx + 7.5, 0.5 + i * 0.42, cz - 5);
    S.scene.add(t);
  }
  // Car lift in the middle.
  const lift = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 5.5),
    new THREE.MeshStandardMaterial({ color: 0xd8a93a, roughness: 0.5, metalness: 0.5 }));
  lift.position.set(cx + 1, 0.55, cz);
  S.scene.add(lift);
  // Tool wall: coloured pegboard boxes.
  const toolColors = [0xc0392b, 0x2e6fb0, 0xd8a93a, 0x4da34d];
  for (let i = 0; i < 8; i++) {
    const tool = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.15),
      new THREE.MeshStandardMaterial({ color: toolColors[i % 4], roughness: 0.6 }));
    tool.position.set(cx - 8 + i * 1.1, 2.2, cz - 6.6);
    S.scene.add(tool);
  }
  // Neon sign strip (emissive, glows at dusk).
  const neonMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff6a00, emissiveIntensity: 1.8 });
  S.sky.registerLamp(neonMat);
  const neon = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 0.2), neonMat);
  neon.position.set(cx, 3.4, cz - 6.6);
  S.scene.add(neon);
}

function buildPortal(S, doorX, doorZ, color, label) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  for (const dx of [-1.6, 1.6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.4, 0.5), frameMat);
    post.position.set(dx, 2.2, 0);
    g.add(post);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.5, 0.5), frameMat);
  top.position.set(0, 4.4, 0);
  g.add(top);
  const glowMat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 1.6, transparent: true, opacity: 0.75,
  });
  S.sky.registerLamp(glowMat);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 4.0), glowMat);
  glow.position.set(0, 2.1, 0);
  g.add(glow);
  g.position.set(doorX, 0, doorZ);
  // Face the street: office door faces south (+z), garage door faces west (-x).
  g.rotation.y = label === 'office' ? 0 : Math.PI / 2;
  S.scene.add(g);
  return g;
}

export function buildRooms(S) {
  buildOffice(S);
  buildGarage(S);
  const officePortal = buildPortal(S, OFFICE.doorX, OFFICE.doorZ, 0xffd23d, 'office');
  const garagePortal = buildPortal(S, GARAGE.doorX, GARAGE.doorZ, 0xff6a00, 'garage');
  const rooms = {
    inside: null, // 'office' | 'garage' | null
    officePortal, garagePortal,
    office: OFFICE, garage: GARAGE,

    // Called on E when Rico is on foot. Returns true if a portal was used.
    tryUsePortal(S2) {
      const p = S2.player;
      if (p.inCar) return false;
      if (this.inside) {
        this.exitRoom(S2);
        return true;
      }
      if (dist2D(p.pos.x, p.pos.z, OFFICE.doorX, OFFICE.doorZ) < 2.5) {
        this.enterRoom(S2, 'office');
        return true;
      }
      if (dist2D(p.pos.x, p.pos.z, GARAGE.doorX, GARAGE.doorZ) < 2.5) {
        this.enterRoom(S2, 'garage');
        return true;
      }
      return false;
    },

    enterRoom(S2, which) {
      const room = which === 'office' ? OFFICE : GARAGE;
      const p = S2.player;
      this.inside = which;
      p.sheltered = true;
      p.pos.x = room.cx;
      p.pos.z = room.cz + 4.5; // entry step, just inside the door gap
      p.heading = Math.PI;
      p.mesh.position.set(p.pos.x, 0, p.pos.z);
      S2.tunes.doorSound();
      S2.hud.say(which === 'office' ? 'Voss office — put the cash on the desk.' : 'Chop garage — Rico, out of sight.');
      // Entering the office on the finale's door stage advances the job.
      if (which === 'office' && S2.jobs.index === 3 && S2.jobs.stage === 1) {
        S2.jobs.completeStage(S2);
      }
    },

    exitRoom(S2) {
      const room = this.inside === 'office' ? OFFICE : GARAGE;
      const p = S2.player;
      this.inside = null;
      p.sheltered = false;
      // exitDrop: 4–5 m out from the door, clear of the portal trigger.
      const dx = room.name === 'office' ? 0 : -4.5;
      const dz = room.name === 'office' ? 4.5 : 0;
      p.pos.x = room.doorX + dx;
      p.pos.z = room.doorZ + dz;
      p.heading = room.name === 'office' ? 0 : Math.PI / 2;
      p.mesh.position.set(p.pos.x, 0, p.pos.z);
      S2.tunes.doorSound();
      S2.hud.say('Back on the street.');
    },

    update(S2) {
      // Hint near a portal.
      const p = S2.player;
      if (!p.inCar && !this.inside) {
        if (dist2D(p.pos.x, p.pos.z, OFFICE.doorX, OFFICE.doorZ) < 4) {
          S2.hud.hint('Press E to enter the Voss office');
        } else if (dist2D(p.pos.x, p.pos.z, GARAGE.doorX, GARAGE.doorZ) < 4) {
          S2.hud.hint('Press E to enter the chop garage');
        }
      }
      // Pulse the portal glow with the game clock.
      const pulse = 1.3 + Math.sin(S2.clock.t * 3.2) * 0.5;
      for (const portal of [this.officePortal, this.garagePortal]) {
        const glow = portal.children[3];
        if (glow && glow.material) glow.material.emissiveIntensity = pulse;
      }
    },
  };
  S.rooms = rooms;
  return rooms;
}
