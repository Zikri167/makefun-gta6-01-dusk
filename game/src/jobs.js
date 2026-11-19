// jobs.js — Rico's job chain for fixer Mara Voss: four missions, chained,
// with beacons, rewards and the finale banner. Every beacon sits on a
// road, plaza or promenade — never inside a building collider.
import * as THREE from 'three';
import { dist2D, formatCash } from './util.js';
import { setTimeOfDay } from './sky.js';

// All mission points, in one place, so the playtest can assert each one
// lies outside every building collider.
export const MISSION_POINTS = [
  { x: 0, z: 180, label: 'M1 pickup — marina promenade' },
  { x: 0, z: 90, label: 'M1 dropoff — market square' },
  { x: 90, z: -150, label: 'M2 Vantara GT parking spot' },
  { x: 150, z: 30, label: 'M2 chop garage door' },
  { x: 190, z: -60, label: 'M3 harbor drop 1' },
  { x: 190, z: 0, label: 'M3 harbor drop 2' },
  { x: 190, z: 60, label: 'M3 harbor drop 3' },
  { x: 150, z: -150, label: 'M4 cash pickup' },
  { x: 30, z: -90, label: 'M4 Voss office door' },
];

const MISSIONS = [
  {
    id: 1, name: 'First Fare', reward: 150,
    intro: 'Mara Voss: pick up my client at the marina promenade, drop him at Market Square.',
    stages: [
      { x: 0, z: 180, text: 'Pick up the client at the marina promenade' },
      { x: 0, z: 90, text: 'Drop the client at Market Square' },
    ],
  },
  {
    id: 2, name: 'Hot Wheels', reward: 300,
    intro: 'Mara Voss: an orange Vantara GT is parked on the north avenue. Bring it to the chop garage.',
    stages: [
      { x: 90, z: -150, text: 'Steal the orange Vantara GT', needCar: 'Vantara GT' },
      { x: 150, z: 30, text: 'Deliver the Vantara GT to the chop garage', needCar: 'Vantara GT' },
    ],
  },
  {
    id: 3, name: 'Harbor Run', reward: 500, timer: 90,
    intro: 'Mara Voss: three drops along the harbor road. 90 seconds. Each drop heats things up.',
    stages: [
      { x: 190, z: -60, text: 'Harbor drop 1 of 3', heat: 1 },
      { x: 190, z: 0, text: 'Harbor drop 2 of 3', heat: 1 },
      { x: 190, z: 60, text: 'Harbor drop 3 of 3', heat: 1 },
    ],
  },
  {
    id: 4, name: 'Sundown', reward: 500, dusk: true,
    intro: 'Mara Voss: sundown. Grab the cash at the north-east corner, bring it to my office door, and put it on my desk.',
    stages: [
      { x: 150, z: -150, text: 'Pick up the cash bag' },
      { x: 30, z: -90, text: 'Go to the Voss office door — press E to enter' },
      { x: 2000, z: 0, text: 'Put the cash on the desk inside the office', interior: 'office' },
    ],
  },
];

function buildBeaconMesh(S, color) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.4, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 13;
  g.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 2.4, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  g.add(ring);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4 }),
  );
  diamond.position.y = 3.2;
  g.add(diamond);
  g.userData.diamond = diamond;
  g.userData.ring = ring;
  return g;
}

