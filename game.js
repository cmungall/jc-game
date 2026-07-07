/* ============================================================
   Jasper & Clementine Go Mental
   A mobile-friendly defend-Dundee game.
   ============================================================ */
(function () {
"use strict";

// ---------- Canvas & scaling ----------
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, DPR = 1;
let riverY = 0;   // y where the Tay ends and the shore/city begins
let shoreY = 0;   // y where the player stands

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  riverY = H * 0.62;          // river occupies top ~62%
  shoreY = H - Math.max(120, H * 0.14);
  if (player) player.y = shoreY;
  buildSkyline();
}
window.addEventListener("resize", resize);

// ---------- Utility ----------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

// ---------- Audio (tiny WebAudio blips) ----------
const Audio = (function () {
  let ac = null, muted = false;
  function ctxNow() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } return ac; }
  function blip(freq, dur, type, vol) {
    if (muted) return;
    const a = ctxNow(); if (!a) return;
    if (a.state === "suspended") a.resume();
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || "square";
    o.frequency.value = freq;
    g.gain.value = (vol || 0.06);
    o.connect(g); g.connect(a.destination);
    const t = a.currentTime;
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur);
  }
  return {
    shoot: () => blip(620, 0.08, "square", 0.04),
    hit:   () => blip(300, 0.09, "sawtooth", 0.05),
    pop:   () => blip(180, 0.16, "triangle", 0.06),
    hurt:  () => blip(120, 0.25, "sawtooth", 0.08),
    special: () => { blip(200, 0.1, "square", 0.07); setTimeout(() => blip(400, 0.15, "square", 0.07), 90); setTimeout(() => blip(700, 0.2, "sawtooth", 0.07), 190); },
    wave:  () => { blip(500, 0.1, "triangle", 0.06); setTimeout(() => blip(760, 0.16, "triangle", 0.06), 110); },
    toggle: () => { muted = !muted; return muted; }
  };
})();

