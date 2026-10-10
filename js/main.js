// HUSH — a first-person escape through 50 procedurally generated rooms. Listen. React. Hide.
import * as THREE from 'three';
import { H, DOOR_W, GAP, LAST_ROOM, makeRng, planRoom, buildRoom, disposeRoom } from './world.js';
import { AudioEngine } from './audio.js';
import { Director, TIPS, jumpscareImage } from './monsters.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

const scene = new THREE.Scene();
scene.background = new THREE.Color('#040303');
scene.fog = new THREE.FogExp2('#050404', 0.085);
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 80);
camera.rotation.order = 'YXZ';
scene.add(camera);
scene.add(new THREE.HemisphereLight('#3a3440', '#140c08', 0.35));

// a fixed pool of room lights (a constant light count avoids shader recompiles)
const LIGHTS = [];
for (let i = 0; i < 4; i++) { const l = new THREE.PointLight('#ffc98a', 0, 13, 1.6); scene.add(l); LIGHTS.push(l); }
// the flashlight
const flash = new THREE.SpotLight('#fff1d6', 0, 18, 0.5, 0.55, 1.4);
flash.position.set(0.15, -0.12, 0);
flash.target.position.set(0, -0.1, -1);
camera.add(flash); camera.add(flash.target);

const audio = new AudioEngine();
const SPEED = { walk: 2.7, sprint: 4.3, crouch: 1.3 };
const EYE = 1.62, EYE_CROUCH = 1.0, RADIUS = 0.3;

// ======================= game state (shared with the monsters) =======================
const G = {
  scene, audio, rooms: [], time: 0, shake: 0, gazing: 0, state: 'title',
  player: { pos: new THREE.Vector3(), eye: new THREE.Vector3(), yaw: 0, pitch: 0, hp: 100, alive: true, crouch: false, hidden: null, hideIdle: 0,
            battery: 100, light: false, gold: 0, keys: 0, room: 0, best: 0, stepDist: 0 },
  roomIndexAt, flicker, breakLight, kill, damage, caption, jumpscare, unhide, behindPlayer, lookingAt, moveCircle
};
const director = new Director(G);
G.director = director;
let roomRng = null, runStart = 0, deaths = 0;
try { G.player.best = Number(localStorage.getItem('hush.best') || 0); } catch (e) { /* private mode */ }

// ======================= rooms =======================
function ensureRooms(upTo) {
  while (G.rooms.length <= Math.min(upTo, LAST_ROOM)) {
    const i = G.rooms.length, prev = G.rooms[i - 1];
    const room = planRoom(i, roomRng, prev ? prev.exitX : 0, prev ? prev.oz - prev.d - GAP : 0);
    G.rooms.push(room);
  }
}
function syncRoomMeshes(cur) {
  ensureRooms(cur + 2);
  G.rooms.forEach((room, i) => {
    const want = i >= cur - 2 && i <= cur + 2;
    if (want && !room.group) { scene.add(buildRoom(room, makeRng(G.seed * 131 + i))); restoreRoom(room); applyLight(room); }
    if (!want && room.group) disposeRoom(room);
  });
}
// a rebuilt room remembers its open door and emptied drawers
function restoreRoom(room) {
  if (room.doorOpen) { room.door.open = true; room.door.angle = 1.75; room.door.pivot.rotation.y = 1.75; room.door.collider.off = true; room.door.locked = false; }
  (room.opened || []).forEach((k) => { const dr = room.drawers[k]; if (dr) { dr.open = true; dr.slide = 0.3; dr.group.position.z = dr.local.z + 0.3; } });
}
function roomIndexAt(z) {
  for (let i = 0; i < G.rooms.length; i++) { const r = G.rooms[i]; if (z <= r.oz + 0.01 && z > r.oz - r.d - GAP) return i; }
  return z > 0 ? 0 : G.rooms.length - 1;
}
const isLit = (r) => !r.dark && !r.lightBroken && !(r.lightOutT > 0);
function applyLight(room) {
  if (!room.bulb) return;
  const lit = isLit(room);
  room.bulb.material.emissiveIntensity = lit ? 2 : 0;
  room.bulb.material.color.set(lit ? '#ffe0a0' : '#3a3020');
}
function flicker(i, secs) { const r = G.rooms[i]; if (r) r.flickerT = Math.max(r.flickerT || 0, secs); }
function breakLight(i) {
  const r = G.rooms[i];
  if (!r || r.lightBroken || r.dark || r.lightOutT > 0) return;
  if (i < G.player.room && Math.random() < 0.2) { r.lightBroken = true; audio.play('shatter', r.light); }   // a bulb behind you may really break
  else { r.lightOutT = 7 + Math.random() * 5; audio.play('flicker', r.light); }                              // otherwise it is only knocked out for a while
  applyLight(r);
}
function updateLights(dt) {
  G.rooms.forEach((r) => {
    if (r.flickerT > 0) r.flickerT -= dt;
    if (r.lightOutT > 0) { r.lightOutT -= dt; if (r.lightOutT <= 0) { r.lightOutT = 0; r.flickerT = 1.2; applyLight(r); } }   // the light stutters back on
  });
  const cur = G.player.room, lit = [];
  for (let i = cur - 1; i <= cur + 2; i++) { const r = G.rooms[i]; if (r && r.group && isLit(r)) lit.push(r); }
  LIGHTS.forEach((l, k) => {
    const r = lit[k];
    if (!r) { l.intensity = 0; return; }
    l.position.set(r.light.x, r.light.y - 0.15, r.light.z);
    let I = r.type === 'archive' ? 55 : 16;
    if (r.flickerT > 0) I *= Math.random() < 0.35 ? 0.05 : 0.6 + Math.random() * 0.6;
    l.intensity = I;
    l.distance = r.type === 'archive' ? 26 : 13;
    if (r.bulb) r.bulb.material.emissiveIntensity = I > 3 ? 2 : 0.2;
  });
}

