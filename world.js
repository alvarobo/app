/* ============================================================
   Euskaltxo — Mundo 1 (beta): plataformas 2D
   Nao recorre el campo vasco; los personajes le cierran el paso
   hasta que responde en euskera, y el Basajaun guarda el arco
   final. Canvas propio, sin dependencias, control táctil y teclado.
   ============================================================ */

"use strict";

let W = null; // estado del mundo activo
window.__W = () => W; // gancho de depuración/pruebas

const WORLD_META = {
  agurrak: { num: 1, boss: "Basajaun", bossEmoji: "🌲" },
};

function startWorld(unitId) {
  route = { view: "world", unitId };
  render();
}

/* ---------------- Montaje de la vista ---------------- */

function renderWorld() {
  const unit = COURSE.find(u => u.id === route.unitId) || COURSE[0];
  const meta = WORLD_META[unit.id] || { num: 1, boss: "Basajaun" };
  app.innerHTML = `
    <div class="world-wrap">
      <div class="world-hud">
        <button class="quit-btn" id="w-quit" aria-label="Salir">✕</button>
        <span class="world-title">🎮 Mundo ${meta.num} · ${esc(unit.title.split("·")[0].trim())} <span class="beta-tag">BETA</span></span>
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
      Coge las ⭐, responde a la gente en euskera para que te deje pasar y vence al ${esc(meta.boss)} para llegar al arco.</p>
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
    // suelo por tramos (dos barrancos pequeños) y plataformas flotantes
    ground: [
      { x0: 0, x1: 780 },
      { x0: 850, x1: 1560 },
      { x0: 1630, x1: 2560 },
    ],
    platforms: [
      { x: 330, y: 178, w: 90 },
      { x: 700, y: 168, w: 80 },   // ayuda a cruzar el 1er barranco
      { x: 1090, y: 175, w: 90 },
      { x: 1555, y: 165, w: 90 },  // ayuda con el 2º barranco
      { x: 2050, y: 175, w: 90 },
    ],
    stars: [
      { x: 375, y: 148, got: false },
      { x: 740, y: 136, got: false },
      { x: 1135, y: 145, got: false },
      { x: 1600, y: 133, got: false },
      { x: 2095, y: 145, got: false },
    ],
    gates: [
      { x: 560, npc: "Artzaina", emoji: "🐑", skin: "#a06a48", cloth: "#3f6ea5", hat: "#5c4632", greet: "Kaixo! Artzaina naiz.", greetEs: "¡Hola! Soy el pastor.", open: false },
      { x: 1280, npc: "Amona", emoji: "🌼", skin: "#c98d66", cloth: "#8a5fae", hat: "#d8d8d8", greet: "Egun on, maitea!", greetEs: "¡Buenos días, querida!", open: false },
      { x: 1900, npc: "Tabernaria", emoji: "🍷", skin: "#b07850", cloth: "#824e3d", hat: "#2e2e38", greet: "Arratsalde on! Zer nahi duzu?", greetEs: "¡Buenas tardes! ¿Qué quieres?", open: false },
    ],
    boss: { x: 2330, hp: 3, hpMax: 3, defeated: false, shake: 0 },
    goalX: 2470,
    quiz: null,
    got: 0,
    onKeyDown: null, onKeyUp: null,
  };

  // controles
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

  speak("Kaixo, Nao!");
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
  const SPEED = 2.4, GRAV = 0.5, JUMP = -9.2;

  p.vx = (k.right ? SPEED : 0) - (k.left ? SPEED : 0);
  if (p.vx !== 0) { p.dir = p.vx > 0 ? 1 : -1; p.frame++; }
  // búfer de salto: un toque rapidísimo también cuenta
  if ((k.jump || k.jumpQueued) && p.onGround) { p.vy = JUMP; p.onGround = false; playSfx("tap"); }
  k.jumpQueued = false;

  p.x = Math.max(14, Math.min(W.worldEnd - 14, p.x + p.vx));
  p.vy += GRAV;
  p.y += p.vy;

  // colisión: suelo por tramos
  p.onGround = false;
  const gy = groundAt(p.x);
  if (gy !== null && p.y >= gy && p.vy >= 0) { p.y = gy; p.vy = 0; p.onGround = true; }
  // plataformas flotantes (solo desde arriba)
  for (const pl of W.platforms) {
    if (p.x > pl.x - 6 && p.x < pl.x + pl.w + 6 && p.vy >= 0 &&
        p.y >= pl.y && p.y - p.vy <= pl.y + 6) {
      p.y = pl.y; p.vy = 0; p.onGround = true;
    }
  }
  // caída al barranco: volver al último punto seguro
  if (p.y > 300) {
    p.x = W.checkpoint; p.y = W.groundY; p.vy = 0;
    playSfx("buzz");
  }

  // estrellas
  for (const s of W.stars) {
    if (!s.got && Math.abs(p.x - s.x) < 16 && Math.abs((p.y - 22) - s.y) < 20) {
      s.got = true; W.got++;
      playSfx("pair");
      const el = document.getElementById("w-stars");
      if (el) el.textContent = `⭐ ${W.got}/5`;
    }
  }

  // puertas con personaje
  for (const g of W.gates) {
    if (!g.open && p.x > g.x - 26) {
      p.x = g.x - 26;
      if (!W.quiz) openWorldQuiz(g);
    }
  }

  // jefe
  const b = W.boss;
  if (!b.defeated && p.x > b.x - 42) {
    p.x = b.x - 42;
    if (!W.quiz) openWorldQuiz(null, b);
  }
  if (b.shake > 0) b.shake--;

  // meta: el arco
  if (b.defeated && p.x >= W.goalX && !W.done) completeWorld();

  // cámara
  W.cam = Math.max(0, Math.min(W.worldEnd - 480, p.x - 200));
}

/* ---------------- Preguntas ---------------- */

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

function openWorldQuiz(gate, boss) {
  W.paused = true;
  const q = makeWorldQuestion(W.unit);
  W.quiz = { q, gate, boss };
  const who = boss
    ? { name: W.meta.boss, emoji: W.meta.bossEmoji || "🌲", greet: "GRRR! Hiru erantzun zuzen… edo ez zara pasako!", greetEs: "¡Tres respuestas correctas… o no pasarás!" }
    : { name: gate.npc, emoji: gate.emoji, greet: gate.greet, greetEs: gate.greetEs };
  if (!boss || W.boss.hp === W.boss.hpMax) speak(who.greet.replace(/GRRR! /, ""));
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
      playSfx("win");
      burst(document.getElementById("w-canvas"), { emoji: ["🌟", "🌲", "✨"], n: 18 });
      closeWorldQuiz("Basajaun garaituta! (¡Basajaun vencido!) Corre al arco 🌳");
    } else {
      // siguiente pregunta del jefe, encadenada
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

function completeWorld() {
  W.done = true;
  const stars = W.got;
  S.worlds = S.worlds || {};
  const prev = S.worlds[W.unit.id] || { stars: 0 };
  S.worlds[W.unit.id] = { stars: Math.max(prev.stars || 0, stars), done: true };
  addXp(30);
  S.gems += 15;
  bumpStreak();
  checkBadges();
  saveState();
  playSfx("level");
  const unitId = W.unit.id;
  setTimeout(() => {
    destroyWorld();
    route = { view: "results", world: true, unitId, stars, xp: 30, gems: 15 };
    render();
  }, 900);
}

/* ---------------- Dibujo ---------------- */

function worldDraw() {
  const { ctx, cam, t } = W;
  ctx.imageSmoothingEnabled = false;

  // cielo y mar (como en Jaizkibel)
  const sky = ctx.createLinearGradient(0, 0, 0, 270);
  sky.addColorStop(0, "#bfe3f2");
  sky.addColorStop(0.55, "#dcf0f7");
  sky.addColorStop(0.62, "#9fc9dd");
  sky.addColorStop(0.72, "#7fb5cf");
  sky.addColorStop(0.78, "#8fce7c");
  sky.addColorStop(1, "#6db24f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 480, 270);

  // nubes
  ctx.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 260 + t * 0.15) % (480 + 160)) - 80;
    const cy = 28 + (i % 2) * 26;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 34, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 22, cy + 4, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // colinas lejanas (parallax)
  ctx.fillStyle = "#7cb96a";
  for (let i = -1; i < 6; i++) {
    const hx = i * 220 - (cam * 0.3) % 220;
    ctx.beginPath();
    ctx.ellipse(hx, 172, 130, 44, 0, Math.PI, 0);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(-cam, 0);

  // suelo por tramos
  for (const g of W.ground) {
    ctx.fillStyle = "#5da043";
    ctx.fillRect(g.x0, W.groundY, g.x1 - g.x0, 8);
    ctx.fillStyle = "#7a5230";
    ctx.fillRect(g.x0, W.groundY + 8, g.x1 - g.x0, 40);
    ctx.fillStyle = "#8fce7c";
    for (let x = g.x0; x < g.x1; x += 14) ctx.fillRect(x, W.groundY - 3, 6, 3);
  }

  // vallas de pasto (como en la foto)
  ctx.fillStyle = "#9a7c58";
  for (let x = 40; x < W.worldEnd; x += 90) {
    if (groundAt(x) !== null && Math.abs(x - W.goalX) > 90) {
      ctx.fillRect(x, W.groundY - 18, 4, 18);
      ctx.fillRect(x - 12, W.groundY - 14, 28, 3);
    }
  }

  // flores malva
  for (let i = 0; i < 40; i++) {
    const fx = 30 + i * 63;
    if (groundAt(fx) === null) continue;
    ctx.fillStyle = "#cf8fd6";
    ctx.fillRect(fx, W.groundY - 6, 3, 3);
    ctx.fillStyle = "#3e7d33";
    ctx.fillRect(fx + 1, W.groundY - 3, 1, 3);
  }

  // plataformas
  for (const pl of W.platforms) {
    ctx.fillStyle = "#7a5230";
    ctx.fillRect(pl.x, pl.y, pl.w, 8);
    ctx.fillStyle = "#5da043";
    ctx.fillRect(pl.x, pl.y - 4, pl.w, 5);
  }

  // estrellas
  for (const s of W.stars) {
    if (s.got) continue;
    drawStar(ctx, s.x, s.y + Math.sin((t + s.x) / 18) * 3);
  }

  // puertas y personajes
  for (const g of W.gates) {
    drawGate(ctx, g);
    drawNpc(ctx, g);
  }

  // jefe Basajaun
  drawBoss(ctx, W.boss, t);

  // arco de hojas final (como la foto)
  drawArch(ctx, W.goalX);

  // Nao
  drawNao(ctx, W.player, t);

  ctx.restore();

  // viñeta suave
  const vg = ctx.createRadialGradient(240, 135, 150, 240, 135, 330);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,.14)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, 480, 270);
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
    ctx.fillRect(-2, -34, 5, 34);           // poste
    ctx.save();
    ctx.translate(2, -30);
    ctx.rotate(-1.1);                        // hoja abierta
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
  // cuerpo
  ctx.fillStyle = g.cloth;
  ctx.fillRect(-7, -26, 14, 16);
  // cabeza
  ctx.fillStyle = g.skin;
  ctx.fillRect(-5, -38, 10, 12);
  // sombrero / pelo
  ctx.fillStyle = g.hat;
  ctx.fillRect(-7, -41, 14, 5);
  // piernas
  ctx.fillStyle = "#2e2e38";
  ctx.fillRect(-6, -10, 5, 10);
  ctx.fillRect(1, -10, 5, 10);
  // nombre
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,.65)";
  ctx.fillText(`${g.emoji} ${g.npc}`, 0, -46);
  ctx.restore();
}

function drawBoss(ctx, b, t) {
  if (b.defeated && t % 2 === 0) return; // parpadea vencido
  const shake = b.shake > 0 ? Math.sin(t) * 2 : 0;
  const x = b.x + shake, y = W.groundY;
  ctx.save();
  ctx.translate(x, y);
  const breathe = Math.sin(t / 22) * 2;
  // cuerpo peludo
  ctx.fillStyle = "#5c4632";
  ctx.fillRect(-20, -58 - breathe, 40, 58 + breathe);
  ctx.fillStyle = "#6f5740";
  for (let i = 0; i < 7; i++) ctx.fillRect(-20 + i * 6, -58 - breathe + (i % 2) * 4, 3, 54);
  // cara
  ctx.fillStyle = "#8a6a4c";
  ctx.fillRect(-12, -52 - breathe, 24, 16);
  // ojos (rojos hasta vencerlo)
  ctx.fillStyle = b.defeated ? "#7fd97a" : "#e04b3a";
  ctx.fillRect(-8, -48 - breathe, 5, 4);
  ctx.fillRect(3, -48 - breathe, 5, 4);
  // corona de ramas
  ctx.fillStyle = "#3e7d33";
  ctx.fillRect(-16, -62 - breathe, 32, 5);
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,.65)";
  ctx.fillText(`🌲 ${W.meta.boss} ${b.defeated ? "😴" : "❤".repeat(b.hp)}`, 0, -68);
  ctx.restore();
}

function drawArch(ctx, gx) {
  ctx.save();
  ctx.translate(gx, W.groundY);
  // dos matas laterales + copa: el arco de hojas
  ctx.fillStyle = "#2f6b2a";
  ctx.beginPath();
  ctx.ellipse(-26, -30, 18, 34, 0, 0, Math.PI * 2);
  ctx.ellipse(26, -30, 18, 34, 0, 0, Math.PI * 2);
  ctx.ellipse(0, -62, 40, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3e8a36";
  ctx.beginPath();
  ctx.ellipse(-24, -34, 12, 26, 0, 0, Math.PI * 2);
  ctx.ellipse(24, -34, 12, 26, 0, 0, Math.PI * 2);
  ctx.ellipse(0, -60, 30, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // florecillas blancas
  ctx.fillStyle = "#e8f2d8";
  for (let i = 0; i < 10; i++) {
    ctx.fillRect(-36 + (i * 17) % 72, -66 + (i * 13) % 40, 2, 2);
  }
  ctx.restore();
}

// Nao: gorra beige, camiseta crema, pantalón teja ancho, zapatillas rosas.
function drawNao(ctx, p, t) {
  const P = 2; // tamaño de "píxel"
  const x = Math.round(p.x), yFeet = Math.round(p.y);
  const step = p.onGround && Math.abs(p.vx) > 0 ? Math.floor(p.frame / 6) % 2 : 0;
  const jump = !p.onGround;
  ctx.save();
  ctx.translate(x, yFeet);
  const px = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(dx * P, dy * P, w * P, h * P); };

  // zapatillas rosas (animación de paso)
  const legL = jump ? -1 : (step === 0 ? 0 : -1);
  const legR = jump ? -1 : (step === 0 ? -1 : 0);
  px(-5, -2 + legL, 4, 2, "#f0958a");
  px(1, -2 + legR, 4, 2, "#f0958a");
  // pantalón ancho teja
  px(-5, -10, 10, 8 + (jump ? 0 : 1), "#96524a");
  px(-6, -7, 12, 3, "#96524a");
  // camiseta crema
  px(-4, -16, 8, 6, "#f0e9d6");
  // brazos
  px(-6, -15, 2, 4, "#c68a5e");
  px(4, -15, 2, 4, jump ? "#f0e9d6" : "#c68a5e");
  if (jump) px(4, -19, 2, 4, "#c68a5e"); // brazo arriba al saltar
  // cara
  px(-3, -21, 6, 5, "#c68a5e");
  // sonrisa
  px(-1, -18, 2, 1, "#8a4a3a");
  // moño oscuro detrás
  px(p.dir > 0 ? -5 : 3, -23, 2, 3, "#33241f");
  // gorra beige con visera hacia delante
  px(-4, -24, 8, 3, "#d8c49a");
  px(p.dir > 0 ? 2 : -6, -22, 4, 1, "#d8c49a");
  ctx.restore();

  // etiqueta
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,.6)";
  ctx.fillText("Nao", x, yFeet - 52);
}
