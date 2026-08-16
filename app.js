/* ============================================================
   Euskaltxo — motor de la aplicación
   Sin dependencias: estado + render manual sobre #app.
   ============================================================ */

"use strict";

/* ---------------- Estado y persistencia ---------------- */

const STORAGE_KEY = "euskaltxo-v1";
const MAX_HEARTS = 5;
const HEART_REGEN_MS = 30 * 60 * 1000; // 1 vida cada 30 min
const HEART_REFILL_COST = 350;         // gemas

const defaultState = () => ({
  xp: 0,
  gems: 0,
  hearts: MAX_HEARTS,
  heartsStamp: Date.now(),
  streak: 0,
  lastDay: null,          // "YYYY-MM-DD" del último día con lección completada
  progress: {},           // unitId -> nº de lecciones completadas
  wordStats: {},          // eu -> {ok, ko} para el repaso inteligente
  badges: {},             // id de logro -> true
  perfects: 0,            // lecciones perfectas acumuladas
  goalDay: null,          // día de la meta diaria en curso
  goalXp: 0,              // XP conseguidos hoy
  goalRewarded: null,     // día en que ya se cobró el cofre diario
  sound: true,            // efectos de sonido
  musicShown: {},         // id de canción -> true (playlist descubierta)
  theme: "auto",          // "auto" | "light" | "dark"
  streakFreezes: 0,       // protectores de racha equipados (máx. 2)
  stories: {},            // id de historia -> true (completada)
  blitzBest: 0,           // récord del reto Erronka (60 s)
});

let S = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { /* estado corrupto: empezar de cero */ }
  return defaultState();
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch (e) {}
}

/* ---------------- Tema claro / oscuro ---------------- */

function applyTheme() {
  const root = document.documentElement;
  if (S.theme === "light" || S.theme === "dark") root.dataset.theme = S.theme;
  else delete root.dataset.theme;
  // Color de la barra del navegador acorde al tema efectivo
  const dark = S.theme === "dark" ||
    (S.theme !== "light" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? "#131f24" : "#ffffff";
}

if (window.matchMedia) {
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
}

function todayStr(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

// Racha: si el último día activo fue antes de ayer, se rompe…
// salvo que haya protectores 🧊 equipados (uno por día perdido).
function refreshStreak() {
  if (!S.lastDay) return;
  const gap = daysBetween(S.lastDay, todayStr());
  if (gap <= 1) return;
  const missed = gap - 1;
  if (S.streak > 0 && (S.streakFreezes || 0) >= missed) {
    S.streakFreezes -= missed;
    S.lastDay = todayStr(new Date(Date.now() - 86400000)); // cuenta como activo ayer
    setTimeout(() => toast(`🧊 Protector de racha usado — racha de ${S.streak} salvada`), 600);
  } else if (S.streak > 0) {
    S.streak = 0;
  }
  saveState();
}

const FREEZE_COST = 200;
const MAX_FREEZES = 2;

function buyFreeze() {
  if ((S.streakFreezes || 0) >= MAX_FREEZES) { toast(`Ya tienes ${MAX_FREEZES} protectores 🧊`); return; }
  if (S.gems < FREEZE_COST) { toast(`Necesitas ${FREEZE_COST} 💎 (tienes ${S.gems})`); return; }
  S.gems -= FREEZE_COST;
  S.streakFreezes = (S.streakFreezes || 0) + 1;
  saveState();
  toast("🧊 Protector comprado: tu racha aguanta un día sin practicar");
  render();
}

function bumpStreak() {
  const today = todayStr();
  if (S.lastDay === today) return;
  S.streak = (S.lastDay && daysBetween(S.lastDay, today) === 1) ? S.streak + 1 : 1;
  S.lastDay = today;
}

// Regeneración de vidas por tiempo transcurrido.
function refreshHearts() {
  if (S.hearts >= MAX_HEARTS) { S.heartsStamp = Date.now(); return; }
  const elapsed = Date.now() - S.heartsStamp;
  const regened = Math.floor(elapsed / HEART_REGEN_MS);
  if (regened > 0) {
    S.hearts = Math.min(MAX_HEARTS, S.hearts + regened);
    S.heartsStamp = S.hearts >= MAX_HEARTS ? Date.now() : S.heartsStamp + regened * HEART_REGEN_MS;
    saveState();
  }
}

function level() { return Math.floor(S.xp / 100) + 1; }
function levelPct() { return S.xp % 100; }

function unitDone(u) { return (S.progress[u.id] || 0) >= LESSONS_PER_UNIT; }
function unitUnlocked(idx) { return idx === 0 || unitDone(COURSE[idx - 1]); }
function allUnitsDone() { return COURSE.every(unitDone); }
function examPassed() { return (S.progress[EXAM_A1.id] || 0) > 0; }
function a1Pct() {
  const total = COURSE.length * LESSONS_PER_UNIT + 1; // lecciones + examen
  const done = totalLessonsDone() + (examPassed() ? 1 : 0);
  return Math.round((done / total) * 100);
}

function totalLessonsDone() {
  return COURSE.reduce((n, u) => n + (S.progress[u.id] || 0), 0);
}

function learnedWords() {
  // Palabras de todas las unidades con al menos una lección completada.
  const out = [];
  for (const u of COURSE) if ((S.progress[u.id] || 0) > 0) out.push(...u.words);
  return out;
}

function getMn(eu) { return (typeof MNEMONICS !== "undefined" && MNEMONICS[eu]) || null; }

/* ---------------- Repaso espaciado (cajas de Leitner) ----------------
   Cada palabra sube de caja al acertarla y cae a la caja 0 al fallarla.
   La caja determina cuándo "vence" el siguiente repaso. */

const SRS_INTERVALS = [0, 1, 3, 7, 21, 60]; // días hasta el próximo repaso

function noteWord(eu, ok) {
  const st = S.wordStats[eu] || (S.wordStats[eu] = { ok: 0, ko: 0, box: 0, due: 0 });
  if (st.box === undefined) { st.box = Math.round(wordStrength(eu) * 3); st.due = 0; } // migración
  if (ok) { st.ok++; st.box = Math.min(SRS_INTERVALS.length - 1, st.box + 1); }
  else { st.ko++; st.box = 0; }
  st.due = Date.now() + SRS_INTERVALS[st.box] * 86400000;
}

// Palabras ya practicadas cuyo repaso ha vencido.
function dueWords() {
  const now = Date.now();
  return learnedWords().filter(w => {
    const st = S.wordStats[w.eu];
    return st && (st.due === undefined || st.due <= now);
  });
}

function wordStrength(eu) {
  const st = S.wordStats[eu];
  if (!st || st.ok + st.ko === 0) return 0;
  return st.ok / (st.ok + st.ko);
}

// Las palabras falladas o nunca practicadas van primero.
function weakestWords(n) {
  const pool = learnedWords();
  const scored = pool.map(w => {
    const st = S.wordStats[w.eu];
    const s = st ? st.ok / (st.ok + st.ko || 1) : 0.35; // sin datos: prioridad media
    return { w, s: s + Math.random() * 0.15 };          // algo de variedad
  });
  scored.sort((a, b) => a.s - b.s);
  return scored.slice(0, n).map(x => x.w);
}

/* ---------------- Meta diaria ---------------- */

function goalToday() {
  if (S.goalDay !== todayStr()) { S.goalDay = todayStr(); S.goalXp = 0; }
  return S.goalXp;
}

let pendingLevelUp = null; // se celebra en la siguiente pantalla de resultados

function addXp(n) {
  const lvBefore = level();
  S.xp += n;
  if (level() > lvBefore) pendingLevelUp = level();
  goalToday();
  const before = S.goalXp;
  S.goalXp += n;
  if (before < DAILY_GOAL_XP && S.goalXp >= DAILY_GOAL_XP && S.goalRewarded !== todayStr()) {
    S.goalRewarded = todayStr();
    S.gems += 10;
    setTimeout(() => toast("🎯 ¡Meta diaria cumplida! +10 💎"), 900);
  }
}

/* ---------------- Logros ---------------- */

const BADGES = [
  { id: "first", icon: "🐣", t: "Lehen urratsa", d: "Completa tu primera lección", test: () => totalLessonsDone() >= 1 },
  { id: "ten", icon: "📚", t: "Ikasle fina", d: "Completa 10 lecciones", test: () => totalLessonsDone() >= 10 },
  { id: "half", icon: "🧗", t: "Erdibidean", d: "Completa 8 unidades", test: () => COURSE.filter(unitDone).length >= 8 },
  { id: "all", icon: "🗺️", t: "Bidaiaria", d: "Completa las 16 unidades", test: () => allUnitsDone() },
  { id: "exam", icon: "🎓", t: "A1 gainditua", d: "Aprueba el examen A1", test: () => examPassed() },
  { id: "streak3", icon: "🔥", t: "Sutan", d: "Racha de 3 días", test: () => S.streak >= 3 },
  { id: "streak7", icon: "🌋", t: "Astebete sutan", d: "Racha de 7 días", test: () => S.streak >= 7 },
  { id: "xp500", icon: "⚡", t: "Indartsu", d: "Consigue 500 XP", test: () => S.xp >= 500 },
  { id: "perfect5", icon: "💎", t: "Perfektua", d: "5 lecciones perfectas", test: () => S.perfects >= 5 },
  { id: "words50", icon: "🗣️", t: "Hiztuna", d: "Practica 50 palabras distintas", test: () => Object.keys(S.wordStats).length >= 50 },
  { id: "blitz20", icon: "⚡", t: "Ziztu bizian", d: "20+ puntos en un reto Erronka", test: () => (S.blitzBest || 0) >= 20 },
  { id: "gems300", icon: "💰", t: "Aberatsa", d: "Acumula 300 gemas", test: () => S.gems >= 300 },
];

/* ---------------- Música en euskera ---------------- */

// Elige una canción aún no descubierta, preferiblemente de la unidad dada.
function pickMusic(unitId) {
  let cand = MUSIC.filter(m => !S.musicShown[m.id] && (!unitId || m.units.includes(unitId)));
  if (!cand.length && !unitId) cand = MUSIC.filter(m => !S.musicShown[m.id]);
  return cand.length ? pick(cand) : null;
}

function musicSearchUrl(m) {
  // Para canciones tradicionales el nombre del artista no ayuda a buscar.
  const generic = /^(tradicional|popular)/i.test(m.artist);
  const q = generic ? m.song + " euskaraz" : m.artist + " " + m.song;
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
}

function extraCardHTML(r) {
  if (r.music) {
    const m = r.music;
    return `
      <div class="music-card">
        <div class="music-head">🎵 Canción para esta unidad</div>
        <div class="music-title"><b>${esc(m.song)}</b> — ${esc(m.artist)}</div>
        <p>${esc(m.desc)}</p>
        <div class="music-words">
          ${m.words.map(w => `<span class="music-chip"><b>${esc(w.eu)}</b> · ${esc(w.es)}</span>`).join("")}
        </div>
        <a class="music-link" href="${musicSearchUrl(m)}" target="_blank" rel="noopener">▶ Escuchar en YouTube</a>
      </div>`;
  }
  if (r.tip) return `<div class="tip-card">💡 <b>¿Sabías que…?</b> ${esc(r.tip)}</div>`;
  return "";
}

function checkBadges() {
  for (const b of BADGES) {
    if (!S.badges[b.id] && b.test()) {
      S.badges[b.id] = true;
      setTimeout(() => toast(`🏆 Logro: ${b.icon} ${b.t}`), 1600);
    }
  }
}

/* ---------------- Utilidades ---------------- */

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample(arr, n) { return shuffle(arr).slice(0, n); }

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function normalize(s) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:'"«»()-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* ---------------- Audio: TTS y efectos ---------------- */

// La disponibilidad de voces varía mucho entre navegadores: casi ninguno
// trae voz en euskera, así que caemos a una voz en español (la lectura es
// casi idéntica) y, si ni siquiera eso funciona, avisamos y ofrecemos ver
// la palabra en los ejercicios de escucha.
let ttsBroken = false;

function bestVoice() {
  const vs = speechSynthesis.getVoices();
  return vs.find(v => v.lang && v.lang.toLowerCase().startsWith("eu"))
      || vs.find(v => v.lang && v.lang.toLowerCase().startsWith("es"))
      || vs.find(v => v.default)
      || vs[0] || null;
}

function markSpeaking(on) {
  document.querySelectorAll(".speaker-btn").forEach(b => b.classList.toggle("speaking", on));
}

// Solo cuando el navegador no tiene síntesis de voz en absoluto.
function ttsFailed() {
  if (!ttsBroken) {
    ttsBroken = true;
    toast("Tu navegador no tiene voz de síntesis 🔇 Usa «Ver la palabra»");
  }
}

function speak(text) {
  if (!("speechSynthesis" in window)) { ttsFailed(); return; }
  const synth = speechSynthesis;
  try { synth.cancel(); } catch (e) {}
  const u = new SpeechSynthesisUtterance(text);
  const v = bestVoice();
  if (v) { u.voice = v; u.lang = v.lang; }
  else u.lang = "es-ES"; // sin lista de voces: deja hablar al motor por defecto
  u.rate = 0.85;
  u.onstart = () => markSpeaking(true);
  u.onend = () => markSpeaking(false);
  u.onerror = () => markSpeaking(false);
  // Chrome ignora a veces un speak() inmediatamente después de cancel(),
  // y puede quedarse en estado "paused": pequeño retardo + resume().
  // NOTA: nada de heurísticas de "audio roto" aquí — en iOS dan falsos
  // positivos y acababan revelando la palabra de los ejercicios de
  // escucha. La palabra solo se muestra si el usuario lo pide.
  setTimeout(() => {
    try { synth.resume(); synth.speak(u); } catch (e) {}
  }, 60);
}

// Los navegadores móviles bloquean el audio hasta el primer gesto del
// usuario: desbloqueamos el AudioContext y "calentamos" la síntesis.
// "Estrenar" un <audio> dentro de un gesto: iOS solo deja reproducir
// elementos que ya se hayan tocado con permiso del usuario.
const SFX_PRIMED = {};
function primeSfx(name) {
  try {
    const a = getSfx(name);
    SFX_PRIMED[name] = true;
    a.muted = true;
    const p = a.play();
    if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; })
                      .catch(() => { a.muted = false; });
    else { a.pause(); a.currentTime = 0; a.muted = false; }
  } catch (e) {}
}