// ======================= collisions =======================
function colliders(rooms) {
  const list = [];
  rooms.forEach((r) => r && r.colliders.forEach((c) => { if (!c.off) list.push(c); }));
  return list;
}
function moveCircle(pos, dx, dz, r, rooms) {
  const list = colliders(rooms || nearRooms());
  pos.x += dx;
  list.forEach((c) => {
    if (pos.z + r <= c.minZ || pos.z - r >= c.maxZ || pos.x + r <= c.minX || pos.x - r >= c.maxX) return;
    if (dx > 0) pos.x = c.minX - r; else if (dx < 0) pos.x = c.maxX + r;
  });
  pos.z += dz;
  list.forEach((c) => {
    if (pos.z + r <= c.minZ || pos.z - r >= c.maxZ || pos.x + r <= c.minX || pos.x - r >= c.maxX) return;
    if (dz > 0) pos.z = c.minZ - r; else if (dz < 0) pos.z = c.maxZ + r;
  });
}
function nearRooms() { const c = G.player.room; return [G.rooms[c - 1], G.rooms[c], G.rooms[c + 1]]; }

// ======================= helpers used by the monsters =======================
function forward3() { return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); }
function lookingAt(pos, dot) {
  const to = pos.clone().sub(camera.position).normalize();
  return forward3().dot(to) > dot;
}
function behindPlayer(d) { const f = forward3(); f.y = 0; f.normalize(); return G.player.eye.clone().addScaledVector(f, -d); }
let capTimer = 0;
const captionsOn = () => $('opt-captions').checked;
function caption(text, secs) {
  if (!captionsOn()) return;
  const el = $('caption');
  el.textContent = text; el.classList.add('on');
  clearTimeout(capTimer); capTimer = setTimeout(() => el.classList.remove('on'), (secs || 2.5) * 1000);
}
audio.onCaption = caption;
function jumpscare(kind, secs) {
  const el = $('scare');
  el.innerHTML = '';
  const img = jumpscareImage(kind);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
  el.appendChild(c);
  el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), (secs || 0.5) * 1000);
}
function damage(amount, source, silent) {
  const p = G.player;
  if (!p.alive) return;
  p.hp -= amount;
  if (!silent) { $('hurt').classList.remove('on'); void $('hurt').offsetWidth; $('hurt').classList.add('on'); G.shake = Math.max(G.shake, 0.12); }
  if (p.hp <= 0) kill(source);
}
function kill(source) {
  const p = G.player;
  if (!p.alive) return;
  p.alive = false; p.hp = 0;
  deaths++;
  audio.play('scream');
  jumpscare(source, 0.9);
  G.state = 'dead';
  document.exitPointerLock && document.exitPointerLock();
  setTimeout(() => {
    const tip = TIPS[source] || ['SOMETHING', 'Listen carefully.'];
    $('dead-by').textContent = tip[0];
    $('dead-tip').textContent = tip[1];
    $('dead-room').textContent = 'You reached room ' + String(p.room).padStart(3, '0') + ' · ' + p.gold + ' gold';
    show('dead');
  }, 900);
  audio.stopAll();
}

