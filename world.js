/* ============================================================
   Euskaltxo — Mundos 2D (plataformas)
   Un mundo por unidad, tras el Repaso; superarlo desbloquea la
   unidad siguiente. En el Mundo 1 (Agurrak) el día avanza según
   caminas: amaneces con el Artzaina, meriendas con la Amona,
   entras a la taberna al atardecer, vences al Basajaun de noche
   y despegas en cohete con Álvaro rumbo al Mundo 2.
   ============================================================ */

"use strict";

let W = null; // estado del mundo activo
window.__W = () => W; // gancho de depuración/pruebas

/* ---------------- Generación por dificultad ----------------
   Cada mundo construye su terreno con una semilla propia: más
   huecos y más anchos, plataformas más altas y, desde dificultad
   3, plataformas móviles. La lluvia añade zonas de viento. */

function makeRng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => ((s = (s * 48271) % 2147483647) - 1) / 2147483646;
}

function gAt(ground, x) {
  for (const g of ground) if (x >= g.x0 && x <= g.x1) return true;
  return false;
}

function buildTerrain(meta) {
  const d = meta.difficulty || 1;
  const rnd = makeRng(meta.num * 7919 + 13);
  const slots = [700, 980, 1160, 1460, 1740, 2060].sort(() => rnd() - 0.5);
  const nGaps = Math.min(2 + Math.floor(d / 2), 4);
  const chosen = [];
  for (const slot of slots) {
    if (chosen.length >= nGaps) break;
    if (chosen.every(c => Math.abs(c - slot) > 220)) chosen.push(slot);
  }
  chosen.sort((a, b) => a - b);
  const gapW = Math.min(96, 54 + d * 6);
  const ground = [];
  let x0 = 0;
  for (const c of chosen) { ground.push({ x0, x1: c }); x0 = c + gapW; }
  ground.push({ x0, x1: 2560 });

  const platforms = [];
  chosen.forEach((c, i) => {
    const moving = d >= 3 && i % 2 === 0;
    const px = c + gapW / 2 - 40;
    platforms.push({
      x: px, y: 170 - Math.min(12, d * 2), w: 80, dx: 0,
      move: moving ? { cx: px, range: 30 + d * 4, speed: 0.02 + d * 0.004, phase: rnd() * 6.28 } : null,
    });
  });
  for (const px of [330, 1090, 1560, 2050]) {
    if (chosen.every(c => Math.abs(c - px) > 130)) {
      platforms.push({ x: px, y: 178 - Math.min(16, d * 3), w: 90, dx: 0, move: null });
    }
  }
  return { ground, platforms };
}

const COLOR_ORBS = [
  { eu: "gorria", c: "#e04b3a" },
  { eu: "urdina", c: "#2f7fd9" },
  { eu: "berdea", c: "#3e8a36" },
  { eu: "horia", c: "#ffc800" },
];

// Coleccionables por temática: estrellas, números EN ORDEN,
// orbes del color pedido, o pintxos.
function buildCollectibles(meta, terrain) {
  const kind = (meta.theme && meta.theme.collectible) || "star";
  const rnd = makeRng(meta.num * 104729 + 7);
  const spots = terrain.platforms.slice(0, 5).map(pl => ({ x: pl.x + pl.w / 2, y: pl.y - 30 }));
  let gx = 420;
  while (spots.length < 5) {
    while (!gAt(terrain.ground, gx)) gx += 60;
    spots.push({ x: gx, y: 202 });
    gx += 430;
  }
  spots.sort((a, b) => a.x - b.x);
  if (kind === "number") {
    const names = ["bat", "bi", "hiru", "lau", "bost"];
    return { items: spots.map((s, i) => ({ ...s, got: false, kind, idx: i, label: names[i], cool: 0 })), target: null };
  }
  if (kind === "color") {
    const target = COLOR_ORBS[Math.floor(rnd() * COLOR_ORBS.length)];
    const items = spots.map(s => ({ ...s, got: false, kind, color: target, good: true }));
    for (let i = 0; i < 3; i++) {
      let dx = 380 + i * 640 + Math.floor(rnd() * 120);
      while (!gAt(terrain.ground, dx)) dx += 60;
      items.push({ x: dx, y: 204, got: false, kind, color: pick(COLOR_ORBS.filter(c => c !== target)), good: false });
    }
    return { items, target };
  }
  return { items: spots.map(s => ({ ...s, got: false, kind })), target: null };
}

function worldFriend(meta) {
  return meta.friend || {
    name: "Alvaro", label: "Álvaro",
    greet: `Kaixo, Nao! Mundu ${meta.num} gaindituta! Bagoaz aurrera?`,
    greetEs: `¡Hola, Nao! ¡Mundo ${meta.num} superado! ¿Seguimos adelante?`,
  };
}

function updateWorldHud() {
  const el = document.getElementById("w-stars");
  if (!el || !W) return;
  const k = (W.meta.theme && W.meta.theme.collectible) || "star";
  if (k === "color") el.textContent = `🎯 ${W.colorTarget.eu} ${W.got}/5`;
  else el.textContent = `${k === "pintxo" ? "🍢" : k === "number" ? "🔢" : "⭐"} ${W.got}/5`;
}

function collectibleHint(meta) {
  const k = (meta.theme && meta.theme.collectible) || "star";
  if (k === "number") return "Recoge los números <b>en orden</b>: bat → bost.";
  if (k === "color") return "Recoge solo los orbes del <b>color que se pide</b> arriba.";
  if (k === "pintxo") return "Recoge los 5 <b>pintxos</b>.";
  return "Coge las 5 ⭐.";
}