document.addEventListener("pointerdown", function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
  } catch (e) {}
  // Solo el tap se sintetiza dentro del primer gesto (es ligero y es el
  // primero que suena); el resto se genera en diferido para no congelar
  // el primer toque en móviles modestos.
  primeSfx("tap");
  Object.keys(SFX_SPECS).filter(n => n !== "tap")
    .forEach((n, i) => setTimeout(() => { try { getSfx(n); } catch (e) {} }, 150 + i * 90));
  try {
    if ("speechSynthesis" in window) {
      speechSynthesis.getVoices();
      const w = new SpeechSynthesisUtterance(" ");
      w.volume = 0;
      speechSynthesis.speak(w);
    }
  } catch (e) {}
}, { once: true });

// En los siguientes gestos se estrenan (en tandas de 2) los efectos ya
// sintetizados; cuando están todos, el listener se retira solo.
document.addEventListener("pointerdown", function progressivePrime() {
  let primed = 0;
  for (const n of Object.keys(SFX_SPECS)) {
    if (primed >= 2) break;
    if (SFX[n] && !SFX_PRIMED[n]) { primeSfx(n); primed++; }
  }
  if (Object.keys(SFX_SPECS).every(n => SFX_PRIMED[n])) {
    document.removeEventListener("pointerdown", progressivePrime);
  }
});

/* Efectos de sonido.
   IMPORTANTE (iPhone): el interruptor de silencio mutea la Web Audio
   API pero NO los elementos <audio>. Por eso sintetizamos cada efecto
   como un WAV corto y lo reproducimos por <audio> (suena siempre),
   dejando la Web Audio API solo como respaldo. */

let audioCtx = null;
function beep(freqs, dur = 0.11, type = "triangle", gain = 0.16) {
  if (S.sound === false) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime + 0.01;
    freqs.forEach((f, i) => {
      const start = t0 + i * dur;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + 0.015);     // ataque
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur * 1.9); // cola
      o.connect(g); g.connect(audioCtx.destination);
      o.start(start);
      o.stop(start + dur * 2);
    });
  } catch (e) {}
}

/* Cada efecto se describe como segmentos de síntesis: tono (glissando
   f→f2), armónico de campana, ruido filtrado para el golpe físico y
   paneo estéreo. El "bus de mezcla" aplica masterización de videojuego:
   capa desafinada para anchura estéreo, reverb por peines de
   retroalimentación decorrelados por canal, saturación suave tipo
   limitador y normalización a ~-1 dBFS. Pesa cero bytes en assets. */
const SFX_SPECS = {
  // Toque al elegir una opción o ficha: golpecito con blip descendente.
  tap: [
    { noise: true, dur: 0.025, gain: 0.12 },
    { f: 950, f2: 700, dur: 0.055, gain: 0.22 },
  ],
  // Ficha colocada: burbuja ascendente.
  chip: [{ f: 480, f2: 900, dur: 0.08, gain: 0.28, harm: 0.2, pan: 0.15 }],
  // Acierto: campanitas do–mi–sol que viajan de izquierda a derecha.
  ok: [
    { f: 523.25, start: 0, dur: 0.1, gain: 0.34, harm: 0.35, pan: -0.5 },
    { f: 659.25, start: 0.07, dur: 0.1, gain: 0.34, harm: 0.35, pan: 0 },
    { f: 783.99, start: 0.14, dur: 0.13, gain: 0.34, harm: 0.35, pan: 0.5 },
    { f: 1567.98, start: 0.2, dur: 0.16, gain: 0.1, harm: 0.2, pan: 0.2 },
  ],
  // Fallo: "womp" descendente con capa subgrave, suave.
  ko: [
    { f: 220, f2: 145, dur: 0.24, type: "triangle", gain: 0.26 },
    { f: 110, f2: 72, dur: 0.24, gain: 0.16 },
  ],
  // Fallo rápido del modo Erronka: zumbido corto sin drama.
  buzz: [{ f: 190, f2: 150, dur: 0.1, type: "triangle", gain: 0.2 }],
  // Pareja emparejada: ding brillante doble.
  pair: [
    { f: 1174.66, dur: 0.08, gain: 0.26, harm: 0.4, pan: -0.2 },
    { f: 1567.98, start: 0.05, dur: 0.11, gain: 0.18, harm: 0.3, pan: 0.2 },
  ],
  // Hito de combo: glissando pentatónico que cruza el estéreo.
  combo: [
    { f: 523.25, start: 0, dur: 0.07, gain: 0.28, harm: 0.25, pan: -0.6 },
    { f: 587.33, start: 0.05, dur: 0.07, gain: 0.28, harm: 0.25, pan: -0.3 },
    { f: 659.25, start: 0.1, dur: 0.07, gain: 0.28, harm: 0.25, pan: 0 },
    { f: 783.99, start: 0.15, dur: 0.07, gain: 0.3, harm: 0.25, pan: 0.3 },
    { f: 1046.5, start: 0.2, dur: 0.16, gain: 0.32, harm: 0.35, pan: 0.6 },
  ],
  // Fin de lección: fanfarria en acordes anchos + campana final.
  win: [
    { f: 523.25, start: 0, dur: 0.12, gain: 0.2, harm: 0.3, pan: -0.4 },
    { f: 659.25, start: 0, dur: 0.12, gain: 0.2, harm: 0.3, pan: 0 },
    { f: 783.99, start: 0, dur: 0.12, gain: 0.2, harm: 0.3, pan: 0.4 },
    { f: 783.99, start: 0.16, dur: 0.1, gain: 0.2, harm: 0.3, pan: -0.25 },
    { f: 1046.5, start: 0.16, dur: 0.1, gain: 0.2, harm: 0.3, pan: 0.25 },
    { f: 1318.51, start: 0.3, dur: 0.28, gain: 0.26, harm: 0.4 },
  ],
  // Subida de nivel: campana grave + acorde que se abre + destello.
  level: [
    { f: 261.63, start: 0, dur: 0.3, gain: 0.24, harm: 0.4 },
    { f: 523.25, start: 0.12, dur: 0.18, gain: 0.2, harm: 0.35, pan: -0.5 },
    { f: 659.25, start: 0.18, dur: 0.18, gain: 0.2, harm: 0.35, pan: 0 },
    { f: 783.99, start: 0.24, dur: 0.2, gain: 0.22, harm: 0.35, pan: 0.5 },
    { f: 2093, start: 0.34, dur: 0.22, gain: 0.09, harm: 0.2 },
  ],
};

// Sintetiza los segmentos como un WAV PCM estéreo de 16 bits (44,1 kHz)
// con la cadena de masterización, y devuelve una URL blob.
function synthWavUrl(segments) {
  // 28 kHz: agudos nítidos hasta 14 kHz con un tercio del coste de 44,1 kHz
  // (la síntesis corre en el hilo principal de móviles modestos).
  const sr = 28000;
  const wantsReverb = segments.some(s => s.harm); // los blips secos no llevan reverb
  const end = Math.max(...segments.map(s => (s.start || 0) + (s.dur || 0.1))) + (wantsReverb ? 0.35 : 0.12);
  const total = Math.ceil(sr * end);
  const L = new Float32Array(total), R = new Float32Array(total);

  for (const s of segments) {
    const start = Math.floor((s.start || 0) * sr);
    const dur = s.dur || 0.1;
    const len = Math.floor(dur * 1.7 * sr);
    const gain = s.gain === undefined ? 0.3 : s.gain;
    const pan = s.pan || 0; // -1 izquierda … 1 derecha (ley de paneo cosenoidal)
    const gL = Math.cos((pan + 1) * Math.PI / 4);
    const gR = Math.sin((pan + 1) * Math.PI / 4);

    if (s.noise) {
      let lp = 0; // paso-bajo de un polo: golpe físico sin aspereza
      for (let n = 0; n < len && start + n < total; n++) {
        const t = n / sr;
        lp += 0.22 * ((Math.random() * 2 - 1) - lp);
        const v = lp * Math.exp(-t * 120) * gain * 3;
        L[start + n] += v * gL;
        R[start + n] += v * gR;
      }
      continue;
    }

    const f1 = s.f, f2 = s.f2 === undefined ? s.f : s.f2;
    let ph = 0, ph2 = 0, phD = 0;
    for (let n = 0; n < len && start + n < total; n++) {
      const t = n / sr;
      const f = f1 + (f2 - f1) * Math.min(1, t / dur);
      ph += (2 * Math.PI * f) / sr;
      ph2 += (2 * Math.PI * f * 2) / sr;
      phD += (2 * Math.PI * f * 1.006) / sr; // capa desafinada: anchura estéreo
      const env = Math.min(1, t / 0.006) * Math.exp(-t * (4.5 / dur));
      let v;
      if (s.type === "triangle") {
        const p = ph / (2 * Math.PI), frac = p - Math.floor(p);
        v = 4 * Math.abs(frac - 0.5) - 1;
      } else {
        v = Math.sin(ph);
      }
      if (s.harm) v += Math.sin(ph2) * s.harm;
      const dry = v * env * gain;
      const det = Math.sin(phD) * env * gain * 0.32;
      L[start + n] += (dry + det * 0.4) * gL;
      R[start + n] += (dry * 0.92 + det) * gR;
    }
  }

  // Reverb: peines de retroalimentación, decorrelados entre canales.
  // Solo para los sonidos musicales (con armónicos); los blips van secos.
  if (wantsReverb) {
    const combs = [
      { d: Math.floor(0.029 * sr), g: 0.30 },
      { d: Math.floor(0.047 * sr), g: 0.24 },
      { d: Math.floor(0.073 * sr), g: 0.18 },
    ];
    const wet = 0.22;
    [L, R].forEach((ch, ci) => {
      const dry = Float32Array.from(ch);
      for (const { d, g } of combs) {
        const off = ci === 1 ? Math.floor(d * 1.11) : d;
        for (let i = off; i < total; i++) {
          ch[i] += (dry[i - off] + ch[i - off] * 0.3) * g * wet;
        }
      }
    });
  }

  // Master: saturación suave (cohesión + límite). La normalización SOLO
  // atenúa: subir todo a -1 dB igualaría el volumen de los 9 efectos y
  // rompería la jerarquía diseñada en los gains (un tap no es una fanfarria).
  let peak = 0;
  for (let i = 0; i < total; i++) {
    L[i] = Math.tanh(L[i] * 1.35);
    R[i] = Math.tanh(R[i] * 1.35);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const norm = peak > 0.89 ? 0.89 / peak : 1;

  const buf = new ArrayBuffer(44 + total * 4);
  const v = new DataView(buf);
  const wstr = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  wstr(0, "RIFF"); v.setUint32(4, 36 + total * 4, true); wstr(8, "WAVE");
  wstr(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  wstr(36, "data"); v.setUint32(40, total * 4, true);
  for (let i = 0; i < total; i++) {
    v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i] * norm)) * 32767, true);
    v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i] * norm)) * 32767, true);
  }
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