// ---------- Character art ----------
// Draw a character centered at (0,0). `r` ~ head radius scale.
function drawHero(g, type, r, t) {
  const bob = Math.sin(t * 0.008) * 2;
  g.save();
  g.translate(0, bob);
  const isJ = type === "jasper";
  const body = isJ ? "#3a7bd5" : "#ff8a3d";
  const bodyDark = isJ ? "#285a9e" : "#e06a1f";
  const fur = isJ ? "#dfeeff" : "#ffe4c4";

  // shadow
  g.fillStyle = "rgba(0,0,0,.25)";
  g.beginPath(); g.ellipse(0, r * 1.9, r * 1.1, r * 0.35, 0, 0, 7); g.fill();

  // body
  g.fillStyle = body;
  roundRect(g, -r * 0.85, r * 0.2, r * 1.7, r * 1.7, r * 0.7); g.fill();
  g.fillStyle = bodyDark;
  roundRect(g, -r * 0.85, r * 1.1, r * 1.7, r * 0.8, r * 0.5); g.fill();
  // belly
  g.fillStyle = fur;
  g.beginPath(); g.ellipse(0, r * 1.0, r * 0.5, r * 0.6, 0, 0, 7); g.fill();

  // head
  g.fillStyle = body;
  g.beginPath(); g.arc(0, -r * 0.5, r, 0, 7); g.fill();

  // ears
  g.fillStyle = body;
  if (isJ) { // pointy cat-like ears
    tri(g, -r * 0.75, -r * 1.15, -r * 0.35, -r * 1.85, -r * 0.05, -r * 1.15);
    tri(g,  r * 0.75, -r * 1.15,  r * 0.35, -r * 1.85,  r * 0.05, -r * 1.15);
    g.fillStyle = fur;
    tri(g, -r * 0.55, -r * 1.2, -r * 0.35, -r * 1.6, -r * 0.18, -r * 1.2);
    tri(g,  r * 0.55, -r * 1.2,  r * 0.35, -r * 1.6,  r * 0.18, -r * 1.2);
  } else { // round floppy ears
    g.beginPath(); g.arc(-r * 0.8, -r * 1.0, r * 0.42, 0, 7); g.fill();
    g.beginPath(); g.arc( r * 0.8, -r * 1.0, r * 0.42, 0, 7); g.fill();
  }

  // face patch
  g.fillStyle = fur;
  g.beginPath(); g.ellipse(0, -r * 0.35, r * 0.62, r * 0.55, 0, 0, 7); g.fill();

  // eyes
  const blink = (Math.sin(t * 0.003) > 0.985) ? 0.15 : 1;
  g.fillStyle = "#1a1a2a";
  g.beginPath(); g.ellipse(-r * 0.3, -r * 0.6, r * 0.13, r * 0.16 * blink, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse( r * 0.3, -r * 0.6, r * 0.13, r * 0.16 * blink, 0, 0, 7); g.fill();
  g.fillStyle = "#fff";
  g.beginPath(); g.arc(-r * 0.26, -r * 0.66, r * 0.05, 0, 7); g.fill();
  g.beginPath(); g.arc( r * 0.34, -r * 0.66, r * 0.05, 0, 7); g.fill();

  // nose
  g.fillStyle = isJ ? "#ff6d9e" : "#7a3b12";
  g.beginPath(); g.moveTo(-r * 0.12, -r * 0.34); g.lineTo(r * 0.12, -r * 0.34); g.lineTo(0, -r * 0.2); g.closePath(); g.fill();
  // smile
  g.strokeStyle = "#1a1a2a"; g.lineWidth = r * 0.06; g.lineCap = "round";
  g.beginPath(); g.arc(-r * 0.14, -r * 0.22, r * 0.16, 0, Math.PI); g.stroke();
  g.beginPath(); g.arc( r * 0.14, -r * 0.22, r * 0.16, 0, Math.PI); g.stroke();

  // cheeks
  g.fillStyle = isJ ? "rgba(255,120,160,.4)" : "rgba(255,90,90,.35)";
  g.beginPath(); g.arc(-r * 0.5, -r * 0.35, r * 0.14, 0, 7); g.fill();
  g.beginPath(); g.arc( r * 0.5, -r * 0.35, r * 0.14, 0, 7); g.fill();

  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function tri(g, x1, y1, x2, y2, x3, y3) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath(); g.fill(); }

// character preview canvases on the title screen
function renderPreviews() {
  document.querySelectorAll("[data-preview]").forEach(cv => {
    const g = cv.getContext("2d");
    g.clearRect(0, 0, cv.width, cv.height);
    g.save();
    g.translate(cv.width / 2, cv.height / 2 + 14);
    drawHero(g, cv.dataset.preview, 26, 0);
    g.restore();
  });
}

// ---------- Skyline (Dundee) ----------
let skyline = [];
function buildSkyline() {
  skyline = [];
  let x = 0;
  while (x < W) {
    const bw = rand(24, 48);
    const bh = rand(18, 46);   // filler kept short so landmarks stand out
    skyline.push({ x, w: bw, h: bh, lit: Math.random() < 0.6 });
    x += bw + rand(2, 10);
  }
}

// ---------- Game entities ----------
let player = null;
let bullets = [];
let monsters = [];
let particles = [];
let floaters = [];   // score text
let ripples = [];
let powerups = [];   // marmalade jars
let specials = [];   // descending Irn Bru cans & the Taymara boat
let dolphins = [];   // allied dolphins released by the Taymara
let descendTimer = 9000;   // ms until next Irn Bru / Taymara

const MonsterTypes = {
  blob:   { r: 22, hp: 1, speed: 1.0, score: 10, color: "#5fe08a", eyes: 1 },
  crab:   { r: 26, hp: 3, speed: 0.7, score: 25, color: "#ff6b6b", eyes: 2 },
  eel:    { r: 18, hp: 2, speed: 1.7, score: 20, color: "#b78bff", eyes: 1, wiggle: true },
  kraken: { r: 44, hp: 10, speed: 0.4, score: 120, color: "#3aa6a0", eyes: 3, big: true },
};

function makePlayer(type) {
  return {
    type,
    x: W / 2,
    y: shoreY,
    r: 30,
    targetX: W / 2,
    cooldown: 0,
    fireRate: type === "jasper" ? 240 : 340,   // ms
    special: 0,                                 // 0..1
    power: 0,                                   // marmalade buff time left (ms)
    invuln: 0,
    recoil: 0,
  };
}
const MARM_DURATION = 6500;

// ---------- State ----------
const State = { TITLE: 0, PLAY: 1, PAUSE: 2, OVER: 3 };
let state = State.TITLE;
let score = 0, wave = 1, cityHP = 100, best = 0;
let spawnTimer = 0, waveTimer = 0, monstersThisWave = 0, monstersSpawned = 0;
let chosenChar = null;
let lastT = 0;
let shakeT = 0, shakeMag = 0;

try { best = parseInt(localStorage.getItem("jc_best") || "0", 10) || 0; } catch (e) {}

// ---------- Waves ----------
function startWave(n) {
  wave = n;
  monstersThisWave = 4 + Math.floor(n * 2.5);
  monstersSpawned = 0;
  spawnTimer = 0;
  waveTimer = 0;
  el.wave.textContent = n;
  if (n > 1) { Audio.wave(); floatText(W / 2, riverY - 30, "WAVE " + n, "#ffd24a", 34); }
}

function pickMonsterType() {
  const r = Math.random();
  const w = wave;
  if (w >= 3 && monstersSpawned === monstersThisWave - 1 && w % 3 === 0) return "kraken";
  if (w >= 4 && r < 0.15) return "kraken";
  if (w >= 2 && r < 0.35) return "crab";
  if (w >= 2 && r < 0.6) return "eel";
  return "blob";
}

function spawnMonster() {
  const key = pickMonsterType();
  const base = MonsterTypes[key];
  const hpBoost = 1 + Math.floor(wave / 4);
  monsters.push({
    key,
    x: rand(base.r + 10, W - base.r - 10),
    y: rand(-40, riverY - 60),
    r: base.r,
    hp: base.hp * hpBoost,
    maxHp: base.hp * hpBoost,
    speed: base.speed * (0.9 + wave * 0.05),
    color: base.color,
    score: base.score,
    eyes: base.eyes,
    wiggle: base.wiggle,
    big: base.big,
    phase: rand(0, 7),
    hitFlash: 0,
    emerged: false,
    wob: rand(0, 7),
  });
  splash(monsters[monsters.length - 1].x, monsters[monsters.length - 1].y);
}

// ---------- Effects ----------
function splash(x, y) {
  ripples.push({ x, y, r: 4, max: rand(30, 50), a: 0.7 });
  for (let i = 0; i < 8; i++) {
    particles.push({ x, y, vx: rand(-2, 2), vy: rand(-3, -0.5), r: rand(2, 5), a: 1, c: "#8fd3ff", g: 0.12 });
  }
}
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const ang = rand(0, 7), sp = rand(1, 5);
    particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: rand(2, 6), a: 1, c: color, g: 0.06 });
  }
}
function floatText(x, y, text, color, size) {
  floaters.push({ x, y, text, color, size: size || 18, a: 1, vy: -0.6 });
}
function fizz(x, y) {   // Irn-Bru bubbles
  for (let i = 0; i < 6; i++) {
    particles.push({ x, y, vx: rand(-2.5, 2.5), vy: rand(-3.5, -1), r: rand(2, 5), a: 1,
                     c: Math.random() < 0.5 ? "#ff7a1a" : "#ffd24a", g: 0.05 });
  }
}
function shake(mag) { shakeT = 1; shakeMag = mag; }

// ---------- Irn-Bru & Taymara descenders ----------
function spawnDescender() {
  if (Math.random() < 0.5) {
    // Irn-Bru can drops from the top — shoot it to heal Dundee
    specials.push({ type: "irnbru", x: rand(60, W - 60), y: -50, vy: 1.15, r: 24,
                    hp: 8, maxHp: 8, phase: rand(0, 7) });
  } else {
    // Taymara sails ACROSS the river — slide aside so you don't sink it
    const fromLeft = Math.random() < 0.5;
    const by = rand(shoreY - 150, shoreY - 80);
    specials.push({ type: "taymara", x: fromLeft ? -40 : W + 40, y: by, baseY: by,
                    vx: fromLeft ? 1.6 : -1.6, r: 26, hp: 6, maxHp: 6, phase: rand(0, 7), hitFlash: 0 });
  }
}