function startWorld(unitId) {
  route = { view: "world", unitId };
  render();
}

/* ---------------- Montaje de la vista ---------------- */

function renderWorld() {
  const unit = COURSE.find(u => u.id === route.unitId) || COURSE[0];
  const meta = WORLD_META[unit.id];
  if (!meta) { route = { view: "home", tab: "learn" }; render(); return; }
  app.innerHTML = `
    <div class="world-wrap">
      <div class="world-hud">
        <button class="quit-btn" id="w-quit" aria-label="Salir">✕</button>
        <span class="world-title">🎮 Mundo ${meta.num} · ${esc(unit.title.split("·")[0].trim())}</span>
        <span class="world-stars" id="w-stars">⭐ 0/5</span>
      </div>
      <div class="world-stage">
        <canvas id="w-canvas" width="480" height="270"></canvas>
        <div class="world-quiz" id="w-quiz" hidden></div>
      </div>
      <div class="world-controls">
        <div class="wc-pad">
          <button class="wc-btn" id="wc-left" aria-label="Izquierda">◀</button>
          <button class="wc-btn" id="wc-right" aria-label="Derecha">▶</button>
        </div>
        <button class="wc-btn wc-jump" id="wc-jump" aria-label="Saltar">A</button>
      </div>
      <p class="page-sub world-help">Mueve a <b>Nao</b> con ◀ ▶ y salta con <b>A</b> (teclado: flechas + espacio).
      ${collectibleHint(meta)} Responde bien a la gente para pasar, vence a <b>${esc(meta.boss)}</b> y llega al cohete de <b>Álvaro</b>.</p>
    </div>`;
  document.getElementById("w-quit").addEventListener("click", quitWorld);
  initWorld(unit, meta);
}

function quitWorld() {
  destroyWorld();
  route = { view: "home", tab: "learn" };
  render();
}

function destroyWorld() {
  if (!W) return;
  cancelAnimationFrame(W.raf);
  document.removeEventListener("keydown", W.onKeyDown);
  document.removeEventListener("keyup", W.onKeyUp);
  W = null;
}

/* ---------------- Inicialización ---------------- */

function initWorld(unit, meta) {
  const canvas = document.getElementById("w-canvas");
  const groundY = 230;
  const gateX = [560, 1280, 1900];
  W = {
    unit, meta, canvas,
    ctx: canvas.getContext("2d"),
    raf: null, t: 0, cam: 0,
    groundY,
    worldEnd: 2560,
    player: { x: 60, y: groundY, vx: 0, vy: 0, onGround: true, dir: 1, frame: 0 },
    checkpoint: 60,
    keys: {},
    paused: false,
    done: false,
    ground: [],
    platforms: [],
    stars: [],
    colorTarget: null,
    windZones: [],
    gates: meta.gates.map((g, i) => ({ ...g, x: gateX[i], open: false, greeted: false, used: [] })),
    boss: { x: 2280, hp: meta.bossHp || 3, hpMax: meta.bossHp || 3, defeated: false, shake: 0, greeted: false },
    friendX: 2410,
    rocketX: 2470,
    met: false,
    launch: { active: false, lift: 0, v: 0 },
    quiz: null,
    got: 0,
    onKeyDown: null, onKeyUp: null,
  };

  // terreno, coleccionables y clima según el mundo
  const terrain = buildTerrain(meta);
  W.ground = terrain.ground;
  W.platforms = terrain.platforms;
  const col = buildCollectibles(meta, terrain);
  W.stars = col.items;
  W.colorTarget = col.target;
  if (meta.theme && meta.theme.weather === "rain") {
    W.windZones = [{ x0: 880, x1: 1480, f: 0.32 }, { x0: 1720, x1: 2180, f: -0.28 }];
  }
  updateWorldHud();
  if (W.colorTarget) {
    const tgt = W.colorTarget; // capturado: el aviso no debe disparar tras salir del mundo
    setTimeout(() => {
      if (W && W.colorTarget === tgt) { toast(`🎯 Bildu: ${tgt.eu.toUpperCase()}`); speak(tgt.eu); }
    }, 600);
  }

  const k = W.keys;
  W.onKeyDown = e => {
    if (!W || route.view !== "world") return;
    if (e.key === "ArrowLeft" || e.key === "a") k.left = true;
    if (e.key === "ArrowRight" || e.key === "d") k.right = true;
    if (e.key === " " || e.key === "ArrowUp" || e.key === "w") { k.jump = true; k.jumpQueued = true; e.preventDefault(); }
  };
  W.onKeyUp = e => {
    if (!W) return;
    if (e.key === "ArrowLeft" || e.key === "a") k.left = false;
    if (e.key === "ArrowRight" || e.key === "d") k.right = false;
    if (e.key === " " || e.key === "ArrowUp" || e.key === "w") k.jump = false;
  };
  document.addEventListener("keydown", W.onKeyDown);
  document.addEventListener("keyup", W.onKeyUp);

  const bindHold = (id, prop) => {
    const b = document.getElementById(id);
    const on = e => { e.preventDefault(); k[prop] = true; };
    const off = e => { e.preventDefault(); k[prop] = false; };
    b.addEventListener("pointerdown", on);
    b.addEventListener("pointerup", off);
    b.addEventListener("pointercancel", off);
    b.addEventListener("pointerleave", off);
  };
  bindHold("wc-left", "left");
  bindHold("wc-right", "right");
  bindHold("wc-jump", "jump");
  document.getElementById("wc-jump").addEventListener("pointerdown", () => { k.jumpQueued = true; });

  speak("Egun on, Nao!");
  W.raf = requestAnimationFrame(worldTick);
}

/* ---------------- Bucle ---------------- */

