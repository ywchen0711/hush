// HUSH — procedural rooms: layout, textures, furniture, doors, colliders and interactables.
import * as THREE from 'three';

export const H = 3.2;            // ceiling height
export const DOOR_W = 1.3, DOOR_H = 2.3;
export const T = 0.2;            // wall thickness
export const GAP = 0.3;          // door frame depth between two rooms
export const LAST_ROOM = 50;
export const ARCHIVES = [15, 30, 45];

// small seeded random generator (mulberry32)
export function makeRng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ======================= textures (drawn on canvases) =======================
const cache = new Map();
function canvasTexture(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}
function repeated(tex, rx, ry) {
  const t = tex.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}
function grime(g, w, h, n, alpha) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 10 + Math.random() * 60;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(20,14,8,${alpha})`); grad.addColorStop(1, 'rgba(20,14,8,0)');
    g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

export const THEMES = [
  { base: '#5b4632', motif: '#6f583e', kind: 'damask' },
  { base: '#33463f', motif: '#40574e', kind: 'stripes' },
  { base: '#5a3434', motif: '#6a4040', kind: 'diamond' },
  { base: '#46405a', motif: '#55506c', kind: 'dots' },
  { base: '#4e4a36', motif: '#5e5a42', kind: 'stripes' }
];

// wallpaper on top, wooden wainscot on the bottom third — one texture spans the full wall height
function wallTexture(theme) {
  return canvasTexture('wall' + THEMES.indexOf(theme), 256, 512, (g, w, h) => {
    g.fillStyle = theme.base; g.fillRect(0, 0, w, h);
    g.fillStyle = theme.motif;
    const top = h * 0.68;
    if (theme.kind === 'stripes') for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 12, top);
    if (theme.kind === 'dots') for (let y = 16; y < top; y += 32) for (let x = (y / 32 % 2) * 16; x < w; x += 32) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
    if (theme.kind === 'diamond') for (let y = 0; y < top; y += 48) for (let x = 0; x < w; x += 48) {
      g.beginPath(); g.moveTo(x + 24, y); g.lineTo(x + 48, y + 24); g.lineTo(x + 24, y + 48); g.lineTo(x, y + 24); g.closePath(); g.stroke(); g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 1;
    }
    if (theme.kind === 'damask') for (let y = 20; y < top; y += 64) for (let x = (y / 64 % 2) * 32; x < w + 32; x += 64) {
      g.beginPath(); g.ellipse(x, y, 10, 18, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(x - 12, y + 8, 6, 10, 0.6, 0, 7); g.ellipse(x + 12, y + 8, 6, 10, -0.6, 0, 7); g.fill();
    }
    grime(g, w, top, 18, 0.35);
    // dado rail + wainscot panels
    g.fillStyle = '#2a1a10'; g.fillRect(0, top, w, 10);
    g.fillStyle = '#3b2616'; g.fillRect(0, top + 10, w, h - top - 10);
    g.strokeStyle = '#24160c'; g.lineWidth = 4;
    for (let x = 8; x < w; x += 128) g.strokeRect(x, top + 26, 112, h - top - 50);
    grime(g, w, h, 8, 0.25);
  });
}
function floorTexture() {
  return canvasTexture('floor', 512, 512, (g, w, h) => {
    for (let y = 0; y < h; y += 64) {
      for (let x = -((y / 64) % 2) * 128; x < w; x += 256) {
        const v = 40 + Math.random() * 20;
        g.fillStyle = `rgb(${v + 30},${v + 12},${v - 8})`; g.fillRect(x, y, 256, 64);
        g.strokeStyle = 'rgba(0,0,0,0.25)';
        for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(x, y + 8 + k * 9 + Math.random() * 4); g.lineTo(x + 256, y + 8 + k * 9 + Math.random() * 4); g.stroke(); }
        g.fillStyle = '#140c06'; g.fillRect(x, y, 256, 3); g.fillRect(x, y, 3, 64);
      }
    }
    grime(g, w, h, 20, 0.3);
  });
}
function ceilingTexture() {
  return canvasTexture('ceiling', 256, 256, (g, w, h) => {
    g.fillStyle = '#6e675c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    grime(g, w, h, 6, 0.45);
  });
}
function woodTexture(key, base) {
  return canvasTexture(key, 256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.15})`;
      g.beginPath(); const y = Math.random() * h; g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x / 40 + i) * 4);
      g.stroke();
    }
  });
}
function carpetTexture() {
  return canvasTexture('carpet', 256, 256, (g, w, h) => {
    g.fillStyle = '#4a1414'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#7a5a20'; g.lineWidth = 6; g.strokeRect(12, 0, w - 24, h);
    g.fillStyle = '#5e1c1c';
    for (let y = 32; y < h; y += 64) { g.beginPath(); g.moveTo(w / 2, y - 20); g.lineTo(w / 2 + 30, y); g.lineTo(w / 2, y + 20); g.lineTo(w / 2 - 30, y); g.fill(); }
    grime(g, w, h, 6, 0.3);
  });
}
function doorTexture(number, locked) {
  return canvasTexture('door' + number + (locked ? 'L' : ''), 128, 256, (g, w, h) => {
    g.fillStyle = '#4a2c18'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2a170a'; g.lineWidth = 5;
    g.strokeRect(14, 14, w - 28, 100); g.strokeRect(14, 130, w - 28, 112);
    for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); const x = Math.random() * w; g.moveTo(x, 0); g.lineTo(x + 6, h); g.stroke(); }
    // brass number plate
    g.fillStyle = '#b08a3a'; g.fillRect(34, 50, 60, 30);
    g.strokeStyle = '#5a4010'; g.lineWidth = 2; g.strokeRect(34, 50, 60, 30);
    g.fillStyle = '#2a1a06'; g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(number === LAST_ROOM + 1 ? 'EXIT' : String(number).padStart(3, '0'), 64, 66);
    g.fillStyle = '#c8a050'; g.beginPath(); g.arc(104, 140, 6, 0, 7); g.fill();     // knob
  });
}
function paintingTexture(seed) {
  return canvasTexture('paint' + seed, 128, 160, (g, w, h) => {
    const r = makeRng(seed);
    g.fillStyle = '#2a1c10'; g.fillRect(0, 0, w, h);
    g.fillStyle = `hsl(${r() * 360},25%,${18 + r() * 12}%)`; g.fillRect(12, 12, w - 24, h - 24);
    // a faceless portrait or a dim landscape
    if (r() < 0.6) {
      g.fillStyle = '#1a1410'; g.beginPath(); g.ellipse(w / 2, 70, 22, 28, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(w / 2, 140, 40, 34, 0, Math.PI, 0); g.fill();
      if (r() < 0.3) { g.fillStyle = '#d8d0c0'; g.fillRect(w / 2 - 10, 64, 5, 3); g.fillRect(w / 2 + 5, 64, 5, 3); }
    } else {
      g.fillStyle = '#141a14'; g.beginPath(); g.moveTo(12, 110); g.lineTo(50, 70); g.lineTo(80, 100); g.lineTo(116, 60); g.lineTo(116, 148); g.lineTo(12, 148); g.fill();
    }
    g.strokeStyle = '#8a6a2a'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  });
}

// ======================= materials =======================
let MAT = null;
function materials() {
  if (MAT) return MAT;
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, o));
  MAT = {
    floor: floorTexture(), ceiling: ceilingTexture(),
    darkWood: std({ map: woodTexture('darkwood', '#2e1c10') }),
    wood: std({ map: woodTexture('wood', '#5a3a20') }),
    frame: std({ color: '#1c120a' }),
    brass: std({ color: '#a8823a', metalness: 0.7, roughness: 0.35 }),
    mattress: std({ color: '#8a8070' }),
    sheet: std({ color: '#5a5048' }),
    bulbOn: new THREE.MeshStandardMaterial({ color: '#ffe0a0', emissive: '#ffcc80', emissiveIntensity: 2 }),
    bulbOff: std({ color: '#3a3020' }),
    shade: std({ color: '#2a2018', side: THREE.DoubleSide }),
    carpet: carpetTexture()
  };
  return MAT;
}