// ======================= hiding =======================
function hide(w) {
  const p = G.player;
  p.hidden = w; p.hideIdle = 0;
  p.savedPos = p.pos.clone();
  p.yaw = w.yaw + Math.PI; p.pitch = 0;             // look out through the slats
  (w.doors || []).forEach((m) => { m.visible = false; });
  audio.play('wardrobe', { x: w.hideX, y: 1.2, z: w.hideZ });
  $('slats').classList.add('on'); document.body.classList.add('hiding');
}
function unhide(force) {
  const p = G.player, w = p.hidden;
  if (!w) return;
  p.hidden = null;
  p.pos.set(w.x, 0, w.z);
  (w.doors || []).forEach((m) => { m.visible = true; });
  if (force) p.yaw = w.yaw + Math.PI;
  G.lightHint = 0.8;                                          // stepping out into the dark: remind about the flashlight soon
  audio.play('wardrobe', { x: w.hideX, y: 1.2, z: w.hideZ });
  $('slats').classList.remove('on'); document.body.classList.remove('hiding');
}

// ======================= interaction =======================
let focus = null;
function findFocus() {
  const p = G.player, eye = camera.position, f = forward3();
  let best = null, bestDot = 0.8;
  nearRooms().forEach((r) => r && r.interact.forEach((it) => {
    if (it.kind === 'drawer' && it.open) return;
    if (it.kind === 'door' && it.room.door.open) return;
    const to = new THREE.Vector3(it.x - eye.x, it.y - eye.y, it.z - eye.z), d = to.length();
    if (d > (it.kind === 'door' ? 2.2 : 1.9)) return;
    const dot = f.dot(to.normalize());
    if (dot > bestDot) { bestDot = dot; best = it; }
  }));
  if (p.hidden) best = null;
  return best;
}
function promptFor(it) {
  if (!it) return G.player.hidden ? '[E] Leave the wardrobe' : '';
  if (it.kind === 'wardrobe') return '[E] Hide';
  if (it.kind === 'drawer') return '[E] Open drawer';
  if (it.kind === 'door') return it.room.door.locked ? (G.player.keys > 0 ? '[E] Unlock' : 'Locked — find the key') : '[E] Open';
  return '';
}
function interact() {
  const p = G.player;
  if (p.hidden) { unhide(); return; }
  const it = focus;
  if (!it) return;
  if (it.kind === 'wardrobe') { hide(it); return; }
  if (it.kind === 'drawer') { openDrawer(it); return; }
  if (it.kind === 'door') tryDoor(it.room, true);
}
function openDrawer(dr) {
  dr.open = true;
  (dr.room.opened || (dr.room.opened = [])).push(dr.room.drawers.indexOf(dr));
  audio.play('drawer', dr);
  director.hear(new THREE.Vector3(dr.x, 0, dr.z), 0.35);
  const c = dr.contents;
  if (c.type === 'gold') { G.player.gold += c.amount; audio.play('gold'); toast('+' + c.amount + ' gold'); }
  else if (c.type === 'battery') { G.player.battery = Math.min(100, G.player.battery + 45); audio.play('pickup'); toast('Batteries +45%'); }
  else if (c.type === 'medkit') { G.player.hp = Math.min(100, G.player.hp + 35); audio.play('heal'); toast('Bandages +35'); }
  else if (c.type === 'key') { G.player.keys++; audio.play('key'); toast('A room key'); }
  else if (c.type === 'skitter') director.skitter(dr);
  else toast('Empty');
}
function tryDoor(room, pressed) {
  const door = room.door;
  if (door.open) return;
  if (door.locked) {
    if (G.player.keys <= 0) { if (pressed) { audio.play('locked', { x: door.x, y: 1.2, z: door.z }); toast('Locked. The key must be in a drawer.'); } return; }
    G.player.keys--; door.locked = false; room.unlocked = true;
    if (room.lockMesh) room.lockMesh.visible = false;
    audio.play('unlock', { x: door.x, y: 1.2, z: door.z });
  }
  door.open = true; room.doorOpen = true;
  door.collider.off = true;
  audio.play('creak', { x: door.x, y: 1.2, z: door.z });
  director.hear(new THREE.Vector3(door.x, 0, door.z), 0.5);
  if (room.index === LAST_ROOM) { win(); return; }
  syncRoomMeshes(G.player.room);
  director.onDoorOpened(room.index);
}
let toastTimer = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 1800); }