function worldTick() {
  if (!W || route.view !== "world") { destroyWorld(); return; }
  W.t++;
  if (!W.paused && !W.done) worldUpdate();
  worldDraw();
  W.raf = requestAnimationFrame(worldTick);
}

function groundAt(x) {
  for (const g of W.ground) if (x >= g.x0 && x <= g.x1) return W.groundY;
  return null;
}

function worldUpdate() {
  const p = W.player, k = W.keys;

  // secuencia de despegue
  if (W.launch.active) {
    W.launch.v += 0.16;
    W.launch.lift += W.launch.v;
    if (W.launch.lift > 330) { W.launch.active = false; completeWorld(); }
    return;
  }

  const SPEED = 2.4, GRAV = 0.5, JUMP = -9.2;

  p.vx = (k.right ? SPEED : 0) - (k.left ? SPEED : 0);
  if (p.vx !== 0) { p.dir = p.vx > 0 ? 1 : -1; p.frame++; }
  if ((k.jump || k.jumpQueued) && p.onGround) { p.vy = JUMP; p.onGround = false; playSfx("tap"); }
  k.jumpQueued = false;

  // plataformas móviles (dificultad ≥3): se mueven y te llevan encima
  for (const pl of W.platforms) {
    if (pl.move) {
      const nx = pl.move.cx + Math.sin(W.t * pl.move.speed + pl.move.phase) * pl.move.range;
      pl.dx = nx - pl.x;
      pl.x = nx;
    } else pl.dx = 0;
  }

  p.x = Math.max(14, Math.min(W.worldEnd - 14, p.x + p.vx));

  // zonas de viento (mundos con tormenta): empujan a Nao
  for (const z of W.windZones) if (p.x > z.x0 && p.x < z.x1) p.x += z.f;

  p.vy += GRAV;
  p.y += p.vy;

  p.onGround = false;
  const gy = groundAt(p.x);
  if (gy !== null && p.y >= gy && p.vy >= 0) { p.y = gy; p.vy = 0; p.onGround = true; }
  for (const pl of W.platforms) {
    if (p.x > pl.x - 6 && p.x < pl.x + pl.w + 6 && p.vy >= 0 &&
        p.y >= pl.y && p.y - p.vy <= pl.y + 6) {
      p.y = pl.y; p.vy = 0; p.onGround = true;
      p.x += pl.dx; // viajar con la plataforma
    }
  }
  if (p.y > 300) {
    p.x = W.checkpoint; p.y = W.groundY; p.vy = 0;
    playSfx("buzz");
  }

  // coleccionables: estrellas / números en orden / orbes de color / pintxos
  const NUM_NAMES = ["bat", "bi", "hiru", "lau", "bost"];
  for (const s of W.stars) {
    if (s.got) continue;
    if (s.cool > 0) { s.cool--; continue; }
    if (Math.abs(p.x - s.x) < 16 && Math.abs((p.y - 22) - s.y) < 20) {
      if (s.kind === "number") {
        if (s.idx === W.got) {
          s.got = true; W.got++;
          playSfx("pair");
          speak(s.label);
        } else {
          s.cool = 50;
          playSfx("buzz");
          toast(`Ordenean! Orain: «${NUM_NAMES[W.got]}»`);
        }
      } else if (s.kind === "color") {
        s.got = true;
        speak(s.color.eu);
        if (s.good) { W.got++; playSfx("pair"); }
        else { playSfx("buzz"); toast(`Hori ${s.color.eu} da! Bildu: ${W.colorTarget.eu}`); }
      } else {
        s.got = true; W.got++;
        playSfx("pair");
      }
      updateWorldHud();
    }
  }

  for (const g of W.gates) {
    if (!g.open && p.x > g.x - 26) {
      p.x = g.x - 26;
      if (!W.quiz) openWorldQuiz(g);
    }
  }

  const b = W.boss;
  if (!b.defeated && p.x > b.x - 42) {
    p.x = b.x - 42;
    if (!W.quiz && !W.introOpen) {
      if (!b.introShown) openBossIntro();
      else openWorldQuiz(null, b);
    }
  }
  if (b.shake > 0) b.shake--;

  // encuentro con Álvaro junto al cohete
  if (b.defeated && !W.met && p.x >= W.friendX - 24) {
    p.x = W.friendX - 24;
    openFriendPanel();
  }

  W.cam = Math.max(0, Math.min(W.worldEnd - 480, p.x - 200));
}

/* ---------------- Preguntas ---------------- */

// Pregunta situacional de puerta: primero las escritas a mano (dan
// sentido a la escena), después el generador de la unidad.
function makeGateQuestion(gate) {
  const fresh = gate.situations.map((s, i) => i).filter(i => !gate.used.includes(i));
  if (fresh.length) {
    const i = pick(fresh);
    gate.used.push(i);
    const s = gate.situations[i];
    return { title: s.q, options: shuffle(s.options.slice()), answer: s.answer, speakAfter: s.speak };
  }
  return makeWorldQuestion(W.unit);
}

function makeWorldQuestion(unit) {
  const drills = DRILLS[unit.id] || [];
  if (drills.length && Math.random() < 0.35) {
    const d = pick(drills);
    return {
      title: "Completa: " + d.q.replace("___", "____"),
      hint: d.hint || "",
      options: shuffle(d.options.slice()),
      answer: d.answer,
      speakAfter: d.q.replace("___", d.answer),
    };
  }
  const w = pick(unit.words);
  const dir = Math.random() < 0.5 ? "eu-es" : "es-eu";
  const ex = exChoice(w, unit.words, dir);
  return {
    title: dir === "eu-es" ? `¿Qué significa «${ex.promptText}»?` : `¿Cómo se dice «${ex.promptText}»?`,
    hint: "",
    options: ex.options,
    answer: ex.answer,
    accepts: ex.accepts,
    speakAfter: w.eu,
    mnKey: w.eu,
  };
}

