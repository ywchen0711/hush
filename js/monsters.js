// HUSH — the things in the rooms. Each one is announced by a sound; the player survives by listening and reacting.
//   STAMPEDE / ECHO  rumble + flickering lights → hide in a wardrobe until it has passed (the Echo comes back)
//   HISSER           "psst" in a dark room → turn and look at it within a moment
//   GAZE             a low choir → don't look at it, it drains you while you do
//   LISTENER         blind giant in the archives → crouch, don't run, it follows noise
//   BREATHER         hide too long and something breathes behind you → get out
//   SKITTER          some drawers bite
import * as THREE from 'three';

function faceTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const cx = 128, cy = 128;
  if (kind === 'stampede') {                        // a smoky mass with hollow white eyes and a gaping mouth
    for (let i = 0; i < 40; i++) {
      const r = 40 + Math.random() * 80, a = Math.random() * 6.28, d = Math.random() * 40;
      const grad = g.createRadialGradient(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0, cx + Math.cos(a) * d, cy + Math.sin(a) * d, r);
      grad.addColorStop(0, 'rgba(10,8,12,0.55)'); grad.addColorStop(1, 'rgba(10,8,12,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    }
    g.fillStyle = '#f4f0ff';
    g.beginPath(); g.ellipse(cx - 34, cy - 20, 16, 22, -0.3, 0, 7); g.ellipse(cx + 34, cy - 20, 16, 22, 0.3, 0, 7); g.fill();
    g.fillStyle = '#000'; g.beginPath(); g.ellipse(cx, cy + 40, 40, 26, 0, 0, 7); g.fill();
    g.strokeStyle = '#f4f0ff'; g.lineWidth = 3;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(cx + i * 10, cy + 18); g.lineTo(cx + i * 10 + 3, cy + 32); g.stroke(); }
  } else if (kind === 'hisser') {                   // a pale floating head with a too-wide grin
    const grad = g.createRadialGradient(cx, cy, 10, cx, cy, 110);
    grad.addColorStop(0, 'rgba(60,50,60,0.95)'); grad.addColorStop(0.7, 'rgba(20,16,22,0.9)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, 110, 0, 7); g.fill();
    g.fillStyle = '#ff3040'; g.beginPath(); g.arc(cx - 30, cy - 25, 7, 0, 7); g.arc(cx + 30, cy - 25, 7, 0, 7); g.fill();
    g.fillStyle = '#e8e0d0';
    for (let i = 0; i < 14; i++) { const x = cx - 56 + i * 8; g.beginPath(); g.moveTo(x, cy + 20); g.lineTo(x + 4, cy + 34 + (i % 2) * 6); g.lineTo(x + 8, cy + 20); g.fill(); }
  } else if (kind === 'eye') {
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, 120);
    grad.addColorStop(0, 'rgba(200,120,255,0.9)'); grad.addColorStop(1, 'rgba(120,40,200,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#f8f0ff'; g.beginPath(); g.ellipse(cx, cy, 70, 44, 0, 0, 7); g.fill();
    g.fillStyle = '#5a10a0'; g.beginPath(); g.arc(cx, cy, 30, 0, 7); g.fill();
    g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, 14, 0, 7); g.fill();
  } else if (kind === 'skitter') {                  // a pale spider
    g.strokeStyle = '#d8d0c0'; g.lineWidth = 8;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 40 - 30, cx + Math.cos(a) * 110, cy + Math.sin(a) * 90); g.stroke(); }
    g.fillStyle = '#e8e0d0'; g.beginPath(); g.ellipse(cx, cy, 40, 32, 0, 0, 7); g.fill();
    g.fillStyle = '#c01020'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx - 18 + i * 12, cy - 8, 5, 0, 7); g.fill(); }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const TEX = {};
function tex(kind) { return TEX[kind] || (TEX[kind] = faceTexture(kind)); }
export function jumpscareImage(kind) { return tex(kind === 'listener' || kind === 'breather' || kind === 'echo' ? 'stampede' : kind).image; }

export const TIPS = {
  stampede: ['THE STAMPEDE', 'When the lights flicker and a rumble grows, hide in a wardrobe. Fast.'],
  echo: ['THE ECHO', 'The Echo charges back and forth. Stay hidden until the rumble is gone for good.'],
  hisser: ['THE HISSER', 'It lives in dark rooms. When you hear "psst", turn toward the sound.'],
  gaze: ['THE GAZE', 'Its choir hums in the room. Look away — it drains you while you look at it.'],
  listener: ['THE LISTENER', 'It is blind and hunts by sound. Crouch (C) to move silently. Never sprint near it.'],
  breather: ['THE BREATHER', 'Something lives in the wardrobes. Don\'t stay hidden longer than you must.'],
  skitter: ['SKITTER', 'Some drawers bite.']
};