// ======================= room layout =======================
// A room is generated from (index, rng, entrance x / z). It always extends toward -z.
export function planRoom(index, rng, entranceX, oz) {
  const room = { index, oz, entranceX, colliders: [], interact: [], wardrobes: [], drawers: [], decor: [] };
  let type = 'normal';
  if (index === 0) type = 'lobby';
  else if (index === LAST_ROOM) type = 'exit';
  else if (ARCHIVES.includes(index)) type = 'archive';
  else if (index > 2 && rng() < 0.18) type = 'corridor';
  room.type = type;
  if (type === 'archive') { room.w = 16; room.d = 22; }
  else if (type === 'corridor') { room.w = 2.6 + rng() * 0.6; room.d = 10 + rng() * 6; }
  else if (type === 'lobby') { room.w = 10; room.d = 9; }
  else if (type === 'exit') { room.w = 8; room.d = 8; }
  else { room.w = 6 + rng() * 6; room.d = 7 + rng() * 7; }
  // room center x: keep the entrance inside the wall
  const half = room.w / 2 - DOOR_W / 2 - 0.4;
  room.ox = entranceX + (rng() * 2 - 1) * Math.max(0, half);
  room.exitX = room.ox + (rng() * 2 - 1) * Math.max(0, half);
  if (type === 'corridor' || type === 'exit') room.exitX = room.ox;
  room.theme = THEMES[Math.floor(rng() * THEMES.length)];
  const darkChance = index < 6 ? 0 : Math.min(0.4, 0.12 + index * 0.006);
  room.dark = type !== 'lobby' && type !== 'exit' && type !== 'archive' && rng() < darkChance;
  room.locked = room.plannedLock = type === 'archive' || (index > 3 && type === 'normal' && rng() < 0.22);
  room.lightBroken = false;
  room.light = { x: room.ox, y: H - 0.35, z: oz - room.d / 2 };
  return room;
}

