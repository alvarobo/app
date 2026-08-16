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

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

// Racha: si el último día activo fue antes de ayer, se rompe.
function refreshStreak() {
  if (S.lastDay && daysBetween(S.lastDay, todayStr()) > 1) {
    S.streak = 0;
    saveState();
  }
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

/* ---------------- Repaso inteligente (fuerza por palabra) ---------------- */

function noteWord(eu, ok) {
  const st = S.wordStats[eu] || (S.wordStats[eu] = { ok: 0, ko: 0 });
  if (ok) st.ok++; else st.ko++;
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

function addXp(n) {
  S.xp += n;
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

function ttsFailed() {
  if (!ttsBroken) {
    ttsBroken = true;
    toast("Tu navegador no tiene voz de síntesis disponible 🔇");
  }
  revealListenWord();
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
  let started = false;
  u.onstart = () => { started = true; markSpeaking(true); };
  u.onend = () => markSpeaking(false);
  u.onerror = () => { markSpeaking(false); if (!started) ttsFailed(); };
  // Chrome ignora a veces un speak() inmediatamente después de cancel(),
  // y puede quedarse en estado "paused": pequeño retardo + resume().
  setTimeout(() => {
    try { synth.resume(); synth.speak(u); } catch (e) { ttsFailed(); }
  }, 60);
  // Si tras 1,5 s no ha empezado a hablar, no hay voz utilizable.
  setTimeout(() => { if (!started && !synth.speaking) ttsFailed(); }, 1500);
}

// Los navegadores móviles bloquean el audio hasta el primer gesto del
// usuario: desbloqueamos el AudioContext y "calentamos" la síntesis.
document.addEventListener("pointerdown", function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
  } catch (e) {}
  try {
    if ("speechSynthesis" in window) {
      speechSynthesis.getVoices();
      const w = new SpeechSynthesisUtterance(" ");
      w.volume = 0;
      speechSynthesis.speak(w);
    }
  } catch (e) {}
}, { once: true });

let audioCtx = null;
// Notas con ataque y caída suaves (sin clics) para que los aciertos
// suenen a premio y no a pitido.
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
// Acierto: arpegio mayor ascendente (do–mi–sol), alegre y breve.
const sfxOk = () => beep([523.25, 659.25, 783.99], 0.075, "triangle", 0.18);
// Fallo: dos notas graves descendentes, suaves (nada de zumbidos).
const sfxKo = () => beep([196, 164.81], 0.16, "sine", 0.1);
// Fin de lección: fanfarria do–mi–sol–do agudo.
const sfxWin = () => beep([523.25, 659.25, 783.99, 1046.5], 0.12, "triangle", 0.18);

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
  exs.push(exType(w()));
  if (unit.phrases.length) exs.push(exFillPhrase(pick(unit.phrases), unit));
  exs.push(exListen(w(), unit.words));
  if (drills.length > 1) exs.push(exDrill(drills[(lessonIdx * 2 + 1) % drills.length]));
  exs.push(exChoice(w(), unit.words, "eu-es"));

  return exs.slice(0, EXERCISES_PER_LESSON);
}

// Práctica inteligente: repasa primero tus palabras más débiles
// (falladas o nunca practicadas). No gasta vidas.
function buildPractice() {
  const pool = learnedWords();
  const words = weakestWords(8);
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
    const k = i % 6;
    if (k === 0) exs.push(exChoice(w, pool, "eu-es"));
    else if (k === 1) exs.push(exChoice(w, pool, "es-eu"));
    else if (k === 2) exs.push(exListen(w, pool));
    else if (k === 3) exs.push(exWordbank(pick(u.phrases), u));
    else if (k === 4) exs.push(exType(w));
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
    route = { view: "results", exam: true, xp, gems, acc, perfect: s.wrong === 0, tip, music };
    session = null;
    render();
    return;
  } else {
    xp = 5 + Math.min(5, s.bestCombo);
    addXp(xp);
    if (S.hearts < MAX_HEARTS) { S.hearts += 1; } // practicar recupera 1 vida
    bumpStreak();
  }
  checkBadges();
  saveState();
  sfxWin();
  route = { view: "results", xp, gems, acc, perfect: s.wrong === 0, mode: s.mode, tip, music };
  session = null;
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
  refreshHearts();
  refreshStreak();
  if (route.view === "lesson") renderLesson();
  else if (route.view === "results") renderResults();
  else renderHome();
  window.scrollTo(0, 0);
}