export class Director {
  constructor(G) {
    this.G = G;
    this.list = [];
    this.lastStampede = -99;
    this.visited = new Set();
  }
  reset() {
    this.list.forEach((m) => m.remove && m.remove());
    this.list = [];
    this.lastStampede = -99;
    this.visited = new Set();
  }
  get stampeding() { return this.list.some((m) => m.kind === 'stampede' && m.state !== 'done'); }
  get threatNear() { return this.stampeding || this.list.some((m) => m.kind === 'listener' && m.huntT > 0); }

  // ---- called by the game ----
  onEnterRoom(n) {
    if (this.visited.has(n)) return;
    this.visited.add(n);
    const G = this.G, room = G.rooms[n], r = G.rng;
    if (!room || n < 2) return;
    if (room.type === 'archive') { this.list.push(new Listener(G, room)); return; }
    // stampede: never twice close together; only when there is somewhere to hide
    const hideable = room.wardrobes.length + ((G.rooms[n + 1] && G.rooms[n + 1].wardrobes.length) || 0) > 0;
    const chance = n < 4 ? 0 : Math.min(0.3, 0.1 + n * 0.004) + (n - this.lastStampede > 7 ? 0.08 : 0);
    if (hideable && n - this.lastStampede >= 3 && room.type !== 'exit' && r() < chance) {
      this.lastStampede = n;
      const echo = n >= 18 && r() < 0.3;
      this.list.push(new Stampede(G, n, echo ? 2 + Math.floor(r() * 2) : 1, 1.5 + r() * 3));
    }
    if (this.isDark(room) && n >= 6 && r() < 0.75) this.list.push(new Hisser(G, n, 4 + r() * 7));
  }
  onDoorOpened(n) {                                 // the door from room n into room n+1 just opened
    const G = this.G, next = G.rooms[n + 1];
    if (!next || n + 1 < 10 || next.type !== 'normal' || G.rng() > Math.min(0.16, 0.06 + n * 0.002)) return;
    this.list.push(new Gaze(G, next));
  }
  isDark(room) { return room.dark || room.lightBroken; }
  hear(pos, loudness) { this.list.forEach((m) => m.hear && m.hear(pos, loudness)); }

  update(dt) {
    const G = this.G, p = G.player;
    this.list.forEach((m) => m.update(dt));
    this.list = this.list.filter((m) => { if (m.dead) { m.remove(); return false; } return true; });
    // the Breather: hiding too long when nothing is out there
    if (p.hidden && !this.threatNear) {
      p.hideIdle += dt;
      if (p.hideIdle > 10 && !this.breath) {
        this.breath = G.audio.loop('breath', G.behindPlayer(0.4));
        this.breath.setVolume(0.9, 0.5);
        G.caption('[breathing... right behind you]');
      }
      if (this.breath) this.breath.setPos(G.behindPlayer(0.4));
      if (p.hideIdle > 14) {
        G.audio.play('bite');
        G.unhide(true);
        G.damage(15, 'breather');
        G.caption('[something shoves you out]');
      }
    } else {
      p.hideIdle = Math.max(0, p.hideIdle - dt * 2);
    }
    if ((!p.hidden || this.threatNear) && this.breath) { this.breath.stop(); this.breath = null; }
  }

  skitter(drawer) {
    const G = this.G;
    G.audio.play('skitter', drawer);
    G.jumpscare('skitter', 0.5);
    G.damage(8, 'skitter');
    G.caption('[something skitters out of the drawer]');
  }
}

