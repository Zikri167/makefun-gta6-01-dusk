// shots.js — deterministic screenshot staging for ?shot=... poses.
// Each pose places Rico, the camera and the world state, then flags
// window.__shotReady once a frame has rendered.
import { setTimeOfDay } from './sky.js';

function stageStart(S) {
  // Start screen over a downtown street at dusk-ish daylight.
  S.player.pos.x = 0;
  S.player.pos.z = 60;
  S.player.heading = Math.PI;
  S.player.mesh.position.set(0, 0, 60);
  S.rig.yaw = Math.PI * 0.9;
  S.flags.started = false;
  S.hud.startEl.classList.remove('hidden');
}

function stageStreet(S) {
  S.startGame();
  S.player.pos.x = 0;
  S.player.pos.z = 30;
  S.player.heading = Math.PI;
  S.player.mesh.position.set(0, 0, 30);
  S.rig.yaw = Math.PI * 0.85;
  S.hud.say('Costa Verde — on foot in Downtown.');
}

function stageMission(S) {
  S.startGame();
  // Rico on foot on the south street, beacon for job 1's drop-off ahead.
  S.jobs.startMission(S, 0);
  S.jobs.stage = 1; // already picked the client up
  S.jobs.showBeacon(S);
  S.player.pos.x = 0;
  S.player.pos.z = 150;
  S.player.heading = Math.PI;
  S.player.mesh.position.set(0, 0, 150);
  S.rig.yaw = Math.PI;
  S.hud.say('Drop the client at Market Square — 60m.');
}

function stageChase(S) {
  S.startGame();
  // Rico driving the Vantara GT down the avenue, wanted 3, cops behind.
  const car = S.vantara;
  car.x = 90;
  car.z = -30;
  car.heading = 0;
  car.speed = 22;
  car.mesh.position.set(90, 0, -30);
  car.mesh.rotation.y = 0;
  car.parked = false;
  car.stolen = true;
  S.player.inCar = true;
  S.player.car = car;
  S.player.mesh.visible = false;
  S.player.pos.x = 90;
  S.player.pos.z = -30;
  S.law.wanted = 3;
  S.law.spawnCop(S);
  S.law.spawnCop(S);
  S.law.spawnCop(S);
  // Put the cops where the camera can see them: two flanking ahead,
  // one closing in from behind.
  const copSpots = [
    { x: 82, z: -8, heading: Math.PI },
    { x: 98, z: -2, heading: Math.PI },
    { x: 90, z: -52, heading: 0 },
  ];
  S.law.cops.forEach((c, i) => {
    const s = copSpots[i % copSpots.length];
    c.x = s.x;
    c.z = s.z;
    c.heading = s.heading;
    c.speed = 18;
    c.mesh.position.set(c.x, 0, c.z);
  });
  S.jobs.startMission(S, 1);
  S.jobs.stage = 1;
  S.jobs.showBeacon(S);
  S.rig.yaw = Math.PI;
  S.hud.say('Wanted 3 — lose the cops, deliver the Vantara GT.');
}

export function applyShot(S) {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return false;
  if (q.get('night') === '1' || shot === 'night') setTimeOfDay(S, 'dusk');
  if (shot === 'start') stageStart(S);
  else if (shot === 'street') stageStreet(S);
  else if (shot === 'mission') stageMission(S);
  else if (shot === 'chase') stageChase(S);
  else if (shot === 'night') {
    setTimeOfDay(S, 'dusk');
    stageStreet(S);
  } else {
    stageStreet(S);
  }
  S.shotMode = shot;
  return true;
}

export function markShotReady(S) {
  window.__shotReady = true;
  window.__shotName = S.shotMode || 'none';
}