const SFX = {};
function getSfx(name) {
  if (!SFX[name]) {
    const a = new Audio(synthWavUrl(SFX_SPECS[name]));
    a.setAttribute("playsinline", "");
    a.preload = "auto";
    SFX[name] = a;
  }
  return SFX[name];
}

function sfxFallback(name) {
  const fs = (SFX_SPECS[name] || []).filter(s => s.f).map(s => s.f).slice(0, 4);
  beep(fs.length ? fs : [600], 0.09, "triangle", 0.14);
}

function playSfx(name) {
  if (S.sound === false) return;
  try {
    const a = getSfx(name);
    a.currentTime = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => sfxFallback(name));
  } catch (e) {
    sfxFallback(name);
  }
}

const sfxOk = () => playSfx("ok");
const sfxKo = () => playSfx("ko");
const sfxWin = () => playSfx("win");

/* ---------------- Generación de ejercicios ---------------- */

// Devuelve n traducciones incorrectas (distractores) para una palabra.
function distractors(word, poolWords, field, n) {
  const cands = poolWords.filter(w => w[field] !== word[field] && w.eu !== word.eu);
  const global = COURSE.flatMap(u => u.words).filter(w => w[field] !== word[field] && w.eu !== word.eu);
  const base = cands.length >= n ? cands : global;
  const seen = new Set([word[field]]);
  const out = [];
  for (const w of shuffle(base)) {
    if (!seen.has(w[field])) { seen.add(w[field]); out.push(w[field]); }
    if (out.length === n) break;
  }
  return out;
}

function exChoice(word, pool, dir) {
  // dir "eu-es": se muestra euskera, se elige el español (y viceversa)
  const from = dir === "eu-es" ? "eu" : "es";
  const to = dir === "eu-es" ? "es" : "eu";
  const answer = word[to];
  const options = shuffle([answer, ...distractors(word, pool, to, 3)]);
  return {
    type: "choice",
    title: dir === "eu-es" ? "¿Qué significa esta palabra?" : "¿Cómo se dice en euskera?",
    promptText: word[from],
    speakText: dir === "eu-es" ? word.eu : null,
    options, answer,
    accepts: dir === "eu-es" && word.alt ? [answer, ...word.alt] : [answer],
    solution: `${word.eu} = ${word.es}`,
    wordKey: word.eu,
    speakOnCheck: dir === "es-eu" ? word.eu : null, // oír la respuesta en euskera
  };
}

function exListen(word, pool) {
  const options = shuffle([word.eu, ...distractors(word, pool, "eu", 3)]);
  return {
    type: "listen",
    title: "¿Qué has oído?",
    speakText: word.eu,
    options, answer: word.eu, accepts: [word.eu],
    solution: `${word.eu} = ${word.es}`,
    wordKey: word.eu,
  };
}

function exMatch(pool) {
  const pairs = sample(pool, Math.min(5, pool.length));
  return {
    type: "match",
    title: "Une las parejas",
    pairs,
  };
}

function exWordbank(phrase, unit) {
  const tokens = phrase.eu.split(" ");
  const others = unit.phrases.filter(p => p !== phrase).flatMap(p => p.eu.split(" "));
  const wordPool = unit.words.map(w => w.eu.split(" ")[0]);
  const extras = sample([...new Set([...others, ...wordPool])].filter(t => !tokens.includes(t)), 3);
  return {
    type: "wordbank",
    title: "Traduce esta frase al euskera",
    promptText: phrase.es,
    tokens: shuffle([...tokens, ...extras]),
    answer: phrase.eu,
    solution: phrase.eu,
    speakOnCheck: phrase.eu, // al comprobar, se lee cómo suena la frase
  };
}

function exType(item) {
  const accepts = [item.es, ...(item.alt || [])];
  return {
    type: "type",
    title: "Escribe la traducción en español",
    promptText: item.eu,
    speakText: item.eu,
    answer: item.es,
    accepts,
    solution: `${item.eu} = ${item.es}`,
    wordKey: item.eu,
  };
}

// Producción escrita: del español al euskera (lo que pide el examen).
function exTypeEU(item) {
  return {
    type: "type",
    title: "Escribe en euskera",
    promptText: item.es,
    answer: item.eu,
    accepts: [item.eu],
    solution: `${item.es} = ${item.eu}`,
    wordKey: item.eu,
    speakOnCheck: item.eu,
  };
}

// Comprensión auditiva de frase completa: escucha y elige el significado.
function exListenPhrase(phrase, unit) {
  const others = sample(unit.phrases.filter(p => p !== phrase), 3);
  const globalOthers = sample(COURSE.flatMap(u => u.phrases).filter(p => p.es !== phrase.es), 3);
  const wrong = (others.length >= 3 ? others : globalOthers).map(p => p.es).slice(0, 3);
  return {
    type: "listen",
    title: "Escucha la frase: ¿qué significa?",
    speakText: phrase.eu,
    options: shuffle([phrase.es, ...wrong]),
    answer: phrase.es,
    accepts: [phrase.es],
    solution: `${phrase.eu} = ${phrase.es}`,
  };
}

// Completar hueco con las estructuras gramaticales de la unidad.
function exDrill(d) {
  return {
    type: "fill",
    title: "Completa la frase",
    sentence: d.q,
    esText: d.hint ? `Pista: ${d.hint}` : "",
    options: shuffle(d.options.slice()),
    answer: d.answer,
    accepts: [d.answer],
    solution: d.q.replace("___", d.answer),
    speakOnCheck: d.q.replace("___", d.answer),
  };
}

// Completar hueco generado a partir de una frase de la unidad.
function exFillPhrase(phrase, unit) {
  const tokens = phrase.eu.split(" ");
  const idx = Math.floor(Math.random() * tokens.length);
  const answer = tokens[idx];
  const gapped = tokens.map((t, i) => (i === idx ? "___" : t)).join(" ");
  const pool = [...new Set([
    ...unit.phrases.flatMap(p => p.eu.split(" ")),
    ...unit.words.map(w => w.eu.split(" ")[0]),
  ])].filter(t => t !== answer);
  return {
    type: "fill",
    title: "Completa la frase",
    sentence: gapped,
    esText: `«${phrase.es}»`,
    options: shuffle([answer, ...sample(pool, 3)]),
    answer,
    accepts: [answer],
    solution: phrase.eu,
    speakOnCheck: phrase.eu,
  };
}

// Construye la lista de ejercicios de una lección.
function buildLesson(unit, lessonIdx) {
  const isReview = lessonIdx === LESSONS_PER_UNIT - 1;
  // Cada lección se centra en un subconjunto; el repaso usa toda la unidad.
  let words;
  if (isReview) {
    words = shuffle(unit.words);
  } else {
    const per = Math.ceil(unit.words.length / (LESSONS_PER_UNIT - 1));
    const focus = unit.words.slice(lessonIdx * per, lessonIdx * per + per);
    words = shuffle([...focus, ...sample(unit.words, 3)]);
    words = [...new Set(words)];
  }

  const exs = [];
  const w = () => pick(words);
  const drills = DRILLS[unit.id] || [];

  exs.push(exChoice(w(), unit.words, "eu-es"));
  exs.push(exChoice(w(), unit.words, "es-eu"));
  exs.push(exListen(w(), unit.words));
  if (drills.length) exs.push(exDrill(drills[(lessonIdx * 2) % drills.length]));
  exs.push(exMatch(unit.words));
  if (unit.phrases.length) exs.push(exWordbank(pick(unit.phrases), unit));
  // Alterna comprensión (eu→es) y producción (es→eu), como el examen.
  exs.push(lessonIdx % 2 === 1 ? exTypeEU(w()) : exType(w()));
  if (unit.phrases.length) exs.push(exFillPhrase(pick(unit.phrases), unit));
  // Desde la 2ª lección, la escucha pasa a frases completas.
  exs.push(lessonIdx >= 1 && unit.phrases.length ? exListenPhrase(pick(unit.phrases), unit) : exListen(w(), unit.words));
  if (drills.length > 1) exs.push(exDrill(drills[(lessonIdx * 2 + 1) % drills.length]));
  exs.push(exChoice(w(), unit.words, "eu-es"));

  return exs.slice(0, EXERCISES_PER_LESSON);
}

// Práctica inteligente: primero las palabras cuyo repaso ha vencido
// (repaso espaciado), después las más débiles o nunca practicadas.
function practiceQueue(n) {
  const due = shuffle(dueWords());
  const seen = new Set(due.map(w => w.eu));
  const rest = weakestWords(n * 2).filter(w => !seen.has(w.eu));
  return [...due, ...rest].slice(0, n);
}

function buildPractice() {
  const pool = learnedWords();
  const words = practiceQueue(8);
  const exs = words.map((word, i) => {
    const kind = i % 4;
    if (kind === 0) return exChoice(word, pool, "eu-es");
    if (kind === 1) return exChoice(word, pool, "es-eu");
    if (kind === 2) return exListen(word, pool);
    return exType(word);
  });
  return shuffle(exs);
}

// Examen A1: preguntas variadas de todas las unidades del nivel.
function buildExam() {
  const pool = COURSE.flatMap(u => u.words);
  const exs = [];
  for (let i = 0; i < EXAM_A1.size; i++) {
    const u = pick(COURSE);
    const w = pick(u.words);
    const k = i % 7;
    if (k === 0) exs.push(exChoice(w, pool, "eu-es"));
    else if (k === 1) exs.push(exChoice(w, pool, "es-eu"));
    else if (k === 2) exs.push(exListenPhrase(pick(u.phrases), u));
    else if (k === 3) exs.push(exWordbank(pick(u.phrases), u));
    else if (k === 4) exs.push(i % 2 ? exTypeEU(w) : exType(w));
    else if (k === 5) exs.push(exListen(w, pool));
    else {
      const drills = DRILLS[u.id];
      exs.push(drills && drills.length ? exDrill(pick(drills)) : exChoice(w, pool, "eu-es"));
    }
  }
  return shuffle(exs);
}

/* ---------------- Sesión de lección ---------------- */

let route = { view: "home", tab: "learn" };
let session = null;

function startLesson(unitIdx, lessonIdx) {
  refreshHearts();
  if (S.hearts <= 0) { showNoHeartsModal(); return; }
  const unit = COURSE[unitIdx];
  session = {
    mode: "lesson",
    unitIdx, lessonIdx,
    exercises: buildLesson(unit, lessonIdx),
    current: 0,
    correct: 0,
    wrong: 0,
    combo: 0,
    bestCombo: 0,
    checked: false,
  };
  route = { view: "lesson" };
  render();
}

function startExam() {
  if (!allUnitsDone()) { toast("Completa todas las unidades para desbloquear el examen 🎓"); return; }
  session = {
    mode: "exam",
    exercises: buildExam(),
    current: 0, correct: 0, wrong: 0, combo: 0, bestCombo: 0, checked: false,
  };
  route = { view: "lesson" };
  render();
}

/* ---------------- Mini-historias ---------------- */

function storyUnlocked(st) { return (S.progress[st.unit] || 0) > 0; }

function openStory(id) {
  const st = STORIES.find(s => s.id === id);
  if (!st || !storyUnlocked(st)) { toast("Empieza antes su unidad para desbloquearla 📖"); return; }
  route = { view: "story", storyId: id };
  render();
}

function startStoryQuiz(story) {
  session = {
    mode: "story",
    storyId: story.id,
    exercises: story.questions.map(q => ({
      type: "choice",
      title: q.q,
      options: shuffle(q.options.slice()),
      answer: q.answer,
      accepts: [q.answer],
      solution: q.answer,
    })),
    current: 0, correct: 0, wrong: 0, combo: 0, bestCombo: 0, checked: false,
  };
  route = { view: "lesson" };
  render();
}