// ======================= building meshes =======================
function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function addCollider(room, minX, maxX, minZ, maxZ) { const c = { minX, maxX, minZ, maxZ }; room.colliders.push(c); return c; }

// a wall along x at depth z, with an optional door hole centered at holeX
function wallX(room, group, x0, x1, z, holeX, mat) {
  const len = x1 - x0;
  const tex = repeated(wallTexture(room.theme), len / 2.2, 1);
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const parts = holeX == null ? [[x0, x1]] : [[x0, holeX - DOOR_W / 2], [holeX + DOOR_W / 2, x1]];
  parts.forEach(([a, b]) => {
    if (b - a < 0.01) return;
    const mesh = box(b - a, H, T, m.clone());
    mesh.material.map = repeated(wallTexture(room.theme), (b - a) / 2.2, 1);
    mesh.position.set((a + b) / 2, H / 2, z);
    group.add(mesh);
    addCollider(room, a, b, z - T / 2, z + T / 2);
  });
  if (holeX != null) {                              // lintel above the door
    const lintel = box(DOOR_W, H - DOOR_H, T, mat || materials().frame);
    lintel.position.set(holeX, DOOR_H + (H - DOOR_H) / 2, z);
    group.add(lintel);
  }
}
function wallZ(room, group, x, z0, z1) {
  const len = z0 - z1;
  const mesh = box(T, H, len, new THREE.MeshStandardMaterial({ map: repeated(wallTexture(room.theme), len / 2.2, 1), roughness: 0.9 }));
  mesh.position.set(x, H / 2, (z0 + z1) / 2);
  group.add(mesh);
  addCollider(room, x - T / 2, x + T / 2, z1, z0);
}