function landTaymara(x) {
  floatText(x, shoreY - 44, "TAYMARA!", "#6fe3ff", 26);
  floatText(x, shoreY - 20, "dolphins to the rescue!", "#8fe3ff", 15);
  Audio.wave();
  const n = 3;
  for (let i = 0; i < n; i++) {
    dolphins.push({
      x: clamp(x + (i - 1) * 46, 30, W - 30),
      baseY: shoreY - 12,
      y: shoreY - 12,
      phase: rand(0, 7),
      life: 8000,                 // ms of covering fire
      fireCd: rand(250, 800),
      dir: i <= 1 ? -1 : 1,       // swim-off direction
    });
  }
}

function dolphinFish(x, y, tx, ty) {
  const dx = tx - x, dy = ty - y, len = Math.hypot(dx, dy) || 1, sp = 8;
  bullets.push({ x, y, vx: dx / len * sp, vy: dy / len * sp, r: 7, c: "#8fe3ff", dmg: 2, spin: 0, fish: true });
}

function nearestMonster(x, y) {
  let best = null, bd = Infinity;
  for (const m of monsters) {
    const d = dist2(x, y, m.x, m.y);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

// ---------- Firing ----------
function fire() {
  if (!player) return;
  const isJ = player.type === "jasper";
  const pow = player.power > 0;   // marmalade boost
  const ox = player.x, oy = player.y - player.r;
  player.recoil = 6;
  if (isJ) {
    bullets.push(mkBullet(ox, oy, 0, -9, pow ? 8 : 6, pow ? "#ff8a3d" : "#ffd24a", pow ? 2 : 1));
    if (pow) {
      bullets.push(mkBullet(ox, oy, -3, -8.5, 7, "#ffb347", 1));
      bullets.push(mkBullet(ox, oy, 3, -8.5, 7, "#ffb347", 1));
    }
  } else {
    // Clementine: bigger, spread of 3, slower but heavier
    bullets.push(mkBullet(ox, oy, 0, -7.5, pow ? 13 : 10, "#ff8a3d", pow ? 3 : 2));
    bullets.push(mkBullet(ox, oy, -2.2, -7, pow ? 10 : 8, "#ffb36b", 1));
    bullets.push(mkBullet(ox, oy, 2.2, -7, pow ? 10 : 8, "#ffb36b", 1));
    if (pow) {
      bullets.push(mkBullet(ox, oy, -4.5, -6.5, 9, "#ffcf8b", 1));
      bullets.push(mkBullet(ox, oy, 4.5, -6.5, 9, "#ffcf8b", 1));
    }
  }
  Audio.shoot();
}
function mkBullet(x, y, vx, vy, r, c, dmg) { return { x, y, vx, vy, r, c, dmg, spin: 0 }; }

function fireSpecial() {
  if (!player || player.special < 1) return;
  player.special = 0;
  Audio.special();
  shake(14);
  floatText(W / 2, H / 2, "GONE MENTAL!", "#ff4d6d", 40);
  // sweeping wave of projectiles
  for (let a = -1; a <= 1; a += 0.08) {
    bullets.push(mkBullet(player.x, player.y - player.r, a * 6, -9, 9, "#b78bff", 3));
  }
  // damage everything on screen a bit
  monsters.forEach(m => { m.hp -= 4; m.hitFlash = 1; });
  burst(player.x, player.y - player.r, "#b78bff", 40);
}

// ---------- Update ----------
function update(dt) {
  if (state !== State.PLAY) return;
  const t = performance.now();

  // player
  player.x += (player.targetX - player.x) * 0.25;
  player.x = clamp(player.x, player.r, W - player.r);
  if (player.recoil > 0) player.recoil *= 0.8;
  if (player.invuln > 0) player.invuln -= dt;
  if (player.power > 0) player.power -= dt;
  // auto fire (marmalade = faster)
  player.cooldown -= dt;
  if (player.cooldown <= 0) { fire(); player.cooldown = player.power > 0 ? player.fireRate * 0.5 : player.fireRate; }

  // spawning
  if (monstersSpawned < monstersThisWave) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnMonster();
      monstersSpawned++;
      spawnTimer = clamp(1100 - wave * 60, 350, 1100);
    }
  } else if (monsters.length === 0) {
    waveTimer += dt;
    if (waveTimer > 900) startWave(wave + 1);
  }

  // Irn-Bru / Taymara appear now and then
  descendTimer -= dt;
  if (descendTimer <= 0 && specials.length < 2) {
    spawnDescender();
    descendTimer = rand(15000, 24000);
  }

  // bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx; b.y += b.vy; b.spin += 0.3;
    if (b.y < -20 || b.x < -20 || b.x > W + 20) { bullets.splice(i, 1); continue; }
  }

  // monsters
  for (let i = monsters.length - 1; i >= 0; i--) {
    const m = monsters[i];
    m.phase += 0.05; m.wob += 0.04;
    if (m.hitFlash > 0) m.hitFlash -= dt / 120;
    // drift toward city
    m.y += m.speed * (dt / 16.7);
    if (m.wiggle) m.x += Math.sin(m.phase * 2) * 1.6;
    else m.x += Math.sin(m.wob) * 0.4;
    m.x = clamp(m.x, m.r, W - m.r);
    if (!m.emerged && m.y > 0) { m.emerged = true; }

    // reached the city?
    if (m.y + m.r >= shoreY - 10) {
      cityHP -= m.big ? 25 : (m.maxHp > 2 ? 12 : 7);
      cityHP = Math.max(0, cityHP);
      Audio.hurt();
      shake(m.big ? 16 : 8);
      burst(m.x, shoreY - 10, "#ff5a5a", 18);
      floatText(m.x, shoreY - 30, "-DUNDEE", "#ff5a5a", 18);
      monsters.splice(i, 1);
      updateHUD();
      if (cityHP <= 0) { gameOver(false); return; }
      continue;
    }

    // bullet collisions
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      const rr = (m.r + b.r);
      if (dist2(m.x, m.y, b.x, b.y) <= rr * rr) {
        m.hp -= b.dmg;
        m.hitFlash = 1;
        burst(b.x, b.y, m.color, 5);
        Audio.hit();
        bullets.splice(j, 1);
        if (m.hp <= 0) {
          killMonster(m, i);
          break;
        }
      }
    }
  }

  // Irn-Bru cans (drop from top) & the Taymara boat (sails across)
  for (let i = specials.length - 1; i >= 0; i--) {
    const p = specials[i];
    p.phase += 0.05;
    if (p.hitFlash > 0) p.hitFlash -= dt / 150;
    if (p.type === "irnbru") {
      p.y += p.vy * (dt / 16.7);
      p.x += Math.sin(p.phase) * 0.5;
    } else {
      p.x += p.vx * (dt / 16.7);
      p.y = p.baseY + Math.sin(p.phase) * 3;   // bob on the water
    }

    // bullet / fish collisions
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      const rr = p.r + b.r;
      if (dist2(p.x, p.y, b.x, b.y) > rr * rr) continue;
      if (p.type === "irnbru") {
        bullets.splice(j, 1);
        p.hp -= b.dmg;
        fizz(b.x, b.y);
        Audio.hit();
        cityHP = clamp(cityHP + 1, 0, 100);   // a wee splash of Irn-Bru
        if (p.hp <= 0) {
          cityHP = clamp(cityHP + 6, 0, 100);
          floatText(p.x, p.y, "+IRN-BRU!", "#ff7a1a", 24);
          burst(p.x, p.y, "#ff7a1a", 22); fizz(p.x, p.y); fizz(p.x, p.y);
          Audio.pop();
          specials.splice(i, 1);
        }
        updateHUD();
        break;
      } else {                                 // Taymara — takes a few knocks, then sinks
        bullets.splice(j, 1);
        p.hp -= b.dmg;
        p.hitFlash = 1;
        burst(b.x, b.y, "#cfe6fb", 6);
        Audio.hit();
        if (p.hp <= 0) {
          floatText(p.x, p.y, "OCH, NO!", "#ff5a5a", 22);
          burst(p.x, p.y, "#9fb8c8", 18); splash(p.x, p.y);
          Audio.hurt();
          specials.splice(i, 1);
        } else if (p.hp <= 2) {
          floatText(p.x, p.y - p.r, "careful!", "#ffd24a", 16);
        }
        break;
      }
    }
    if (i >= specials.length || specials[i] !== p) continue;   // was removed above

    if (p.type === "irnbru") {
      if (p.y + p.r >= shoreY - 8) { fizz(p.x, shoreY - 8); specials.splice(i, 1); }  // fizzled out un-shot
    } else {
      // made it across? dolphins to the rescue!
      if ((p.vx > 0 && p.x - p.r > W) || (p.vx < 0 && p.x + p.r < 0)) {
        landTaymara(clamp(p.x, 40, W - 40));
        specials.splice(i, 1);
      }
    }
  }

  // allied dolphins from the Taymara
  for (let i = dolphins.length - 1; i >= 0; i--) {
    const d = dolphins[i];
    d.phase += 0.12;
    d.life -= dt;
    if (d.life > 0) {
      d.y = d.baseY - Math.abs(Math.sin(d.phase)) * 24;   // leaping out of the Tay
      d.fireCd -= dt;
      if (d.fireCd <= 0 && monsters.length) {
        const tgt = nearestMonster(d.x, d.y);
        if (tgt) { dolphinFish(d.x, d.y - 6, tgt.x, tgt.y); Audio.shoot(); }
        d.fireCd = rand(450, 950);
      }
    } else {                                    // time's up — swim off
      d.x += d.dir * 3.2;
      d.y = d.baseY - Math.abs(Math.sin(d.phase)) * 10;
      if (d.x < -50 || d.x > W + 50) dolphins.splice(i, 1);
    }
  }

  // effects
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += p.g; p.a -= 0.02;
    if (p.a <= 0) particles.splice(i, 1);
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i]; r.r += 1.2; r.a -= 0.02;
    if (r.a <= 0) ripples.splice(i, 1);
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i]; f.y += f.vy; f.a -= 0.014;
    if (f.a <= 0) floaters.splice(i, 1);
  }

  // marmalade power-ups drift down; catch them to power up
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.phase += 0.05;
    p.y += p.vy * (dt / 16.7);
    p.x += Math.sin(p.phase) * 0.6;
    const rr = player.r + p.r;
    if (dist2(p.x, p.y, player.x, player.y - player.r * 0.4) <= rr * rr) {
      collectMarmalade(p);
      powerups.splice(i, 1);
      continue;
    }
    if (p.y - p.r > shoreY + 20) { splash(p.x, shoreY); powerups.splice(i, 1); }  // missed
  }

  if (shakeT > 0) shakeT -= dt / 300;
}