function renderStoryRead() {
  const story = STORIES.find(s => s.id === route.storyId);
  if (!story) { route = { view: "home", tab: "practice" }; render(); return; }
  app.innerHTML = `
    <div class="lesson-top">
      <button class="quit-btn" id="quit" aria-label="Volver">✕</button>
      <div style="flex:1;text-align:center;font-weight:900">${story.icon} ${esc(story.title)}</div>
      <div style="width:38px"></div>
    </div>
    <div class="story">
      <p class="page-sub" style="text-align:center">Toca 🔊 para escuchar cada línea.<br>Lee el diálogo y responde a las preguntas.</p>
      ${story.lines.map((l, i) => `
        <div class="story-line ${i % 2 ? "right" : ""}">
          <div class="story-who">${l.who}</div>
          <div class="story-bubble">
            <button class="story-say" data-say="${esc(l.eu)}" aria-label="Escuchar">🔊</button>
            <div class="story-eu">${esc(l.eu)}</div>
            <div class="story-es" hidden>${esc(l.es)}</div>
          </div>
        </div>`).join("")}
      <div class="story-actions">
        <button class="btn btn-ghost" id="story-trans">👁 Mostrar traducción</button>
        <button class="btn btn-primary" id="story-quiz">Responder preguntas ${S.stories[story.id] ? "otra vez" : ""}</button>
      </div>
    </div>`;
  document.getElementById("quit").addEventListener("click", () => { route = { view: "home", tab: "practice" }; render(); });
  app.querySelectorAll("[data-say]").forEach(b => b.addEventListener("click", () => speak(b.dataset.say)));
  let shown = false;
  document.getElementById("story-trans").addEventListener("click", () => {
    shown = !shown;
    app.querySelectorAll(".story-es").forEach(e => { e.hidden = !shown; });
    document.getElementById("story-trans").textContent = shown ? "🙈 Ocultar traducción" : "👁 Mostrar traducción";
  });
  document.getElementById("story-quiz").addEventListener("click", () => startStoryQuiz(story));
}

/* ---------------- ⚡ Erronka: reto contrarreloj de 60 s ----------------
   Respuesta al toque, sin botón de comprobar: aprendizaje acelerado.
   Cada respuesta alimenta también el repaso espaciado. */

const BLITZ_MS = 60000;

function startBlitz() {
  if (learnedWords().length < 8) { toast("Completa un par de lecciones para desbloquear el reto ⚡"); return; }
  session = {
    mode: "blitz",
    score: 0, combo: 0, answered: 0,
    endAt: Date.now() + (window.BLITZ_MS_OVERRIDE || BLITZ_MS),
    timer: null,
    locked: false,
  };
  route = { view: "blitz" };
  render();
}

function renderBlitz() {
  const s = session;
  app.innerHTML = `
    <div class="lesson-top">
      <button class="quit-btn" id="quit" aria-label="Salir">✕</button>
      <div class="progress-track"><div class="progress-fill blitz-fill" id="blitz-time" style="width:100%"></div></div>
      <div class="blitz-score" id="blitz-score">⚡ 0</div>
    </div>
    <div class="exercise" id="exercise"></div>`;
  document.getElementById("quit").addEventListener("click", () => {
    clearInterval(s.timer);
    clearTimeout(s.qTimer);
    session = null;
    saveState(); // las respuestas ya dadas alimentaron el repaso espaciado
    route = { view: "home", tab: "practice" };
    render();
  });
  s.timer = setInterval(() => {
    if (!session || session.mode !== "blitz") { clearInterval(s.timer); return; }
    const left = Math.max(0, s.endAt - Date.now());
    const bar = document.getElementById("blitz-time");
    if (bar) bar.style.width = (left / (window.BLITZ_MS_OVERRIDE || BLITZ_MS)) * 100 + "%";
    if (left <= 0) endBlitz();
  }, 100);
  nextBlitzQuestion();
}

function nextBlitzQuestion() {
  const s = session;
  if (!s || s.mode !== "blitz") return;
  const pool = learnedWords();
  const word = pick(pool);
  const ex = exChoice(word, pool, Math.random() < 0.5 ? "eu-es" : "es-eu");
  s.locked = false;
  const box = document.getElementById("exercise");
  if (!box) return;
  box.innerHTML = `
    <h1 class="blitz-q">${esc(ex.title)}</h1>
    <div class="prompt-line"><span class="prompt-word">${esc(ex.promptText)}</span></div>
    <div class="options">
      ${ex.options.map((o, i) => `
        <button class="option" data-opt="${esc(o)}"><span class="opt-num">${i + 1}</span>${esc(o)}</button>`).join("")}
    </div>`;
  box.querySelectorAll(".option").forEach(btn => btn.addEventListener("click", () => {
    if (s.locked) return;
    s.locked = true;
    const ok = (ex.accepts || [ex.answer]).some(a => normalize(a) === normalize(btn.dataset.opt));
    s.answered++;
    noteWord(ex.wordKey, ok); // el reto también alimenta el repaso espaciado
    box.querySelectorAll(".option").forEach(b => { b.disabled = true; });
    if (ok) {
      s.combo++;
      s.score += 1 + Math.floor(s.combo / 5); // el combo acelera la puntuación
      btn.classList.add("correct");
      playSfx(s.combo % 5 === 0 ? "combo" : "pair");
      if (s.combo >= 3) floatText(btn, `🔥 x${s.combo}`, "#ff9600");
    } else {
      s.combo = 0;
      btn.classList.add("wrong");
      box.querySelectorAll(".option").forEach(b => {
        if ((ex.accepts || [ex.answer]).some(a => normalize(a) === normalize(b.dataset.opt))) b.classList.add("correct");
      });
      playSfx("buzz");
    }
    const sc = document.getElementById("blitz-score");
    if (sc) sc.textContent = `⚡ ${s.score}`;
    // ligado a ESTA partida: un timeout huérfano no debe disparar en otra
    s.qTimer = setTimeout(() => { if (session === s) nextBlitzQuestion(); }, ok ? 220 : 650);
  }));
}

function endBlitz() {
  const s = session;
  if (!s || s.mode !== "blitz") return;
  clearInterval(s.timer);
  clearTimeout(s.qTimer);
  const record = s.score > (S.blitzBest || 0);
  if (record) S.blitzBest = s.score;
  const xp = Math.min(40, s.score);
  if (xp > 0) { addXp(xp); bumpStreak(); }
  checkBadges();
  saveState();
  // siempre "win": si además hay subida de nivel, el overlay reproducirá
  // "level" y no deben pisarse (comparten elemento de audio)
  playSfx("win");
  route = { view: "results", blitz: true, score: s.score, record, xp, answered: s.answered };
  session = null;
  render();
}

function startPractice() {
  if (!learnedWords().length) { toast("Completa primero una lección 🙂"); return; }
  session = {
    mode: "practice",
    exercises: buildPractice(),
    current: 0, correct: 0, wrong: 0, combo: 0, bestCombo: 0, checked: false,
  };
  route = { view: "lesson" };
  render();
}

function quitLesson() {
  session = null;
  route = { view: "home", tab: "learn" };
  render();
}

function finishLesson() {
  const s = session;
  const total = s.correct + s.wrong;
  const acc = total ? Math.round((s.correct / total) * 100) : 100;
  let xp = 0, gems = 0;

  // Extra de resultados: canción de la unidad si queda alguna por
  // descubrir; si no, una curiosidad cultural.
  let music = null;
  if (s.mode === "lesson") music = pickMusic(COURSE[s.unitIdx].id);
  else if (s.mode === "practice" && Math.random() < 0.35) music = pickMusic(null);
  if (music) S.musicShown[music.id] = true;
  const tip = music ? null : pick(TIPS);
  const failedExs = (s.failedExs || []).slice(0, 10);

  if (s.mode === "redo") {
    xp = 3 + Math.min(3, s.bestCombo);
    addXp(xp);
    bumpStreak();
    checkBadges();
    saveState();
    sfxWin();
    route = { view: "results", xp, gems: 0, acc, perfect: s.wrong === 0, mode: "redo", tip, failedExs };
    session = null;
    render();
    return;
  }

  if (s.mode === "lesson") {
    xp = 10 + s.bestCombo;
    if (s.wrong === 0) { xp += 5; S.perfects++; } // bonus perfecto
    gems = s.wrong === 0 ? 10 : 5;
    addXp(xp); S.gems += gems;
    bumpStreak();
    const unit = COURSE[s.unitIdx];
    const done = S.progress[unit.id] || 0;
    if (s.lessonIdx === done) S.progress[unit.id] = done + 1; // avanza solo la siguiente pendiente
  } else if (s.mode === "exam") {
    if (s.wrong > EXAM_A1.maxErrors) { failExam(); return; }
    xp = EXAM_A1.xp; gems = EXAM_A1.gems;
    addXp(xp); S.gems += gems;
    S.progress[EXAM_A1.id] = 1;
    bumpStreak();
    checkBadges();
    saveState();
    sfxWin();
    const nota = Math.round((s.correct / (s.correct + s.wrong)) * 10 * 10) / 10;
    route = { view: "results", exam: true, xp, gems, acc, nota, perfect: s.wrong === 0, tip, music, failedExs };
    session = null;
    render();
    return;
  } else if (s.mode === "story") {
    const first = !S.stories[s.storyId];
    xp = first ? 10 : 5;
    gems = first ? 5 : 0;
    S.stories[s.storyId] = true;
    addXp(xp); S.gems += gems;
    bumpStreak();
  } else {
    xp = 5 + Math.min(5, s.bestCombo);
    addXp(xp);
    if (S.hearts < MAX_HEARTS) { S.hearts += 1; } // practicar recupera 1 vida
    bumpStreak();
  }
  checkBadges();
  saveState();
  sfxWin();
  route = { view: "results", xp, gems, acc, perfect: s.wrong === 0, mode: s.mode, tip, music, failedExs };
  session = null;
  render();
}

// Repaso inmediato de los ejercicios fallados: corregir el error en
// caliente es de lo más efectivo que hay para fijarlo.
function startRedo(exs) {
  if (!exs || !exs.length) return;
  session = {
    mode: "redo",
    exercises: shuffle(exs),
    current: 0, correct: 0, wrong: 0, combo: 0, bestCombo: 0, checked: false,
  };
  route = { view: "lesson" };
  render();
}

function failLesson() {
  session = null;
  route = { view: "results", failed: true };
  render();
}

function failExam() {
  session = null;
  route = { view: "results", examFailed: true };
  render();
}

/* ---------------- Render raíz ---------------- */

const app = document.getElementById("app");

function render() {
  clearLevelUp(); // al cambiar de vista, la celebración pendiente no debe tapar nada
  refreshHearts();
  refreshStreak();
  if (route.view === "lesson") renderLesson();
  else if (route.view === "results") renderResults();
  else if (route.view === "story") renderStoryRead();
  else if (route.view === "blitz") renderBlitz();
  else renderHome();
  window.scrollTo(0, 0);
}

function headerHTML() {
  return `
    <header class="topbar"><div class="topbar-inner">
      <div class="logo"><span>🦉</span> euskaltxo</div>
      <div class="stats">
        <div class="stat streak ${S.streak > 0 && S.lastDay === todayStr() ? "lit" : ""}" title="Racha de días"><span class="ico">🔥</span>${S.streak}</div>
        <div class="stat gems" title="Gemas"><span class="ico">💎</span>${S.gems}</div>
        <div class="stat hearts" title="Vidas"><span class="ico">❤️</span>${S.hearts}</div>
      </div>
    </div></header>`;
}

function navHTML(tab) {
  const due = dueWords().length;
  const items = [
    { id: "learn", ico: "🏠", label: "Aprender" },
    { id: "words", ico: "📖", label: "Palabras" },
    { id: "practice", ico: "💪", label: "Práctica", badge: due },
    { id: "profile", ico: "👤", label: "Perfil" },
  ];
  return `
    <nav class="bottomnav"><div class="bottomnav-inner">
      ${items.map(i => `
        <button class="nav-btn ${tab === i.id ? "active" : ""}" data-nav="${i.id}">
          <span class="ico">${i.ico}${i.badge ? `<span class="nav-badge">${i.badge > 99 ? "99+" : i.badge}</span>` : ""}</span>${i.label}
        </button>`).join("")}
    </div></nav>`;
}

/* ---------------- Vista: inicio / camino ---------------- */