// ======================= input =======================
const keys = {};
let pressedE = false, pressedF = false;
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && !keys.KeyE) pressedE = true;
  if (e.code === 'KeyF' && !keys.KeyF) pressedF = true;
  if ((e.code === 'KeyC' || e.code === 'ControlLeft') && !keys[e.code]) G.player.crouch = !G.player.crouch;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));
let sens = 0.0022;
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas || G.state !== 'play') return;
  look(e.movementX, e.movementY);
});
function look(dx, dy) {
  const p = G.player;
  p.yaw -= dx * sens;
  p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch - dy * sens));
  if (p.hidden) {                                   // limited view while hiding
    const base = p.hidden.yaw + Math.PI;
    let d = Math.atan2(Math.sin(p.yaw - base), Math.cos(p.yaw - base));
    d = Math.max(-0.6, Math.min(0.6, d)); p.yaw = base + d;
    p.pitch = Math.max(-0.4, Math.min(0.4, p.pitch));
  }
}
canvas.addEventListener('click', () => { if (G.state === 'play' && !isTouch) canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => {
  if (G.state === 'play' && document.pointerLockElement !== canvas && !isTouch) show('paused');
});

// ---- touch controls: left stick to move, drag the right side to look, buttons ----
const isTouch = 'ontouchstart' in window || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
const stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 }, lookTouch = { id: null, x: 0, y: 0 };
if (isTouch) {
  document.body.classList.add('touch');
  const knob = $('stick-knob'), base = $('stick');
  canvas.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth * 0.45 && stick.id === null) {
        stick.id = t.identifier; stick.ox = t.clientX; stick.oy = t.clientY; stick.x = stick.y = 0;
        base.style.left = (t.clientX - 50) + 'px'; base.style.top = (t.clientY - 50) + 'px'; base.classList.add('on');
      } else if (lookTouch.id === null) { lookTouch.id = t.identifier; lookTouch.x = t.clientX; lookTouch.y = t.clientY; }
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) {
        let dx = t.clientX - stick.ox, dy = t.clientY - stick.oy; const m = Math.hypot(dx, dy);
        if (m > 45) { dx *= 45 / m; dy *= 45 / m; }
        stick.x = dx / 45; stick.y = dy / 45;
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (t.identifier === lookTouch.id) {
        look((t.clientX - lookTouch.x) * 1.6, (t.clientY - lookTouch.y) * 1.6);
        lookTouch.x = t.clientX; lookTouch.y = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) { stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; base.classList.remove('on'); }
      if (t.identifier === lookTouch.id) lookTouch.id = null;
    }
  };
  canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);
  $('t-use').addEventListener('touchstart', (e) => { e.preventDefault(); pressedE = true; });
  $('t-light').addEventListener('touchstart', (e) => { e.preventDefault(); pressedF = true; });
  $('t-crouch').addEventListener('touchstart', (e) => { e.preventDefault(); G.player.crouch = !G.player.crouch; });
  $('t-run').addEventListener('touchstart', (e) => { e.preventDefault(); keys.TouchRun = !keys.TouchRun; $('t-run').classList.toggle('on', keys.TouchRun); });
}