function headerHTML() {
  return `
    <header class="topbar"><div class="topbar-inner">
      <div class="logo"><span>🦉</span> euskaltxo</div>
      <div class="stats">
        <div class="stat streak" title="Racha de días"><span class="ico">🔥</span>${S.streak}</div>
        <div class="stat gems" title="Gemas"><span class="ico">💎</span>${S.gems}</div>
        <div class="stat hearts" title="Vidas"><span class="ico">❤️</span>${S.hearts}</div>
      </div>
    </div></header>`;
}

function navHTML(tab) {
  const items = [
    { id: "learn", ico: "🏠", label: "Aprender" },
    { id: "words", ico: "📖", label: "Palabras" },
    { id: "practice", ico: "💪", label: "Práctica" },
    { id: "profile", ico: "👤", label: "Perfil" },
  ];
  return `
    <nav class="bottomnav"><div class="bottomnav-inner">
      ${items.map(i => `
        <button class="nav-btn ${tab === i.id ? "active" : ""}" data-nav="${i.id}">
          <span class="ico">${i.ico}</span>${i.label}
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

  app.querySelectorAll("[data-say]").forEach(b =>
    b.addEventListener("click", () => speak(b.dataset.say)));

  const snd = app.querySelector("#toggle-sound");
  if (snd) snd.addEventListener("click", () => {
    S.sound = S.sound === false ? true : false;
    saveState(); render();
  });
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
    ${units.map(u => `
      <div class="profile-card">
        <h2>${u.icon} ${esc(u.title)}</h2>
        ${u.words.map(w => {
          const st = S.wordStats[w.eu];
          const pct = st ? Math.round(wordStrength(w.eu) * 100) : 0;
          const color = !st ? "var(--gray-2)" : pct >= 75 ? "var(--green)" : pct >= 40 ? "var(--gold)" : "var(--red)";
          return `
            <div class="vocab-row">
              <button class="vocab-say" data-say="${esc(w.eu)}" aria-label="Escuchar ${esc(w.eu)}">🔊</button>
              <span class="vocab-eu">${esc(w.eu)}</span>
              <span class="vocab-es">${esc(w.es)}</span>
              <div class="mini-bar"><div style="width:${st ? Math.max(pct, 8) : 0}%;background:${color}"></div></div>
            </div>`;
        }).join("")}
      </div>`).join("")}`;
}

function pathHTML() {
  const a1 = LEVELS[0];
  let html = goalCardHTML() + `
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
  return `
    <div class="results" style="padding-top:40px">
      <div class="big-emoji">💪</div>
      <h1 style="color:var(--blue)">Práctica</h1>
      <p class="sub">Repasa las ${n} palabras que has aprendido.<br>
      La práctica no gasta vidas y te devuelve <b>+1 ❤️</b> al terminar.</p>
      <button class="btn btn-blue btn-full" id="practice-start" style="max-width:320px">Empezar práctica</button>
      ${S.hearts < MAX_HEARTS ? `
        <button class="btn btn-ghost btn-full" id="refill-hearts" style="max-width:320px">
          💎 ${HEART_REFILL_COST} — Recargar vidas
        </button>` : ""}
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
    <button class="btn btn-ghost btn-full" id="toggle-sound" style="margin-bottom:8px">
      ${S.sound === false ? "🔇 Efectos de sonido: desactivados" : "🔊 Efectos de sonido: activados"}
    </button>
    <div class="danger-zone"><button id="reset-progress">Borrar todo el progreso</button></div>
    <p class="app-version">🦉 Euskaltxo <b>v${APP_VERSION}</b> · ${APP_DATE}</p>`;
}

/* ---------------- Vista: lección ---------------- */