export function createJobs(S) {
  const jobs = {
    index: 0, // 0-based mission index; 4 means all done
    stage: 0,
    done: 0,
    cash: 0,
    timer: 0,
    timerActive: false,
    beacon: null,
    beacons: MISSION_POINTS,
    passenger: false,

    current() {
      return MISSIONS[this.index] || null;
    },
    currentStage() {
      const m = this.current();
      return m ? m.stages[this.stage] : null;
    },
    objectiveText() {
      if (this.index >= MISSIONS.length) return 'All jobs done — Costa Verde is yours, Rico.';
      const st = this.currentStage();
      const m = this.current();
      let t = 'Job ' + m.id + ' — ' + m.name + ': ' + st.text;
      if (this.timerActive) t += '  (' + Math.ceil(this.timer) + 's)';
      return t;
    },
    targetPos() {
      const st = this.currentStage();
      return st ? { x: st.x, z: st.z } : null;
    },

    showBeacon(S2) {
      this.hideBeacon(S2);
      const st = this.currentStage();
      if (!st) return;
      if (st.interior) {
        // Interior stage: beacon lives inside the office room.
        const b = buildBeaconMesh(S2, 0xffd23d);
        b.position.set(st.x, 0, st.z);
        S2.scene.add(b);
        this.beacon = b;
        return;
      }
      const b = buildBeaconMesh(S2, 0xffd23d);
      b.position.set(st.x, 0, st.z);
      S2.scene.add(b);
      this.beacon = b;
    },
    hideBeacon(S2) {
      if (this.beacon) {
        S2.scene.remove(this.beacon);
        this.beacon = null;
      }
    },

    startMission(S2, idx) {
      this.index = idx;
      this.stage = 0;
      const m = this.current();
      if (!m) return;
      if (m.dusk) setTimeOfDay(S2, 'dusk');
      if (m.timer) {
        this.timer = m.timer;
        this.timerActive = true;
      } else {
        this.timerActive = false;
      }
      S2.hud.banner('JOB ' + m.id + ' — ' + m.name.toUpperCase(), m.intro);
      S2.hud.say(m.intro);
      S2.tunes.jobJingle();
      this.showBeacon(S2);
    },

    completeStage(S2) {
      const m = this.current();
      const st = this.currentStage();
      if (st && st.heat) S2.law.addWanted(S2, st.heat, 'harbor drop');
      S2.tunes.pickupJingle();
      this.stage += 1;
      if (this.stage >= m.stages.length) {
        this.completeMission(S2);
      } else {
        S2.hud.say('Next: ' + m.stages[this.stage].text);
        this.showBeacon(S2);
      }
    },

    completeMission(S2) {
      const m = this.current();
      this.cash += m.reward;
      S2.progress.cash = this.cash;
      this.done += 1;
      this.timerActive = false;
      S2.hud.banner('JOB COMPLETE — ' + m.name.toUpperCase(), '+' + formatCash(m.reward) + '  •  Total ' + formatCash(this.cash));
      S2.hud.say('Job complete: +' + formatCash(m.reward) + '. Total ' + formatCash(this.cash) + '.');
      S2.tunes.payJingle();
      S2.progress.save(S2);
      if (this.index + 1 >= MISSIONS.length) {
        this.index = MISSIONS.length;
        this.hideBeacon(S2);
        S2.hud.banner('ALL JOBS DONE', 'Voss is paid. Costa Verde is yours, Rico.');
        S2.hud.say('All jobs done. Voss is paid. Costa Verde is yours, Rico.');
        S2.tunes.finaleJingle();
        return;
      }
      this.startMission(S2, this.index + 1);
    },

    failTimer(S2) {
      this.timerActive = false;
      S2.hud.banner('TOO SLOW', 'The harbor run window closed. Mara gives you one more shot.');
      S2.hud.say('Too slow — Harbor Run restarts.');
      this.startMission(S2, this.index);
    },

    update(S2, dt) {
      if (!S2.flags.started || S2.flags.paused || S2.flags.busted || S2.flags.wasted) return;
      if (this.index >= MISSIONS.length) return;
      const st = this.currentStage();
      if (!st) return;
      // Timer for Harbor Run.
      if (this.timerActive) {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = 0;
          this.failTimer(S2);
          return;
        }
      }
      // Interior stage: only reachable while sheltered inside the office.
      if (st.interior) {
        if (!S2.player.sheltered) return;
        const d = dist2D(S2.player.pos.x, S2.player.pos.z, st.x, st.z);
        if (d < 3.5) this.completeStage(S2);
        return;
      }
      // Door stage of the finale: reaching the office door prompts E.
      if (this.index === 3 && this.stage === 1) {
        const d = dist2D(S2.player.pos.x, S2.player.pos.z, st.x, st.z);
        if (d < 4 && !S2.player.inCar) {
          S2.hud.hint('Press E to enter the Voss office');
        }
        return;
      }
      const p = S2.player;
      const d = dist2D(p.pos.x, p.pos.z, st.x, st.z);
      if (d > 5.5) return;
      if (st.needCar) {
        if (!p.inCar || !p.car || p.car.name !== st.needCar) {
          S2.hud.hint('You need the ' + st.needCar + ' for this.');
          return;
        }
      }
      this.completeStage(S2);
    },

    tickBeacon(S2) {
      if (!this.beacon) return;
      const dia = this.beacon.userData.diamond;
      const ring = this.beacon.userData.ring;
      dia.rotation.y = S2.clock.t * 1.8;
      dia.position.y = 3.2 + Math.sin(S2.clock.t * 2.2) * 0.35;
      const s = 1 + Math.sin(S2.clock.t * 3) * 0.08;
      ring.scale.set(s, s, s);
    },
  };
  return jobs;
}