// ======================= player update =======================
function updatePlayer(dt) {
  const p = G.player;
  if (pressedE) interact();
  if (pressedF) { p.light = !p.light && p.battery > 0; audio.play('drawer', null, 0.2); }
  pressedE = pressedF = false;
  if (p.light) { p.battery -= dt * 0.55; if (p.battery <= 0) { p.battery = 0; p.light = false; toast('The flashlight died'); } }
  flash.intensity = p.light ? 38 * (p.battery < 15 && Math.random() < 0.1 ? 0.2 : 1) : 0;

  renderer.toneMappingExposure += ((p.hidden ? 1.7 : 1.05) - renderer.toneMappingExposure) * Math.min(1, dt * 2);
  const here = G.rooms[p.room];
  if (here && !isLit(here) && !p.light && p.battery > 0 && !p.hidden) {
    G.lightHint = (G.lightHint || 0) - dt;
    if (G.lightHint <= 0) { toast(isTouch ? 'Too dark? Tap LIGHT for your flashlight' : 'Too dark? Press F for your flashlight'); G.lightHint = 25; }
  }
  if (p.hidden) {
    camera.position.set(p.hidden.hideX, 1.45, p.hidden.hideZ);
  } else {
    let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let mz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    if (stick.id !== null) { mx = stick.x; mz = -stick.y; }
    const len = Math.hypot(mx, mz);
    const sprint = (keys.ShiftLeft || keys.ShiftRight || keys.TouchRun) && !p.crouch && mz > 0;
    const speed = p.crouch ? SPEED.crouch : sprint ? SPEED.sprint : SPEED.walk;
    if (len > 0.1) {
      const k = Math.min(1, len) / len;
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      const vx = (fx * mz + rx * mx) * k * speed * dt, vz = (fz * mz + rz * mx) * k * speed * dt;
      const before = p.pos.clone();
      moveCircle(p.pos, vx, vz, RADIUS);
      const moved = before.distanceTo(p.pos);
      p.stepDist += moved;
      p.bob = (p.bob || 0) + moved * (sprint ? 2.6 : 2.2);
      const stride = sprint ? 0.85 : p.crouch ? 0.7 : 0.75;
      if (p.stepDist > stride) {
        p.stepDist = 0;
        const loud = sprint ? 1 : p.crouch ? 0.08 : 0.42;
        audio.play('step', null, p.crouch ? 0.25 : sprint ? 1 : 0.6);
        director.hear(p.pos, loud);
      }
    }
    const eyeH = p.crouch ? EYE_CROUCH : EYE;
    p.eyeH = (p.eyeH || EYE) + (eyeH - (p.eyeH || EYE)) * Math.min(1, dt * 10);
    camera.position.set(p.pos.x, p.eyeH + Math.sin(p.bob || 0) * 0.04, p.pos.z);
    // walk into a door to open it
    const room = G.rooms[roomIndexAt(p.pos.z)];
    if (room && !room.door.open && !room.door.locked && Math.abs(p.pos.x - room.door.x) < DOOR_W / 2 + 0.3 && p.pos.z - room.door.z < 0.75) tryDoor(room, false);
  }
  if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake; camera.position.y += (Math.random() - 0.5) * G.shake; G.shake *= Math.pow(0.02, dt); }
  camera.rotation.set(p.pitch, p.yaw, 0);
  p.eye.copy(camera.position);

  // entering a new room
  const idx = roomIndexAt(p.pos.z);
  if (idx !== p.room) {
    p.room = idx;
    syncRoomMeshes(idx);
    director.onEnterRoom(idx);
    if (idx > p.best) { p.best = idx; try { localStorage.setItem('hush.best', String(idx)); } catch (e) { /* ignore */ } }
  }
}

// doors swing open
function updateDoors(dt) {
  G.rooms.forEach((r) => {
    if (!r.group || !r.door.open || r.door.angle >= 1.75) return;
    r.door.angle = Math.min(1.75, r.door.angle + dt * 3.2);
    r.door.pivot.rotation.y = r.door.angle;
  });
  G.rooms.forEach((r) => r.drawers.forEach((dr) => {
    if (!dr.open || dr.slide >= 0.3 || !r.group) return;
    dr.slide = Math.min(0.3, dr.slide + dt * 1.5);
    dr.group.position.z = dr.local.z + dr.slide;
  }));
}