function renderHome() {
  const tab = route.tab || "learn";
  let body = "";
  if (tab === "learn") body = pathHTML();
  else if (tab === "words") body = vocabHTML();
  else if (tab === "practice") body = practiceHTML();
  else body = profileHTML();

  app.innerHTML = headerHTML() + `<main class="main">${body}</main>` + navHTML(tab);

  app.querySelectorAll("[data-nav]").forEach(b =>
    b.addEventListener("click", () => { route = { view: "home", tab: b.dataset.nav }; render(); }));

  app.querySelectorAll("[data-lesson]").forEach(b =>
    b.addEventListener("click", () => {
      const [ui, li] = b.dataset.lesson.split(":").map(Number);
      startLesson(ui, li);
    }));

  app.querySelectorAll("[data-grammar]").forEach(b =>
    b.addEventListener("click", () => showGrammarModal(COURSE[Number(b.dataset.grammar)])));

  const ex = app.querySelector("[data-exam]");
  if (ex) ex.addEventListener("click", startExam);

  const pb = app.querySelector("#practice-start");
  if (pb) pb.addEventListener("click", startPractice);

  const rs = app.querySelector("#reset-progress");
  if (rs) rs.addEventListener("click", () => {
    if (confirm("¿Seguro que quieres borrar todo tu progreso?")) {
      S = defaultState(); saveState(); render();
    }
  });

  const refill = app.querySelector("#refill-hearts");
  if (refill) refill.addEventListener("click", tryRefillHearts);

  const frz = app.querySelector("#buy-freeze");
  if (frz) frz.addEventListener("click", buyFreeze);

  const bz = app.querySelector("#blitz-start");
  if (bz) bz.addEventListener("click", startBlitz);

  app.querySelectorAll("[data-story]").forEach(b =>
    b.addEventListener("click", () => openStory(b.dataset.story)));

  app.querySelectorAll("[data-verb]").forEach(b =>
    b.addEventListener("click", () => showVerbModal(VERB_TABLES.find(v => v.id === b.dataset.verb))));

  app.querySelectorAll("[data-mn]").forEach(b =>
    b.addEventListener("click", () => {
      const line = b.closest(".vocab-main").querySelector(".vocab-mn");
      if (line) line.hidden = !line.hidden;
    }));

  const vs = app.querySelector("#vocab-search");
  if (vs) vs.addEventListener("input", () => {
    const q = normalize(vs.value);
    app.querySelectorAll(".vocab-row").forEach(r => {
      r.style.display = !q || r.dataset.search.includes(q) ? "" : "none";
    });
  });

  app.querySelectorAll("[data-say]").forEach(b =>
    b.addEventListener("click", () => speak(b.dataset.say)));

  const owl = app.querySelector(".hero-owl");
  if (owl) owl.addEventListener("click", () => {
    owl.classList.remove("wiggle");
    void owl.offsetWidth; // reinicia la animación
    owl.classList.add("wiggle");
    speak("Kaixo!");
    burst(owl, { emoji: ["💚", "✨"], n: 8 });
  });

  const snd = app.querySelector("#toggle-sound");
  if (snd) snd.addEventListener("click", () => {
    S.sound = S.sound === false ? true : false;
    saveState(); render();
    if (S.sound !== false) playSfx("ok"); // muestra de cómo suena
  });

  const upd = app.querySelector("#check-update");
  if (upd) upd.addEventListener("click", checkForUpdate);
  const thm = app.querySelector("#toggle-theme");
  if (thm) thm.addEventListener("click", () => {
    S.theme = S.theme === "auto" ? "dark" : S.theme === "dark" ? "light" : "auto";
    saveState(); applyTheme(); render();
  });
  const exp = app.querySelector("#export-progress");
  if (exp) exp.addEventListener("click", exportProgress);
  const imp = app.querySelector("#import-progress");
  if (imp) imp.addEventListener("click", importProgress);
}

function goalCardHTML() {
  const g = Math.min(goalToday(), DAILY_GOAL_XP);
  const met = g >= DAILY_GOAL_XP;
  return `
    <section class="goal-card ${met ? "met" : ""}">
      <span class="goal-ico">${met ? "✅" : "🎯"}</span>
      <div style="flex:1">
        <div class="goal-title">Meta diaria ${met ? "— ¡cumplida!" : ""}</div>
        <div class="goal-bar"><div style="width:${Math.round((g / DAILY_GOAL_XP) * 100)}%"></div></div>
      </div>
      <span class="goal-num">${g}/${DAILY_GOAL_XP} XP</span>
    </section>`;
}

function vocabHTML() {
  const units = COURSE.filter(u => (S.progress[u.id] || 0) > 0);
  if (!units.length) {
    return `<div class="results" style="padding-top:40px">
      <div class="big-emoji">📖</div>
      <h1 style="color:var(--blue)">Palabras</h1>
      <p class="sub">Completa tu primera lección y aquí verás<br>todas las palabras aprendidas con su fuerza.</p>
    </div>`;
  }
  return `
    <h1 class="page-title">📖 Tus palabras</h1>
    <p class="page-sub">Toca 🔊 para escuchar. La barra muestra cómo la llevas: practica las débiles en la pestaña Práctica.</p>
    <div class="profile-card">
      <h2>🔤 Verbos esenciales</h2>
      <div class="verb-btns">
        ${VERB_TABLES.map(v => `<button class="verb-btn" data-verb="${v.id}">${esc(v.label)}</button>`).join("")}
      </div>
    </div>
    <input class="vocab-search" id="vocab-search" type="search" placeholder="🔍 Buscar palabra en euskera o español…" autocomplete="off">
    ${units.map(u => `
      <div class="profile-card">
        <h2>${u.icon} ${esc(u.title)}</h2>
        ${u.words.map(w => {
          const st = S.wordStats[w.eu];
          const pct = st ? Math.round(wordStrength(w.eu) * 100) : 0;
          const color = !st ? "var(--gray-2)" : pct >= 75 ? "var(--green)" : pct >= 40 ? "var(--gold)" : "var(--red)";
          const mn = getMn(w.eu);
          return `
            <div class="vocab-row" data-search="${esc(normalize(w.eu + " " + w.es))}">
              <button class="vocab-say" data-say="${esc(w.eu)}" aria-label="Escuchar ${esc(w.eu)}">🔊</button>
              <div class="vocab-main">
                <div class="vocab-line">
                  <span class="vocab-eu">${esc(w.eu)}</span>
                  <span class="vocab-es">${esc(w.es)}</span>
                  <div class="mini-bar"><div style="width:${st ? Math.max(pct, 8) : 0}%;background:${color}"></div></div>
                  ${mn ? `<button class="mn-toggle" data-mn aria-label="Truco de memoria">💡</button>` : ""}
                </div>
                ${mn ? `<div class="vocab-mn" hidden>💡 ${esc(mn)}</div>` : ""}
              </div>
            </div>`;
        }).join("")}
      </div>`).join("")}`;
}

// Saludo según la hora, en euskera y con su traducción: cada visita enseña.
function heroHTML() {
  const h = new Date().getHours();
  const eu = h >= 6 && h < 14 ? "Egun on" : h >= 14 && h < 21 ? "Arratsalde on" : "Gabon";
  const es = { "Egun on": "buenos días", "Arratsalde on": "buenas tardes", "Gabon": "buenas noches" }[eu];
  const sub = S.streak > 0
    ? `«${es}» · Llevas ${S.streak} día${S.streak === 1 ? "" : "s"} de racha, ¡a por hoy! 🔥`
    : `«${es}» · Una lección hoy y la racha empieza a arder 🔥`;
  return `
    <section class="hero">
      <div class="hero-owl">🦉</div>
      <div>
        <h1>${eu}!</h1>
        <p>${sub}</p>
      </div>
    </section>`;
}

// Frase del día: rota con la fecha sobre todas las frases del curso.
function potdHTML() {
  const pool = COURSE.flatMap(u => u.phrases);
  const p = pool[Math.floor(Date.now() / 86400000) % pool.length];
  return `
    <section class="potd">
      <span class="potd-ico">✨</span>
      <div style="flex:1">
        <div class="potd-eu">${esc(p.eu)}</div>
        <div class="potd-es">${esc(p.es)} · frase del día</div>
      </div>
      <button class="vocab-say" data-say="${esc(p.eu)}" aria-label="Escuchar la frase del día">🔊</button>
    </section>`;
}

function pathHTML() {
  const a1 = LEVELS[0];
  let html = heroHTML() + goalCardHTML() + potdHTML() + `
    <section class="level-banner">
      <div class="level-badge">A1</div>
      <div>
        <h2>${esc(a1.title)}</h2>
        <p>${esc(a1.desc)}</p>
        <div class="level-progress"><div style="width:${a1Pct()}%"></div></div>
        <span class="level-pct">${a1Pct()}% completado${examPassed() ? " · 🎓 aprobado" : ""}</span>
      </div>
    </section>`;
  COURSE.forEach((unit, ui) => {
    const unlocked = unitUnlocked(ui);
    const done = S.progress[unit.id] || 0;
    html += `
      <section class="unit-header" style="background:${unit.color}">
        <div>
          <h2>Unidad ${ui + 1} · ${esc(unit.title)}</h2>
          <p>${esc(unit.subtitle)}</p>
        </div>
        <div class="unit-side">
          <div class="unit-icon">${unit.icon}</div>
          ${unit.grammar ? `<button class="grammar-btn" data-grammar="${ui}" aria-label="Gramática de la unidad">📖 Gramática</button>` : ""}
        </div>
      </section>
      <div class="lesson-path">`;
    for (let li = 0; li < LESSONS_PER_UNIT; li++) {
      const isDone = li < done;
      const isNext = unlocked && li === done;
      const isLocked = !unlocked || li > done;
      const isReview = li === LESSONS_PER_UNIT - 1;
      const icon = isReview ? "🏆" : (isDone ? "⭐" : (isNext ? unit.icon : "🔒"));
      const label = isReview ? "Repaso" : `Lección ${li + 1}`;
      html += `
        <div class="lesson-node">
          ${isNext ? `<div class="start-bubble">Empezar</div>` : ""}
          <button class="lesson-btn ${isLocked ? "locked" : ""} ${isDone ? "done" : ""}"
            style="background:${unit.color}"
            ${isLocked ? "disabled" : `data-lesson="${ui}:${li}"`}
            aria-label="${esc(unit.title)} — ${label}">
            ${icon}
            ${isDone ? `<span class="check-badge">✓</span>` : ""}
          </button>
          <span class="lesson-label">${label}</span>
        </div>`;
    }
    html += `</div>`;
  });

  // Nodo del examen final A1
  const examOpen = allUnitsDone();
  const passed = examPassed();
  html += `
    <section class="unit-header" style="background:#3c3c3c">
      <div>
        <h2>🎓 ${esc(EXAM_A1.title)}</h2>
        <p>${esc(EXAM_A1.subtitle)} — ${EXAM_A1.size} preguntas, máximo ${EXAM_A1.maxErrors} fallos</p>
      </div>
      <div class="unit-icon">📜</div>
    </section>
    <div class="lesson-path">
      <div class="lesson-node">
        ${examOpen && !passed ? `<div class="start-bubble">¡Examen!</div>` : ""}
        <button class="lesson-btn exam-btn ${!examOpen ? "locked" : ""} ${passed ? "done" : ""}"
          style="background:#3c3c3c" ${!examOpen ? "disabled" : `data-exam="1"`}
          aria-label="Examen A1">
          ${passed ? "🏅" : (examOpen ? "🎓" : "🔒")}
          ${passed ? `<span class="check-badge">✓</span>` : ""}
        </button>
        <span class="lesson-label">${passed ? "¡Aprobado!" : "Examen A1"}</span>
      </div>
    </div>`;

  // Niveles futuros bloqueados
  for (const lvl of LEVELS.slice(1)) {
    html += `
      <section class="locked-level">
        <div class="level-badge locked">${lvl.id}</div>
        <div>
          <h2>🔒 ${esc(lvl.title)}</h2>
          <p>${esc(lvl.desc)}</p>
        </div>
      </section>`;
  }
  return html;
}