// Presentación del jefe: su leyenda de la mitología vasca antes de luchar.
function openBossIntro() {
  W.paused = true;
  W.introOpen = true;
  W.boss.introShown = true;
  playSfx("ko"); // golpe grave de aparición
  speak(W.meta.bossIntro.replace(/^(GRRR!|GRAUNK!|GROAAR!|Zzz…|Ssss…|Sssuak|Ji ji ji!|Ji ji!|Beee!|Blub!)\s*/, ""));
  const panel = document.getElementById("w-quiz");
  panel.hidden = false;
  panel.innerHTML = `
    <div class="wq-head boss-head">
      <span class="wq-emoji boss-emoji">${W.meta.bossEmoji}</span>
      <div>
        <span class="boss-tag">⚔️ JEFE DEL MUNDO ${W.meta.num}</span>
        <b class="boss-name">${esc(W.meta.boss)}</b>
        <div class="wq-greet">«${esc(W.meta.bossIntro)}» <span>${esc(W.meta.bossIntroEs)}</span></div>
      </div>
    </div>
    ${W.meta.lore ? `<div class="wq-lore">📜 ${esc(W.meta.lore)}</div>` : ""}
    <button class="btn btn-red btn-full" id="w-battle" style="margin-top:8px">⚔️ ¡A la batalla!</button>`;
  document.getElementById("w-battle").addEventListener("click", () => {
    W.introOpen = false;
    panel.hidden = true;
    panel.innerHTML = "";
    playSfx("combo");
    openWorldQuiz(null, W.boss);
  });
}

function openWorldQuiz(gate, boss) {
  W.paused = true;
  const q = boss ? makeWorldQuestion(W.unit) : makeGateQuestion(gate);
  W.quiz = { q, gate, boss };
  const who = boss
    ? { name: W.meta.boss, emoji: W.meta.bossEmoji, greet: W.meta.bossIntro, greetEs: W.meta.bossIntroEs }
    : { name: gate.npc, emoji: gate.emoji, greet: gate.greet, greetEs: gate.greetEs };
  const target = boss || gate;
  if (!target.greeted) {
    target.greeted = true;
    speak(who.greet.replace(/^GRRR! /, ""));
  }
  const panel = document.getElementById("w-quiz");
  panel.hidden = false;
  panel.innerHTML = `
    <div class="wq-head">
      <span class="wq-emoji">${who.emoji}</span>
      <div>
        <b>${esc(who.name)}${boss ? ` · ${"❤".repeat(W.boss.hp)}` : ""}</b>
        <div class="wq-greet">«${esc(who.greet)}» <span>${esc(who.greetEs)}</span></div>
      </div>
    </div>
    <div class="wq-q">${esc(q.title)}${q.hint ? ` <span class="wq-hint">(${esc(q.hint)})</span>` : ""}</div>
    <div class="wq-opts">
      ${q.options.map(o => `<button class="wq-opt" data-opt="${esc(o)}">${esc(o)}</button>`).join("")}
    </div>
    <div class="wq-feedback" id="wq-feedback"></div>`;
  panel.querySelectorAll(".wq-opt").forEach(btn => btn.addEventListener("click", () => {
    const ok = (q.accepts || [q.answer]).some(a => normalize(a) === normalize(btn.dataset.opt));
    if (ok) worldQuizOk(btn);
    else worldQuizKo(btn, q);
  }));
}

function worldQuizOk(btn) {
  const { gate, boss, q } = W.quiz;
  btn.classList.add("good");
  playSfx("ok");
  if (q.speakAfter) setTimeout(() => speak(q.speakAfter), 350);
  if (boss) {
    W.boss.hp--;
    W.boss.shake = 20;
    if (W.boss.hp <= 0) {
      W.boss.defeated = true;
      W.checkpoint = W.boss.x + 20;
      playSfx("win");
      burst(document.getElementById("w-canvas"), { emoji: ["🌟", "🌲", "✨"], n: 18 });
      closeWorldQuiz("Basajaun garaituta! El cohete de Álvaro te espera 🚀");
    } else {
      setTimeout(() => { W.quiz = null; openWorldQuiz(null, W.boss); }, 650);
      return;
    }
  } else {
    gate.open = true;
    W.checkpoint = gate.x + 30;
    burst(btn);
    closeWorldQuiz(`${gate.npc}: «Aurrera!» (¡Adelante!)`);
  }
}

function worldQuizKo(btn, q) {
  btn.classList.add("bad");
  btn.disabled = true;
  playSfx("buzz");
  const fb = document.getElementById("wq-feedback");
  const mn = q.mnKey ? getMn(q.mnKey) : null;
  fb.innerHTML = `Respuesta: <b>${esc(q.answer)}</b>${mn ? `<div class="wq-mn">💡 ${esc(mn)}</div>` : ""} <span class="wq-retry">Nueva pregunta…</span>`;
  setTimeout(() => {
    W.quiz = null;
    const wasBoss = W.player.x > W.boss.x - 60 && !W.boss.defeated;
    openWorldQuiz(wasBoss ? null : W.gates.find(g => !g.open), wasBoss ? W.boss : null);
  }, 1900);
}

function closeWorldQuiz(msg) {
  const panel = document.getElementById("w-quiz");
  setTimeout(() => {
    panel.hidden = true;
    panel.innerHTML = "";
    W.quiz = null;
    W.paused = false;
    if (msg) toast(msg);
  }, 550);
}