export function buildRoom(room, rng) {
  const M = materials();
  const g = new THREE.Group();
  room.group = g;
  // a room can be rebuilt when you walk back to it: start from clean lists
  room.colliders = []; room.interact = []; room.wardrobes = []; room.drawers = [];
  room.locked = room.plannedLock;
  const { ox, oz, w, d } = room;
  const x0 = ox - w / 2, x1 = ox + w / 2, zf = oz - d;

  // floor, ceiling, optional carpet runner
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: repeated(M.floor, w / 3, d / 3), roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(ox, 0, oz - d / 2); g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: repeated(M.ceiling, w / 3, d / 3), roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(ox, H, oz - d / 2); g.add(ceil);
  if (room.type !== 'archive' && rng() < 0.45) {
    const run = new THREE.Mesh(new THREE.PlaneGeometry(1.4, d - 0.6), new THREE.MeshStandardMaterial({ map: repeated(M.carpet, 1, (d - 0.6) / 2), roughness: 1 }));
    run.rotation.x = -Math.PI / 2; run.position.set((room.entranceX + room.exitX) / 2, 0.005, oz - d / 2); g.add(run);
  }

  // walls: entrance (with hole), exit (with hole), sides
  wallX(room, g, x0 - T / 2, x1 + T / 2, oz, room.index === 0 ? null : room.entranceX);
  wallX(room, g, x0 - T / 2, x1 + T / 2, zf, room.exitX);
  wallZ(room, g, x0, oz, zf);
  wallZ(room, g, x1, oz, zf);
  // door frame tunnel to the next room
  const fz = zf - GAP / 2;
  [-1, 1].forEach((s) => {
    const post = box(0.12, DOOR_H, GAP + 0.02, M.frame);
    post.position.set(room.exitX + s * (DOOR_W / 2 + 0.06), DOOR_H / 2, fz); g.add(post);
  });
  const top = box(DOOR_W + 0.24, H - DOOR_H, GAP + 0.02, M.frame); top.position.set(room.exitX, DOOR_H + (H - DOOR_H) / 2, fz); g.add(top);
  addCollider(room, room.exitX - DOOR_W / 2 - 3, room.exitX - DOOR_W / 2, zf - GAP, zf);
  addCollider(room, room.exitX + DOOR_W / 2, room.exitX + DOOR_W / 2 + 3, zf - GAP, zf);

  // the door to the next room (hinged on the left)
  const pivot = new THREE.Group();
  pivot.position.set(room.exitX - DOOR_W / 2, 0, zf - 0.05);
  const panel = box(DOOR_W - 0.04, DOOR_H - 0.03, 0.07, new THREE.MeshStandardMaterial({ map: doorTexture(room.index + 1, room.locked), roughness: 0.7 }));
  panel.position.set(DOOR_W / 2, DOOR_H / 2, 0);
  pivot.add(panel);
  if (room.locked && !room.unlocked) {               // a padlock hanging on the door
    const lock = box(0.14, 0.18, 0.08, M.brass); lock.position.set(DOOR_W - 0.22, 1.05, 0.08); pivot.add(lock);
    room.lockMesh = lock;
  }
  g.add(pivot);
  room.door = { pivot, open: false, angle: 0, locked: room.locked && !room.unlocked, x: room.exitX, z: zf,
                collider: addCollider(room, room.exitX - DOOR_W / 2, room.exitX + DOOR_W / 2, zf - 0.1, zf + 0.02) };
  room.interact.push({ kind: 'door', room, x: room.exitX, y: 1.2, z: zf + 0.1 });

  // ceiling lamp
  const L = room.light;
  const cord = box(0.02, 0.3, 0.02, M.frame); cord.position.set(L.x, H - 0.15, L.z); g.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 16, 1, true), M.shade); shade.position.set(L.x, H - 0.36, L.z); g.add(shade);
  room.bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), room.dark ? M.bulbOff : M.bulbOn.clone());
  room.bulb.position.set(L.x, H - 0.42, L.z); g.add(room.bulb);

  furnish(room, g, rng);
  room.path = [
    new THREE.Vector3(room.entranceX, 1.5, oz + 0.2),
    new THREE.Vector3((room.entranceX + room.exitX) / 2, 1.5, oz - d / 2),
    new THREE.Vector3(room.exitX, 1.5, zf - GAP)
  ];
  return g;
}