function collectMarmalade(p) {
  player.power = MARM_DURATION;
  player.special = clamp(player.special + 0.34, 0, 1);
  floatText(player.x, player.y - player.r * 2, "MARMALADE!", "#ff8a3d", 26);
  burst(p.x, p.y, "#ffb347", 22);
  Audio.special();
  updateHUD();
}

function spawnMarmalade(x, y) {
  powerups.push({ x: clamp(x, 20, W - 20), y, vy: 1.15, r: 15, phase: rand(0, 7) });
}

function killMonster(m, i) {
  score += m.score;
  player.special = clamp(player.special + (m.big ? 0.35 : 0.06), 0, 1);
  burst(m.x, m.y, m.color, m.big ? 30 : 14);
  ripples.push({ x: m.x, y: m.y, r: m.r, max: m.r * 2, a: 0.6 });
  floatText(m.x, m.y - m.r, "+" + m.score, "#ffd24a", m.big ? 30 : 18);
  Audio.pop();
  if (m.big) shake(10);
  // marmalade drop: krakens always, others sometimes (not if one is already falling)
  if (powerups.length === 0 && (m.big || Math.random() < 0.13)) spawnMarmalade(m.x, m.y);
  monsters.splice(i, 1);
  updateHUD();
}

// ---------- Render ----------
function render() {
  const t = performance.now();
  ctx.save();
  if (shakeT > 0) {
    const s = shakeMag * shakeT;
    ctx.translate(rand(-s, s), rand(-s, s));
  }

  drawScene(t);

  // ripples (on water)
  ripples.forEach(r => {
    ctx.strokeStyle = `rgba(200,235,255,${r.a})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.45, 0, 0, 7); ctx.stroke();
  });

  // monsters
  monsters.forEach(m => drawMonster(m, t));

  // Irn-Bru cans & Taymara boat
  specials.forEach(p => p.type === "irnbru" ? drawIrnBru(p, t) : drawTaymara(p, t));

  // allied dolphins
  dolphins.forEach(d => drawDolphin(d, t));

  // bullets (and dolphin fish)
  bullets.forEach(b => {
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.fish) {
      const ang = Math.atan2(b.vy, b.vx);
      ctx.rotate(ang);
      ctx.fillStyle = b.c;
      ctx.beginPath(); ctx.ellipse(0, 0, b.r, b.r * 0.6, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-b.r, 0); ctx.lineTo(-b.r - 5, -4); ctx.lineTo(-b.r - 5, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#12303f"; ctx.beginPath(); ctx.arc(b.r * 0.4, -1, 1.3, 0, 7); ctx.fill();
    } else {
      ctx.rotate(b.spin);
      ctx.fillStyle = b.c;
      ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.beginPath(); ctx.arc(-b.r * 0.3, -b.r * 0.3, b.r * 0.35, 0, 7); ctx.fill();
    }
    ctx.restore();
  });

  // marmalade jars
  powerups.forEach(p => drawMarmalade(p, t));

  // player
  if (player && state !== State.TITLE) {
    ctx.save();
    ctx.translate(player.x, player.y - player.recoil);
    // marmalade aura + timer
    if (player.power > 0) {
      const pulse = 1 + Math.sin(t * 0.02) * 0.08;
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(t * 0.02) * 0.12;
      const g = ctx.createRadialGradient(0, 0, player.r * 0.5, 0, 0, player.r * 2.1 * pulse);
      g.addColorStop(0, "rgba(255,170,60,.6)");
      g.addColorStop(1, "rgba(255,170,60,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, player.r * 2.1 * pulse, 0, 7); ctx.fill();
      ctx.restore();
      // countdown bar over head
      const frac = clamp(player.power / MARM_DURATION, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,.4)";
      ctx.fillRect(-player.r, -player.r * 2.4, player.r * 2, 5);
      ctx.fillStyle = "#ff8a3d";
      ctx.fillRect(-player.r, -player.r * 2.4, player.r * 2 * frac, 5);
    }
    if (player.invuln > 0 && Math.floor(t / 100) % 2 === 0) ctx.globalAlpha = 0.4;
    drawHero(ctx, player.type, player.r, t);
    ctx.restore();
  }

  // particles
  particles.forEach(p => {
    ctx.globalAlpha = clamp(p.a, 0, 1);
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
  });
  ctx.globalAlpha = 1;

  // floaters
  floaters.forEach(f => {
    ctx.globalAlpha = clamp(f.a, 0, 1);
    ctx.fillStyle = f.color;
    ctx.font = "900 " + f.size + "px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.4)";
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";

  ctx.restore();
}

function drawScene(t) {
  // sky
  let sky = ctx.createLinearGradient(0, 0, 0, riverY);
  sky.addColorStop(0, "#12385f");
  sky.addColorStop(1, "#2d6ea0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, riverY);

  // The Law (hill + war memorial) on the far horizon
  drawLaw(t);

  // distant Tay Rail Bridge silhouette
  drawBridge(t);

  // water (the Tay)
  let water = ctx.createLinearGradient(0, riverY - 60, 0, shoreY);
  water.addColorStop(0, "#1c4a7a");
  water.addColorStop(1, "#0f2f52");
  ctx.fillStyle = water;
  ctx.fillRect(0, riverY - 60, W, shoreY - (riverY - 60) + 4);

  // wavy water surface
  ctx.strokeStyle = "rgba(140,200,255,.25)";
  ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    const yy = riverY - 50 + k * ((shoreY - riverY + 50) / 4);
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const y = yy + Math.sin((x * 0.03) + t * 0.002 + k) * 4;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Dundee skyline sitting on the near shore (filler buildings first, behind landmarks)
  const cityTop = shoreY;
  skyline.forEach(b => {
    ctx.fillStyle = "#0a1a2e";
    ctx.fillRect(b.x, cityTop - b.h, b.w, b.h);
    if (b.lit) {
      ctx.fillStyle = "rgba(255,210,74,.65)";
      for (let wy = cityTop - b.h + 6; wy < cityTop - 6; wy += 12) {
        for (let wx = b.x + 5; wx < b.x + b.w - 6; wx += 12) {
          if ((wx + wy) % 3 === 0) ctx.fillRect(wx, wy, 4, 5);
        }
      }
    }
  });

  // signature Dundee landmarks along the waterfront
  drawCoxStack(W * 0.10, cityTop);
  drawCairdHall(W * 0.46, cityTop);
  drawVA(W * 0.76, cityTop);
  drawDiscovery(t);   // RRS Discovery moored on the water in front

  // shore / promenade
  ctx.fillStyle = "#1a2a1f";
  ctx.fillRect(0, shoreY - 6, W, H - shoreY + 6);
  ctx.fillStyle = "#243a2a";
  ctx.fillRect(0, shoreY - 6, W, 6);
}

// small gold caption under/over a landmark
function label(text, x, y, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha == null ? 0.6 : alpha;
  ctx.font = "700 10px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.6)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#ffd88a";
  ctx.fillText(text, x, y);
  ctx.restore();
  ctx.textAlign = "left";
}

function drawLaw(t) {
  const baseY = riverY - 40;
  const cx = W * 0.80, wdt = Math.min(W * 0.55, 300), ht = 84;
  ctx.fillStyle = "#123324";
  ctx.beginPath();
  ctx.moveTo(cx - wdt / 2, baseY);
  ctx.quadraticCurveTo(cx - wdt * 0.16, baseY - ht, cx, baseY - ht);
  ctx.quadraticCurveTo(cx + wdt * 0.20, baseY - ht, cx + wdt / 2, baseY);
  ctx.closePath(); ctx.fill();
  // war memorial tower + beacon
  ctx.fillStyle = "#0d2619";
  ctx.fillRect(cx - 4, baseY - ht - 18, 8, 20);
  ctx.fillStyle = "rgba(255,180,80,.85)";
  ctx.beginPath(); ctx.arc(cx, baseY - ht - 20, 2.5, 0, 7); ctx.fill();
  label("THE LAW", cx, baseY - ht - 26, 0.5);
}

function drawCoxStack(x, base) {
  const h = 98, w = 12;
  ctx.fillStyle = "#12283f";
  ctx.fillRect(x - w / 2, base - h, w, h);
  // ornate banded chimney top
  ctx.fillStyle = "#b5762e";
  ctx.fillRect(x - w / 2 - 2, base - h, w + 4, 7);
  ctx.fillRect(x - w / 2 - 1, base - h + 12, w + 2, 3);
  ctx.fillRect(x - w / 2 - 1, base - h + 19, w + 2, 3);
  label("COX'S STACK", x, base - h - 6, 0.55);
}

function drawCairdHall(x, base) {
  const w = 76, h = 48;
  ctx.fillStyle = "#13293f";
  ctx.fillRect(x - w / 2, base - h, w, h);
  // pediment
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 4, base - h);
  ctx.lineTo(x, base - h - 15);
  ctx.lineTo(x + w / 2 + 4, base - h);
  ctx.closePath(); ctx.fill();
  // columns
  ctx.fillStyle = "#20405e";
  for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * 10 - 2, base - h + 8, 4, h - 12);
  label("CAIRD HALL", x, base - h - 19, 0.55);
}

function drawVA(x, base) {
  const w = 92, h = 54;
  ctx.fillStyle = "#0f2236";
  ctx.beginPath();                       // angular stacked slabs (Kengo Kuma prow)
  ctx.moveTo(x - w / 2, base);
  ctx.lineTo(x - w / 2 + 10, base - h * 0.5);
  ctx.lineTo(x - 8, base - h * 0.5);
  ctx.lineTo(x - 2, base - h);
  ctx.lineTo(x + 16, base - h);
  ctx.lineTo(x + 22, base - h * 0.45);
  ctx.lineTo(x + w / 2, base - h * 0.45);
  ctx.lineTo(x + w / 2, base);
  ctx.closePath(); ctx.fill();
  // horizontal concrete bands
  ctx.strokeStyle = "rgba(130,175,215,.28)"; ctx.lineWidth = 1;
  for (let yy = base - 6; yy > base - h * 0.45; yy -= 6) {
    ctx.beginPath(); ctx.moveTo(x - w / 2, yy); ctx.lineTo(x + w / 2, yy); ctx.stroke();
  }
  label("V&A DUNDEE", x, base - h - 4, 0.55);
}

function drawDiscovery(t) {
  const x = W * 0.20, y = shoreY - 24 + Math.sin(t * 0.001) * 2;
  const s = clamp(W / 430, 0.7, 1.1);
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  // hull
  ctx.fillStyle = "#3b2a17";
  ctx.beginPath();
  ctx.moveTo(-34, 0); ctx.quadraticCurveTo(0, 15, 34, 0);
  ctx.lineTo(28, -7); ctx.lineTo(-28, -7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#c9a24a"; ctx.fillRect(-30, -6, 60, 2);   // gold stripe
  // three masts with yards
  ctx.strokeStyle = "#22323c"; ctx.lineWidth = 2; ctx.lineCap = "round";
  for (const mx of [-18, 0, 18]) {
    ctx.beginPath(); ctx.moveTo(mx, -7); ctx.lineTo(mx, -42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx - 9, -34); ctx.lineTo(mx + 9, -34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx - 7, -24); ctx.lineTo(mx + 7, -24); ctx.stroke();
  }
  // rigging
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-28, -7); ctx.lineTo(0, -44); ctx.lineTo(28, -7); ctx.stroke();
  ctx.restore();
  label("RRS DISCOVERY", x, y - 50 * s, 0.5);
}

function drawMarmalade(p, t) {
  ctx.save();
  ctx.translate(p.x, p.y + Math.sin(p.phase + t * 0.005) * 2);
  const r = p.r;
  // glow
  ctx.fillStyle = "rgba(255,160,60,.30)";
  ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, 7); ctx.fill();
  // jar body
  ctx.fillStyle = "#ff9a2e";
  roundRect(ctx, -r * 0.7, -r * 0.55, r * 1.4, r * 1.45, 4); ctx.fill();
  // shine
  ctx.fillStyle = "rgba(255,255,255,.35)";
  roundRect(ctx, -r * 0.5, -r * 0.4, r * 0.3, r * 1.1, 3); ctx.fill();
  // lid
  ctx.fillStyle = "#c85a12";
  roundRect(ctx, -r * 0.78, -r * 0.85, r * 1.56, r * 0.4, 3); ctx.fill();
  // label
  ctx.fillStyle = "#fff8ec";
  roundRect(ctx, -r * 0.55, -r * 0.12, r * 1.1, r * 0.82, 2); ctx.fill();
  ctx.fillStyle = "#c85a12";
  ctx.font = "900 " + (r * 0.8) + "px Trebuchet MS, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("M", 0, r * 0.3);
  ctx.restore();
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}

function drawIrnBru(p, t) {
  ctx.save();
  ctx.translate(p.x, p.y + Math.sin(p.phase) * 2);
  const w = 34, h = 50;
  // HP pips (how much fizz is left)
  const pipW = w / p.maxHp;
  for (let i = 0; i < p.maxHp; i++) {
    ctx.fillStyle = i < p.hp ? "#ff7a1a" : "rgba(0,0,0,.3)";
    ctx.fillRect(-w / 2 + i * pipW, -h / 2 - 9, pipW - 1.5, 4);
  }
  // can body
  ctx.fillStyle = "#eef3f7"; roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
  ctx.fillStyle = "#ff7a1a"; ctx.fillRect(-w / 2, -h / 2 + 13, w, h - 26);   // orange band
  ctx.fillStyle = "#1f4aa0";                                                 // blue ends
  ctx.fillRect(-w / 2, -h / 2, w, 11);
  ctx.fillRect(-w / 2, h / 2 - 9, w, 9);
  // sheen
  ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(-w / 2 + 4, -h / 2 + 2, 5, h - 4);
  // wordmark
  ctx.fillStyle = "#1f4aa0"; ctx.font = "900 11px Trebuchet MS, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("IRN", 0, -1); ctx.fillText("BRU", 0, 10);
  ctx.restore();
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  label("SHOOT ME!", p.x, p.y - h / 2 - 14, 0.6);
}

function drawTaymara(p, t) {
  const flip = p.vx < 0 ? -1 : 1;   // face the way it's sailing
  const flash = p.hitFlash > 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  // friendly green halo — a hint NOT to shoot
  ctx.fillStyle = "rgba(110,227,140,.18)";
  ctx.beginPath(); ctx.arc(0, 0, p.r * 1.5, 0, 7); ctx.fill();
  // little bow wake
  ctx.fillStyle = "rgba(200,235,255,.3)";
  ctx.beginPath(); ctx.ellipse(flip * 24, 6, 10, 3, 0, 0, 7); ctx.fill();
  ctx.save();
  ctx.scale(flip, 1);
  // hull
  ctx.fillStyle = flash ? "#ffffff" : "#f2f6fa";
  ctx.beginPath();
  ctx.moveTo(-26, 2); ctx.quadraticCurveTo(0, 20, 26, 2);
  ctx.lineTo(20, -6); ctx.lineTo(-20, -6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#2a7fc0"; ctx.fillRect(-24, -3, 48, 3);   // waterline stripe
  // wheelhouse
  ctx.fillStyle = flash ? "#ffd0d0" : "#e94f4f"; roundRect(ctx, -9, -20, 18, 15, 3); ctx.fill();
  ctx.fillStyle = "#bfe4ff"; ctx.fillRect(-5, -17, 10, 6);   // window
  // mast + friendly heart flag
  ctx.strokeStyle = "#3a2a17"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -34); ctx.stroke();
  ctx.fillStyle = "#6fe3a0";
  ctx.beginPath();
  ctx.moveTo(2, -34); ctx.lineTo(14, -31); ctx.lineTo(2, -27); ctx.closePath(); ctx.fill();
  ctx.restore();
  // heart HP meter (how much more knocking it can take)
  const hw = 8;
  for (let i = 0; i < p.maxHp; i++) {
    ctx.fillStyle = i < p.hp ? "#6fe3a0" : "rgba(255,90,90,.55)";
    ctx.fillRect(-p.maxHp * hw / 2 + i * hw, -p.r - 14, hw - 2, 4);
  }
  ctx.restore();
  label("TAYMARA — don't sink it!", p.x, p.y - p.r - 20, 0.6);
}

function drawDolphin(d, t) {
  ctx.save();
  ctx.translate(d.x, d.y);
  const flip = d.life <= 0 ? d.dir : (Math.sin(d.phase) >= 0 ? 1 : -1);
  ctx.scale(flip, 1);
  ctx.rotate(-0.25);
  // body
  ctx.fillStyle = "#7fa8c8";
  ctx.beginPath();
  ctx.moveTo(-15, 5);
  ctx.quadraticCurveTo(-6, -15, 16, -11);
  ctx.quadraticCurveTo(7, -3, 11, 7);
  ctx.quadraticCurveTo(-2, 1, -15, 5);
  ctx.closePath(); ctx.fill();
  // tail fluke
  ctx.beginPath(); ctx.moveTo(-13, 4); ctx.lineTo(-22, -3); ctx.lineTo(-19, 9); ctx.closePath(); ctx.fill();
  // dorsal fin
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, -18); ctx.lineTo(8, -8); ctx.closePath(); ctx.fill();
  // belly
  ctx.fillStyle = "#e2eef7";
  ctx.beginPath(); ctx.moveTo(-8, 4); ctx.quadraticCurveTo(2, 8, 10, 4); ctx.quadraticCurveTo(0, 2, -8, 4); ctx.closePath(); ctx.fill();
  // eye + smile
  ctx.fillStyle = "#12303f"; ctx.beginPath(); ctx.arc(9, -6, 1.6, 0, 7); ctx.fill();
  ctx.strokeStyle = "#12303f"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(11, -3, 3, 0, 1.4); ctx.stroke();
  ctx.restore();
}

function drawBridge(t) {
  const by = riverY - 34;
  const curve = x => by - Math.sin((x / W) * Math.PI) * 8;   // gentle rise to mid-span
  ctx.save();
  ctx.strokeStyle = "rgba(9,20,34,.9)";
  ctx.fillStyle = "rgba(9,20,34,.9)";
  ctx.lineWidth = 3;
  // deck
  ctx.beginPath();
  for (let x = 0; x <= W; x += 18) { const y = curve(x); x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke();
  // piers dropping into the water + lamp lights
  for (let x = 16; x < W; x += 40) {
    const y = curve(x);
    ctx.fillRect(x, y, 4, 42);
    ctx.fillStyle = "rgba(255,205,120,.75)"; ctx.fillRect(x - 1, y - 5, 6, 3);   // lamp
    ctx.fillStyle = "rgba(9,20,34,.9)";
  }
  ctx.restore();
  label("TAY BRIDGE", W * 0.42, curve(W * 0.42) - 9, 0.4);
}

function drawMonster(m, t) {
  const wobY = Math.sin(m.wob) * 3;
  ctx.save();
  ctx.translate(m.x, m.y + wobY);

  // wet shine under water not yet emerged
  const flash = m.hitFlash > 0;
  const col = flash ? "#ffffff" : m.color;

  // tentacles for kraken
  if (m.big) {
    ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.lineCap = "round";
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2 + m.phase * 0.3;
      const len = m.r * 1.4 + Math.sin(m.phase + a) * 8;
      ctx.beginPath();
      ctx.moveTo(0, m.r * 0.3);
      ctx.quadraticCurveTo(Math.cos(ang) * len * 0.6, m.r + Math.sin(m.phase + a) * 8,
                           Math.cos(ang) * len, m.r * 0.8 + len * 0.5);
      ctx.stroke();
    }
  }

  // body blob
  ctx.fillStyle = col;
  ctx.beginPath();
  const lobes = m.big ? 10 : 8;
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const rr = m.r * (1 + Math.sin(a * 3 + m.phase) * 0.08);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill();

  // darker underside
  ctx.fillStyle = "rgba(0,0,0,.15)";
  ctx.beginPath(); ctx.ellipse(0, m.r * 0.4, m.r * 0.8, m.r * 0.4, 0, 0, 7); ctx.fill();

  // eyes
  ctx.fillStyle = "#fff";
  const eyeCount = m.eyes;
  for (let e = 0; e < eyeCount; e++) {
    const ox = eyeCount === 1 ? 0 : (e - (eyeCount - 1) / 2) * m.r * 0.5;
    const oy = -m.r * 0.15;
    const es = m.r * (eyeCount > 2 ? 0.18 : 0.24);
    ctx.beginPath(); ctx.arc(ox, oy, es, 0, 7); ctx.fill();
    ctx.fillStyle = "#1a1a2a";
    ctx.beginPath(); ctx.arc(ox, oy + es * 0.2, es * 0.5, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff";
  }

  // angry brow
  ctx.strokeStyle = "#1a1a2a"; ctx.lineWidth = m.r * 0.1;
  ctx.beginPath(); ctx.moveTo(-m.r * 0.5, -m.r * 0.5); ctx.lineTo(-m.r * 0.1, -m.r * 0.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(m.r * 0.5, -m.r * 0.5); ctx.lineTo(m.r * 0.1, -m.r * 0.3); ctx.stroke();

  // hp pips for tougher monsters
  if (m.maxHp > 1) {
    const pipW = (m.r * 1.6) / m.maxHp;
    for (let p = 0; p < m.maxHp; p++) {
      ctx.fillStyle = p < m.hp ? "#7fffa0" : "rgba(0,0,0,.3)";
      ctx.fillRect(-m.r * 0.8 + p * pipW, -m.r - 10, pipW - 2, 4);
    }
  }

  ctx.restore();
}

// ---------- Loop ----------
function loop(t) {
  const dt = Math.min(50, t - lastT || 16);
  lastT = t;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ---------- HUD ----------
const el = {
  hud: document.getElementById("hud"),
  score: document.getElementById("score"),
  wave: document.getElementById("wave"),
  cityFill: document.getElementById("cityFill"),
  specialFill: document.getElementById("specialFill"),
  title: document.getElementById("titleScreen"),
  pause: document.getElementById("pauseScreen"),
  over: document.getElementById("overScreen"),
  overTitle: document.getElementById("overTitle"),
  overMsg: document.getElementById("overMsg"),
  finalScore: document.getElementById("finalScore"),
  finalWave: document.getElementById("finalWave"),
  bestScore: document.getElementById("bestScore"),
};
function updateHUD() {
  el.score.textContent = score;
  el.cityFill.style.width = clamp(cityHP, 0, 100) + "%";
  el.specialFill.style.width = clamp(player ? player.special * 100 : 0, 0, 100) + "%";
}

// ---------- Flow ----------
function startGame() {
  if (!chosenChar) return;
  player = makePlayer(chosenChar);
  bullets = []; monsters = []; particles = []; floaters = []; ripples = []; powerups = [];
  specials = []; dolphins = []; descendTimer = 9000;
  score = 0; cityHP = 100;
  el.hud.classList.remove("hidden");
  hideAll();
  state = State.PLAY;
  startWave(1);
  updateHUD();
  // keep special bar refreshed
  clearInterval(startGame._hi);
  startGame._hi = setInterval(() => { if (state === State.PLAY) updateHUD(); }, 120);
}
function gameOver(won) {
  state = State.OVER;
  if (score > best) { best = score; try { localStorage.setItem("jc_best", best); } catch (e) {} }
  el.overTitle.textContent = won ? "Dundee is saved!" : "Dundee has fallen!";
  el.overMsg.textContent = won
    ? "The Tay is calm again. For now…"
    : (player.type === "jasper" ? "Jasper gave it laldy, but the monsters won." : "Clementine splashed hard, but Dundee is overrun.");
  el.finalScore.textContent = score;
  el.finalWave.textContent = wave;
  el.bestScore.textContent = best;
  el.hud.classList.add("hidden");
  el.over.classList.remove("hidden");
}
function pauseGame() { if (state === State.PLAY) { state = State.PAUSE; el.pause.classList.remove("hidden"); } }
function resumeGame() { if (state === State.PAUSE) { state = State.PLAY; el.pause.classList.add("hidden"); lastT = performance.now(); } }
function toMenu() {
  state = State.TITLE;
  hideAll();
  el.hud.classList.add("hidden");
  el.title.classList.remove("hidden");
}
function hideAll() {
  el.title.classList.add("hidden");
  el.pause.classList.add("hidden");
  el.over.classList.add("hidden");
}

// ---------- Input ----------
let dragging = false;
function pointerPos(e) {
  const p = e.touches ? e.touches[0] : e;
  return { x: p.clientX, y: p.clientY };
}
function onDown(e) {
  if (state !== State.PLAY) return;
  e.preventDefault();
  const p = pointerPos(e);
  dragging = true;
  player.targetX = p.x;
  // tap in lower-right corner-ish always allowed; tap fires special if ready, else a quick shot
  fireSpecial();
}
function onMove(e) {
  if (state !== State.PLAY || !dragging) return;
  e.preventDefault();
  const p = pointerPos(e);
  player.targetX = p.x;
}
function onUp() { dragging = false; }

canvas.addEventListener("touchstart", onDown, { passive: false });
canvas.addEventListener("touchmove", onMove, { passive: false });
canvas.addEventListener("touchend", onUp);
canvas.addEventListener("mousedown", onDown);
canvas.addEventListener("mousemove", onMove);
window.addEventListener("mouseup", onUp);

// keyboard for desktop play
const keys = {};
window.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (state === State.PLAY) {
    if (e.key === " ") { e.preventDefault(); fireSpecial(); }
    if (e.key === "p" || e.key === "P") pauseGame();
    if (e.key === "ArrowLeft" || e.key === "a") player.targetX = clamp(player.x - 60, player.r, W - player.r);
    if (e.key === "ArrowRight" || e.key === "d") player.targetX = clamp(player.x + 60, player.r, W - player.r);
  }
});
window.addEventListener("keyup", e => { keys[e.key] = false; });
// smooth keyboard hold
setInterval(() => {
  if (state !== State.PLAY) return;
  if (keys["ArrowLeft"] || keys["a"]) player.targetX = clamp(player.targetX - 12, player.r, W - player.r);
  if (keys["ArrowRight"] || keys["d"]) player.targetX = clamp(player.targetX + 12, player.r, W - player.r);
}, 30);

// ---------- UI buttons ----------
document.querySelectorAll(".charBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".charBtn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    chosenChar = btn.dataset.char;
    const sb = document.getElementById("startBtn");
    sb.disabled = false;
    sb.textContent = "Save Dundee as " + (chosenChar === "jasper" ? "Jasper" : "Clementine") + "!";
  });
});
document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("pauseBtn").addEventListener("click", pauseGame);
document.getElementById("resumeBtn").addEventListener("click", resumeGame);
document.getElementById("quitBtn").addEventListener("click", toMenu);
document.getElementById("againBtn").addEventListener("click", startGame);
document.getElementById("menuBtn").addEventListener("click", toMenu);

// prevent iOS double-tap zoom / scroll bounce
document.addEventListener("gesturestart", e => e.preventDefault());
document.addEventListener("touchmove", e => { if (e.target === canvas) e.preventDefault(); }, { passive: false });

// ---------- Boot ----------
resize();
renderPreviews();
requestAnimationFrame(loop);

})();