/* ---------------- Álvaro y el cohete ---------------- */

function openFriendPanel() {
  W.met = true;
  W.paused = true;
  const f = worldFriend(W.meta);
  speak(f.greet);
  const panel = document.getElementById("w-quiz");
  panel.hidden = false;
  panel.innerHTML = `
    <div class="wq-head">
      <span class="wq-emoji">🚀</span>
      <div>
        <b>${esc(f.label)}</b>
        <div class="wq-greet">«${esc(f.greet)}» <span>${esc(f.greetEs)}</span></div>
      </div>
    </div>
    <button class="btn btn-primary btn-full" id="w-launch" style="margin-top:6px">${COURSE.findIndex(u => u.id === W.unit.id) === COURSE.length - 1 ? "🎓 ¡Rumbo al examen A1!" : `🚀 ¡Despegar al Mundo ${W.meta.num + 1}!`}</button>`;
  document.getElementById("w-launch").addEventListener("click", () => {
    panel.hidden = true;
    panel.innerHTML = "";
    W.paused = false;
    W.launch.active = true;
    playSfx("level");
  });
}

function completeWorld() {
  W.done = true;
  const stars = W.got;
  S.worlds = S.worlds || {};
  const prev = S.worlds[W.unit.id] || { stars: 0 };
  const firstTime = !prev.done;
  S.worlds[W.unit.id] = { stars: Math.max(prev.stars || 0, stars), done: true };
  addXp(30);
  S.gems += 15;
  bumpStreak();
  checkBadges();
  saveState();
  const unitId = W.unit.id;
  setTimeout(() => {
    destroyWorld();
    route = { view: "results", world: true, unitId, stars, xp: 30, gems: 15, firstTime };
    render();
  }, 500);
}

/* ---------------- Ciclo del día ---------------- */