// ======================= STAMPEDE / ECHO =======================
class Stampede {
  constructor(G, n, passes, delay) {
    this.G = G; this.kind = 'stampede'; this.n = n; this.passes = passes; this.echo = passes > 1;
    this.state = 'wait'; this.t = -delay; this.dist = 0;
    const from = Math.max(0, n - 2), to = n + 1;
    this.pts = [];
    for (let i = from; i <= to; i++) if (G.rooms[i]) G.rooms[i].path.forEach((v) => this.pts.push(v.clone()));
    this.rooms = []; for (let i = from; i <= to; i++) this.rooms.push(i);
    this.len = 0; this.seg = [];
    for (let i = 1; i < this.pts.length; i++) { const l = this.pts[i].distanceTo(this.pts[i - 1]); this.seg.push(l); this.len += l; }
    this.pos = this.pts[0].clone();
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('stampede'), transparent: true, depthWrite: false, color: this.echo ? '#c0d0ff' : '#ffffff' }));
    this.sprite.scale.set(2.6, 2.6, 1); this.sprite.visible = false;
    G.scene.add(this.sprite);
    this.speed = this.echo ? 22 : 26;
  }
  at(d) {
    for (let i = 0; i < this.seg.length; i++) {
      if (d <= this.seg[i]) return this.pts[i].clone().lerp(this.pts[i + 1], d / this.seg[i]);
      d -= this.seg[i];
    }
    return this.pts[this.pts.length - 1].clone();
  }
  update(dt) {
    const G = this.G;
    this.t += dt;
    if (this.state === 'wait') {
      if (this.t < 0) return;
      this.state = 'warn'; this.t = 0;
      this.warnTime = Math.max(3.2, 5.5 - this.n * 0.04);
      this.sound = G.audio.loop('rumble', this.pos);
      G.caption(this.echo ? '[a rumble... it sounds hungry]' : '[a distant rumble grows louder]', 3);
      this.rooms.forEach((i) => G.flicker(i, this.warnTime + 2));
      G.audio.play('flicker', G.rooms[this.n].light);
    }
    if (this.state === 'warn') {
      this.sound.setVolume(0.2 + 0.8 * (this.t / this.warnTime), 0.3);
      if (this.t >= this.warnTime) { this.state = 'run'; this.t = 0; this.sprite.visible = true; }
      return;
    }
    if (this.state === 'pause') {                   // the Echo turns around
      this.sound.setVolume(0.35, 0.4);
      if (this.t > this.pauseTime) { this.state = 'run'; this.t = 0; this.sprite.visible = true; G.caption('[it\'s coming back]'); }
      return;
    }
    if (this.state === 'run') {
      this.dist += this.speed * dt;
      const d = this.forward === false ? this.len - this.dist : this.dist;
      this.pos.copy(this.at(Math.max(0, Math.min(this.len, d))));
      this.pos.y = 1.5 + Math.sin(G.time * 30) * 0.08;
      this.sprite.position.copy(this.pos);
      this.sprite.material.rotation = Math.sin(G.time * 20) * 0.1;
      this.sound.setPos(this.pos); this.sound.setVolume(1.4, 0.05);
      G.shake = Math.max(G.shake, Math.max(0, 1 - this.pos.distanceTo(G.player.pos) / 14) * 0.08);
      // seen in the same room (or right on top of you) while not hiding = dead
      const p = G.player;
      if (!p.hidden && p.alive && (G.roomIndexAt(this.pos.z) === G.roomIndexAt(p.pos.z) || this.pos.distanceTo(p.eye) < 2.2)) {
        G.kill(this.echo ? 'echo' : 'stampede');
      }
      const room = G.rooms[G.roomIndexAt(this.pos.z)];
      if (room && room.index > 0 && !room.lightBroken && Math.abs(room.light.z - this.pos.z) < 1) G.breakLight(room.index);
      if (this.dist >= this.len) {
        this.passes--;
        if (this.passes > 0) {
          this.state = 'pause'; this.t = 0; this.pauseTime = 1.5 + Math.random() * 2; this.dist = 0;
          this.forward = this.forward === false;           // flip direction
          this.sprite.visible = false;
        } else {
          this.state = 'done'; this.dead = true;
          G.caption('[silence]', 1.5);
        }
      }
    }
  }
  remove() { this.G.scene.remove(this.sprite); this.sprite.material.dispose(); if (this.sound) this.sound.stop(); }
}