function showVerbModal(v) {
  if (!v) return;
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `
    <div class="modal">
      <div class="modal-emoji">🔤</div>
      <h2>${esc(v.label)}</h2>
      <p>${esc(v.note)}</p>
      <div class="verb-table">
        ${v.rows.map(r => `<div class="verb-row"><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join("")}
      </div>
      <button class="btn btn-primary btn-full" id="v-close">Entendido</button>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector("#v-close").addEventListener("click", () => wrap.remove());
  wrap.addEventListener("click", e => { if (e.target === wrap) wrap.remove(); });
}

function showGrammarModal(unit) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `
    <div class="modal grammar-modal">
      <div class="modal-emoji">${unit.icon}</div>
      <h2>${esc(unit.title)}</h2>
      ${unit.grammar.map(g => `
        <div class="grammar-item">
          <h3>${esc(g.title)}</h3>
          <p>${esc(g.body)}</p>
          ${(g.examples || []).map(e => `
            <div class="grammar-example"><b>${esc(e.eu)}</b><span>${esc(e.es)}</span></div>`).join("")}
        </div>`).join("")}
      <button class="btn btn-primary btn-full" id="g-close">Entendido</button>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector("#g-close").addEventListener("click", () => wrap.remove());
  wrap.addEventListener("click", e => { if (e.target === wrap) wrap.remove(); });
}

function practiceHTML() {
  const n = learnedWords().length;
  const due = dueWords().length;
  const freezes = S.streakFreezes || 0;
  return `
    <h1 class="page-title">💪 Práctica</h1>
    <p class="page-sub">Repaso espaciado: la app te trae cada palabra justo cuando estás a punto de olvidarla. No gasta vidas y devuelve <b>+1 ❤️</b>.</p>

    <section class="due-card ${due ? "has-due" : ""}">
      <span class="due-ico">${due ? "🔔" : "✅"}</span>
      <div style="flex:1">
        <div class="due-title">${due
          ? `${due} palabra${due === 1 ? "" : "s"} espera${due === 1 ? "" : "n"} repaso hoy`
          : n ? "Sin repasos pendientes — ¡al día!" : "Completa una lección para empezar"}</div>
        <div class="due-sub">${n} palabra${n === 1 ? "" : "s"} en tu colección</div>
      </div>
      <button class="btn btn-blue" id="practice-start">Practicar</button>
    </section>

    ${S.hearts < MAX_HEARTS ? `
      <button class="btn btn-ghost btn-full settings-btn" id="refill-hearts">💎 ${HEART_REFILL_COST} — Recargar vidas</button>` : ""}

    <section class="due-card blitz-banner">
      <span class="due-ico">⚡</span>
      <div style="flex:1">
        <div class="due-title">Erronka! Reto de 60 segundos</div>
        <div class="due-sub">Respuestas al toque, combos ×2 · Récord: <b>${S.blitzBest || 0}</b></div>
      </div>
      <button class="btn btn-blue" id="blitz-start">Jugar</button>
    </section>

    <section class="freeze-card">
      <span class="due-ico">🧊</span>
      <div style="flex:1">
        <div class="due-title">Protector de racha: ${freezes}/${MAX_FREEZES}</div>
        <div class="due-sub">Salva tu racha un día que no practiques</div>
      </div>
      <button class="btn btn-ghost" id="buy-freeze">💎 ${FREEZE_COST}</button>
    </section>

    <h2 class="section-title">📖 Mini-historias</h2>
    <p class="page-sub">Diálogos reales de nivel A1 con preguntas de comprensión, como en el examen. Se desbloquean al empezar su unidad.</p>
    <div class="stories-grid">
      ${STORIES.map(st => {
        const open = storyUnlocked(st);
        const done = !!S.stories[st.id];
        return `
          <button class="story-card ${open ? "" : "locked"}" data-story="${st.id}" ${open ? "" : "disabled"}>
            <span class="story-ico">${open ? st.icon : "🔒"}</span>
            <span class="story-name">${esc(st.title)}</span>
            <span class="story-state">${done ? "✓ completada" : open ? "▶ leer" : "bloqueada"}</span>
          </button>`;
      }).join("")}
    </div>`;
}

function profileHTML() {
  const lv = level();
  return `
    <div class="profile-card">
      <h2>👤 Tu progreso</h2>
      <div class="profile-stats">
        <div class="pstat"><span class="ico">⚡</span><div><div class="val">${S.xp} XP</div><div class="lbl">experiencia total</div></div></div>
        <div class="pstat"><span class="ico">🔥</span><div><div class="val">${S.streak} día${S.streak === 1 ? "" : "s"}</div><div class="lbl">racha actual</div></div></div>
        <div class="pstat"><span class="ico">💎</span><div><div class="val">${S.gems}</div><div class="lbl">gemas</div></div></div>
        <div class="pstat"><span class="ico">📚</span><div><div class="val">${totalLessonsDone()}</div><div class="lbl">lecciones completadas</div></div></div>
      </div>
      <div style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;color:var(--gray-4)">
          <span>Nivel ${lv}</span><span>${levelPct()}/100 XP</span>
        </div>
        <div class="level-bar"><div style="width:${levelPct()}%"></div></div>
      </div>
    </div>
    <div class="profile-card">
      <h2>🎓 Nivel A1 (HEOC/HABE)</h2>
      <div class="unit-progress-row">
        <span class="ico">${examPassed() ? "🏅" : "📜"}</span>
        <span class="name">${examPassed() ? "¡Nivel A1 aprobado!" : "Nivel A1 en curso"}</span>
        <div class="mini-bar"><div style="width:${a1Pct()}%;background:var(--gold)"></div></div>
        <span class="pct">${a1Pct()}%</span>
      </div>
    </div>
    <div class="profile-card">
      <h2>🗺️ Unidades</h2>
      ${COURSE.map(u => {
        const done = S.progress[u.id] || 0;
        const pct = Math.round((done / LESSONS_PER_UNIT) * 100);
        return `
          <div class="unit-progress-row">
            <span class="ico">${u.icon}</span>
            <span class="name">${esc(u.title)}</span>
            <div class="mini-bar"><div style="width:${pct}%;background:${u.color}"></div></div>
            <span class="pct">${pct}%</span>
          </div>`;
      }).join("")}
    </div>
    <div class="profile-card">
      <h2>🎵 Tu playlist en euskera</h2>
      ${(() => {
        const discovered = MUSIC.filter(m => S.musicShown[m.id]);
        if (!discovered.length) return `<p class="page-sub" style="margin:0">Completa lecciones para ir descubriendo canciones en euskera relacionadas con lo que aprendes.</p>`;
        return discovered.map(m => `
          <div class="playlist-row">
            <span class="pl-ico">🎵</span>
            <span class="pl-song"><b>${esc(m.song)}</b><br><span class="pl-artist">${esc(m.artist)}</span></span>
            <a class="pl-play" href="${musicSearchUrl(m)}" target="_blank" rel="noopener" aria-label="Escuchar ${esc(m.song)}">▶</a>
          </div>`).join("") +
          `<p class="page-sub" style="margin:10px 0 0">${discovered.length}/${MUSIC.length} canciones descubiertas</p>`;
      })()}
    </div>
    <div class="profile-card">
      <h2>🏆 Logros</h2>
      <div class="badges-grid">
        ${BADGES.map(b => `
          <div class="badge ${S.badges[b.id] ? "earned" : ""}" title="${esc(b.d)}">
            <span class="badge-ico">${b.icon}</span>
            <span class="badge-name">${esc(b.t)}</span>
            <span class="badge-desc">${esc(b.d)}</span>
          </div>`).join("")}
      </div>
    </div>
    <div class="profile-card">
      <h2>⚙️ Ajustes</h2>
      <button class="btn btn-ghost btn-full settings-btn" id="check-update">🔄 Buscar actualización</button>
      <button class="btn btn-ghost btn-full settings-btn" id="toggle-theme">
        ${S.theme === "dark" ? "🌙 Tema: oscuro" : S.theme === "light" ? "☀️ Tema: claro" : "🌗 Tema: automático"}
      </button>
      <button class="btn btn-ghost btn-full settings-btn" id="toggle-sound">
        ${S.sound === false ? "🔇 Efectos de sonido: desactivados" : "🔊 Efectos de sonido: activados"}
      </button>
      <button class="btn btn-ghost btn-full settings-btn" id="export-progress">📋 Copiar código de progreso</button>
      <button class="btn btn-ghost btn-full settings-btn" id="import-progress">📥 Restaurar progreso con código</button>
      <p class="page-sub" style="margin:6px 0 0">«Buscar actualización» descarga la última versión <b>sin tocar tu progreso</b>. El código de progreso te permite llevar tu avance a otro dispositivo o recuperarlo si reinstalas: cópialo de vez en cuando y guárdalo en tus notas.</p>
    </div>
    <div class="danger-zone"><button id="reset-progress">Borrar todo el progreso</button></div>
    <p class="app-version">🦉 Euskaltxo <b>v${APP_VERSION}</b> · ${APP_DATE}</p>`;
}

/* ---------------- Actualización y copia de progreso ---------------- */

async function checkForUpdate() {
  toast("Buscando la última versión… 🔄");
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.update();
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) {}
  // El progreso vive en localStorage: recargar nunca lo toca.
  setTimeout(() => location.reload(), 400);
}

function exportProgress() {
  try {
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(S))));
    const done = () => toast("Código copiado 📋 Guárdalo en tus notas");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(() => prompt("Copia tu código de progreso:", code));
    } else {
      prompt("Copia tu código de progreso:", code);
    }
  } catch (e) { toast("No se pudo generar el código ❌"); }
}

function importProgress() {
  const code = prompt("Pega aquí tu código de progreso:");
  if (!code) return;
  try {
    const obj = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!obj || typeof obj.xp !== "number" || typeof obj.progress !== "object") throw new Error("bad");
    S = Object.assign(defaultState(), obj);
    saveState();
    render();
    toast("Progreso restaurado ✅ Ongi etorri berriro!");
  } catch (e) { toast("Ese código no es válido ❌"); }
}

/* ---------------- Vista: lección ---------------- */

function renderLesson() {
  const s = session;
  const ex = s.exercises[s.current];
  const pct = Math.round((s.current / s.exercises.length) * 100);
  const heartsHTML = s.mode === "practice"
    ? `<span style="color:var(--blue);font-weight:900">∞</span>`
    : s.mode === "story"
    ? `<span style="color:var(--purple);font-weight:900">📖</span>`
    : s.mode === "redo"
    ? `<span style="color:var(--blue);font-weight:900">🔁</span>`
    : s.mode === "exam"
    ? `<span style="color:var(--purple);font-weight:900">🎓 ${Math.max(0, EXAM_A1.maxErrors - s.wrong)}</span>`
    : `❤️ ${S.hearts}`;

  app.innerHTML = `
    <div class="lesson-top">
      <button class="quit-btn" id="quit" aria-label="Salir">✕</button>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="lesson-hearts">${heartsHTML}</div>
    </div>
    <div class="exercise" id="exercise"></div>
    <div class="lesson-footer" id="footer">
      <div class="lesson-footer-inner" id="footer-inner">
        <button class="btn btn-ghost" id="skip" ${s.mode === "exam" ? 'style="visibility:hidden"' : ""}>Saltar</button>
        <div style="flex:1"></div>
        <button class="btn btn-primary" id="check" disabled>Comprobar</button>
      </div>
    </div>`;

  document.getElementById("quit").addEventListener("click", () => {
    if (confirm("¿Salir de la lección? Perderás el progreso de esta sesión.")) quitLesson();
  });

  renderExercise(ex);
}

// Respaldo de los ejercicios de escucha cuando el audio no está disponible.
function revealListenWord() {
  const r = document.getElementById("revealed-word");
  const b = document.getElementById("tts-reveal");
  if (r) r.hidden = false;
  if (b) b.hidden = true;
}

function setCheckEnabled(on) {
  const b = document.getElementById("check");
  if (b) b.disabled = !on;
}

function renderExercise(ex) {
  const box = document.getElementById("exercise");
  const checkBtn = document.getElementById("check");
  const skipBtn = document.getElementById("skip");
  let getAnswer = () => null;

  if (ex.type === "choice" || ex.type === "listen") {
    box.innerHTML = `
      <h1>${esc(ex.title)}</h1>
      ${ex.type === "listen"
        ? `<button class="speaker-btn big" id="speak">🔊</button>
           <div class="tts-fallback">
             <button class="tts-help" id="tts-reveal">¿No suena? Ver la palabra</button>
             <div class="revealed-word" id="revealed-word" hidden>${esc(ex.speakText)}</div>
           </div>`
        : ex.promptText || ex.speakText
        ? `<div class="prompt-line">
             ${ex.speakText ? `<button class="speaker-btn" id="speak">🔊</button>` : ""}
             ${ex.promptText ? `<span class="prompt-word">${esc(ex.promptText)}</span>` : ""}
           </div>`
        : ""}
      <div class="options">
        ${ex.options.map((o, i) => `
          <button class="option" data-opt="${esc(o)}"><span class="opt-num">${i + 1}</span>${esc(o)}</button>`).join("")}
      </div>`;
    let selected = null;
    box.querySelectorAll(".option").forEach(btn => btn.addEventListener("click", () => {
      box.querySelectorAll(".option").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selected = btn.dataset.opt;
      playSfx("tap");
      setCheckEnabled(true);
    }));
    getAnswer = () => selected;
    const sp = box.querySelector("#speak");
    if (sp) sp.addEventListener("click", () => speak(ex.speakText));
    if (ex.type === "listen") {
      // La palabra queda SIEMPRE oculta salvo que el usuario toque el enlace.
      box.querySelector("#tts-reveal").addEventListener("click", revealListenWord);
      setTimeout(() => speak(ex.speakText), 350);
    }
  }

  else if (ex.type === "fill") {
    box.innerHTML = `
      <h1>${esc(ex.title)}</h1>
      ${ex.esText ? `<div class="fill-es">${esc(ex.esText)}</div>` : ""}
      <div class="fill-sentence">${esc(ex.sentence).replace("___", '<span class="gap" id="gap">___</span>')}</div>
      <div class="options">
        ${ex.options.map((o, i) => `
          <button class="option" data-opt="${esc(o)}"><span class="opt-num">${i + 1}</span>${esc(o)}</button>`).join("")}
      </div>`;
    let selected = null;
    const gap = box.querySelector("#gap");
    box.querySelectorAll(".option").forEach(btn => btn.addEventListener("click", () => {
      box.querySelectorAll(".option").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selected = btn.dataset.opt;
      gap.textContent = selected;
      gap.classList.remove("filled");
      void gap.offsetWidth;
      gap.classList.add("filled");
      playSfx("tap");
      setCheckEnabled(true);
    }));
    getAnswer = () => selected;
  }

  else if (ex.type === "wordbank") {
    box.innerHTML = `
      <h1>${esc(ex.title)}</h1>
      <div class="prompt-line"><span class="prompt-word">“${esc(ex.promptText)}”</span></div>
      <div class="answer-zone" id="zone"></div>
      <div class="word-bank" id="bank">
        ${ex.tokens.map((t, i) => `<button class="chip" data-i="${i}" data-t="${esc(t)}">${esc(t)}</button>`).join("")}
      </div>`;
    const zone = box.querySelector("#zone");
    const picked = []; // {i, t}
    const sync = () => {
      zone.innerHTML = picked.map((p, k) => `<button class="chip" data-k="${k}">${esc(p.t)}</button>`).join("");
      zone.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => {
        const k = Number(c.dataset.k);
        const rem = picked.splice(k, 1)[0];
        box.querySelector(`#bank .chip[data-i="${rem.i}"]`).classList.remove("used");
        playSfx("tap");
        sync();
      }));
      setCheckEnabled(picked.length > 0);
    };
    box.querySelectorAll("#bank .chip").forEach(c => c.addEventListener("click", () => {
      c.classList.add("used");
      picked.push({ i: Number(c.dataset.i), t: c.dataset.t });
      playSfx("chip");
      sync();
    }));
    getAnswer = () => picked.map(p => p.t).join(" ");
  }

  else if (ex.type === "type") {
    box.innerHTML = `
      <h1>${esc(ex.title)}</h1>
      <div class="prompt-line">
        <button class="speaker-btn" id="speak">🔊</button>
        <span class="prompt-word">${esc(ex.promptText)}</span>
      </div>
      <textarea class="type-input" id="type-in" placeholder="Escribe en español…" autocomplete="off"></textarea>`;
    const input = box.querySelector("#type-in");
    input.addEventListener("input", () => setCheckEnabled(input.value.trim().length > 0));
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); if (!checkBtn.disabled) checkBtn.click(); }
    });
    box.querySelector("#speak").addEventListener("click", () => speak(ex.speakText));
    setTimeout(() => input.focus(), 100);
    getAnswer = () => input.value;
  }

  else if (ex.type === "match") {
    const left = shuffle(ex.pairs.map(p => p.eu));
    const right = shuffle(ex.pairs.map(p => p.es));
    // dos columnas: izquierda euskera, derecha español
    box.innerHTML = `
      <h1>${esc(ex.title)}</h1>
      <div class="match-grid">
        ${left.map((v, i) => `
          <button class="match-btn" data-side="eu" data-v="${esc(v)}">${esc(v)}</button>
          <button class="match-btn" data-side="es" data-v="${esc(right[i])}">${esc(right[i])}</button>`).join("")}
      </div>`;
    let sel = null;
    let matched = 0;
    const isPair = (eu, es) => ex.pairs.some(p => p.eu === eu && p.es === es);
    box.querySelectorAll(".match-btn").forEach(btn => btn.addEventListener("click", () => {
      if (btn.classList.contains("matched")) return;
      if (btn.dataset.side === "eu") speak(btn.dataset.v);
      if (!sel) { sel = btn; btn.classList.add("selected"); playSfx("tap"); return; }
      if (sel === btn) { btn.classList.remove("selected"); sel = null; return; }
      if (sel.dataset.side === btn.dataset.side) {
        sel.classList.remove("selected"); sel = btn; btn.classList.add("selected"); return;
      }
      const eu = sel.dataset.side === "eu" ? sel.dataset.v : btn.dataset.v;
      const es = sel.dataset.side === "es" ? sel.dataset.v : btn.dataset.v;
      if (isPair(eu, es)) {
        sel.classList.remove("selected");
        sel.classList.add("matched"); btn.classList.add("matched");
        matched++;
        playSfx("pair");
        noteWord(eu, true);
        if (matched === ex.pairs.length) {
          // Emparejar completo cuenta como acierto automático.
          session.correct++; session.combo++;
          session.bestCombo = Math.max(session.bestCombo, session.combo);
          sfxOk();
          burst(box.querySelector(".match-grid"));
          floatText(document.querySelector(".progress-track"), pick(PRAISE), "#58cc02");
          setTimeout(nextExercise, 600);
        }
      } else {
        const a = sel, b = btn;
        a.classList.remove("selected");
        a.classList.add("shake"); b.classList.add("shake");
        sfxKo();
        setTimeout(() => { a.classList.remove("shake"); b.classList.remove("shake"); }, 380);
      }
      sel = null;
    }));
    // En emparejar no hay botón comprobar
    checkBtn.style.display = "none";
    skipBtn.style.display = "none";
    return;
  }

  checkBtn.addEventListener("click", () => checkAnswer(ex, getAnswer()));
  skipBtn.addEventListener("click", () => {
    // Saltar cuenta como fallo sin quitar vida.
    session.wrong++; session.combo = 0;
    (session.failedExs = session.failedExs || []).push(ex);
    showFeedback(false, ex, { skipped: true });
  });
}