// ======================= furniture =======================
function wardrobe(room, g, x, z, rot) {
  const M = materials(), grp = new THREE.Group();
  const body = box(1.1, 2.1, 0.6, M.darkWood); body.position.y = 1.05; grp.add(body);
  const doors = [];                                  // hidden while you hide inside (the slat overlay takes over)
  [-0.27, 0.27].forEach((dx) => {
    const door = box(0.52, 1.95, 0.03, M.wood); door.position.set(dx, 1.05, 0.31); grp.add(door); doors.push(door);
    for (let k = 0; k < 5; k++) { const slat = box(0.4, 0.02, 0.01, M.frame); slat.position.set(dx, 1.5 + k * 0.08, 0.33); grp.add(slat); doors.push(slat); }
    const knob = box(0.03, 0.08, 0.03, M.brass); knob.position.set(dx * 0.2, 1.05, 0.34); grp.add(knob); doors.push(knob);
  });
  grp.position.set(x, 0, z); grp.rotation.y = rot; g.add(grp);
  const fx = Math.sin(rot), fz = Math.cos(rot);    // facing direction
  const w = { kind: 'wardrobe', room, x: x + fx * 0.75, y: 1.2, z: z + fz * 0.75, hideX: x + fx * 0.2, hideZ: z + fz * 0.2, yaw: rot, mesh: grp, doors };
  room.wardrobes.push(w); room.interact.push(w);
  colliderFor(room, x, z, rot, 1.1, 0.6);
}
function dresser(room, g, x, z, rot, rng, n) {
  const M = materials(), grp = new THREE.Group(), h = n * 0.28 + 0.1;
  const body = box(1.2, h, 0.5, M.darkWood); body.position.y = h / 2; grp.add(body);
  for (let i = 0; i < n; i++) {
    const dr = new THREE.Group();
    const front = box(1.08, 0.22, 0.04, M.wood); dr.add(front);
    const knob = box(0.12, 0.03, 0.04, M.brass); knob.position.z = 0.03; dr.add(knob);
    dr.position.set(0, 0.17 + i * 0.28, 0.25); grp.add(dr);
    const drawer = { kind: 'drawer', room, group: dr, open: false, slide: 0, contents: rollDrawer(room, rng), mesh: grp, local: dr.position.clone() };
    room.drawers.push(drawer); room.interact.push(drawer);
  }
  if (rng() < 0.4 && !room.dark) {                 // a small lamp on top
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 0.35, 8), M.brass); lamp.position.set(0.4, h + 0.17, 0); grp.add(lamp);
    const sh = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#d8c090', emissive: '#a07030', emissiveIntensity: 0.6, side: THREE.DoubleSide }));
    sh.position.set(0.4, h + 0.4, 0); grp.add(sh);
  }
  grp.position.set(x, 0, z); grp.rotation.y = rot; g.add(grp);
  grp.updateMatrixWorld();
  room.drawers.slice(-n).forEach((dr) => { const p = dr.group.getWorldPosition(new THREE.Vector3()); dr.x = p.x; dr.y = p.y; dr.z = p.z; dr.dir = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)); });
  colliderFor(room, x, z, rot, 1.2, 0.5);
}
function bed(room, g, x, z, rot) {
  const M = materials(), grp = new THREE.Group();
  const frame = box(1.1, 0.35, 2.0, M.darkWood); frame.position.y = 0.2; grp.add(frame);
  const mat = box(1.0, 0.18, 1.9, M.mattress); mat.position.y = 0.46; grp.add(mat);
  const sheet = box(1.02, 0.06, 1.2, M.sheet); sheet.position.set(0, 0.57, 0.35); grp.add(sheet);
  const head = box(1.1, 1.0, 0.08, M.darkWood); head.position.set(0, 0.6, -1.0); grp.add(head);
  grp.position.set(x, 0, z); grp.rotation.y = rot; g.add(grp);
  colliderFor(room, x, z, rot + Math.PI / 2, 2.0, 1.1);
}
function bookshelf(room, g, x, z, rot, width, rng) {
  const M = materials(), grp = new THREE.Group();
  const back = box(width, 2.4, 0.4, M.darkWood); back.position.y = 1.2; grp.add(back);
  const colors = ['#5a2020', '#20305a', '#2a4a2a', '#5a4a20', '#3a2a4a', '#4a3a2a'];
  for (let s = 0; s < 5; s++) {
    let bx = -width / 2 + 0.08;
    while (bx < width / 2 - 0.1) {
      const bw = 0.04 + rng() * 0.05, bh = 0.25 + rng() * 0.12;
      const b = box(bw, bh, 0.28, new THREE.MeshStandardMaterial({ color: colors[Math.floor(rng() * colors.length)], roughness: 0.9 }));
      b.position.set(bx + bw / 2, 0.12 + s * 0.46 + bh / 2, 0.08); grp.add(b);
      bx += bw + 0.01 + (rng() < 0.1 ? 0.15 : 0);
    }
  }
  grp.position.set(x, 0, z); grp.rotation.y = rot; g.add(grp);
  colliderFor(room, x, z, rot, width, 0.45);
}
function painting(room, g, x, z, rot, rng) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.88), new THREE.MeshStandardMaterial({ map: paintingTexture(Math.floor(rng() * 1e6)), roughness: 0.6 }));
  p.position.set(x, 1.7, z); p.rotation.y = rot; g.add(p);
}
function table(room, g, x, z, rng) {
  const M = materials(), grp = new THREE.Group();
  const topm = box(1.4, 0.06, 0.8, M.wood); topm.position.y = 0.76; grp.add(topm);
  [[-0.62, -0.32], [0.62, -0.32], [-0.62, 0.32], [0.62, 0.32]].forEach(([a, b]) => { const leg = box(0.06, 0.74, 0.06, M.darkWood); leg.position.set(a, 0.37, b); grp.add(leg); });
  if (rng() < 0.6) { const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), new THREE.MeshStandardMaterial({ color: '#e8e0c8' })); candle.position.set(0.3, 0.88, 0); grp.add(candle); }
  grp.position.set(x, 0, z); g.add(grp);
  addCollider(room, x - 0.72, x + 0.72, z - 0.42, z + 0.42);
}
function colliderFor(room, x, z, rot, w, d) {
  const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
  const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
  addCollider(room, x - hw, x + hw, z - hd, z + hd);
}