// ======================= HISSER =======================
class Hisser {
  constructor(G, n, delay) { this.G = G; this.kind = 'hisser'; this.n = n; this.t = -delay; this.state = 'wait'; }
  update(dt) {
    const G = this.G, p = G.player;
    this.t += dt;
    if (this.state === 'wait') {
      if (G.roomIndexAt(p.pos.z) !== this.n || !p.alive) { if (this.t > 0) this.dead = true; return; }
      if (this.t < 0 || p.hidden) return;
      // appear beside or behind the player, inside the room
      const room = G.rooms[this.n];
      const a = p.yaw + Math.PI * (0.55 + Math.random() * 0.9) * (Math.random() < 0.5 ? 1 : -1);
      const dir = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a));
      this.pos = p.eye.clone().addScaledVector(dir, 2.3);
      this.pos.x = Math.max(room.ox - room.w / 2 + 0.4, Math.min(room.ox + room.w / 2 - 0.4, this.pos.x));
      this.pos.z = Math.max(room.oz - room.d + 0.4, Math.min(room.oz - 0.4, this.pos.z));
      this.pos.y = 1.5 + Math.random() * 0.4;
      this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('hisser'), transparent: true, depthWrite: false, opacity: 0 }));
      this.sprite.scale.set(0.9, 0.9, 1); this.sprite.position.copy(this.pos);
      G.scene.add(this.sprite);
      G.audio.play('psst', this.pos);
      G.caption('[psst]', 1.5);
      this.state = 'watch'; this.t = 0;
      return;
    }
    if (this.state === 'watch') {
      this.sprite.material.opacity = Math.min(0.85, this.t * 2);
      if (!p.alive) { this.dead = true; return; }
      if (G.lookingAt(this.pos, 0.93)) {             // seen: it hisses and flees
        G.audio.play('repel', this.pos);
        G.caption('[hsss...]', 1.2);
        this.state = 'flee'; this.t = 0;
      } else if (this.t > 2.6) {
        G.audio.play('bite');
        G.jumpscare('hisser', 0.6);
        G.damage(35, 'hisser');
        this.state = 'flee'; this.t = 0;
      }
      return;
    }
    if (this.state === 'flee') {
      this.sprite.material.opacity = Math.max(0, 0.85 - this.t * 3);
      this.sprite.position.y += dt * 0.5;
      if (this.t > 0.4) this.dead = true;
    }
  }
  remove() { if (this.sprite) { this.G.scene.remove(this.sprite); this.sprite.material.dispose(); } }
}

// ======================= GAZE =======================
class Gaze {
  constructor(G, room) {
    this.G = G; this.kind = 'gaze'; this.room = room; this.t = 0; this.hitT = 0;
    this.pos = new THREE.Vector3(room.ox + (Math.random() - 0.5) * room.w * 0.3, 1.9, room.oz - room.d * (0.45 + Math.random() * 0.2));
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    this.eyes = [];
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('eye'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const a = i / 9 * Math.PI * 2, r = i === 0 ? 0 : 0.35 + Math.random() * 0.25;
      s.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.8, (Math.random() - 0.5) * 0.3);
      const sc = i === 0 ? 0.6 : 0.25 + Math.random() * 0.15; s.scale.set(sc, sc * 0.75, 1);
      this.group.add(s); this.eyes.push(s);
    }
    G.scene.add(this.group);
    this.sound = G.audio.loop('hum', this.pos);
    this.sound.setVolume(0.9, 1);
  }
  update(dt) {
    const G = this.G, p = G.player;
    this.t += dt;
    this.eyes.forEach((s, i) => { s.position.y += Math.sin(this.t * 2 + i) * 0.002; s.material.opacity = 0.8 + Math.sin(this.t * 3 + i) * 0.2; });
    const pr = G.roomIndexAt(p.pos.z);
    if (pr > this.room.index + 1 || !p.alive) { this.dead = true; return; }
    if (pr < this.room.index - 1 || p.hidden) { G.gazing = Math.max(0, (G.gazing || 0) - dt); return; }
    const visible = pr === this.room.index || (pr === this.room.index - 1 && G.rooms[pr].door.open);
    if (visible && G.lookingAt(this.pos, 0.86) && p.eye.distanceTo(this.pos) < 20) {
      G.damage(14 * dt, 'gaze', true);
      G.gazing = 1;
      this.hitT -= dt;
      if (this.hitT <= 0) { this.hitT = 0.45; G.audio.play('hit', null, 0.4); G.caption('[it sees you — look away]', 1); }
    } else G.gazing = Math.max(0, (G.gazing || 0) - dt * 2);
  }
  remove() {
    this.G.scene.remove(this.group);
    this.eyes.forEach((s) => s.material.dispose());
    this.sound.stop();
    this.G.gazing = 0;
  }
}

