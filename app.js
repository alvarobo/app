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

let euVoice = null;
function pickVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  euVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith("eu"))
         || voices.find(v => v.lang && v.lang.toLowerCase().startsWith("es"))
         || null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = euVoice && euVoice.lang.toLowerCase().startsWith("eu") ? euVoice.lang : "eu-ES";
  if (euVoice) u.voice = euVoice;
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

let audioCtx = null;
function beep(freqs, dur = 0.13, type = "sine", gain = 0.12) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(gain, audioCtx.currentTime + i * dur);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (i + 1) * dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(audioCtx.currentTime + i * dur);
      o.stop(audioCtx.currentTime + (i + 1) * dur + 0.02);
    });
  } catch (e) {}
}
const sfxOk = () => beep([660, 880], 0.12);
const sfxKo = () => beep([220, 180], 0.18, "square", 0.07);
const sfxWin = () => beep([523, 659, 784, 1047], 0.14);

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

  exs.push(exChoice(w(), unit.words, "eu-es"));
  exs.push(exChoice(w(), unit.words, "es-eu"));
  exs.push(exListen(w(), unit.words));
  exs.push(exMatch(unit.words));
  exs.push(exChoice(w(), unit.words, "es-eu"));
  if (unit.phrases.length) exs.push(exWordbank(pick(unit.phrases), unit));
  exs.push(exType(w()));
  exs.push(exListen(w(), unit.words));
  if (unit.phrases.length) exs.push(exWordbank(pick(unit.phrases), unit));
  exs.push(exChoice(w(), unit.words, "eu-es"));

  return exs.slice(0, EXERCISES_PER_LESSON);
}

// Sesión de práctica: repaso de todo lo aprendido (no gasta vidas).
function buildPractice() {
  const pool = learnedWords();
  const units = COURSE.filter(u => (S.progress[u.id] || 0) > 0);
  const exs = [];
  for (let i = 0; i < 8; i++) {
    const word = pick(pool);
    const kind = i % 4;
    if (kind === 0) exs.push(exChoice(word, pool, "eu-es"));
    else if (kind === 1) exs.push(exChoice(word, pool, "es-eu"));
    else if (kind === 2) exs.push(exListen(word, pool));
    else exs.push(exMatch(pool));
  }
  const u = pick(units);
  if (u && u.phrases.length) exs.push(exWordbank(pick(u.phrases), u));
  return shuffle(exs).slice(0, 8);
}

// Examen A1: preguntas variadas de todas las unidades del nivel.
function buildExam() {
  const pool = COURSE.flatMap(u => u.words);
  const exs = [];
  for (let i = 0; i < EXAM_A1.size; i++) {
    const u = pick(COURSE);
    const w = pick(u.words);
    const k = i % 5;
    if (k === 0) exs.push(exChoice(w, pool, "eu-es"));
    else if (k === 1) exs.push(exChoice(w, pool, "es-eu"));
    else if (k === 2) exs.push(exListen(w, pool));
    else if (k === 3) exs.push(exWordbank(pick(u.phrases), u));
    else exs.push(exType(w));
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

  if (s.mode === "lesson") {
    xp = 10 + s.bestCombo;
    if (s.wrong === 0) xp += 5; // bonus perfecto
    gems = s.wrong === 0 ? 10 : 5;
    S.xp += xp; S.gems += gems;
    bumpStreak();
    const unit = COURSE[s.unitIdx];
    const done = S.progress[unit.id] || 0;
    if (s.lessonIdx === done) S.progress[unit.id] = done + 1; // avanza solo la siguiente pendiente
  } else if (s.mode === "exam") {
    if (s.wrong > EXAM_A1.maxErrors) { failExam(); return; }
    xp = EXAM_A1.xp; gems = EXAM_A1.gems;
    S.xp += xp; S.gems += gems;
    S.progress[EXAM_A1.id] = 1;
    bumpStreak();
    saveState();
    sfxWin();
    route = { view: "results", exam: true, xp, gems, acc, perfect: s.wrong === 0 };
    session = null;
    render();
    return;
  } else {
    xp = 5 + Math.min(5, s.bestCombo);
    S.xp += xp;
    if (S.hearts < MAX_HEARTS) { S.hearts += 1; } // practicar recupera 1 vida
    bumpStreak();
  }
  saveState();
  sfxWin();
  route = { view: "results", xp, gems, acc, perfect: s.wrong === 0, mode: s.mode };
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
}

function pathHTML() {
  const a1 = LEVELS[0];
  let html = `
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
    <div class="danger-zone"><button id="reset-progress">Borrar todo el progreso</button></div>`;
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
        ? `<button class="speaker-btn big" id="speak">🔊</button>`
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
    if (sp) {
      sp.addEventListener("click", () => speak(ex.speakText));
      if (ex.type === "listen") setTimeout(() => speak(ex.speakText), 350);
    }
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
        beep([880], 0.08);
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

  if (ok) {
    session.correct++; session.combo++;
    session.bestCombo = Math.max(session.bestCombo, session.combo);
    sfxOk();
  } else {
    session.wrong++; session.combo = 0;
    sfxKo();
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
          <div class="result-card xp"><div class="rc-title">XP</div><div class="rc-value">+${r.xp}</div></div>
          <div class="result-card acc"><div class="rc-title">Precisión</div><div class="rc-value">${r.acc}%</div></div>
          <div class="result-card combo"><div class="rc-title">Gemas</div><div class="rc-value">+${r.gems} 💎</div></div>
        </div>
        <button class="btn btn-primary btn-full" id="go-home" style="max-width:320px">Continuar</button>
      </div>`;
    document.getElementById("go-home").addEventListener("click", () => { route = { view: "home", tab: "learn" }; render(); });
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
        <div class="result-card xp"><div class="rc-title">XP total</div><div class="rc-value">+${r.xp}</div></div>
        <div class="result-card acc"><div class="rc-title">Precisión</div><div class="rc-value">${r.acc}%</div></div>
        ${r.gems ? `<div class="result-card combo"><div class="rc-title">Gemas</div><div class="rc-value">+${r.gems} 💎</div></div>` : ""}
      </div>
      <button class="btn btn-primary btn-full" id="go-home" style="max-width:320px">Continuar</button>
    </div>`;
  document.getElementById("go-home").addEventListener("click", () => { route = { view: "home", tab: "learn" }; render(); });
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

/* ---------------- Arranque ---------------- */

render();