function lerpC(a, b, t) {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

// paletas: amanecer → mediodía → atardecer → noche
const DAY_STOPS = [
  { at: 0.00, top: [159, 205, 233], hor: [222, 240, 247], sea: [127, 181, 207] },
  { at: 0.35, top: [191, 227, 242], hor: [230, 244, 249], sea: [127, 181, 207] },
  { at: 0.70, top: [242, 178, 107], hor: [247, 217, 160], sea: [156, 143, 160] },
  { at: 1.00, top: [61, 74, 117], hor: [217, 138, 95], sea: [56, 66, 96] },
];

function dayPalette(prog) {
  let a = DAY_STOPS[0], b = DAY_STOPS[DAY_STOPS.length - 1];
  for (let i = 0; i < DAY_STOPS.length - 1; i++) {
    if (prog >= DAY_STOPS[i].at && prog <= DAY_STOPS[i + 1].at) { a = DAY_STOPS[i]; b = DAY_STOPS[i + 1]; break; }
  }
  const t = (prog - a.at) / Math.max(0.0001, b.at - a.at);
  return {
    top: lerpC(a.top, b.top, t),
    hor: lerpC(a.hor, b.hor, t),
    sea: lerpC(a.sea, b.sea, t),
    night: Math.max(0, (prog - 0.72) / 0.28), // 0..1 al final
  };
}

/* ---------------- Dibujo ---------------- */

function worldDraw() {
  const { ctx, cam, t } = W;
  ctx.imageSmoothingEnabled = false;
  const prog = Math.min(1, cam / (W.worldEnd - 480));
  const pal = dayPalette(prog);

  const th = W.meta.theme || {};
  const interior = th.backdrop === "room";
  const rainy = th.weather === "rain";

  if (interior) {
    // interior de caserío: pared cálida, ventanas al valle, viga
    ctx.fillStyle = "#e8dcc8";
    ctx.fillRect(0, 0, 480, 270);
    ctx.fillStyle = "#d3c3a8";
    ctx.fillRect(0, 26, 480, 6);
    for (let i = 0; i < 4; i++) {
      const wx = 60 + i * 130 - (cam * 0.2) % 130;
      ctx.fillStyle = "#8a6a42";
      ctx.fillRect(wx - 3, 52, 56, 60);
      ctx.fillStyle = "#bfe3f2";
      ctx.fillRect(wx, 55, 50, 54);
      ctx.fillStyle = "#7cb96a";
      ctx.fillRect(wx, 92, 50, 17);
      ctx.fillStyle = "#8a6a42";
      ctx.fillRect(wx + 23, 55, 4, 54);
    }
  } else {
    // cielo con ciclo del día (gris si llueve)
    const sky = ctx.createLinearGradient(0, 0, 0, 270);
    if (rainy) {
      sky.addColorStop(0, "#8b98a8");
      sky.addColorStop(0.58, "#aeb8c2");
      sky.addColorStop(0.62, "#7f92a4");
    } else {
      sky.addColorStop(0, pal.top);
      sky.addColorStop(0.58, pal.hor);
      sky.addColorStop(0.62, pal.sea);
    }
    sky.addColorStop(0.78, "#8fce7c");
    sky.addColorStop(1, "#6db24f");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 480, 270);

    // sol → se pone; luna y estrellas de noche
    if (!rainy) {
      const sunX = 70 + prog * 340;
      const sunY = 95 - Math.sin(prog * Math.PI) * 60;
      ctx.fillStyle = prog < 0.6 ? "#fff3c4" : "#ff9e5e";
      ctx.beginPath();
      ctx.arc(sunX, sunY, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    if (pal.night > 0 && !rainy) {
      ctx.globalAlpha = pal.night;
      ctx.fillStyle = "#f2f0e4";
      ctx.beginPath();
      ctx.arc(400, 42, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 24; i++) {
        const sx = (i * 97 + 31) % 480;
        const sy = (i * 53 + 11) % 120;
        if ((t + i * 7) % 90 < 70) ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
    }

    // nubes
    ctx.fillStyle = `rgba(255,255,255,${rainy ? 0.35 : 0.85 - pal.night * 0.5})`;
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 260 + t * (rainy ? 0.5 : 0.15)) % (480 + 160)) - 80;
      const cy = 28 + (i % 2) * 26;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 34, 10, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 22, cy + 4, 22, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // fondo lejano según temática
    if (th.backdrop === "mountain" || th.backdrop === "forest") {
      ctx.fillStyle = th.backdrop === "mountain" ? "#8a9bb0" : "#4c7c46";
      for (let i = -1; i < 7; i++) {
        const mx = i * 190 - (cam * 0.22) % 190;
        ctx.beginPath();
        ctx.moveTo(mx - 90, 176); ctx.lineTo(mx, 86); ctx.lineTo(mx + 90, 176);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillStyle = "#7cb96a";
    for (let i = -1; i < 6; i++) {
      const hx = i * 220 - (cam * 0.3) % 220;
      ctx.beginPath();
      ctx.ellipse(hx, 172, 130, 44, 0, Math.PI, 0);
      ctx.fill();
    }
    if (th.backdrop === "houses") {
      // hilera de caseríos
      for (let i = -1; i < 8; i++) {
        const hx = i * 170 - (cam * 0.45) % 170;
        ctx.fillStyle = "#f0e9dc";
        ctx.fillRect(hx, 148, 74, 34);
        ctx.fillStyle = "#a04a3a";
        ctx.beginPath();
        ctx.moveTo(hx - 6, 148); ctx.lineTo(hx + 37, 128); ctx.lineTo(hx + 80, 148);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#8a5230";
        ctx.fillRect(hx + 8, 158, 12, 24);
        ctx.fillRect(hx + 46, 156, 14, 12);
      }
    } else if (th.backdrop === "stalls") {
      // puestos de mercado con toldos
      const awn = ["#e04b3a", "#3f6ea5", "#3e8a36", "#ffc800"];
      for (let i = -1; i < 9; i++) {
        const sx = i * 150 - (cam * 0.45) % 150;
        ctx.fillStyle = "#8a6a42";
        ctx.fillRect(sx, 156, 64, 26);
        ctx.fillStyle = awn[((i % 4) + 4) % 4];
        ctx.fillRect(sx - 5, 146, 74, 12);
        ctx.fillStyle = "#f0e9dc";
        for (let jj = 0; jj < 4; jj++) ctx.fillRect(sx - 5 + jj * 19, 152, 10, 6);
      }
    } else if (th.backdrop === "forest") {
      ctx.fillStyle = "#2f6b2a";
      for (let i = -1; i < 10; i++) {
        const px2 = i * 120 - (cam * 0.45) % 120;
        ctx.beginPath();
        ctx.moveTo(px2 - 22, 182); ctx.lineTo(px2, 122); ctx.lineTo(px2 + 22, 182);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#5c4632";
        ctx.fillRect(px2 - 3, 182, 6, 8);
        ctx.fillStyle = "#2f6b2a";
      }
    } else if (th.backdrop === "station") {
      // andén con postes y catenaria
      ctx.strokeStyle = "#5a6470";
      ctx.lineWidth = 2;
      for (let i = -1; i < 8; i++) {
        const px2 = i * 180 - (cam * 0.45) % 180;
        ctx.strokeRect(px2, 128, 3, 54);
        ctx.beginPath();
        ctx.moveTo(px2 - 40, 132); ctx.lineTo(px2 + 43, 132);
        ctx.stroke();
      }
      ctx.fillStyle = "#c9ced6";
      ctx.fillRect(0, 176, 480, 8);
    }
  }

  ctx.save();
  ctx.translate(-cam, 0);

  const gTop = interior ? "#b08954" : "#5da043";
  const gSoil = interior ? "#8a6238" : "#7a5230";
  const gGrass = interior ? "#c9a06a" : "#8fce7c";
  for (const g of W.ground) {
    ctx.fillStyle = gTop;
    ctx.fillRect(g.x0, W.groundY, g.x1 - g.x0, 8);
    ctx.fillStyle = gSoil;
    ctx.fillRect(g.x0, W.groundY + 8, g.x1 - g.x0, 40);
    ctx.fillStyle = gGrass;
    for (let x = g.x0; x < g.x1; x += 14) ctx.fillRect(x, W.groundY - 3, 6, 3);
  }

  if (!interior && th.backdrop !== "station" && th.backdrop !== "stalls") {
    ctx.fillStyle = "#9a7c58";
    for (let x = 40; x < W.worldEnd; x += 90) {
      if (groundAt(x) !== null && Math.abs(x - W.rocketX) > 110) {
        ctx.fillRect(x, W.groundY - 18, 4, 18);
        ctx.fillRect(x - 12, W.groundY - 14, 28, 3);
      }
    }
  }

  if (th.decor === "flowers") {
    for (let i = 0; i < 40; i++) {
      const fx = 30 + i * 63;
      if (groundAt(fx) === null) continue;
      ctx.fillStyle = "#cf8fd6";
      ctx.fillRect(fx, W.groundY - 6, 3, 3);
      ctx.fillStyle = "#3e7d33";
      ctx.fillRect(fx + 1, W.groundY - 3, 1, 3);
    }
  } else if (th.decor === "crates") {
    for (let i = 0; i < 14; i++) {
      const cx2 = 150 + i * 180;
      if (groundAt(cx2) === null) continue;
      ctx.fillStyle = "#a67b4f";
      ctx.fillRect(cx2, W.groundY - 12, 14, 12);
      ctx.strokeStyle = "#7a5230";
      ctx.strokeRect(cx2 + 0.5, W.groundY - 11.5, 13, 11);
    }
  }

  for (const pl of W.platforms) {
    ctx.fillStyle = "#7a5230";
    ctx.fillRect(pl.x, pl.y, pl.w, 8);
    ctx.fillStyle = "#5da043";
    ctx.fillRect(pl.x, pl.y - 4, pl.w, 5);
  }

  for (const s of W.stars) {
    if (s.got) continue;
    drawCollectible(ctx, s, s.y + Math.sin((t + s.x) / 18) * 3);
  }

  for (const g of W.gates) {
    drawGate(ctx, g);
    drawNpc(ctx, g);
  }

  drawBoss(ctx, W.boss, t);

  // cohete y Álvaro (embarcados durante el despegue)
  drawRocket(ctx, W.rocketX, W.launch, t);
  if (!W.launch.active && !W.done) drawAlvaro(ctx, W.friendX, t);
  if (!W.launch.active && !W.done) drawNao(ctx, W.player, t);

  ctx.restore();

  // lluvia con viento (mundo del eguraldia)
  if (rainy) {
    ctx.strokeStyle = "rgba(205,220,240,.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 46; i++) {
      const rx = ((i * 53 + t * 6) % 500) - 10;
      const ry = ((i * 97 + t * 11) % 280) - 10;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 4, ry + 11);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(70,85,105,.12)";
    ctx.fillRect(0, 0, 480, 270);
  }

  // oscurecer la escena al caer la noche
  if (pal.night > 0 && !interior && !rainy) {
    ctx.fillStyle = `rgba(18,20,60,${pal.night * 0.22})`;
    ctx.fillRect(0, 0, 480, 270);
  }

  const vg = ctx.createRadialGradient(240, 135, 150, 240, 135, 330);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,.14)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, 480, 270);
}