// ======================= LISTENER =======================
class Listener {
  constructor(G, room) {
    this.G = G; this.kind = 'listener'; this.room = room; this.t = 0; this.stepT = 0; this.huntT = 0; this.beatT = 0; this.stuckT = 0;
    this.pos = new THREE.Vector3(room.ox, 0, room.oz - room.d + 2.5);
    this.target = this.randomPoint();
    this.mesh = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: '#1a1416', roughness: 0.9 });
    const glow = new THREE.MeshStandardMaterial({ color: '#400808', emissive: '#ff3020', emissiveIntensity: 1.6 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 1.9, 10), skin); body.position.y = 1.4; this.mesh.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), skin); head.position.y = 2.55; head.scale.set(1, 1.25, 1); this.mesh.add(head);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.05), glow); mouth.position.set(0, 2.45, 0.32); this.mesh.add(mouth);
    for (let i = 0; i < 6; i++) { const crack = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4 + Math.random() * 0.5, 0.04), glow); crack.position.set((Math.random() - 0.5) * 0.5, 1 + Math.random() * 1.2, 0.36); crack.rotation.z = (Math.random() - 0.5); this.mesh.add(crack); }
    [-1, 1].forEach((s) => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 1.7, 6), skin); arm.position.set(s * 0.52, 1.35, 0); arm.rotation.z = s * 0.12; this.mesh.add(arm);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.6, 6), skin); leg.position.set(s * 0.2, 0.3, 0); this.mesh.add(leg);
    });
    this.mesh.position.copy(this.pos);
    G.scene.add(this.mesh);
    G.caption('[heavy footsteps somewhere in the archive]', 3);
  }
  randomPoint() {
    const r = this.room;
    return new THREE.Vector3(r.ox + (Math.random() - 0.5) * (r.w - 2), 0, r.oz - 1.5 - Math.random() * (r.d - 3));
  }
  hear(pos, loudness) {
    if (this.G.roomIndexAt(pos.z) !== this.room.index) return;
    const d = Math.hypot(pos.x - this.pos.x, pos.z - this.pos.z);
    if (d < loudness * 16) {
      this.target = new THREE.Vector3(pos.x, 0, pos.z);
      if (this.huntT <= 0) { this.G.audio.play('growl', this.head()); this.G.caption('[it heard you]', 1.5); }
      this.huntT = 5;
    }
  }
  head() { return new THREE.Vector3(this.pos.x, 2.5, this.pos.z); }
  update(dt) {
    const G = this.G, p = G.player;
    this.t += dt;
    const pr = G.roomIndexAt(p.pos.z);
    if (pr > this.room.index || pr < this.room.index - 1) { if (pr > this.room.index) this.dead = true; return; }
    this.huntT -= dt;
    // up close it can feel you even when you're quiet
    const near = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    if (near < 2 && !p.hidden && p.alive) { this.target = new THREE.Vector3(p.pos.x, 0, p.pos.z); if (this.huntT <= 0) { this.huntT = 2; G.audio.play('growl', this.head()); } }
    const speed = this.huntT > 0 ? 2.9 : 1.1;
    const to = new THREE.Vector3(this.target.x - this.pos.x, 0, this.target.z - this.pos.z);
    const dist = to.length();
    if (dist < 0.4) { this.target = this.randomPoint(); if (this.huntT > 0) this.huntT = Math.min(this.huntT, 1.5); }
    else {
      to.normalize();
      const before = this.pos.clone();
      G.moveCircle(this.pos, to.x * speed * dt, to.z * speed * dt, 0.45, [this.room]);
      this.mesh.rotation.y = Math.atan2(to.x, to.z);
      if (before.distanceTo(this.pos) < speed * dt * 0.3) { this.stuckT += dt; if (this.stuckT > 0.8) { this.target = this.randomPoint(); this.stuckT = 0; } } else this.stuckT = 0;
    }
    this.mesh.position.set(this.pos.x, Math.abs(Math.sin(this.t * (this.huntT > 0 ? 7 : 4))) * 0.06, this.pos.z);
    // heavy footsteps and the player's heartbeat
    this.stepT -= dt;
    if (this.stepT <= 0) { this.stepT = this.huntT > 0 ? 0.42 : 0.8; G.audio.play('thud', this.pos, this.huntT > 0 ? 1 : 0.7); G.shake = Math.max(G.shake, 0.015); }
    const dp = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    this.beatT -= dt;
    if (dp < 9 && this.beatT <= 0) { this.beatT = 0.35 + dp / 12; G.audio.play('heartbeat', null, Math.min(1, 1.6 - dp / 8)); }
    if (dp < 1.25 && p.alive) {
      if (!p.hidden) G.kill('listener');
      else if (this.huntT > 0) { this.huntT = 0; this.target = this.randomPoint(); G.audio.play('growl', this.head(), 0.6); G.caption('[it sniffs at the wardrobe... and moves on]', 2); }
    }
  }
  remove() { this.G.scene.remove(this.mesh); }
}