function checkAnswer(ex, raw) {
  if (session.checked) return;
  const given = normalize(raw || "");
  let ok = false;
  if (ex.type === "wordbank") {
    ok = given === normalize(ex.answer);
  } else {
    ok = (ex.accepts || [ex.answer]).some(a => normalize(a) === given);
  }

  if (ex.wordKey) noteWord(ex.wordKey, ok);

  if (ok) {
    session.correct++; session.combo++;
    session.bestCombo = Math.max(session.bestCombo, session.combo);
    // en los hitos de combo suena el glissando en lugar del acierto normal
    if (session.combo > 0 && session.combo % 5 === 0) playSfx("combo");
    else sfxOk();
    try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) {}
    if (session.combo === 5 || session.combo === 10) toast(`🔥 ¡Combo de ${session.combo}!`);
  } else {
    session.wrong++; session.combo = 0;
    (session.failedExs = session.failedExs || []).push(ex); // para repasar al final
    sfxKo();
    try { if (navigator.vibrate) navigator.vibrate([50, 40, 80]); } catch (e) {}
    if (session.mode === "lesson") {
      S.hearts = Math.max(0, S.hearts - 1);
      if (S.hearts > 0) S.heartsStamp = S.heartsStamp || Date.now();
      saveState();
    }
  }
  showFeedback(ok, ex, {});
}

function showFeedback(ok, ex, { skipped } = {}) {
  session.checked = true;

  // marcar opciones
  document.querySelectorAll(".option").forEach(b => {
    const v = normalize(b.dataset.opt);
    const isAns = (ex.accepts || [ex.answer]).some(a => normalize(a) === v) || v === normalize(ex.answer || "");
    if (isAns) b.classList.add("correct");
    else if (b.classList.contains("selected") && !ok) b.classList.add("wrong");
    b.disabled = true;
  });
  const ti = document.getElementById("type-in");
  if (ti) ti.disabled = true;

  const footer = document.getElementById("footer");
  footer.classList.add(ok ? "ok" : "ko");
  const inner = document.getElementById("footer-inner");
  const heartsNote = (!ok && !skipped && session.mode === "lesson") ? ` · −1 ❤️` : "";
  const mn = !ok && ex.wordKey ? getMn(ex.wordKey) : null;
  inner.innerHTML = `
    <div class="feedback ${ok ? "ok" : "ko"}">
      <h3>${ok ? "✅ ¡Muy bien! Oso ondo!" : (skipped ? "⏭️ Ejercicio saltado" : "❌ Incorrecto" + heartsNote)}</h3>
      ${!ok ? `<p>Respuesta correcta: <b>${esc(ex.solution || ex.answer)}</b></p>` : ""}
      ${mn ? `<p class="mn">💡 ${esc(mn)}</p>` : ""}
    </div>
    <button class="btn ${ok ? "btn-primary" : "btn-red"}" id="continue">Continuar</button>`;
  document.getElementById("continue").addEventListener("click", nextExercise);
  document.getElementById("continue").focus();

  // Al comprobar, leer en voz alta la respuesta en euskera para
  // aprender cómo suena (tras el efecto de acierto/fallo). Se cancela
  // si el usuario avanza antes, para no pisar el audio del siguiente.
  if (ex.speakOnCheck) session.speakTimer = setTimeout(() => speak(ex.speakOnCheck), 500);

  // Capa visual de videojuego: partículas y textos flotantes.
  const anchor = document.querySelector(".progress-track") || footer;
  if (ok) {
    const milestone = session.combo > 0 && session.combo % 5 === 0;
    burst(document.getElementById("continue"), milestone ? { emoji: ["⭐", "✨", "🔥"], n: 18 } : {});
    floatText(anchor, session.combo >= 2 ? `🔥 x${session.combo}` : pick(PRAISE),
      session.combo >= 2 ? "#ff9600" : "#58cc02");
  } else if (!skipped && session.mode === "lesson") {
    const h = document.querySelector(".lesson-hearts");
    if (h) { h.classList.add("hurt"); setTimeout(() => h.classList.remove("hurt"), 600); }
  }
}

function nextExercise() {
  const s = session;
  if (!s) return;
  clearTimeout(s.speakTimer); // no pisar el audio del siguiente ejercicio
  if (s.mode === "lesson" && S.hearts <= 0) { failLesson(); return; }
  if (s.mode === "exam" && s.wrong > EXAM_A1.maxErrors) { failExam(); return; }
  s.checked = false;
  s.current++;
  if (s.current >= s.exercises.length) { finishLesson(); return; }
  renderLesson();
}

/* ---------------- Vista: resultados ---------------- */