function drawCollectible(ctx, s, y) {
  if (s.kind === "number") {
    ctx.save();
    ctx.translate(s.x, y);
    ctx.fillStyle = "#ffc800";
    ctx.strokeStyle = "#d9a300";
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#5c4632";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(s.idx + 1), 0, 4);
    ctx.font = "7px monospace";
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillText(s.label, 0, -14);
    ctx.restore();
    return;
  }
  if (s.kind === "color") {
    ctx.save();
    ctx.translate(s.x, y);
    ctx.fillStyle = s.color.c;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.beginPath();
    ctx.arc(-3, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (s.kind === "pintxo") {
    ctx.save();
    ctx.translate(s.x, y);
    ctx.fillStyle = "#d8a35a";      // pan
    ctx.fillRect(-8, 0, 16, 6);
    ctx.fillStyle = "#e04b3a";      // pimiento/gilda
    ctx.fillRect(-5, -5, 10, 5);
    ctx.fillStyle = "#3e8a36";      // aceituna
    ctx.beginPath();
    ctx.arc(0, -8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5c4632";    // palillo
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(0, 4);
    ctx.stroke();
    ctx.restore();
    return;
  }
  drawStar(ctx, s.x, y);
}

function drawStar(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#ffc800";
  ctx.strokeStyle = "#d9a300";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 9 : 4;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    ctx[i === 0 ? "moveTo" : "lineTo"](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawGate(ctx, g) {
  ctx.save();
  ctx.translate(g.x, W.groundY);
  ctx.fillStyle = "#8a6a42";
  if (g.open) {
    ctx.fillRect(-2, -34, 5, 34);
    ctx.save();
    ctx.translate(2, -30);
    ctx.rotate(-1.1);
    ctx.fillRect(0, 0, 30, 4);
    ctx.fillRect(0, 10, 30, 4);
    ctx.restore();
  } else {
    ctx.fillRect(-2, -34, 5, 34);
    ctx.fillRect(2, -30, 32, 4);
    ctx.fillRect(2, -20, 32, 4);
    ctx.fillRect(2, -10, 32, 4);
    ctx.fillRect(32, -34, 5, 34);
  }
  ctx.restore();
}

function drawNpc(ctx, g) {
  const x = g.x + 52, y = W.groundY;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = g.cloth;
  ctx.fillRect(-7, -26, 14, 16);
  ctx.fillStyle = g.skin;
  ctx.fillRect(-5, -38, 10, 12);
  ctx.fillStyle = g.hat;
  ctx.fillRect(-7, -41, 14, 5);
  ctx.fillStyle = "#2e2e38";
  ctx.fillRect(-6, -10, 5, 10);
  ctx.fillRect(1, -10, 5, 10);
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,.65)";
  ctx.fillText(`${g.emoji} ${g.npc}`, 0, -46);
  ctx.restore();
}

function drawBoss(ctx, b, t) {
  if (b.defeated && t % 2 === 0) return;
  const shake = b.shake > 0 ? Math.sin(t) * 2 : 0;
  const x = b.x + shake, y = W.groundY;
  ctx.save();
  ctx.translate(x, y);
  const breathe = Math.sin(t / 22) * 2;
  ctx.fillStyle = "#5c4632";
  ctx.fillRect(-20, -58 - breathe, 40, 58 + breathe);
  ctx.fillStyle = "#6f5740";
  for (let i = 0; i < 7; i++) ctx.fillRect(-20 + i * 6, -58 - breathe + (i % 2) * 4, 3, 54);
  ctx.fillStyle = "#8a6a4c";
  ctx.fillRect(-12, -52 - breathe, 24, 16);
  ctx.fillStyle = b.defeated ? "#7fd97a" : "#e04b3a";
  ctx.fillRect(-8, -48 - breathe, 5, 4);
  ctx.fillRect(3, -48 - breathe, 5, 4);
  ctx.fillStyle = "#3e7d33";
  ctx.fillRect(-16, -62 - breathe, 32, 5);
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,.65)";
  ctx.fillText(`🌲 ${W.meta.boss} ${b.defeated ? "😴" : "❤".repeat(b.hp)}`, 0, -68);
  ctx.restore();
}

// Cohete blanco de nariz roja; con llama y despegue al final.
function drawRocket(ctx, x, launch, t) {
  const lift = launch.lift || 0;
  ctx.save();
  ctx.translate(x, W.groundY - lift);
  // patas
  ctx.strokeStyle = "#9aa2ad";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, 0); ctx.lineTo(-16, 8);
  ctx.moveTo(10, 0); ctx.lineTo(16, 8);
  ctx.stroke();
  // cuerpo
  ctx.fillStyle = "#eceef2";
  ctx.fillRect(-12, -52, 24, 52);
  // nariz
  ctx.fillStyle = "#d94b3a";
  ctx.beginPath();
  ctx.moveTo(-12, -52); ctx.lineTo(0, -70); ctx.lineTo(12, -52);
  ctx.closePath();
  ctx.fill();
  // aletas
  ctx.fillStyle = "#d94b3a";
  ctx.beginPath();
  ctx.moveTo(-12, -14); ctx.lineTo(-22, 0); ctx.lineTo(-12, 0); ctx.closePath();
  ctx.moveTo(12, -14); ctx.lineTo(22, 0); ctx.lineTo(12, 0); ctx.closePath();
  ctx.fill();
  // ventana
  ctx.fillStyle = "#7fd0f0";
  ctx.beginPath();
  ctx.arc(0, -38, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#9aa2ad";
  ctx.stroke();
  // llama de despegue
  if (launch.active) {
    const f = 10 + (t % 4) * 4;
    ctx.fillStyle = "#ffb340";
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.lineTo(0, f + 8); ctx.lineTo(8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff6b35";
    ctx.beginPath();
    ctx.moveTo(-4, 0); ctx.lineTo(0, f); ctx.lineTo(4, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Álvaro: pelo castaño corto, barba, camiseta negra, jersey beige
// sobre los hombros, pendiente y sonrisa.
function drawAlvaro(ctx, x, t) {
  const P = 2;
  const y = W.groundY;
  const wave = Math.sin(t / 14) > 0.6; // saluda de vez en cuando
  ctx.save();
  ctx.translate(x, y);
  const px = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(dx * P, dy * P, w * P, h * P); };
  // zapatillas blancas
  px(-5, -2, 4, 2, "#e8e8e8");
  px(1, -2, 4, 2, "#e8e8e8");
  // pantalón gris oscuro
  px(-4, -9, 8, 7, "#3a3f4a");
  // camiseta negra
  px(-4, -16, 8, 7, "#22232a");
  // jersey beige sobre los hombros (banda y nudo)
  px(-5, -16, 10, 2, "#d8cbb2");
  px(-1, -14, 2, 3, "#d8cbb2");
  // brazos
  px(-6, -15, 2, 4, "#e0b18e");
  if (wave) px(4, -20, 2, 5, "#e0b18e"); // saludando
  else px(4, -15, 2, 4, "#e0b18e");
  // cara
  px(-3, -22, 6, 5, "#e0b18e");
  // barba
  px(-3, -18, 6, 2, "#4a3828");
  // sonrisa
  px(-1, -18, 2, 1, "#ffffff");
  // pelo castaño corto
  px(-3, -24, 6, 2, "#5a4632");
  px(-4, -23, 1, 2, "#5a4632");
  px(3, -23, 1, 2, "#5a4632");
  // pendiente
  px(3, -20, 1, 1, "#dcdcdc");
  ctx.restore();
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,.6)";
  ctx.fillText("Álvaro", x, y - 52);
}

// Nao: gorra beige, camiseta crema, pantalón teja ancho, zapatillas rosas.
function drawNao(ctx, p, t) {
  const P = 2;
  const x = Math.round(p.x), yFeet = Math.round(p.y);
  const step = p.onGround && Math.abs(p.vx) > 0 ? Math.floor(p.frame / 6) % 2 : 0;
  const jump = !p.onGround;
  ctx.save();
  ctx.translate(x, yFeet);
  const px = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(dx * P, dy * P, w * P, h * P); };
  const legL = jump ? -1 : (step === 0 ? 0 : -1);
  const legR = jump ? -1 : (step === 0 ? -1 : 0);
  px(-5, -2 + legL, 4, 2, "#f0958a");
  px(1, -2 + legR, 4, 2, "#f0958a");
  px(-5, -10, 10, 8 + (jump ? 0 : 1), "#96524a");
  px(-6, -7, 12, 3, "#96524a");
  px(-4, -16, 8, 6, "#f0e9d6");
  px(-6, -15, 2, 4, "#c68a5e");
  px(4, -15, 2, 4, jump ? "#f0e9d6" : "#c68a5e");
  if (jump) px(4, -19, 2, 4, "#c68a5e");
  px(-3, -21, 6, 5, "#c68a5e");
  px(-1, -18, 2, 1, "#8a4a3a");
  px(p.dir > 0 ? -5 : 3, -23, 2, 3, "#33241f");
  px(-4, -24, 8, 3, "#d8c49a");
  px(p.dir > 0 ? 2 : -6, -22, 4, 1, "#d8c49a");
  ctx.restore();
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,.6)";
  ctx.fillText("Nao", x, yFeet - 52);
}