function renderLesson() {
  const s = session;
  const ex = s.exercises[s.current];
  const pct = Math.round((s.current / s.exercises.length) * 100);
  const heartsHTML = s.mode === "practice"
    ? `<span style="color:var(--blue);font-weight:900">∞</span>`
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
        : `<div class="prompt-line">
             ${ex.speakText ? `<button class="speaker-btn" id="speak">🔊</button>` : ""}
             <span class="prompt-word">${esc(ex.promptText)}</span>
           </div>`}
      <div class="options">
        ${ex.options.map((o, i) => `
          <button class="option" data-opt="${esc(o)}"><span class="opt-num">${i + 1}</span>${esc(o)}</button>`).join("")}
      </div>`;
    let selected = null;
    box.querySelectorAll(".option").forEach(btn => btn.addEventListener("click", () => {
      box.querySelectorAll(".option").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selected = btn.dataset.opt;
      setCheckEnabled(true);
    }));
    getAnswer = () => selected;
    const sp = box.querySelector("#speak");
    if (sp) sp.addEventListener("click", () => speak(ex.speakText));
    if (ex.type === "listen") {
      box.querySelector("#tts-reveal").addEventListener("click", revealListenWord);
      if (ttsBroken) revealListenWord(); // muestra la palabra, pero sigue intentando el audio
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
      gap.classList.add("filled");
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
        sync();
      }));
      setCheckEnabled(picked.length > 0);
    };
    box.querySelectorAll("#bank .chip").forEach(c => c.addEventListener("click", () => {
      c.classList.add("used");
      picked.push({ i: Number(c.dataset.i), t: c.dataset.t });
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
      if (!sel) { sel = btn; btn.classList.add("selected"); return; }
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
        beep([880], 0.06, "triangle", 0.12);
        noteWord(eu, true);
        if (matched === ex.pairs.length) {
          // Emparejar completo cuenta como acierto automático.
          session.correct++; session.combo++;
          session.bestCombo = Math.max(session.bestCombo, session.combo);
          sfxOk();
          setTimeout(nextExercise, 500);
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
    sfxOk();
    try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) {}
    if (session.combo === 5 || session.combo === 10) toast(`🔥 ¡Combo de ${session.combo}!`);
  } else {
    session.wrong++; session.combo = 0;
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
  inner.innerHTML = `
    <div class="feedback ${ok ? "ok" : "ko"}">
      <h3>${ok ? "✅ ¡Muy bien! Oso ondo!" : (skipped ? "⏭️ Ejercicio saltado" : "❌ Incorrecto" + heartsNote)}</h3>
      ${!ok ? `<p>Respuesta correcta: <b>${esc(ex.solution || ex.answer)}</b></p>` : ""}
    </div>
    <button class="btn ${ok ? "btn-primary" : "btn-red"}" id="continue">Continuar</button>`;
  document.getElementById("continue").addEventListener("click", nextExercise);
  document.getElementById("continue").focus();
}

function nextExercise() {
  const s = session;
  if (!s) return;
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
        <h1>Azterketa A1 gainditua!</h1>
        <p class="sub">¡Has aprobado el examen del nivel A1! Zorionak!<br>El nivel A2 llegará próximamente.</p>
        <div class="result-cards">
          <div class="result-card xp"><div class="rc-title">XP</div><div class="rc-value" id="xp-count">+0</div></div>
          <div class="result-card acc"><div class="rc-title">Precisión</div><div class="rc-value">${r.acc}%</div></div>
          <div class="result-card combo"><div class="rc-title">Gemas</div><div class="rc-value">+${r.gems} 💎</div></div>
        </div>
        ${extraCardHTML(r)}
        <button class="btn btn-primary btn-full" id="go-home" style="max-width:320px">Continuar</button>
      </div>`;
    document.getElementById("go-home").addEventListener("click", () => { route = { view: "home", tab: "learn" }; render(); });
    launchConfetti();
    countUp(document.getElementById("xp-count"), r.xp);
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
      <h1>${r.perfect ? "¡Lección perfecta!" : "¡Lección completada!"}</h1>
      <p class="sub">${r.mode === "practice" ? "Práctica terminada — Bikain! (+1 ❤️)" : "Zorionak! (¡Enhorabuena!)"}</p>
      <div class="result-cards">
        <div class="result-card xp"><div class="rc-title">XP total</div><div class="rc-value" id="xp-count">+0</div></div>
        <div class="result-card acc"><div class="rc-title">Precisión</div><div class="rc-value">${r.acc}%</div></div>
        ${r.gems ? `<div class="result-card combo"><div class="rc-title">Gemas</div><div class="rc-value">+${r.gems} 💎</div></div>` : ""}
      </div>
      ${extraCardHTML(r)}
      <button class="btn btn-primary btn-full" id="go-home" style="max-width:320px">Continuar</button>
    </div>`;
  document.getElementById("go-home").addEventListener("click", () => { route = { view: "home", tab: "learn" }; render(); });
  launchConfetti();
  countUp(document.getElementById("xp-count"), r.xp);
}

/* ---------------- Celebraciones ---------------- */

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
  if (route.view !== "lesson" || !session) return;
  const tag = (e.target.tagName || "").toLowerCase();
  if (e.key >= "1" && e.key <= "4" && tag !== "textarea" && tag !== "input") {
    const opts = [...document.querySelectorAll(".option:not([disabled])")];
    const o = opts[Number(e.key) - 1];
    if (o) o.click();
  } else if (e.key === "Enter" && tag !== "textarea") {
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

render();
