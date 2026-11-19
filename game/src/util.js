// util.js — small math helpers shared by every Verde Heat system.
// No gameplay state lives here; only pure functions.
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(current, target, rate, dt) {
  // Frame-rate independent exponential approach.
  return lerp(target, current, Math.exp(-rate * dt));
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleLerp(a, b, t) {
  return a + wrapAngle(b - a) * t;
}

export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function pointInBox(x, z, box) {
  return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
}

// Push a circle (x,z,r) out of an AABB. Returns true when a push happened.
export function pushOutOfBox(pos, r, box) {
  const cx = clamp(pos.x, box.minX, box.maxX);
  const cz = clamp(pos.z, box.minZ, box.maxZ);
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 0.000001) {
    const d = Math.sqrt(d2);
    pos.x = cx + (dx / d) * r;
    pos.z = cz + (dz / d) * r;
  } else {
    // Centre is inside the box: shove out along the smallest penetration axis.
    const pl = pos.x - box.minX;
    const pr = box.maxX - pos.x;
    const pt = pos.z - box.minZ;
    const pb = box.maxZ - pos.z;
    const m = Math.min(pl, pr, pt, pb);
    if (m === pl) pos.x = box.minX - r;
    else if (m === pr) pos.x = box.maxX + r;
    else if (m === pt) pos.z = box.minZ - r;
    else pos.z = box.maxZ + r;
  }
  return true;
}

export function formatCash(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}