function renderResults() {
  const r = route;
  if (r.blitz) {
    app.innerHTML = `
      <div class="results">
        <div class="big-emoji">${r.record ? "🏅" : "⚡"}</div>
        <h1 class="${r.record ? "shine-text" : ""}">${r.record ? "¡Nuevo récord!" : "¡Tiempo!"}</h1>
        <p class="sub">${r.answered} respuestas en 60 segundos${r.record ? " — Errekorra! 🎉" : ""}</p>
        <div class="result-cards">
          <div class="result-card xp"><div class="rc-title">Puntos</div><div class="rc-value" id="xp-count">+0</div></div>
          <div class="result-card combo"><div class="rc-title">Récord</div><div class="rc-value">${S.blitzBest}</div></div>
          <div class="result-card acc"><div class="rc-title">XP</div><div class="rc-value">+${r.xp}</div></div>
        </div>
        <button class="btn btn-blue btn-full" id="blitz-again" style="max-width:320px">⚡ Otra vez</button>
        <button class="btn btn-primary btn-full" id="go-home" style="max-width:320px">Continuar</button>
      </div>`;
    document.getElementById("go-home").addEventListener("click", () => { route = { view: "home", tab: "practice" }; render(); });
    document.getElementById("blitz-again").addEventListener("click", startBlitz);
    if (r.record) launchConfetti();
    countUp(document.getElementById("xp-count"), r.score);
    celebrateLevelUpIfAny();
    return;
  }
  if (r.examFailed) {
    app.innerHTML = `
      <div class="results">
        <div class="big-emoji">📚</div>
        <h1 class="fail">Esta vez no ha podido ser</h1>
        <p class="sub">Has superado los ${EXAM_A1.maxErrors} fallos permitidos.<br>Repasa las unidades o practica un poco y vuelve a intentarlo — ¡lo tienes cerca!</p>
        <button class="btn btn-blue btn-full" id="go-practice" style="max-width:320px">Ir a practicar</button>
        <button class="btn btn-ghost btn-full" id="go-home" style="max-width:320px">Volver al camino</button>
      </div>`;
    document.getElementById("go-practice").addEventListener("click", () => { route = { view: "home", tab: "practice" }; render(); });
    document.getElementById("go-home").addEventListener("click", () => { route = { view: "home", tab: "learn" }; render(); });
    return;
  }
  if (r.exam) {
    app.innerHTML = `
      <div class="results">
        <div class="big-emoji">🎓</div>
        <h1 class="shine-text">Azterketa A1 gainditua!</h1>
        <p class="sub">¡Has aprobado el examen del nivel A1! Zorionak!<br>El nivel A2 llegará próximamente.</p>
        <div class="result-cards">
          <div class="result-card xp"><div class="rc-title">Nota</div><div class="rc-value">${r.nota}/10</div></div>
          <div class="result-card acc"><div class="rc-title">XP</div><div class="rc-value" id="xp-count">+0</div></div>
          <div class="result-card combo"><div class="rc-title">Gemas</div><div class="rc-value">+${r.gems} 💎</div></div>
        </div>
        ${extraCardHTML(r)}
        ${r.failedExs && r.failedExs.length ? `<button class="btn btn-blue btn-full" id="redo" style="max-width:320px">🔁 Repasar mis ${r.failedExs.length} fallo${r.failedExs.length === 1 ? "" : "s"}</button>` : ""}
        <button class="btn btn-primary btn-full" id="go-home" style="max-width:320px">Continuar</button>
      </div>`;
    document.getElementById("go-home").addEventListener("click", () => { route = { view: "home", tab: "learn" }; render(); });
    const rd = document.getElementById("redo");
    if (rd) rd.addEventListener("click", () => startRedo(r.failedExs));
    launchConfetti();
    setTimeout(() => burst(document.querySelector(".big-emoji"), { emoji: ["🎓", "⭐", "✨"], n: 20 }), 300);
    countUp(document.getElementById("xp-count"), r.xp);
    celebrateLevelUpIfAny();
    return;
  }
  if (r.failed) {
    app.innerHTML = `
      <div class="results">
        <div class="big-emoji">💔</div>
        <h1 class="fail">¡Te has quedado sin vidas!</h1>
        <p class="sub">Practica para recuperar vidas o espera 30 minutos.<br>Cada práctica completada te da +1 ❤️</p>
        <button class="btn btn-blue btn-full" id="go-practice" style="max-width:320px">Ir a practicar</button>
        <button class="btn btn-ghost btn-full" id="go-home" style="max-width:320px">Volver al camino</button>
      </div>`;
    document.getElementById("go-practice").addEventListener("click", () => { route = { view: "home", tab: "practice" }; render(); });
    document.getElementById("go-home").addEventListener("click", () => { route = { view: "home", tab: "learn" }; render(); });
    return;
  }

  app.innerHTML = `
    <div class="results">
      <div class="big-emoji">${r.perfect ? "🏆" : "🎉"}</div>
      <h1 class="${r.perfect ? "shine-text" : ""}">${r.perfect ? "¡Lección perfecta!" : "¡Lección completada!"}</h1>
      <p class="sub">${r.mode === "practice" ? "Práctica terminada — Bikain! (+1 ❤️)" : r.mode === "story" ? "Istorioa osatuta! (¡Historia completada!)" : r.mode === "redo" ? "Fallos repasados — así se aprende de verdad 💪" : "Zorionak! (¡Enhorabuena!)"}</p>
      <div class="result-cards">
        <div class="result-card xp"><div class="rc-title">XP total</div><div class="rc-value" id="xp-count">+0</div></div>
        <div class="result-card acc"><div class="rc-title">Precisión</div><div class="rc-value">${r.acc}%</div></div>
        ${r.gems ? `<div class="result-card combo"><div class="rc-title">Gemas</div><div class="rc-value">+${r.gems} 💎</div></div>` : ""}
      </div>
      ${extraCardHTML(r)}
      ${r.failedExs && r.failedExs.length ? `<button class="btn btn-blue btn-full" id="redo" style="max-width:320px">🔁 Repasar mis ${r.failedExs.length} fallo${r.failedExs.length === 1 ? "" : "s"}</button>` : ""}
      <button class="btn btn-primary btn-full" id="go-home" style="max-width:320px">Continuar</button>
    </div>`;
  document.getElementById("go-home").addEventListener("click", () => { route = { view: "home", tab: "learn" }; render(); });
  const rd = document.getElementById("redo");
  if (rd) rd.addEventListener("click", () => startRedo(r.failedExs));
  launchConfetti();
  countUp(document.getElementById("xp-count"), r.xp);
  celebrateLevelUpIfAny();
}

/* ---------------- Celebraciones ---------------- */

function reducedMotion() {
  return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Explosión de partículas desde un elemento (aciertos, hitos, examen).
function burst(el, { colors, n = 14, emoji } = {}) {
  if (reducedMotion() || !el) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    p.className = "particle";
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.6;
    const dist = 60 + Math.random() * 80;
    p.style.setProperty("--x", cx + "px");
    p.style.setProperty("--y", cy + "px");
    p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
    p.style.setProperty("--dy", (Math.sin(ang) * dist - 50) + "px");
    p.style.setProperty("--rot", (Math.random() * 400 - 200) + "deg");
    p.style.setProperty("--dur", (0.55 + Math.random() * 0.35) + "s");
    if (emoji) {
      p.textContent = pick(emoji);
      p.style.fontSize = (13 + Math.random() * 11) + "px";
    } else {
      p.style.background = pick(colors || ["#58cc02", "#1cb0f6", "#ffc800", "#ce82ff", "#ff9600"]);
      const sz = 6 + Math.random() * 7;
      p.style.width = sz + "px"; p.style.height = sz + "px";
      if (Math.random() < .4) p.style.borderRadius = "50%";
    }
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1100);
  }
}

// Texto que flota hacia arriba ("Bikain!", "🔥 x5"…).
function floatText(el, text, color) {
  if (reducedMotion() || !el) return;
  const r = el.getBoundingClientRect();
  const t = document.createElement("div");
  t.className = "float-text";
  t.textContent = text;
  if (color) t.style.color = color;
  t.style.setProperty("--x", (r.left + r.width / 2 - 40) + "px");
  t.style.setProperty("--y", (r.top - 16) + "px");
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1000);
}

const PRAISE = ["Bikain!", "Oso ondo!", "Primeran!", "Ederki!", "Aupa!"];

// Overlay de subida de nivel: el momento AAA de la sesión.
// Se cancela si el usuario navega antes (no debe tapar otra vista).
let levelUpTimer = null;
let levelUpEl = null;

function clearLevelUp() {
  clearTimeout(levelUpTimer);
  levelUpTimer = null;
  if (levelUpEl) { levelUpEl.remove(); levelUpEl = null; }
}

function showLevelUp(lv) {
  playSfx("level");
  const wrap = document.createElement("div");
  levelUpEl = wrap;
  wrap.className = "levelup-overlay";
  wrap.innerHTML = `
    <div class="levelup-card">
      <div class="levelup-ring"></div>
      <div class="levelup-star">⭐</div>
      <h2>¡Nivel ${lv}!</h2>
      <p>Maila berria! Sigue así 🦉</p>
    </div>`;
  document.body.appendChild(wrap);
  setTimeout(() => burst(wrap.querySelector(".levelup-star"), { emoji: ["⭐", "✨", "💫"], n: 22 }), 250);
  const close = () => { wrap.remove(); if (levelUpEl === wrap) levelUpEl = null; };
  wrap.addEventListener("click", close);
  setTimeout(close, 3000);
}

function celebrateLevelUpIfAny() {
  if (!pendingLevelUp) return;
  const lv = pendingLevelUp;
  pendingLevelUp = null;
  levelUpTimer = setTimeout(() => showLevelUp(lv), 700);
}

function launchConfetti() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#58cc02", "#1cb0f6", "#ff9600", "#ff4b4b", "#ce82ff", "#ffc800"];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = pick(colors);
    c.style.animationDelay = (Math.random() * 0.9) + "s";
    c.style.animationDuration = (1.8 + Math.random() * 1.6) + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4500);
  }
}

function countUp(el, target) {
  if (!el || !target) { if (el) el.textContent = "+" + (target || 0); return; }
  let cur = 0;
  const step = Math.max(1, Math.round(target / 25));
  const t = setInterval(() => {
    cur = Math.min(target, cur + step);
    el.textContent = "+" + cur;
    if (cur >= target) clearInterval(t);
  }, 35);
}

/* ---------------- Vidas: modal y recarga ---------------- */

function showNoHeartsModal() {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `
    <div class="modal">
      <div class="modal-emoji">💔</div>
      <h2>¡No te quedan vidas!</h2>
      <p>Recupera 1 ❤️ cada 30 minutos, gana 1 ❤️ completando una práctica, o recarga todas con gemas.</p>
      <button class="btn btn-blue btn-full" id="m-practice">💪 Practicar (+1 ❤️)</button>
      <button class="btn btn-ghost btn-full" id="m-refill">💎 ${HEART_REFILL_COST} — Recargar vidas</button>
      <button class="btn btn-ghost btn-full" id="m-close">Cerrar</button>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector("#m-close").addEventListener("click", () => wrap.remove());
  wrap.querySelector("#m-practice").addEventListener("click", () => { wrap.remove(); startPractice(); });
  wrap.querySelector("#m-refill").addEventListener("click", () => { wrap.remove(); tryRefillHearts(); });
  wrap.addEventListener("click", e => { if (e.target === wrap) wrap.remove(); });
}

function tryRefillHearts() {
  if (S.hearts >= MAX_HEARTS) { toast("Ya tienes todas las vidas ❤️"); return; }
  if (S.gems < HEART_REFILL_COST) { toast(`Necesitas ${HEART_REFILL_COST} 💎 (tienes ${S.gems})`); return; }
  S.gems -= HEART_REFILL_COST;
  S.hearts = MAX_HEARTS;
  S.heartsStamp = Date.now();
  saveState();
  toast("¡Vidas recargadas! ❤️❤️❤️❤️❤️");
  render();
}

/* ---------------- Atajos de teclado (escritorio) ---------------- */

document.addEventListener("keydown", e => {
  if ((route.view !== "lesson" && route.view !== "blitz") || !session) return;
  const tag = (e.target.tagName || "").toLowerCase();
  if (e.key >= "1" && e.key <= "4" && tag !== "textarea" && tag !== "input") {
    const opts = [...document.querySelectorAll(".option:not([disabled])")];
    const o = opts[Number(e.key) - 1];
    if (o) o.click();
  } else if (e.key === "Enter" && tag !== "textarea" && route.view === "lesson") {
    const cont = document.getElementById("continue");
    if (cont) {
      if (document.activeElement !== cont) cont.click(); // si tiene el foco, el navegador ya lo pulsa
      return;
    }
    const chk = document.getElementById("check");
    if (chk && !chk.disabled && chk.style.display !== "none") chk.click();
  }
});

/* ---------------- Arranque ---------------- */

applyTheme();
render();