function rollDrawer(room, rng) {
  const r = rng();
  if (room.index >= 5 && r < 0.05) return { type: 'skitter' };
  if (r < 0.45) return { type: 'empty' };
  if (r < 0.78) return { type: 'gold', amount: 2 + Math.floor(rng() * 14) };
  if (r < 0.9) return { type: 'battery' };
  return { type: 'medkit' };
}

// place furniture along the side walls, keeping a clear lane between the two doors
function furnish(room, g, rng) {
  const { ox, oz, w, d, type } = room;
  const x0 = ox - w / 2, x1 = ox + w / 2, zf = oz - d;
  if (type === 'corridor') {
    for (let z = oz - 2; z > zf + 2; z -= 3) if (rng() < 0.6) painting(room, g, rng() < 0.5 ? x0 + T / 2 + 0.01 : x1 - T / 2 - 0.01, z, 0, rng);
    room.decor.forEach(() => {});
    // paintings on the side walls need to face inward
    g.children.filter((m) => m.geometry && m.geometry.type === 'PlaneGeometry' && m.position.y === 1.7).forEach((m) => { m.rotation.y = m.position.x < ox ? Math.PI / 2 : -Math.PI / 2; });
    if (rng() < 0.5) wardrobe(room, g, rng() < 0.5 ? x0 + 0.42 : x1 - 0.42, oz - d / 2, rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    fixWardrobeFacing(room, ox);
    return;
  }
  if (type === 'archive') { furnishArchive(room, g, rng); return; }
  if (type === 'lobby') {
    table(room, g, ox - 2.5, oz - 4, rng);
    dresser(room, g, x1 - 0.35, oz - 3, -Math.PI / 2, rng, 3);
    wardrobe(room, g, x0 + 0.42, oz - 6.5, Math.PI / 2);
    painting(room, g, ox, oz - 0.12, Math.PI, rng);
    return;
  }
  if (type === 'exit') { painting(room, g, x0 + T / 2 + 0.01, oz - 4, Math.PI / 2, rng); return; }

  // normal room: walk both side walls in slots
  const wantWardrobe = rng() < 0.85;
  let placedWardrobe = false, dressers = 0;
  [[x0, Math.PI / 2], [x1, -Math.PI / 2]].forEach(([wx, rot], side) => {
    let z = oz - 0.9;
    while (z > zf + 0.9) {
      const r = rng(), inward = side === 0 ? 1 : -1;
      if (r < 0.28 && z - 1.2 > zf + 0.6) { wardrobe(room, g, wx + inward * 0.42, z - 0.6, rot); placedWardrobe = true; z -= 1.5; }
      else if (r < 0.55 && z - 1.3 > zf + 0.6) { dresser(room, g, wx + inward * 0.35, z - 0.65, rot, rng, 2 + Math.floor(rng() * 2)); dressers++; z -= 1.6; }
      else if (r < 0.65 && w > 8 && z - 2.1 > zf + 0.6) { bed(room, g, wx + inward * 1.1, z - 1.05, rot); z -= 2.4; }
      else if (r < 0.75 && z - 1.3 > zf + 0.6) { bookshelf(room, g, wx + inward * 0.28, z - 0.65, rot, 1.2, rng); z -= 1.5; }
      else { painting(room, g, wx + inward * (T / 2 + 0.01), z - 0.5, rot, rng); z -= 1.2; }
    }
  });
  if (wantWardrobe && !placedWardrobe) wardrobe(room, g, x0 + 0.42, oz - d / 2, Math.PI / 2);
  if (room.locked && dressers === 0) { dresser(room, g, x1 - 0.35, oz - d / 2, -Math.PI / 2, rng, 3); dressers++; }
  if (w > 9 && rng() < 0.5) table(room, g, ox + (rng() < 0.5 ? -1 : 1) * (w / 4), oz - d / 2, rng);
  placeKey(room, rng);
}
function fixWardrobeFacing(room, ox) {
  room.wardrobes.forEach((w) => {
    const rot = w.mesh.position.x < ox ? Math.PI / 2 : -Math.PI / 2;
    w.mesh.rotation.y = rot; w.yaw = rot;
    w.x = w.mesh.position.x + Math.sin(rot) * 0.75; w.z = w.mesh.position.z + Math.cos(rot) * 0.75;
    w.hideX = w.mesh.position.x + Math.sin(rot) * 0.2; w.hideZ = w.mesh.position.z + Math.cos(rot) * 0.2;
  });
}
function placeKey(room, rng) {
  if (!room.locked) return;
  const ds = room.drawers;
  if (!ds.length) { room.locked = false; room.door.locked = false; if (room.lockMesh) room.lockMesh.visible = false; return; }
  ds[Math.floor(rng() * ds.length)].contents = { type: 'key' };
}

// the archive: aisles of bookshelves, desks with drawers, the Listener roams here
function furnishArchive(room, g, rng) {
  const { ox, oz, w, d } = room;
  const x0 = ox - w / 2, x1 = ox + w / 2;
  for (let z = oz - 4; z > oz - d + 4; z -= 3.4) {
    // each row of shelves leaves two random gaps to walk through
    const gapA = x0 + 1.5 + rng() * (w / 2 - 3), gapB = ox + 1 + rng() * (w / 2 - 3);
    let x = x0 + 1.2;
    while (x < x1 - 1.2) {
      const seg = Math.min(2.4, x1 - 1.2 - x);
      const blocked = (gapA > x - 0.6 && gapA < x + seg + 0.6) || (gapB > x - 0.6 && gapB < x + seg + 0.6);
      if (!blocked && seg > 0.8) bookshelf(room, g, x + seg / 2, z, 0, seg, rng);
      x += seg + 0.2;
    }
  }
  // desks along the walls hold the key
  [[x0 + 0.35, oz - 3, Math.PI / 2], [x1 - 0.35, oz - d / 2, -Math.PI / 2], [x0 + 0.35, oz - d + 3, Math.PI / 2], [x1 - 0.35, oz - d + 4, -Math.PI / 2]].forEach(([x, z, r]) => dresser(room, g, x, z, r, rng, 3));
  wardrobe(room, g, x1 - 0.42, oz - 3, -Math.PI / 2);
  wardrobe(room, g, x0 + 0.42, oz - d / 2 - 2, Math.PI / 2);
  room.drawers.forEach((dr) => { if (dr.contents.type === 'skitter') dr.contents = { type: 'empty' }; });
  placeKey(room, rng);
}

export function disposeRoom(room) {
  if (!room.group) return;
  room.group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        if (m.map && !cacheHas(m.map)) m.map.dispose();
        m.dispose();
      });
    }
  });
  room.group.parent && room.group.parent.remove(room.group);
  room.group = null;
}
function cacheHas(t) { for (const v of cache.values()) if (v === t) return true; return false; }