// ======================= HUD =======================
function updateHud() {
  const p = G.player;
  $('room-no').textContent = String(p.room).padStart(3, '0');
  $('hp-bar').style.width = Math.max(0, p.hp) + '%';
  $('hp-bar').classList.toggle('low', p.hp < 35);
  $('bat-bar').style.width = p.battery + '%';
  $('light-state').textContent = p.light ? 'ON' : 'OFF';
  $('gold').textContent = p.gold;
  $('keys').textContent = p.keys;
  $('keys-wrap').style.display = p.keys ? '' : 'none';
  $('prompt').textContent = promptFor(focus);
  $('gaze').style.opacity = Math.min(1, G.gazing) * 0.7;
  $('crouch-ind').style.display = p.crouch ? '' : 'none';
}

// ======================= flow =======================
function show(id) {
  ['title', 'dead', 'paused', 'win', 'hud'].forEach((k) => { $(k).hidden = k !== id && !(k === 'hud' && id === 'play'); });
  if (id === 'play') $('hud').hidden = false;
  document.body.classList.toggle('playing', id === 'play');
}
function newRun() {
  G.rooms.forEach(disposeRoom);
  G.rooms = [];
  director.reset();
  audio.stopAll();
  G.seed = Math.floor(Math.random() * 1e9);
  G.rng = makeRng(G.seed ^ 0x5eed);
  roomRng = makeRng(G.seed);
  const p = G.player;
  Object.assign(p, { hp: 100, alive: true, crouch: false, hidden: null, hideIdle: 0, battery: 100, light: false, gold: 0, keys: 0, room: 0, yaw: 0, pitch: 0, stepDist: 0 });
  p.pos.set(0, 0, -2);
  $('slats').classList.remove('on');
  syncRoomMeshes(0);
  runStart = performance.now();
  G.state = 'play';
  show('play');
  caption('[the front door locks behind you]', 3);
}
function start() {
  audio.start();
  newRun();
  if (!isTouch) canvas.requestPointerLock();
}
function win() {
  G.state = 'win';
  audio.stopAll();
  audio.play('win');
  document.exitPointerLock && document.exitPointerLock();
  const secs = Math.floor((performance.now() - runStart) / 1000);
  $('win-stats').textContent = `${secs / 60 | 0}:${String(secs % 60).padStart(2, '0')} · ${G.player.gold} gold · ${deaths} deaths before this run`;
  $('fade').classList.add('on');
  setTimeout(() => { show('win'); $('fade').classList.remove('on'); }, 1600);
}
$('btn-start').addEventListener('click', start);
$('btn-retry').addEventListener('click', start);
$('btn-again').addEventListener('click', start);
$('btn-resume').addEventListener('click', () => { G.state = 'play'; show('play'); if (!isTouch) canvas.requestPointerLock(); });
$('sens').addEventListener('input', (e) => { sens = 0.0012 + e.target.value * 0.0004; });
$('best').textContent = G.player.best ? 'Best: room ' + String(G.player.best).padStart(3, '0') : '';

// ======================= main loop =======================
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function step(dt) {
  if (G.state !== 'play') return;
  G.time += dt;
  updatePlayer(dt);
  updateDoors(dt);
  director.update(dt);
  updateLights(dt);
  focus = findFocus();
  const f = forward3();
  audio.setListener(camera.position, f, new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion));
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  if (G.state === 'play') updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
show('title');

// hooks for automated tests
window.HUSH = {
  G, director, start: () => { audio.start(); newRun(); },
  step: (n, dt) => { for (let i = 0; i < (n || 1); i++) step(dt || 1 / 60); },
  keys, press: (k) => { if (k === 'E') pressedE = true; if (k === 'F') pressedF = true; },
  look: (yaw, pitch) => { G.player.yaw = yaw; G.player.pitch = pitch || 0; },
  teleport: (room, fz) => { const r = G.rooms[room] || (ensureRooms(room), G.rooms[room]); G.player.pos.set((r.entranceX + r.exitX) / 2, 0, r.oz - r.d * (fz == null ? 0.5 : fz)); },
  render: () => renderer.render(scene, camera), syncRoomMeshes, tryDoor, hide, unhide, focus: () => focus
};
