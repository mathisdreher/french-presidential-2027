"use strict";
/* L'écologie dans la campagne 2027 : site statique, sans dépendance, en français et en anglais.
   Les agrégats sont calculés dans le navigateur à partir de data.json ; les jeux lisent games.json.
   Les textes d'interface sont dans i18n.js, le livre de codes exporté fournit ses propres champs *_en.
   Convention : les tweets sont nommés « tw » pour ne pas masquer la fonction de traduction t(). */

const REPO_URL = "https://github.com/mathisdreher/french-presidential-2027";

/* =================================================================== utilitaires */
// append et replaceChildren ignorent null, undefined et false, et aplatissent les tableaux
for (const m of ["append", "replaceChildren"]) {
  const orig = Element.prototype[m];
  Element.prototype[m] = function (...xs) { return orig.apply(this, xs.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false)); };
}
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) if (c !== null && c !== undefined && c !== false) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
}
const SVGNS = "http://www.w3.org/2000/svg";
function svg(tag, attrs) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) node.setAttribute(k, v);
  return node;
}
const ICONS = {
  play: '<rect x="2" y="6" width="20" height="12" rx="6"/><path d="M6.5 12h4M8.5 10v4"/><circle cx="15.5" cy="10.8" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="13.4" r="1" fill="currentColor" stroke="none"/>',
  chart: '<path d="M3 20h18"/><path d="M6 16v-4M10 16V6M14 16V9M18 16v-6"/>',
  talk: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z"/>',
  words: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke-width="3"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4M12 2v13"/>',
  up: '<path d="M7 10v11H3V10z"/><path d="M7 10l4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.3 8A2 2 0 0 1 18.2 21H7"/>',
  down: '<path d="M17 14V3h4v11z"/><path d="M17 14l-4 8a3 3 0 0 1-3-3v-4H4.5a2 2 0 0 1-2-2.3l1.3-8A2 2 0 0 1 5.8 3H17"/>',
  mixed: '<path d="M5 9h14M5 15h14"/>',
  arrowL: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowR: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  replay: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
};
function icon(name, size = 18) {
  const s = svg("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" });
  s.innerHTML = ICONS[name];
  return s;
}
function logo(size = 30) {
  const s = svg("svg", { viewBox: "0 0 32 32", width: size, height: size, "aria-hidden": "true", focusable: "false" });
  s.innerHTML = '<rect width="32" height="32" rx="9" style="fill:var(--accent)"/><path d="M9 22c0-8 5-12 14-13-1 9-5 14-12 14" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>';
  return s;
}
// « **texte** » devient du gras
const rich = (text) => text.split("**").map((part, i) => (i % 2 ? el("strong", { text: part }) : part));
function debounce(fn, ms) { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; }
function shuffle(arr, rnd = Math.random) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const mean = (xs, f) => (xs.length ? xs.reduce((a, x) => a + f(x), 0) / xs.length : 0);
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const smooth = () => (reducedMotion() ? "auto" : "smooth");
const NULLISH = new Set(["non_applicable", "aucun", "aucune", "indetermine"]);
const STANCE = { favorable_transition: 1, critique_ecologie: -1 };
const MIN_N = 20;
const MIN_N_SCALE = 10;
const COMPASS_MIN = 8;
const COMPASS_MIN_VISION = 3;
const CHIP_LIMIT = 6;
const ENG_MIN = 10;          // tweets mesurés à 48 h requis pour établir l'habitude d'un candidat
const LEVELS = ["faible", "moyenne", "elevee"];
const LEVEL_COLOR = ["var(--accent-2)", "var(--neutral-mark)", "var(--accent)"];

/* =================================================================== langue */
const MESSAGES = window.MESSAGES || { fr: {}, en: {} };
const LANGS = ["fr", "en"];
let LANG = "fr";
let FMT = null;
function t(key, vars) {
  let s = MESSAGES[LANG][key];
  if (s === undefined) s = MESSAGES.fr[key];
  if (s === undefined) return key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : vars[k])) : s;
}
// Accord en nombre : en français, 0 et 1 sont au singulier
function tn(key, n, vars) {
  const one = LANG === "fr" ? Math.abs(n) < 2 : n === 1;
  return t(`${key}_${one ? "one" : "other"}`, { n: num(n), ...vars });
}
// Champ traduit d'un objet de données : label -> label_en en anglais, s'il existe
const L = (o, f) => (o ? (LANG === "en" && o[f + "_en"]) || o[f] || "" : "");
function setupFormats() {
  const loc = LANG === "fr" ? "fr-FR" : "en-GB";
  FMT = {
    n: new Intl.NumberFormat(loc),
    p1: new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }),
    p0: new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }),
    f2: new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    s2: new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" }),
    sig2: new Intl.NumberFormat(loc, { minimumSignificantDigits: 2, maximumSignificantDigits: 2 }),
    day: new Intl.DateTimeFormat(loc, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    short: new Intl.DateTimeFormat(loc, { day: "numeric", month: "short", timeZone: "UTC" }),
    coll: new Intl.Collator(loc),
  };
}
const num = (x) => FMT.n.format(x);
const pct = (x, digits = 1) => (digits ? FMT.p1 : FMT.p0).format(100 * x) + (LANG === "fr" ? " %" : "%");
const f2 = (x) => FMT.f2.format(x);
// Fait défiler le premier nombre d'un texte depuis zéro (« 3 063 tweets », « 13,9 % »), au format de la langue
function countUp(node, ms = 900) {
  const txt = node.textContent, m = txt.match(/\d[\d\s\u202f\u00a0.,]*\d|\d/);
  if (!m) return;
  const dec = LANG === "fr" ? "," : ".", raw = m[0].trim();
  const clean = raw.replace(LANG === "fr" ? /[\s\u202f\u00a0.]/g : /[\s\u202f\u00a0,]/g, "").replace(dec, ".");
  const target = Number(clean), digits = clean.includes(".") ? clean.split(".")[1].length : 0;
  if (!Number.isFinite(target) || target === 0) return;
  const fmt = new Intl.NumberFormat(LANG === "fr" ? "fr-FR" : "en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const t0 = performance.now(), before = txt.slice(0, m.index), after = txt.slice(m.index + m[0].length);
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / ms), v = target * (1 - Math.pow(1 - p, 3));
    node.textContent = before + fmt.format(p < 1 ? v : target) + after;
    if (p < 1 && node.isConnected) requestAnimationFrame(tick); else node.textContent = txt;
  };
  requestAnimationFrame(tick);
}
const signed = (x) => FMT.s2.format(Math.abs(x) < 0.005 ? 0 : x);
const parseDay = (s) => new Date(s + "T00:00:00Z");
const isoDay = (d) => d.toISOString().slice(0, 10);
const fmtDay = (s) => { const out = FMT.day.format(parseDay(s)); return LANG === "fr" ? out.replace(/^1 /, "1er ") : out; };
const fmtShort = (s) => FMT.short.format(parseDay(s));
function weekStart(day) { const d = parseDay(day); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return isoDay(d); }

/* =================================================================== état */
const X_DEFAULT = { cand: "", theme: "", pos: "", cad: "", concept: "", conf: "", q: "", sort: "date", shown: 15 };
const S = {
  data: null, games: { items: [] }, cands: [], cand: new Map(), vars: new Map(), fw: new Map(), tweets: [],
  periods: [], period: "all", bloc: "", focus: "", tab: "jouer",
  apercuHeat: "themes", discours: "carre", discoursVar: {}, discoursScope: "ecologie", selectedCell: null,
  salMode: "part", evoMode: "ensemble", netMode: "formules", netScope: "tous", engBase: new Map(),
  x: { ...X_DEFAULT }, mots: { who: "", mode: "candidats" },
  tables: new Map(), openTables: new Set(), openChips: new Set(), showOriginal: new Set(),
  play: null, filtersOpen: false, langInUrl: false, scrollTo: null, focusTo: null,
};

/* =================================================================== décodage */
function decode(data) {
  S.data = data;
  S.cands = data.candidates;
  for (const c of S.cands) S.cand.set(c.key, c);
  for (const v of data.codebook.variables) S.vars.set(v.key, v);
  for (const f of [...data.codebook.frameworks, ...data.codebook.engines]) S.fw.set(f.key, f);
  const { cols, rows } = data.tweets;
  const at = Object.fromEntries(cols.map((c, i) => [c, i]));
  const vars = data.codebook.variables.filter((v) => v.short !== "e");
  S.tweets = rows.map((r) => {
    const tw = { i: r[at.i], c: S.cands[r[at.c]].key, d: r[at.d], e: r[at.e], p: r[at.p], s: r[at.s], l: r[at.l], rt: r[at.rt],
      rp: r[at.rp], qt: r[at.qt], bm: r[at.bm], vw: r[at.vw], ma: r[at.ma], cj: r[at.cj], nm: (at.nm === undefined ? null : r[at.nm]) || [], fm: (at.fm === undefined ? null : r[at.fm]) || [] };
    for (const v of vars) {
      const raw = r[at[v.short]];
      if (raw === null || raw === undefined) { tw[v.key] = v.kind === "multi" ? [] : null; continue; }
      if (v.kind === "noul") tw[v.key] = !!raw;
      else if (v.kind === "multi") tw[v.key] = v.options.filter((_, i) => raw & (1 << i)).map((o) => o.key);
      else tw[v.key] = (v.options[raw] || {}).key || null;
    }
    const tx = data.texts[tw.i];
    if (tx) Object.assign(tw, { t: tx.t, rs: tx.rs, lx: tx.lx, im: tx.im, cf: tx.cf, te: tx.te, re: tx.re, ie: tx.ie });
    return tw;
  });
  // Habitude de chaque candidat : médiane des interactions de ses tweets mesurés à 48 h, sur toute l'étude
  const by = new Map();
  for (const tw of S.tweets) if (tw.ma !== null && tw.ma !== undefined) { if (!by.has(tw.c)) by.set(tw.c, []); by.get(tw.c).push(interactions(tw)); }
  for (const [k, list] of by) if (list.length >= ENG_MIN) { const m = median(list); if (m > 0) S.engBase.set(k, m); }
}
const interactions = (tw) => (tw.l || 0) + (tw.rt || 0) + (tw.rp || 0) + (tw.qt || 0);
function median(xs) { const a = [...xs].sort((x, y) => x - y), n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; }
function quantile(xs, q) { const a = [...xs].sort((x, y) => x - y); if (!a.length) return null; const i = (a.length - 1) * q, lo = Math.floor(i); return a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo); }
// Engagement relatif : interactions à 48 h rapportées à l'habitude du candidat (null si non mesurable)
function relEng(tw) {
  const base = S.engBase.get(tw.c);
  return base && tw.ma !== null && tw.ma !== undefined ? interactions(tw) / base : null;
}
const times = (x) => "×" + FMT.sig2.format(x);
function buildPeriods() {
  const d = S.data;
  const anchor = d.generated_at.slice(0, 10);
  const minus = (n) => { const x = parseDay(anchor); x.setUTCDate(x.getUTCDate() - n + 1); return isoDay(x); };
  S.periods = [
    { key: "all", label: t("period_all", { date: fmtDay(d.study.start) }), short: t("period_all_short"), start: d.study.start, end: null },
    ...[90, 30, 7].map((n) => ({ key: `d${n}`, label: t("period_last", { n }), short: t("period_last", { n }), start: minus(n), end: anchor })),
    ...(d.study.phases || []).map((p) => ({ key: p.key, label: t("period_phase", { label: L(p, "label"), start: fmtShort(p.start), end: fmtShort(p.end) }), short: L(p, "label"), start: p.start, end: p.end })),
  ];
}
const V = (key) => S.vars.get(key);
const opt = (varKey, optKey) => (V(varKey)?.options || []).find((o) => o.key === optKey);
const optLabel = (varKey, optKey) => { const o = opt(varKey, optKey); return o ? L(o, "label") : optKey || "–"; };
// Définition d'une catégorie : glose française, ou définition anglaise donnée aux modèles
const optDef = (varKey, optKey) => { const o = opt(varKey, optKey); return !o || !o.fr ? "" : LANG === "en" ? o.en : o.fr; };
const varLabel = (key) => L(V(key), "label") || key;
const fwLabel = (key) => L(S.fw.get(key), "label") || key;
const candName = (k) => (S.cand.get(k) || { name: k }).name;
const candParty = (k) => L(S.cand.get(k), "party");
const byName = (a, b) => FMT.coll.compare(a.name, b.name);
// Ordre politique, de la gauche radicale à l'extrême droite (ordre des familles de study.yaml), puis alphabétique
const blocRank = (k) => { const i = (S.data.study.blocs || []).findIndex((b) => b.key === (S.cand.get(k) || {}).bloc); return i < 0 ? 99 : i; };
const byBloc = (ka, kb) => blocRank(ka) - blocRank(kb) || FMT.coll.compare(candName(ka), candName(kb));
const growthMap = () => S.data.codebook.growth || {};
function shortName(name) {
  const w = name.split(" ");
  if (w.length < 2) return name;
  const i = w.length >= 3 && /^(le|la|de|du|des|d'|van)$/i.test(w[w.length - 2]) ? w.length - 2 : w.length - 1;
  return w.slice(i).join(" ");
}
const blocLabel = (k) => L((S.data.study.blocs || []).find((b) => b.key === k), "label") || t("bloc_other");

const currentPeriod = () => S.periods.find((x) => x.key === S.period) || S.periods[0];
function inPeriod() {
  const p = currentPeriod();
  return S.tweets.filter((tw) => (!p.start || tw.d >= p.start) && (!p.end || tw.d <= p.end));
}
function filtered() {
  const list = inPeriod();
  return S.bloc ? list.filter((tw) => (S.cand.get(tw.c) || {}).bloc === S.bloc) : list;
}
function byCandidate(tweets) {
  const m = new Map();
  for (const tw of tweets) {
    let s = m.get(tw.c);
    if (!s) { s = { key: tw.c, n: 0, eco: 0, fav: 0, neu: 0, cri: 0, tweets: [] }; m.set(tw.c, s); }
    s.n++; s.tweets.push(tw);
    if (tw.e) { s.eco++; if (tw.position === "favorable_transition") s.fav++; else if (tw.position === "critique_ecologie") s.cri++; else s.neu++; }
  }
  return [...m.values()].sort((a, b) => b.eco / b.n - a.eco / a.n || b.n - a.n);
}
// Catégorie la plus fréquente d'une variable parmi des tweets, hors « aucun » et « non applicable »
function topOf(tweets, varKey) {
  const counts = new Map();
  for (const tw of tweets) {
    const v = tw[varKey];
    for (const k of Array.isArray(v) ? v : [v]) if (k && !NULLISH.has(k)) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && tweets.length ? { key: best[0], n: best[1], share: best[1] / tweets.length } : null;
}

/* =================================================================== infobulle */
function showTip(anchor, title, rows, note) {
  const tip = $("#tooltip");
  tip.replaceChildren();
  if (title) tip.append(el("div", { class: "tt-title", text: title }));
  for (const r of rows || []) {
    const row = el("div", { class: "tt-row" });
    if (r.key) row.append(el("span", { class: r.keyShape === "swatch" ? "swatch" : "linekey", style: `background:${r.key}` }));
    row.append(el("strong", { text: r.value }), el("span", { text: r.label }));
    tip.append(row);
  }
  if (note) tip.append(el("div", { class: "tt-note", text: note }));
  tip.hidden = false;
  let x, y;
  if (anchor && anchor.clientX !== undefined && anchor.type !== "focus") { x = anchor.clientX; y = anchor.clientY; }
  else { const r = (anchor.currentTarget || anchor.target || anchor).getBoundingClientRect(); x = r.left + r.width / 2; y = r.bottom; }
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let left = x + 14, top = y + 14;
  if (left + w > innerWidth - 8) left = Math.max(8, x - w - 14);
  if (top + h > innerHeight - 8) top = Math.max(8, y - h - 14);
  tip.style.left = left + "px"; tip.style.top = top + "px";
}
function hideTip() { $("#tooltip").hidden = true; }
function hoverable(node, build) {
  if (!node.hasAttribute("tabindex") && !/^(BUTTON|A)$/.test(node.tagName)) node.tabIndex = 0;
  const on = (e) => { const b = build(); showTip(e, b.title, b.rows, b.note); };
  node.addEventListener("pointermove", on);
  node.addEventListener("focus", on);
  node.addEventListener("pointerleave", hideTip);
  node.addEventListener("blur", hideTip);
}

/* =================================================================== bulles d'info */
let popoverAnchor = null;
function closePopover() {
  $("#popover").hidden = true;
  if (popoverAnchor) { popoverAnchor.setAttribute("aria-expanded", "false"); popoverAnchor = null; }
}
function refsList(refs) {
  if (!refs || !refs.length) return null;
  return el("ul", { class: "refs" }, refs.map((r) => el("li", {}, r.url ? el("a", { href: r.url, target: "_blank", rel: "noopener", text: r.texte }) : r.texte)));
}
function openPopover(btn, build) {
  if (popoverAnchor === btn) { closePopover(); return; }
  closePopover();
  const pop = $("#popover");
  pop.replaceChildren(el("button", { class: "close", type: "button", "aria-label": t("close"), onclick: closePopover, text: "×" }), ...build());
  pop.hidden = false;
  popoverAnchor = btn; btn.setAttribute("aria-expanded", "true");
  const r = btn.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.min(Math.max(16, r.left - 12), innerWidth - w - 16);
  let top = r.bottom + 8;
  if (top + h > innerHeight - 12) top = Math.max(12, r.top - h - 8);
  pop.style.left = left + "px"; pop.style.top = top + "px";
  pop.querySelector(".close").focus({ preventScroll: true });
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#popover").hidden) { const a = popoverAnchor; closePopover(); a && a.focus(); } });
document.addEventListener("pointerdown", (e) => { if (!$("#popover").hidden && !e.target.closest("#popover") && !e.target.closest(".info-btn")) closePopover(); });
addEventListener("scroll", debounce(closePopover, 50), { passive: true });

function fwBody(f) {
  return [el("h3", { text: L(f, "label") }), el("p", { class: "who", text: L(f, "auteurs") }), el("p", { text: L(f, "resume") }),
    el("p", {}, el("strong", { text: t("in_this_study") + " " }), L(f, "dans_l_etude")), refsList(f.refs)];
}
function infoBtn(fwKey) {
  const f = S.fw.get(fwKey);
  if (!f) return null;
  const btn = el("button", { class: "info-btn", type: "button", "aria-label": t("info_about", { label: L(f, "label") }), "aria-expanded": "false", text: "i" });
  btn.addEventListener("click", () => openPopover(btn, () => fwBody(f)));
  return btn;
}
function catInfoBtn(varKey, optKey) {
  const def = optDef(varKey, optKey);
  const v = V(varKey);
  if (!def || !v) return null;
  const btn = el("button", { class: "info-btn", type: "button", "aria-label": t("definition_of", { label: optLabel(varKey, optKey) }), "aria-expanded": "false", text: "i" });
  btn.addEventListener("click", () => openPopover(btn, () => {
    const f = S.fw.get(v.framework);
    return [el("h3", { text: optLabel(varKey, optKey) }), el("p", { class: "who", text: f ? `${varLabel(varKey)} · ${L(f, "auteurs")}` : varLabel(varKey) }), el("p", { text: def }),
      f && DISCOURS_ORDER.includes(f.key) ? el("p", {}, el("a", { href: `#discours/${f.key}`, text: t("the_framework", { label: L(f, "label") }) })) : null, f ? refsList(f.refs) : null];
  }));
  return btn;
}
function titleWithInfo(tag, text, fwKey) { return el("div", { class: "title-row" }, el(tag, { text }), fwKey ? infoBtn(fwKey) : null); }

/* =================================================================== avatars et comptes */
function initials(name) { return name.split(/[\s-]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }
const photoCredit = (p) => `${t("photo")} ${L(p, "auteur") || t("unknown_author")}${p.licence ? ", " + p.licence : ""}`;
// Centre le visage dans un cadre carré : cadrage [x, y, zoom] issu de candidates.yaml, sinon haut de la photo
function framePhoto(img, cad) {
  const apply = () => {
    const r = img.naturalHeight / img.naturalWidth || 1.33, [fx, fy, z] = cad || [0.5, 0.3, 1];
    const w = z * Math.max(100, 100 / r), h = w * r;
    Object.assign(img.style, { position: "absolute", maxWidth: "none", objectFit: "fill", width: `${w}%`, height: `${h}%`,
      left: `${clamp(50 - fx * w, 100 - w, 0)}%`, top: `${clamp(50 - fy * h, 100 - h, 0)}%` });
  };
  if (img.complete && img.naturalWidth) apply(); else img.addEventListener("load", apply, { once: true });
  return img;
}
function avatar(key, size = 28) {
  const c = S.cand.get(key) || { name: key };
  const box = el("span", { class: "avatar", style: `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px`, "aria-hidden": "true" });
  if (c.photo && c.photo.url) {
    const img = el("img", { src: c.photo.url, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer", title: photoCredit(c.photo) });
    img.addEventListener("error", () => { box.replaceChildren(initials(c.name)); });
    box.append(framePhoto(img, c.photo.cadrage));
  } else box.append(initials(c.name));
  return box;
}
const ACCOUNT = {
  actif: null,
  peu_actif: { cls: "warning", ico: "!" },
  introuvable: { cls: "critical", ico: "✕" },
  protege: { cls: "warning", ico: "!" },
  sans_compte: { cls: "critical", ico: "✕" },
  en_attente: { cls: "", ico: "…" },
};
const accountText = (k) => t("account_" + (k || "actif"));
function accountBadge(c) {
  const a = ACCOUNT[c.compte];
  if (!a) return null;
  return el("span", { class: `badge ${a.cls}`, title: L(c, "note") || accountText(c.compte) }, el("span", { class: "ico", "aria-hidden": "true", text: a.ico }), accountText(c.compte));
}

/* =================================================================== cartes et tableaux */
function tableToggle(id) {
  const isOpen = S.openTables.has(id);
  const btn = el("button", { class: "table-toggle", type: "button", "aria-expanded": String(isOpen), "aria-controls": id + "-table", text: isOpen ? t("table_hide") : t("table_show") });
  btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") !== "true";
    if (open) S.openTables.add(id); else S.openTables.delete(id);
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? t("table_hide") : t("table_show");
    const view = document.getElementById(id + "-table");
    view.hidden = !open;
    if (open) renderTable(id);
  });
  return btn;
}
function setTable(id, headers, rows) {
  S.tables.set(id, { headers, rows });
  const view = document.getElementById(id + "-table");
  if (view && !view.hidden) renderTable(id);
}
function renderTable(id) {
  const view = document.getElementById(id + "-table");
  const spec = S.tables.get(id);
  view.replaceChildren();
  if (!spec || !spec.rows.length) { view.append(el("p", { class: "empty", text: t("no_data") })); return; }
  view.append(el("table", {},
    el("thead", {}, el("tr", {}, spec.headers.map((h) => el("th", { class: h.num ? "num" : null, text: h.label })))),
    el("tbody", {}, spec.rows.map((r) => el("tr", {}, r.map((v, i) => el("td", { class: spec.headers[i].num ? "num" : null, text: v })))))));
}
function card(id, title, fwKey, sub, ...body) {
  return el("section", { class: "card", id },
    el("header", { class: "card-head" }, el("div", {}, titleWithInfo("h2", title, fwKey), sub ? el("p", { class: "sub", text: sub }) : null), tableToggle(id)),
    ...body, el("div", { class: "table-view", id: id + "-table", hidden: !S.openTables.has(id) }));
}
function option(value, label, selected) { return el("option", { value, selected: selected ? true : null, text: label }); }
function segCtrl(items, current, onPick, label) {
  return el("div", { class: "seg-ctrl", role: "group", "aria-label": label }, items.map(([k, text]) =>
    el("button", { type: "button", "aria-pressed": String(k === current), text, onclick: () => onPick(k) })));
}
const sectionIntro = (title, text, ...extra) => el("div", { class: "section-intro" }, el("h2", { text: title }), el("p", { text }), ...extra);

/* =================================================================== graphiques */
function barName(key, n, threshold = MIN_N) {
  return el("div", { class: "bar-name", title: candName(key) }, avatar(key, 22), el("span", { class: "nm", text: candName(key) }),
    n < threshold ? el("small", { text: `n=${n}` }) : null);
}

// Saillance : en part (ce que chacun consacre à l'écologie) ou en volume (l'écologie dans l'ensemble des tweets)
function renderSaillance(box, stats) {
  box.replaceChildren();
  if (!stats.length) { box.append(el("p", { class: "empty", text: t("empty_period") })); setTable("saillance", [], []); return; }
  const volume = S.salMode === "volume";
  if (volume) box.append(el("div", { class: "legend" },
    el("span", { class: "key" }, el("span", { class: "swatch", style: "background:var(--accent)" }), t("th_eco_tweets")),
    el("span", { class: "key" }, el("span", { class: "swatch", style: "background:var(--neutral-mark)" }), t("other_tweets"))));
  const rows = volume ? [...stats].sort((a, b) => b.n - a.n) : stats;
  const max = volume ? Math.max(...rows.map((s) => s.n), 1) : Math.max(...rows.map((s) => s.eco / s.n), 0.0001);
  const grid = el("div", { class: "bars" });
  for (const s of rows) {
    const share = s.eco / s.n, focus = S.focus === s.key, dim = S.focus && !focus;
    const track = el("div", { class: "bar-track", "aria-label": t("aria_share", { name: candName(s.key), v: pct(share), eco: num(s.eco), n: num(s.n) }) },
      volume ? el("div", { class: "stackbar" + (dim ? " dim" : ""), style: `width:${(s.n / max) * 80}%` }, el("span", { class: "eco", style: `width:${share * 100}%` }))
        : el("div", { class: "bar" + (dim ? " dim" : ""), style: `width:${(share / max) * 80}%` }),
      el("span", { class: "bar-value", text: volume ? t("vol_value", { eco: num(s.eco), n: num(s.n) }) : pct(share) }));
    hoverable(track, () => ({ title: candName(s.key), rows: [{ value: pct(share), label: t("tt_eco_share") }, { value: num(s.eco), label: t("tt_eco_of", { n: num(s.n) }) }],
      note: s.n < MIN_N ? t("fragile_n", { n: MIN_N }) : null }));
    grid.append(el("div", { class: "bar-row" + (focus ? " is-focus" : "") }, barName(s.key, s.n), track));
  }
  box.append(grid);
  setTable("saillance", [{ label: t("th_candidate") }, { label: t("th_tweets"), num: true }, { label: t("th_eco_tweets"), num: true }, { label: t("th_share"), num: true }],
    rows.map((s) => [candName(s.key), num(s.n), num(s.eco), pct(s.eco / s.n)]));
}

// Engagement relatif des tweets écologie, par candidat et par registre (échelle logarithmique centrée sur ×1)
function renderEngagement(box, tweets) {
  box.replaceChildren();
  const eco = tweets.filter((tw) => tw.e && relEng(tw) !== null);
  if (!eco.length) { box.append(el("p", { class: "empty", text: S.engBase.size ? t("eng_empty") : t("eng_pending") })); setTable("engagement", [], []); return; }
  const group = (list, keyOf) => { const m = new Map(); for (const tw of list) { const k = keyOf(tw); if (!m.has(k)) m.set(k, []); m.get(k).push(relEng(tw)); } return m; };
  const cand = [...group(eco, (tw) => tw.c)].filter(([, v]) => v.length >= 3).map(([k, v]) => ({ key: k, n: v.length, v: median(v) })).sort((a, b) => b.v - a.v);
  const reg = V("registre").options.map((o) => ({ key: o.key, list: eco.filter((tw) => tw.registre === o.key).map(relEng) })).filter((r) => r.list.length >= 3)
    .map((r) => ({ key: r.key, n: r.list.length, v: median(r.list) }));
  const LIM = 2; // de ×1/4 à ×4
  const pos = (v) => 50 + (clamp(Math.log2(Math.max(v, 1e-3)), -LIM, LIM) / LIM) * 46;
  const row = (name, r, isCand) => {
    const track = el("div", { class: "log-track" + (isCand && S.focus && S.focus !== r.key ? " dimmed" : ""), "aria-label": t("eng_aria", { name: isCand ? candName(r.key) : name, v: times(r.v) }) },
      el("span", { class: "log-dot" + (r.v >= 1 ? " up" : " down"), style: `left:${pos(r.v)}%` }),
      el("span", { class: "seg-label", style: r.v >= 1 ? `left:${pos(r.v) + 2}%` : `right:${100 - pos(r.v) + 2}%`, text: times(r.v) }));
    hoverable(track, () => ({ title: isCand ? candName(r.key) : name, rows: [{ value: times(r.v), label: t("eng_tt_median") }, { value: num(r.n), label: t("eng_tt_n") }],
      note: r.n < MIN_N ? t("fragile_eco", { n: MIN_N }) : null }));
    return el("div", { class: "bar-row" + (isCand && S.focus === r.key ? " is-focus" : "") }, isCand ? barName(r.key, r.n) : el("div", { class: "bar-name", text: name }), track);
  };
  const axis = () => el("div", { class: "div-axis" }, el("span"), el("div", { class: "div-axis-inner" }, el("span", { text: t("eng_axis_less") }), el("span", { text: "×1" }), el("span", { text: t("eng_axis_more") })));
  box.append(el("div", { class: "bars" }, cand.map((r) => row(null, r, true))), axis());
  if (reg.length) box.append(el("h3", { class: "block-sub", text: t("eng_by_register") }), el("div", { class: "bars" }, reg.map((r) => row(optLabel("registre", r.key), r, false))), axis());
  box.append(el("p", { class: "note-small", text: t("eng_note", { n: ENG_MIN }) }));
  setTable("engagement", [{ label: t("th_candidate") }, { label: t("eng_th_n"), num: true }, { label: t("eng_th_median"), num: true }],
    [...cand.map((r) => [candName(r.key), num(r.n), times(r.v)]), ...reg.map((r) => [optLabel("registre", r.key), num(r.n), times(r.v)])]);
}

function renderPosition(box, stats) {
  box.replaceChildren(el("div", { class: "legend" },
    el("span", { class: "key" }, el("span", { class: "swatch", style: "background:var(--accent-2)" }), optLabel("position", "critique_ecologie")),
    el("span", { class: "key" }, el("span", { class: "swatch", style: "background:var(--neutral-mark)" }), optLabel("position", "neutre")),
    el("span", { class: "key" }, el("span", { class: "swatch", style: "background:var(--accent)" }), optLabel("position", "favorable_transition"))));
  const rows = stats.filter((s) => s.eco >= 3).map((s) => ({ ...s, f: s.fav / s.eco, u: s.neu / s.eco, c: s.cri / s.eco })).sort((a, b) => (b.f - b.c) - (a.f - a.c));
  const excluded = stats.filter((s) => s.eco > 0 && s.eco < 3).length;
  if (!rows.length) { box.append(el("p", { class: "empty", text: t("position_empty") })); setTable("position", [], []); return; }
  const M = Math.max(...rows.map((r) => Math.max(r.c + r.u / 2, r.f + r.u / 2)), 0.5);
  const narrow = innerWidth <= 760;
  const trackW = Math.max(140, narrow ? ((box.clientWidth || 340) - 12) * 0.66 : (box.clientWidth || 900) - 202);
  const half = Math.min(46, 50 - (40 / trackW) * 100);
  const sc = (x) => (x / M) * half;
  const grid = el("div", { class: "bars" });
  for (const r of rows) {
    const focus = S.focus === r.key, dim = S.focus && !focus;
    const track = el("div", { class: "div-track" + (dim ? " dimmed" : ""), "aria-label": t("aria_position", { name: candName(r.key), f: pct(r.f), u: pct(r.u), c: pct(r.c) }) });
    const nl = 50 - sc(r.u / 2), nr = 50 + sc(r.u / 2);
    const segs = [];
    if (r.c > 0) segs.push(el("div", { class: "seg cri", style: `left:${nl - sc(r.c)}%;width:${sc(r.c)}%` }));
    if (r.u > 0) segs.push(el("div", { class: "seg neu", style: `left:${nl}%;width:${nr - nl}%` }));
    if (r.f > 0) segs.push(el("div", { class: "seg fav", style: `left:${nr}%;width:${sc(r.f)}%` }));
    segs.forEach((sg, i) => { const a = i === 0 ? 4 : 0, b = i === segs.length - 1 ? 4 : 0; sg.style.borderRadius = `${a}px ${b}px ${b}px ${a}px`; });
    track.append(...segs);
    if (r.c > 0) track.append(el("span", { class: "seg-label", style: `right:${100 - (nl - sc(r.c)) + 1}%`, text: pct(r.c, 0) }));
    if (r.f > 0) track.append(el("span", { class: "seg-label", style: `left:${nr + sc(r.f) + 1}%`, text: pct(r.f, 0) }));
    hoverable(track, () => ({ title: `${candName(r.key)} · ${tn("n_eco_tweets", r.eco)}`, rows: [
      { value: pct(r.f), label: t("pos_fav"), key: "var(--accent)", keyShape: "swatch" },
      { value: pct(r.u), label: t("pos_neu"), key: "var(--neutral-mark)", keyShape: "swatch" },
      { value: pct(r.c), label: t("pos_cri"), key: "var(--accent-2)", keyShape: "swatch" }],
      note: r.eco < MIN_N ? t("fragile_eco", { n: MIN_N }) : null }));
    grid.append(el("div", { class: "bar-row" + (focus ? " is-focus" : "") }, barName(r.key, r.eco), track));
  }
  box.append(grid, el("div", { class: "div-axis" }, el("span"), el("div", { class: "div-axis-inner" }, el("span", { text: t("axis_more_critical") }), el("span", { text: t("axis_more_favorable") }))));
  if (excluded) box.append(el("p", { class: "note-small", text: tn("position_excluded", excluded) }));
  setTable("position", [{ label: t("th_candidate") }, { label: t("th_eco_tweets"), num: true }, { label: t("th_favorable"), num: true }, { label: t("th_neutral"), num: true }, { label: t("th_critical"), num: true }],
    rows.map((r) => [candName(r.key), num(r.eco), pct(r.f), pct(r.u), pct(r.c)]));
}

function weekly(tweets) {
  const m = new Map();
  for (const tw of tweets) { const w = weekStart(tw.d); const s = m.get(w) || { n: 0, eco: 0 }; s.n++; s.eco += tw.e; m.set(w, s); }
  return m;
}
// Semaines continues entre la première et la dernière semaine observées
function weekRange(weeks) {
  const full = [];
  for (let d = parseDay(weeks[0]); isoDay(d) <= weeks[weeks.length - 1]; d.setUTCDate(d.getUTCDate() + 7)) full.push(isoDay(d));
  return full;
}
const EVO_MIN_WEEK = 3; // tweets d'un candidat dans la semaine pour entrer dans la dispersion
function renderEvolution(box, legend, tweets) {
  box.replaceChildren();
  if (!tweets.length) { legend.replaceChildren(); box.append(el("p", { class: "empty", text: t("empty_period") })); setTable("evolution", [], []); return; }
  const all = weekly(tweets);
  const full = weekRange([...all.keys()].sort());
  const perCand = new Map();
  for (const k of new Set(tweets.map((tw) => tw.c))) perCand.set(k, weekly(tweets.filter((tw) => tw.c === k)));
  if (S.evoMode === "candidats") { legend.replaceChildren(); renderEvolutionGrid(box, full, all, perCand); return; }
  // Dispersion : moitié centrale des candidats (1er au 3e quartile) de chaque semaine
  const band = new Map();
  for (const w of full) {
    const shares = [...perCand].map(([k, m]) => ({ k, v: m.get(w) })).filter((x) => x.v && x.v.n >= EVO_MIN_WEEK).map((x) => ({ k: x.k, s: x.v.eco / x.v.n }));
    if (shares.length >= 3) { const v = shares.map((x) => x.s); const top = shares.reduce((a, b) => (b.s > a.s ? b : a)); band.set(w, { lo: quantile(v, 0.25), hi: quantile(v, 0.75), n: shares.length, top }); }
  }
  const series = [{ name: S.bloc ? t("series_bloc") : t("series_all"), data: all, color: S.focus ? "var(--muted)" : "var(--accent)" }];
  if (S.focus) series.push({ name: candName(S.focus), data: perCand.get(S.focus) || new Map(), color: "var(--accent)" });
  legend.replaceChildren(
    ...series.map((s) => el("span", { class: "key" }, el("span", { class: "linekey", style: `background:${s.color}` }), s.name)),
    band.size ? el("span", { class: "key" }, el("span", { class: "swatch band-key" }), t("evo_band")) : null,
    el("span", { class: "key" }, el("span", { class: "swatch", style: "background:var(--neutral-mark)" }), t("evo_volume")));
  const W = Math.max(320, box.clientWidth || 640), VOL = 46, H = 300 + VOL, m = { t: 22, r: 16, b: 28, l: 44 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b - VOL - 10;
  const values = [...series.flatMap((s) => full.map((w) => s.data.get(w)).filter(Boolean).map((v) => v.eco / v.n)), ...[...band.values()].map((b) => b.hi)];
  const ymax = [0.04, 0.08, 0.12, 0.2, 0.3, 0.4, 0.6, 0.8, 1].find((s) => s >= Math.max(...values, 0.01) * 1.08) || 1;
  const x = (i) => m.l + (full.length === 1 ? iw / 2 : (i / (full.length - 1)) * iw);
  const y = (v) => m.t + ih - (Math.min(v, ymax) / ymax) * ih;
  const root = svg("svg", { class: "line-chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": t("evo_aria") });
  for (let i = 0; i <= 4; i++) {
    const v = (ymax * i) / 4;
    root.append(svg("line", { class: i === 0 ? "base-line" : "grid-line", x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
    const tx = svg("text", { class: "axis-text", x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }); tx.textContent = pct(v, 0); root.append(tx);
  }
  // bande de dispersion, interrompue là où moins de trois candidats ont assez de tweets
  let run = [];
  const flush = () => { if (run.length > 1) root.append(svg("path", { class: "band", d: "M" + run.map(([i, b]) => `${x(i).toFixed(1)},${y(b.hi).toFixed(1)}`).join("L") + "L" + [...run].reverse().map(([i, b]) => `${x(i).toFixed(1)},${y(b.lo).toFixed(1)}`).join("L") + "Z" })); run = []; };
  full.forEach((w, i) => { const b = band.get(w); if (b) run.push([i, b]); else flush(); });
  flush();
  // volume hebdomadaire sous la courbe : tous les tweets, et la part écologie en couleur
  const vTop = m.t + ih + 10, vmax = Math.max(...full.map((w) => (all.get(w) || { n: 0 }).n), 1), bw = Math.max(2, Math.min(18, (iw / full.length) * 0.7));
  full.forEach((w, i) => {
    const v = all.get(w); if (!v) return;
    const hAll = (v.n / vmax) * VOL, hEco = (v.eco / vmax) * VOL;
    root.append(svg("rect", { class: "vol-all", x: x(i) - bw / 2, y: vTop + VOL - hAll, width: bw, height: hAll, rx: 1.5 }),
      svg("rect", { class: "vol-eco", x: x(i) - bw / 2, y: vTop + VOL - hEco, width: bw, height: hEco, rx: 1.5 }));
  });
  const every = Math.max(1, Math.ceil(full.length / Math.floor(iw / 70)));
  full.forEach((w, i) => { if (i % every) return; const tx = svg("text", { class: "axis-text", x: x(i), y: H - 8, "text-anchor": "middle" }); tx.textContent = fmtShort(w); root.append(tx); });
  let lastX = -1e9;
  for (const ev of S.data.study.events || []) {
    const i = full.indexOf(weekStart(ev.date));
    if (i < 0) continue;
    const ex = x(i);
    root.append(svg("line", { class: "event-line", x1: ex, x2: ex, y1: m.t - 6, y2: m.t + ih }));
    if (ex - lastX > 110) { const end = ex > W - 120; const tx = svg("text", { class: "event-text", x: end ? ex - 4 : ex + 4, y: m.t - 8, "text-anchor": end ? "end" : "start" }); tx.textContent = L(ev, "label"); root.append(tx); lastX = ex; }
  }
  const ends = [];
  for (const s of series) {
    let d = "", pen = false, last = null;
    full.forEach((w, i) => { const v = s.data.get(w); if (!v) { pen = false; return; } const px = x(i), py = y(v.eco / v.n); d += (pen ? "L" : "M") + px.toFixed(1) + "," + py.toFixed(1); pen = true; last = { px, py, v }; });
    root.append(svg("path", { class: "series", d, style: `stroke:${s.color}` }));
    if (last) { root.append(svg("circle", { cx: last.px, cy: last.py, r: 4, style: `fill:${s.color};stroke:var(--surface);stroke-width:2` })); ends.push(last); }
  }
  if (!(ends.length > 1 && Math.abs(ends[0].py - ends[1].py) < 16)) for (const e of ends) {
    const right = e.px > W - 130;
    const tx = svg("text", { class: "end-label", x: right ? e.px - 8 : e.px + 8, y: e.py - 8, "text-anchor": right ? "end" : "start" }); tx.textContent = pct(e.v.eco / e.v.n, 0); root.append(tx);
  }
  const cross = svg("line", { class: "crosshair", y1: m.t, y2: vTop + VOL, visibility: "hidden" });
  const hit = svg("rect", { x: m.l, y: m.t, width: iw, height: vTop + VOL - m.t, fill: "transparent", tabindex: 0 });
  root.append(cross, hit);
  const at = (i) => {
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
    const w = full[i], b = band.get(w), v = all.get(w);
    return { title: t("week_of", { date: fmtDay(w) }),
      rows: [...series.map((s) => { const sv = s.data.get(w); return { value: sv ? pct(sv.eco / sv.n) : "–", label: sv ? `${s.name} (${sv.eco}/${sv.n})` : t("no_tweet_series", { name: s.name }), key: s.color }; }),
        ...(b ? [{ value: `${pct(b.lo, 0)} – ${pct(b.hi, 0)}`, label: t("evo_tt_band", { n: b.n }), key: "var(--seq-1)", keyShape: "swatch" }] : [])],
      note: [b ? t("evo_tt_top", { name: candName(b.top.k), v: pct(b.top.s, 0) }) : null, v ? t("evo_tt_volume", { n: num(v.n), eco: num(v.eco) }) : null].filter(Boolean).join(" · ") };
  };
  let cur = full.length - 1;
  hit.addEventListener("pointermove", (e) => { const r = root.getBoundingClientRect(); cur = Math.max(0, Math.min(full.length - 1, Math.round(((((e.clientX - r.left) / r.width) * W - m.l) / iw) * (full.length - 1)))); const b = at(cur); showTip(e, b.title, b.rows, b.note); });
  hit.addEventListener("pointerleave", () => { hideTip(); cross.setAttribute("visibility", "hidden"); });
  hit.addEventListener("focus", (e) => { const b = at(cur); showTip(e, b.title, b.rows, b.note); });
  hit.addEventListener("blur", () => { hideTip(); cross.setAttribute("visibility", "hidden"); });
  hit.addEventListener("keydown", (e) => { if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return; e.preventDefault(); cur = Math.max(0, Math.min(full.length - 1, cur + (e.key === "ArrowRight" ? 1 : -1))); const b = at(cur); showTip(hit, b.title, b.rows, b.note); });
  box.append(root);
  setTable("evolution", [{ label: t("th_week") }, ...series.flatMap((s) => [{ label: t("th_series_tweets", { name: s.name }), num: true }, { label: t("th_series_share"), num: true }]),
    { label: t("th_band"), num: true }],
    full.map((w) => { const b = band.get(w); return [fmtDay(w), ...series.flatMap((s) => { const v = s.data.get(w); return v ? [num(v.n), pct(v.eco / v.n)] : ["0", "–"]; }),
      b ? `${pct(b.lo, 0)} – ${pct(b.hi, 0)}` : "–"]; }));
}
// Positions dans le temps : position face à l'écologie, volume de tweets et réaction du public, semaine par
// semaine, pour l'ensemble, une famille ou un candidat (filtres du haut de page)
const PT_MIN = 3; // tweets écologie dans la semaine pour une répartition des positions lisible
function renderPositionTime(box, legend, tweets) {
  box.replaceChildren();
  const subj = S.focus ? tweets.filter((tw) => tw.c === S.focus) : tweets;
  const name = S.focus ? candName(S.focus) : S.bloc ? blocLabel(S.bloc) : t("series_all");
  if (!subj.some((tw) => tw.e)) { legend.replaceChildren(); box.append(el("p", { class: "empty", text: t("empty_eco_period") })); setTable("position-temps", [], []); return; }
  const weeks = new Map();
  for (const tw of subj) {
    const w = weekStart(tw.d), s = weeks.get(w) || { n: 0, eco: 0, fav: 0, neu: 0, cri: 0, rel: [] };
    s.n++;
    if (tw.e) {
      s.eco++;
      if (tw.position === "favorable_transition") s.fav++; else if (tw.position === "critique_ecologie") s.cri++; else s.neu++;
      const r = relEng(tw); if (r !== null) s.rel.push(r);
    }
    weeks.set(w, s);
  }
  const full = weekRange([...weeks.keys()].sort());
  const STANCES = [["fav", "favorable_transition", t("th_favorable")], ["neu", "neutre", t("th_neutral")], ["cri", "critique_ecologie", t("th_critical")]];
  legend.replaceChildren(el("span", { class: "legend-title", text: name }),
    ...STANCES.map(([, k, label]) => el("span", { class: "key" }, el("span", { class: "swatch", style: `background:${POS_COLOR[k]}` }), label)),
    el("span", { class: "key" }, el("span", { class: "linekey", style: "background:var(--ink-2)" }), t("pt_reaction")));
  // trois bandes alignées : positions (100 %), volume, réaction (échelle logarithmique autour de ×1)
  const W = Math.max(320, box.clientWidth || 640), m = { t: 26, r: 16, b: 26, l: 52 }, P1 = 150, P2 = 64, P3 = 104, GAP = 26;
  const H = m.t + P1 + GAP + P2 + GAP + P3 + m.b, iw = W - m.l - m.r;
  const y1 = m.t, y2 = y1 + P1 + GAP, y3 = y2 + P2 + GAP;
  const x = (i) => m.l + (full.length === 1 ? iw / 2 : (i / (full.length - 1)) * iw);
  const bw = Math.max(3, Math.min(22, (iw / full.length) * 0.72));
  const root = svg("svg", { class: "line-chart pt-chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": t("pt_aria", { name }) });
  const label = (txt, yy) => { const tx = svg("text", { class: "pt-panel", x: m.l, y: yy - 9 }); tx.textContent = txt; root.append(tx); };
  const axis = (txt, yy) => { const tx = svg("text", { class: "axis-text", x: m.l - 8, y: yy + 4, "text-anchor": "end" }); tx.textContent = txt; root.append(tx); };
  // 1. positions
  label(t("pt_panel_stance"), y1);
  for (const v of [0, 0.5, 1]) { root.append(svg("line", { class: v === 0 ? "base-line" : "grid-line", x1: m.l, x2: W - m.r, y1: y1 + P1 - v * P1, y2: y1 + P1 - v * P1 })); axis(pct(v, 0), y1 + P1 - v * P1); }
  full.forEach((w, i) => {
    const s = weeks.get(w); if (!s || !s.eco) return;
    let acc = 0;
    for (const [f, k] of STANCES) {
      const h = (s[f] / s.eco) * P1; if (!h) continue;
      root.append(svg("rect", { x: x(i) - bw / 2, y: y1 + P1 - acc - h, width: bw, height: h, style: `fill:${POS_COLOR[k]}`, opacity: s.eco >= PT_MIN ? 1 : 0.35 }));
      acc += h;
    }
  });
  // 2. volume : tous les tweets, la part écologie en couleur
  label(t("pt_panel_volume"), y2);
  const vmax = Math.max(...full.map((w) => (weeks.get(w) || { n: 0 }).n), 1);
  root.append(svg("line", { class: "base-line", x1: m.l, x2: W - m.r, y1: y2 + P2, y2: y2 + P2 }));
  axis(num(vmax), y2); axis("0", y2 + P2);
  full.forEach((w, i) => {
    const s = weeks.get(w); if (!s) return;
    const hA = (s.n / vmax) * P2, hE = (s.eco / vmax) * P2;
    root.append(svg("rect", { class: "vol-all", x: x(i) - bw / 2, y: y2 + P2 - hA, width: bw, height: hA, rx: 1.5 }),
      svg("rect", { class: "vol-eco", x: x(i) - bw / 2, y: y2 + P2 - hE, width: bw, height: hE, rx: 1.5 }));
  });
  // 3. réaction : engagement relatif médian des tweets écologie (×1 = l'habitude du candidat)
  label(t("pt_panel_reaction"), y3);
  const LMAX = 3; // de ×1/8 à ×8
  const ry = (v) => y3 + P3 / 2 - (Math.max(-LMAX, Math.min(LMAX, Math.log2(v))) / LMAX) * (P3 / 2);
  for (const v of [0.25, 1, 4]) { root.append(svg("line", { class: v === 1 ? "pt-one" : "grid-line", x1: m.l, x2: W - m.r, y1: ry(v), y2: ry(v) })); axis(times(v), ry(v)); }
  let d = "", pen = false;
  full.forEach((w, i) => {
    const s = weeks.get(w);
    if (!s || s.rel.length < 2) { pen = false; return; }
    const v = median(s.rel), px = x(i), py = ry(v);
    d += (pen ? "L" : "M") + px.toFixed(1) + "," + py.toFixed(1); pen = true;
    root.append(svg("circle", { cx: px, cy: py, r: 3.2, class: "pt-dot" }));
  });
  root.append(svg("path", { class: "series pt-line", d }));
  // axe du temps et événements, sur les trois bandes
  const every = Math.max(1, Math.ceil(full.length / Math.floor(iw / 70)));
  full.forEach((w, i) => { if (i % every) return; const tx = svg("text", { class: "axis-text", x: x(i), y: H - 6, "text-anchor": "middle" }); tx.textContent = fmtShort(w); root.append(tx); });
  let lastX = -1e9;
  for (const ev of S.data.study.events || []) {
    const i = full.indexOf(weekStart(ev.date)); if (i < 0) continue;
    const ex = x(i);
    root.append(svg("line", { class: "event-line", x1: ex, x2: ex, y1: y1 - 4, y2: y3 + P3 }));
    if (ex - lastX > 110) { const end = ex > W - 120; const tx = svg("text", { class: "event-text", x: end ? ex - 4 : ex + 4, y: y1 - 14, "text-anchor": end ? "end" : "start" }); tx.textContent = L(ev, "label"); root.append(tx); lastX = ex; }
  }
  const cross = svg("line", { class: "crosshair", y1: y1, y2: y3 + P3, visibility: "hidden" });
  const hit = svg("rect", { x: m.l, y: y1, width: iw, height: y3 + P3 - y1, fill: "transparent", tabindex: 0 });
  root.append(cross, hit);
  const at = (i) => {
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
    const w = full[i], s = weeks.get(w) || { n: 0, eco: 0, fav: 0, neu: 0, cri: 0, rel: [] };
    const rows = s.eco ? STANCES.map(([f, k, lab]) => ({ value: pct(s[f] / s.eco, 0), label: `${lab} (${s[f]})`, key: POS_COLOR[k], keyShape: "swatch" })) : [];
    rows.push({ value: num(s.n), label: t("pt_tt_volume", { eco: num(s.eco) }) });
    if (s.rel.length >= 2) rows.push({ value: times(median(s.rel)), label: t("pt_tt_reaction", { n: s.rel.length }) });
    return { title: t("week_of", { date: fmtDay(w) }), rows, note: s.eco && s.eco < PT_MIN ? t("pt_few") : null };
  };
  let cur = full.length - 1;
  const show = (e, anchor) => { const b = at(cur); showTip(anchor || e, b.title, b.rows, b.note); };
  hit.addEventListener("pointermove", (e) => { const r = root.getBoundingClientRect(); cur = Math.max(0, Math.min(full.length - 1, Math.round(((((e.clientX - r.left) / r.width) * W - m.l) / iw) * (full.length - 1)))); show(e); });
  hit.addEventListener("pointerleave", () => { hideTip(); cross.setAttribute("visibility", "hidden"); });
  hit.addEventListener("focus", (e) => show(e));
  hit.addEventListener("blur", () => { hideTip(); cross.setAttribute("visibility", "hidden"); });
  hit.addEventListener("keydown", (e) => { if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return; e.preventDefault(); cur = Math.max(0, Math.min(full.length - 1, cur + (e.key === "ArrowRight" ? 1 : -1))); show(e, hit); });
  box.append(root);
  setTable("position-temps", [{ label: t("th_week") }, { label: t("th_tweets"), num: true }, { label: t("th_eco_tweets"), num: true },
    { label: t("th_favorable"), num: true }, { label: t("th_neutral"), num: true }, { label: t("th_critical"), num: true }, { label: t("pt_reaction"), num: true }],
    full.map((w) => { const s = weeks.get(w) || { n: 0, eco: 0, fav: 0, neu: 0, cri: 0, rel: [] };
      return [fmtDay(w), num(s.n), num(s.eco), ...["fav", "neu", "cri"].map((f) => (s.eco ? pct(s[f] / s.eco, 0) : "–")), s.rel.length >= 2 ? times(median(s.rel)) : "–"]; }));
}
// Petits multiples : une courbe par candidat, sur une échelle commune, avec l'ensemble en gris
function renderEvolutionGrid(box, full, all, perCand) {
  const rows = [...perCand].map(([k, m]) => { let n = 0, eco = 0; for (const v of m.values()) { n += v.n; eco += v.eco; } return { k, m, n, eco }; })
    .filter((r) => r.n >= MIN_N_SCALE).sort((a, b) => byBloc(a.k, b.k));
  const pts = rows.flatMap((r) => [...r.m.values()].filter((v) => v.n >= EVO_MIN_WEEK).map((v) => v.eco / v.n));
  const ymax = [0.1, 0.2, 0.3, 0.4, 0.6, 0.8, 1].find((s) => s >= Math.max(...pts, 0.02) * 1.05) || 1;
  const W = 220, H = 74, pad = 4;
  const x = (i) => pad + (full.length === 1 ? (W - 2 * pad) / 2 : (i / (full.length - 1)) * (W - 2 * pad));
  const y = (v) => H - pad - (v / ymax) * (H - 2 * pad);
  const path = (m, minN) => { let d = "", pen = false; full.forEach((w, i) => { const v = m.get(w); if (!v || v.n < minN) { pen = false; return; } d += (pen ? "L" : "M") + x(i).toFixed(1) + "," + y(v.eco / v.n).toFixed(1); pen = true; }); return d; };
  const ref = path(all, 1);
  box.append(el("p", { class: "note-small", text: t("evo_grid_note", { max: pct(ymax, 0), n: EVO_MIN_WEEK }) }),
    el("div", { class: "multiples" }, rows.map((r) => {
      const g = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "mini", role: "img", "aria-label": t("aria_share", { name: candName(r.k), v: pct(r.eco / r.n), eco: num(r.eco), n: num(r.n) }) });
      g.append(svg("line", { class: "base-line", x1: 0, x2: W, y1: H - pad, y2: H - pad }), svg("path", { class: "series ref", d: ref }), svg("path", { class: "series", d: path(r.m, EVO_MIN_WEEK), style: "stroke:var(--accent)" }));
      const cell = el("div", { class: "mini-cell" + (S.focus === r.k ? " is-focus" : "") }, el("div", { class: "mini-head" }, avatar(r.k, 20), el("span", { class: "nm", text: candName(r.k) }), el("span", { class: "v", text: pct(r.eco / r.n, 0) })), g);
      hoverable(cell, () => ({ title: candName(r.k), rows: [{ value: pct(r.eco / r.n), label: t("tt_eco_share") }, { value: num(r.eco), label: t("tt_eco_of", { n: num(r.n) }) }] }));
      return cell;
    })));
  setTable("evolution", [{ label: t("th_candidate") }, { label: t("th_tweets"), num: true }, { label: t("th_share"), num: true }], rows.map((r) => [candName(r.k), num(r.n), pct(r.eco / r.n)]));
}

/* Heatmap générique. rows : [{key, label, n, values:{col:share}, counts:{col:count}, avatar?}] */
function renderHeat(box, id, rows, cols, opts = {}) {
  box.replaceChildren();
  if (!rows.length) { box.append(el("p", { class: "empty", text: opts.empty || t("empty_period") })); setTable(id, [], []); return; }
  const scaleRows = rows.some((r) => r.n >= MIN_N_SCALE) ? rows.filter((r) => r.n >= MIN_N_SCALE) : rows;
  const vals = scaleRows.flatMap((r) => cols.map((c) => r.values[c.key])).filter((v) => v !== null && v !== undefined);
  const lo = opts.domain === "minmax" ? Math.min(...vals) : 0;
  const max = Math.max(...vals, lo + 0.0001);
  const q = (v) => (v <= lo ? 0 : Math.min(6, Math.ceil(((v - lo) / (max - lo)) * 7) - 1));
  // Polarité : échelle fixe de −1 (orange) à +1 (vert), neutre au centre
  const pol = !!opts.polarity, pq = (v) => clamp(Math.round(((v + 1) / 2) * 6), 0, 6);
  const clamped = rows.length !== scaleRows.length;
  const fmt = opts.format || ((v) => pct(v));
  const grid = el("div", { class: "heat", style: `--cols:${cols.length}` });
  grid.append(el("div"));
  cols.forEach((c) => grid.append(el("div", { class: "col-head", title: c.title || c.label, text: c.label })));
  let group = null;
  for (const r of rows) {
    const focus = S.focus && S.focus === r.key;
    if (S.cand.has(r.key) && blocRank(r.key) !== group) {
      group = blocRank(r.key);
      grid.append(el("div", { class: "heat-group", style: "grid-column:1/-1", text: blocLabel((S.cand.get(r.key) || {}).bloc) }));
    }
    grid.append(el("div", { class: "row-head" + (focus ? " is-focus" : "") + (r.n < MIN_N_SCALE ? " small-n" : ""), title: r.label },
      r.avatar === false ? null : avatar(r.key, 18), " ", el("span", { class: "full", text: r.label }), el("span", { class: "short", text: S.cand.has(r.key) ? shortName(r.label) : r.label }),
      r.n !== undefined ? el("small", { text: `n=${r.n}` }) : null));
    for (const c of cols) {
      const v = r.values[c.key];
      if (v === null || v === undefined) {
        const empty = el("div", { class: "cell", "aria-label": t("aria_cell_empty", { row: r.label, col: c.label }) });
        hoverable(empty, () => ({ title: `${r.label} · ${c.label}`, rows: [], note: t("not_enough_data") }));
        grid.append(empty); continue;
      }
      const selected = S.selectedCell && S.selectedCell.row === r.key && S.selectedCell.col === c.key && S.selectedCell.id === id;
      const cell = el("div", { class: `cell ${pol ? "p" + pq(v) : v === 0 ? "zero" : "q" + q(v)}` + (S.focus && S.cand.has(r.key) && !focus ? " dim" : "") + (selected ? " selected" : ""),
        role: opts.onCell ? "button" : null, "aria-label": t("aria_cell", { row: r.label, col: c.label, value: fmt(v) }) });
      hoverable(cell, () => ({ title: `${r.label} · ${c.label}`, rows: [{ value: fmt(v), label: opts.unit || "" }, ...(r.counts ? [{ value: num(r.counts[c.key] || 0), label: t("tt_tweets_of", { n: num(r.n) }) }] : [])],
        note: r.n < MIN_N ? t("fragile_n", { n: MIN_N }) : (opts.onCell ? t("click_examples") : null) }));
      if (opts.onCell) {
        const goCell = () => opts.onCell(r, c);
        cell.addEventListener("click", goCell);
        cell.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goCell(); } });
      }
      grid.append(cell);
    }
  }
  const notes = [opts.note, clamped && !pol ? t("heat_clamped", { n: MIN_N_SCALE }) : null].filter(Boolean);
  box.append(el("div", { class: "heat-scroll" }, grid),
    pol ? el("div", { class: "scale" }, el("span", { text: opts.polarity[0] }), el("span", { class: "steps" }, [0, 1, 2, 3, 4, 5, 6].map((i) => el("span", { class: `p${i}` }))), el("span", { text: opts.polarity[1] })) :
    el("div", { class: "scale" }, el("span", { class: "steps" }, el("span", { class: "zero" })), el("span", { text: t("heat_zero") }),
      el("span", { class: "scale-gap" }), el("span", { text: opts.min0 || pct(0, 0) }), el("span", { class: "steps" }, [0, 1, 2, 3, 4, 5, 6].map((i) => el("span", { class: `q${i}` }))), el("span", { text: (clamped ? "≥ " : "") + fmt(max) })),
    notes.length ? el("p", { class: "note-small", text: notes.join(" ") }) : null);
  setTable(id, [{ label: opts.rowHeader || t("th_candidate") }, ...(rows[0].n !== undefined ? [{ label: t("th_tweets"), num: true }] : []), ...cols.map((c) => ({ label: c.label, num: true }))],
    rows.map((r) => [r.label, ...(r.n !== undefined ? [num(r.n)] : []), ...cols.map((c) => (r.values[c.key] === null || r.values[c.key] === undefined ? "–" : fmt(r.values[c.key])))]));
}

// Colonnes de la plus fréquente à la plus rare, toutes lignes confondues ; « autre » toujours en dernier
function orderCols(cols, rows) {
  const total = (k) => rows.reduce((a, r) => a + (r.counts ? r.counts[k] || 0 : r.values[k] || 0), 0);
  const last = (k) => (/^autre/.test(k) ? 1 : 0);
  return [...cols].sort((a, b) => last(a.key) - last(b.key) || total(b.key) - total(a.key));
}
// Polarité par thème : (favorables − critiques) / tweets écologie du candidat sur ce thème, dès 3 tweets
function stanceByTheme(stats) {
  const themes = V("themes").options;
  const rows = stats.map((s) => {
    const eco = s.tweets.filter((tw) => tw.e), counts = {}, values = {};
    for (const o of themes) {
      const on = eco.filter((tw) => tw.themes.includes(o.key));
      counts[o.key] = on.length;
      values[o.key] = on.length >= 3 ? on.reduce((a, tw) => a + (STANCE[tw.position] || 0), 0) / on.length : null;
    }
    return { key: s.key, label: candName(s.key), n: eco.length, counts, values };
  }).filter((r) => r.n > 0).sort((a, b) => byBloc(a.key, b.key));
  return { rows, cols: orderCols(themes.map((o) => ({ key: o.key, label: L(o, "label") })), rows) };
}
/* Répartition d'une variable par candidat */
function distribution(stats, variable, ecologyOnly) {
  const v = V(variable);
  const cols = v.kind === "noul" ? [{ key: "oui", label: L(v, "label") }]
    : v.options.filter((o) => !NULLISH.has(o.key)).map((o) => ({ key: o.key, label: L(o, "label"), title: optDef(variable, o.key) || L(o, "label") }));
  const rows = stats.map((s) => {
    const pool = ecologyOnly ? s.tweets.filter((tw) => tw.e) : s.tweets;
    const counts = Object.fromEntries(cols.map((c) => [c.key, 0]));
    for (const tw of pool) {
      const val = tw[variable];
      if (Array.isArray(val)) val.forEach((k) => { if (k in counts) counts[k]++; });
      else if (val === true) counts[cols[0].key]++;
      else if (val in counts) counts[val]++;
    }
    return { key: s.key, label: candName(s.key), n: pool.length, counts, values: Object.fromEntries(cols.map((c) => [c.key, pool.length ? counts[c.key] / pool.length : 0])) };
  }).filter((r) => r.n > 0).sort((a, b) => byBloc(a.key, b.key));
  return { rows, cols: v.kind === "score" ? cols : orderCols(cols, rows) };
}

/* =================================================================== boussole */
// Position moyenne (+1 favorable, -1 critique, 0 sinon) et rapport moyen à la croissance (Dryzek)
function compassRows(tweets) {
  const growth = growthMap();
  const rows = [], skipped = [];
  for (const s of byCandidate(tweets)) {
    const eco = s.tweets.filter((tw) => tw.e);
    if (!eco.length) continue;
    const withVision = eco.filter((tw) => tw.vision in growth);
    if (eco.length < COMPASS_MIN || withVision.length < COMPASS_MIN_VISION) { skipped.push(s.key); continue; }
    const top = topOf(withVision, "vision");
    rows.push({ key: s.key, n: eco.length, x: mean(eco, (tw) => STANCE[tw.position] || 0), y: mean(withVision, (tw) => growth[tw.vision]), vision: top ? top.key : null });
  }
  return { rows, skipped };
}
function compassFrame() {
  return el("div", { class: "compass-wrap" },
    el("div", { class: "y-top", text: t("compass_y_top") }),
    el("div", { class: "y-label", text: t("compass_y") }),
    el("div", { class: "compass", role: "group", "aria-label": t("compass_aria") }),
    el("div", { class: "y-bottom", text: t("compass_y_bottom") }),
    el("div", { class: "x-axis" }, el("span", { text: t("compass_x_left") }), el("span", { text: t("compass_x") }), el("span", { text: t("compass_x_right") })));
}
// À appeler une fois le cadre dans la page : la taille des avatars dépend de la largeur réelle
function drawCompass(wrap, rows, opts = {}) {
  const box = $(".compass", wrap);
  const W = box.clientWidth || 360;
  const size = W < 340 ? 26 : W < 460 ? 30 : 36;
  const pts = rows.map((r) => ({ r, s: size }));
  if (opts.you) pts.push({ r: { key: "", ...opts.you }, s: 46, fixed: true });
  // Domaine symétrique autour de zéro, ajusté aux points, par pas de 0,25
  const span = (vals) => Math.min(1, Math.max(0.25, Math.ceil(Math.max(...vals.map(Math.abs)) * 1.15 * 4) / 4));
  const dx = span(pts.map((p) => p.r.x)), dy = span(pts.map((p) => p.r.y));
  for (const p of pts) {
    p.pad = (p.s / 2 + 3) / W;
    p.px = p.pad + ((p.r.x + dx) / (2 * dx)) * (1 - 2 * p.pad);
    p.py = p.pad + ((dy - p.r.y) / (2 * dy)) * (1 - 2 * p.pad);
  }
  // Écarte les avatars qui se chevauchent, sans déplacer le point « Vous »
  for (let it = 0; it < 120; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j];
      const min = ((a.s + b.s) / 2 + 3) / W;
      const d = Math.hypot(b.px - a.px, b.py - a.py);
      if (d >= min) continue;
      // Points confondus : direction arbitraire mais stable
      const ux = d < 1e-6 ? Math.cos(i * 2.4 + j) : (b.px - a.px) / d, uy = d < 1e-6 ? Math.sin(i * 2.4 + j) : (b.py - a.py) / d;
      const push = min - d;
      const wa = a.fixed ? 0 : b.fixed ? 1 : 0.5, wb = 1 - wa;
      a.px -= ux * push * wa; a.py -= uy * push * wa; b.px += ux * push * wb; b.py += uy * push * wb;
      moved = true;
    }
    for (const p of pts) { p.px = clamp(p.px, p.pad, 1 - p.pad); p.py = clamp(p.py, p.pad, 1 - p.pad); }
    if (!moved) break;
  }
  const focus = opts.interactive ? S.focus : "";
  box.replaceChildren(...pts.map((p) => {
    const style = `left:${(p.px * 100).toFixed(2)}%;top:${(p.py * 100).toFixed(2)}%`;
    if (p.fixed) return el("div", { class: "pt you", style, role: "img", "aria-label": t("you_aria", { x: signed(p.r.x), y: signed(p.r.y) }) }, el("span", { class: "you-pin", text: t("you") }));
    const r = p.r;
    const cls = "pt" + (focus === r.key ? " focus" : focus ? " dim" : "") + (opts.near && opts.near.has(r.key) ? " near" : "");
    const node = el(opts.interactive ? "button" : "span", { class: cls, type: opts.interactive ? "button" : null, style,
      "aria-label": t("compass_aria_pt", { name: candName(r.key), x: signed(r.x), y: signed(r.y) }), "aria-pressed": opts.interactive ? String(focus === r.key) : null }, avatar(r.key, p.s));
    hoverable(node, () => ({ title: candName(r.key), rows: [{ value: signed(r.x), label: t("compass_tt_x") }, { value: signed(r.y), label: t("compass_tt_y") }],
      note: [tn("n_eco_tweets", r.n), r.vision ? t("kv", { k: t("th_vision"), v: optLabel("vision", r.vision) }) : null].filter(Boolean).join(" · ") }));
    if (opts.interactive) node.addEventListener("click", () => setFilter({ focus: S.focus === r.key ? "" : r.key }, "#boussole"));
    return node;
  }));
}
function compassTable(id, rows) {
  setTable(id, [{ label: t("th_candidate") }, { label: t("th_eco_tweets"), num: true }, { label: t("th_stance"), num: true }, { label: t("th_growth"), num: true }, { label: t("th_vision") }],
    [...rows].sort((a, b) => b.x - a.x).map((r) => [candName(r.key), num(r.n), signed(r.x), signed(r.y), r.vision ? optLabel("vision", r.vision) : "–"]));
}

/* =================================================================== onglet Aperçu */
function kpis(tweets) {
  const eco = tweets.filter((tw) => tw.e);
  const cri = eco.filter((tw) => tw.position === "critique_ecologie").length;
  const active = new Set(tweets.map((tw) => tw.c)).size;
  const tile = (label, value, note, hero, extra) => el("div", { class: "kpi" + (hero ? " hero-kpi" : "") }, el("div", {}, el("p", { class: "label", text: label }), el("p", { class: "value", text: value }), note ? el("p", { class: "note", text: note }) : null), extra);
  const share = tweets.length ? eco.length / tweets.length : 0, filled = Math.round(share * 100);
  const waffle = tweets.length ? el("div", { class: "waffle-box" }, el("div", { class: "waffle", "aria-hidden": "true" }, Array.from({ length: 100 }, (_, i) => el("i", { class: i < filled ? "on" : null }))),
    el("p", { class: "note", text: t("kpi_waffle", { n: num(filled) }) })) : null;
  return el("section", { class: "kpi-row", "aria-label": t("kpi_aria") },
    tile(t("kpi_eco_share"), tweets.length ? pct(share) : "–", t("kpi_eco_of", { eco: num(eco.length), n: num(tweets.length) }), true, waffle),
    tile(t("kpi_tweets"), num(tweets.length), tn("kpi_active", active)),
    tile(t("kpi_eco_tweets"), num(eco.length)),
    tile(t("kpi_critical"), eco.length ? pct(cri / eco.length) : "–", t("kpi_critical_note")));
}

function stripCard() {
  const list = [...S.cands].sort((a, b) => byBloc(a.key, b.key));
  const flagged = list.filter((c) => ACCOUNT[c.compte]);
  return el("section", { class: "card", id: "candidats" },
    el("header", { class: "card-head" }, el("div", {}, el("h2", { text: t("strip_title") }), el("p", { class: "sub", text: t("strip_sub") }))),
    el("div", { class: "strip", role: "group", "aria-label": t("strip_title") }, list.map((c) => {
      const a = ACCOUNT[c.compte];
      const b = el("button", { class: "person" + (S.bloc && c.bloc !== S.bloc ? " dim" : ""), type: "button", "aria-pressed": String(S.focus === c.key), title: L(c, "note") || t("highlight", { name: c.name }) },
        avatar(c.key, 56), el("span", { class: "nm", text: c.name }),
        a ? el("span", { class: `flag ${a.cls}`, title: accountText(c.compte), "aria-label": accountText(c.compte), text: a.ico }) : null);
      b.addEventListener("click", () => {
        const next = S.focus === c.key ? "" : c.key;
        if (next) S.scrollTo = { sel: "#profile", block: "nearest" };
        setFilter({ focus: next }, next ? null : "#candidats");
      });
      return b;
    })),
    flagged.length ? el("p", { class: "note-small" }, el("strong", { text: t("strip_flagged") }), " ",
      flagged.map((c) => t("kv", { k: c.name, v: L(c, "note") || accountText(c.compte) })).join(" · ")) : null);
}

function profileCard() {
  const c = S.cand.get(S.focus);
  if (!c) return null;
  const period = inPeriod();
  const mine = period.filter((tw) => tw.c === c.key);
  const eco = mine.filter((tw) => tw.e);
  const avg = period.length ? period.filter((tw) => tw.e).length / period.length : 0;
  const head = el("div", { class: "profile-id" }, avatar(c.key, 96), el("h2", { text: c.name }), el("p", { class: "party", text: `${L(c, "party")} · ${blocLabel(c.bloc)}` }),
    accountBadge(c),
    c.handle ? el("a", { href: `https://x.com/${c.handle}`, target: "_blank", rel: "noopener", text: "@" + c.handle }) : null,
    el("div", { class: "btn-row center" },
      eco.some((tw) => tw.t) ? el("button", { class: "secondary-btn", type: "button", onclick: () => { S.x = { ...X_DEFAULT, cand: c.key }; go("tweets"); } }, t("profile_see_tweets")) : null,
      el("button", { class: "ghost-btn", type: "button", onclick: () => setFilter({ focus: "" }) }, t("profile_close"))));
  if (!mine.length) return el("section", { class: "card profile", id: "profile" }, head, el("p", { class: "empty", text: t("profile_no_tweets") }));
  const stat = (label, fw, value, small, extra) => el("div", { class: "stat" }, el("div", { class: "k" }, label, fw ? infoBtn(fw) : null),
    el("div", { class: "v" }, value, small ? [" ", el("small", { text: small })] : null), extra);
  const topStat = (label, fw, varKey) => {
    const x = topOf(eco, varKey);
    return stat(label, fw, x ? optLabel(varKey, x.key) : t("profile_none"), x ? t("share_of_eco", { v: pct(x.share, 0) }) : null);
  };
  const fav = eco.filter((tw) => tw.position === "favorable_transition").length, cri = eco.filter((tw) => tw.position === "critique_ecologie").length, neu = eco.length - fav - cri;
  const stack = eco.length ? el("div", { class: "mini-stack", role: "img", "aria-label": t("aria_position", { name: c.name, f: pct(fav / eco.length), u: pct(neu / eco.length), c: pct(cri / eco.length) }) },
    fav ? el("span", { style: `flex:${fav};background:var(--accent)` }) : null, neu ? el("span", { style: `flex:${neu};background:var(--neutral-mark)` }) : null,
    cri ? el("span", { style: `flex:${cri};background:var(--accent-2)` }) : null) : null;
  const point = compassRows(period).rows.find((r) => r.key === c.key);
  const lx = S.data.lexique;
  const words = ((lx && lx.candidats && lx.candidats[c.key]) || []).slice(0, 10);
  const forms = ((lx && lx.formules) || []).filter((f) => f.par_candidat && f.par_candidat[c.key]).sort((a, b) => b.par_candidat[c.key] - a.par_candidat[c.key]);
  const body = el("div", {},
    el("p", { class: "sub", text: [tn("n_tweets", mine.length), tn("n_eco_tweets", eco.length), currentPeriod().short].join(" · ") }),
    eco.length && eco.length < MIN_N ? el("p", { class: "note-small", text: t("profile_few", { n: MIN_N }) }) : null,
    el("div", { class: "stat-grid" },
      stat(t("profile_eco_share"), "macro", pct(eco.length / mine.length), t("profile_avg", { v: pct(avg) })),
      stat(t("profile_position"), "cadrage", eco.length ? t("profile_pos_value", { f: pct(fav / eco.length, 0), c: pct(cri / eco.length, 0) }) : "–", null, stack),
      topStat(t("profile_frame"), "cadrage", "cadrage"),
      topStat(t("profile_vision"), "visions", "vision"),
      topStat(t("profile_device"), "procedes", "procedes"),
      topStat(t("profile_topos"), "topoi", "topoi"),
      topStat(t("profile_delay"), "retardement", "retardement"),
      stat(t("profile_compass"), "boussole", point ? t("compass_coords", { x: signed(point.x), y: signed(point.y) }) : t("profile_not_placed")),
      (() => { const r = eco.map(relEng).filter((v) => v !== null); return stat(t("profile_eng"), "engagement", r.length >= 3 ? times(median(r)) : t("profile_eng_none"), r.length >= 3 ? t("profile_eng_note", { n: num(r.length) }) : null); })()),
    words.length ? el("div", { class: "profile-block" }, el("h3", { text: t("profile_words") }), el("div", { class: "chips" }, words.map(([w]) => el("span", { class: "chip lex", text: w })))) : null,
    forms.length ? el("div", { class: "profile-block" }, el("h3", { text: t("profile_formulas") }),
      el("div", { class: "chips" }, forms.map((f) => el("span", { class: "chip", text: `${f.label}${LANG === "en" && f.en ? ` (${f.en})` : ""} · ${num(f.par_candidat[c.key])}` })))) : null);
  return el("section", { class: "card profile", id: "profile", "aria-label": c.name }, head, body);
}

function renderApercu(panel) {
  const tweets = filtered();
  const stats = byCandidate(tweets);
  panel.replaceChildren(sectionIntro(t("apercu_title"), t("apercu_intro")), stripCard(), S.focus ? profileCard() : null, kpis(tweets));
  const { rows, skipped } = compassRows(tweets);
  const wrap = rows.length ? compassFrame() : null;
  const side = el("div", { class: "compass-side" },
    el("h3", { text: t("compass_read") }), el("p", { text: t("compass_read_1") }), el("p", { text: t("compass_read_2") }), el("p", { class: "note-small", text: t("compass_read_3") }),
    skipped.length ? el("p", { class: "note-small", text: t("compass_unplaced", { names: skipped.map(candName).join(", ") }) }) : null,
    S.focus ? el("p", {}, el("a", { href: "#profile", onclick: (e) => { e.preventDefault(); const n = $("#profile"); if (n) n.scrollIntoView({ block: "start", behavior: smooth() }); } },
      t("compass_see_profile", { name: candName(S.focus) }))) : null,
    el("div", { class: "btn-row" }, el("a", { class: "secondary-btn", href: "#jouer/situer" }, icon("play", 16), t("compass_play"))));
  const compass = card("boussole", t("compass_title"), "boussole", t("compass_sub"),
    rows.length ? el("div", { class: "compass-layout" }, wrap, side) : el("p", { class: "empty", text: t("compass_empty", { n: COMPASS_MIN }) }));
  const sail = card("saillance", t("sal_title"), "macro", S.salMode === "volume" ? t("sal_sub_volume") : t("sal_sub"),
    el("div", { class: "controls" }, segCtrl([["part", t("sal_part")], ["volume", t("sal_volume")]], S.salMode, (k) => { S.salMode = k; render(); }, t("sal_mode"))), el("div", { class: "chart" }));
  const pos = card("position", t("pos_title"), "cadrage", t("pos_sub"), el("div", { class: "chart" }));
  const eng = card("engagement", t("eng_title"), "engagement", t("eng_sub"), el("div", { class: "chart" }));
  const evoLegend = el("div", { class: "legend" });
  const evo = card("evolution", t("evo_title"), null, S.evoMode === "candidats" ? t("evo_sub_grid") : t("evo_sub"),
    el("div", { class: "controls" }, segCtrl([["ensemble", t("evo_overall")], ["candidats", t("evo_by_cand")]], S.evoMode, (k) => { S.evoMode = k; render(); }, t("evo_mode"))),
    evoLegend, el("div", { class: "chart" }));
  const ptLegend = el("div", { class: "legend" });
  const pt = card("position-temps", t("pt_title"), "engagement", t("pt_sub"), ptLegend, el("div", { class: "chart" }));
  const heatBox = el("div", { class: "chart" });
  const tabs = el("div", { class: "tabs controls", role: "tablist" }, [["themes", t("heat_themes")], ["cadrage", t("heat_frames")], ["stance", t("heat_stance")]].map(([k, label]) =>
    el("button", { class: "tab", type: "button", role: "tab", "aria-selected": String(S.apercuHeat === k), text: label, onclick: () => { S.apercuHeat = k; render(); } })));
  const heat = card("apercu-heat", t("heat_title"), S.apercuHeat === "themes" ? "macro" : "cadrage", S.apercuHeat === "stance" ? t("heat_sub_stance") : t("heat_sub"), tabs, heatBox);
  panel.append(compass, sail, pos, eng, evo, pt, heat);
  if (wrap) { drawCompass(wrap, rows, { interactive: true }); compassTable("boussole", rows); } else setTable("boussole", [], []);
  renderSaillance(sail.querySelector(".chart"), stats);
  renderPosition(pos.querySelector(".chart"), stats);
  renderEngagement(eng.querySelector(".chart"), tweets);
  renderEvolution(evo.querySelector(".chart"), evoLegend, tweets);
  renderPositionTime(pt.querySelector(".chart"), ptLegend, tweets);
  const stance = S.apercuHeat === "stance";
  const d = stance ? stanceByTheme(stats) : distribution(stats, S.apercuHeat, true);
  renderHeat(heatBox, "apercu-heat", d.rows, d.cols, { empty: t("empty_eco_period"), note: stance ? t("stance_note") : S.apercuHeat === "themes" ? t("multi_themes") : null,
    polarity: stance ? [t("stance_left"), t("stance_right")] : null, format: stance ? signed : undefined, unit: stance ? t("stance_unit") : undefined,
    onCell: (r, c) => { S.discours = S.apercuHeat === "cadrage" ? "cadrage" : "macro"; S.discoursVar[S.discours] = S.apercuHeat === "cadrage" ? "cadrage" : "themes"; S.discoursScope = "ecologie";
      S.selectedCell = { id: "discours-heat", row: r.key, col: c.key }; S.scrollTo = { sel: "#examples", block: "start" }; go("discours", S.discours); } });
}

/* =================================================================== onglet Discours */
const DISCOURS_GROUPS = [
  ["g_topics", ["macro", "cadrage", "appropriation"]],
  ["g_usthem", ["carre", "procedes", "ethos"]],
  ["g_arguing", ["topoi", "legitimation", "retardement", "visions", "echelle_horizon"]],
  ["g_language", ["grammaire", "enonciation"]],
];
const DISCOURS_ORDER = DISCOURS_GROUPS.flatMap(([, keys]) => keys);
function frameworkCard(fw) {
  return el("section", { class: "framework" }, el("h2", { text: L(fw, "label") }), el("p", { class: "who", text: L(fw, "auteurs") }),
    el("p", { text: L(fw, "resume") }), el("p", {}, el("strong", { text: t("in_this_study") + " " }), L(fw, "dans_l_etude")), refsList(fw.refs));
}
function examplesFor(row, col, variable) {
  const match = (tw) => { const v = tw[variable]; return Array.isArray(v) ? v.includes(col) : (V(variable).kind === "noul" ? v === true : v === col); };
  const list = filtered().filter((tw) => tw.c === row && tw.e && tw.t && match(tw)).sort((a, b) => b.l - a.l).slice(0, 4);
  const box = el("div", { class: "examples", id: "examples" }, el("h3", { text: `${candName(row)} · ${V(variable).kind === "noul" ? varLabel(variable) : optLabel(variable, col)}` }));
  const def = optDef(variable, col);
  if (def) box.append(el("p", { class: "note-small", text: def }));
  if (LANG === "en" && list.some((tw) => !tw.te)) box.append(el("p", { class: "note-small", text: t("tweets_fr_note") }));
  if (!list.length) box.append(el("p", { class: "empty", text: t("examples_empty") }));
  box.append(el("ol", { class: "tweet-list" }, list.map(tweetItem)));
  return box;
}
function discoursHeat(panel) {
  const vars = S.data.codebook.variables.filter((v) => v.framework === S.discours && v.key !== "parle_ecologie");
  if (!vars.length) return;
  const varKey = vars.some((v) => v.key === S.discoursVar[S.discours]) ? S.discoursVar[S.discours] : vars[0].key;
  const v = V(varKey);
  const ecologyOnly = v.scope === "ecologie" || S.discoursScope === "ecologie";
  const controls = el("div", { class: "controls" });
  if (vars.length > 1) controls.append(segCtrl(vars.map((x) => [x.key, L(x, "label")]), varKey, (k) => { S.discoursVar[S.discours] = k; S.selectedCell = null; render(); }, t("variable")));
  if (v.scope !== "ecologie") controls.append(segCtrl([["ecologie", t("scope_eco")], ["tous", t("scope_all")]], S.discoursScope, (k) => { S.discoursScope = k; S.selectedCell = null; render(); }, t("corpus")));
  const heatBox = el("div", { class: "chart" });
  const c = card("discours-heat", L(v, "label"), null, ecologyOnly ? t("heat_sub_eco") : t("heat_sub_all"), controls.childNodes.length ? controls : null, heatBox);
  panel.append(c);
  const d = distribution(byCandidate(filtered()), varKey, ecologyOnly);
  renderHeat(heatBox, "discours-heat", d.rows, d.cols, {
    empty: ecologyOnly ? t("empty_eco_period") : t("empty_period"),
    note: v.kind === "multi" ? t("multi_cats") : (NULLISH.has((v.options[v.options.length - 1] || {}).key) ? t("none_col") : null),
    onCell: (r, col) => { S.selectedCell = { id: "discours-heat", row: r.key, col: col.key }; S.scrollTo = { sel: "#examples", block: "nearest" }; render(); },
  });
  if (v.options.length) c.append(el("details", { class: "fold" }, el("summary", { text: t("categories") }),
    el("dl", { class: "cat-list" }, v.options.filter((o) => !NULLISH.has(o.key)).map((o) => el("div", {}, el("dt", { text: L(o, "label") }), el("dd", { text: LANG === "en" ? o.en : o.fr || "" }))))));
  if (S.selectedCell && S.selectedCell.id === "discours-heat" && d.cols.some((x) => x.key === S.selectedCell.col)) c.append(examplesFor(S.selectedCell.row, S.selectedCell.col, varKey));
}
function renderDiscours(panel) {
  const keys = DISCOURS_ORDER.filter((k) => S.fw.has(k));
  if (!keys.includes(S.discours)) S.discours = keys[0];
  const i = keys.indexOf(S.discours);
  const groups = DISCOURS_GROUPS.map(([g, ks]) => [g, ks.filter((k) => S.fw.has(k))]).filter(([, ks]) => ks.length);
  const select = el("select", { id: "discours-select" }, groups.map(([g, ks]) => el("optgroup", { label: t(g) }, ks.map((k) => option(k, fwLabel(k), k === S.discours)))));
  select.addEventListener("change", () => go("discours", select.value));
  panel.replaceChildren(
    sectionIntro(t("discours_title"), t("discours_intro")),
    el("nav", { class: "subnav", "aria-label": t("frameworks_aria") }, groups.map(([g, ks]) => el("div", { class: "subnav-group" }, el("span", { class: "glabel", text: t(g) }),
      ks.map((k) => el("a", { class: "tab", href: `#discours/${k}`, "aria-current": k === S.discours ? "true" : null, text: fwLabel(k) }))))),
    el("label", { class: "field subnav-select" }, el("span", { text: t("choose_framework") }), select),
    frameworkCard(S.fw.get(S.discours)));
  if (S.discours === "appropriation") renderAppropriation(panel);
  else discoursHeat(panel);
  panel.append(el("nav", { class: "pager", "aria-label": t("pager_aria") },
    i > 0 ? el("a", { class: "secondary-btn", href: `#discours/${keys[i - 1]}`, "aria-label": t("prev_aria", { label: fwLabel(keys[i - 1]) }) }, icon("arrowL", 16), fwLabel(keys[i - 1])) : el("span"),
    i < keys.length - 1 ? el("a", { class: "secondary-btn", href: `#discours/${keys[i + 1]}`, "aria-label": t("next_aria", { label: fwLabel(keys[i + 1]) }) }, fwLabel(keys[i + 1]), icon("arrowR", 16)) : null));
}

function themeVector(tweets) {
  const keys = V("themes").options.map((o) => o.key);
  const eco = tweets.filter((tw) => tw.e);
  return { n: eco.length, v: keys.map((k) => (eco.length ? eco.filter((tw) => tw.themes.includes(k)).length / eco.length : 0)) };
}
function cosine(a, b) { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return x && y ? d / Math.sqrt(x * y) : 0; }
function renderAppropriation(panel) {
  const tweets = filtered();
  const blocs = (S.data.study.blocs || []).filter((b) => tweets.some((tw) => (S.cand.get(tw.c) || {}).bloc === b.key));
  const themes = V("themes").options;
  const blocTweets = Object.fromEntries(blocs.map((b) => [b.key, tweets.filter((tw) => (S.cand.get(tw.c) || {}).bloc === b.key)]));
  const sal = card("appro-sal", t("appro_sal_title"), null, t("appro_sal_sub"), el("div", { class: "chart" }));
  const prof = card("appro-blocs", t("appro_prof_title"), null, t("appro_prof_sub"), el("div", { class: "chart" }));
  const sim = card("appro-sim", t("appro_sim_title"), null, t("appro_sim_sub"), el("div", { class: "chart" }));
  panel.append(sal, prof, sim);
  const salBox = sal.querySelector(".chart");
  const salRows = blocs.map((b) => { const ts = blocTweets[b.key]; return { b, n: ts.length, eco: ts.filter((tw) => tw.e).length }; }).sort((a, b) => b.eco / b.n - a.eco / a.n);
  if (!salRows.length) salBox.append(el("p", { class: "empty", text: t("empty_period") }));
  const max = Math.max(...salRows.map((r) => r.eco / r.n), 0.0001);
  salBox.append(el("div", { class: "bars" }, salRows.map((r) => {
    const track = el("div", { class: "bar-track", "aria-label": t("aria_share", { name: L(r.b, "label"), v: pct(r.eco / r.n), eco: num(r.eco), n: num(r.n) }) },
      el("div", { class: "bar", style: `width:${(r.eco / r.n / max) * 80}%` }), el("span", { class: "bar-value", text: pct(r.eco / r.n) }));
    hoverable(track, () => ({ title: L(r.b, "label"), rows: [{ value: pct(r.eco / r.n), label: t("tt_eco_share") }, { value: num(r.eco), label: t("tt_eco_of", { n: num(r.n) }) }] }));
    return el("div", { class: "bar-row" }, el("div", { class: "bar-name", text: L(r.b, "label") }), track);
  })));
  setTable("appro-sal", [{ label: t("th_family") }, { label: t("th_tweets"), num: true }, { label: t("th_eco_tweets"), num: true }, { label: t("th_share"), num: true }], salRows.map((r) => [L(r.b, "label"), num(r.n), num(r.eco), pct(r.eco / r.n)]));
  const ecoAll = tweets.filter((tw) => tw.e);
  const cols = orderCols(themes.map((o) => ({ key: o.key, label: L(o, "label") })), [{ values: Object.fromEntries(themes.map((o) => [o.key, ecoAll.filter((tw) => tw.themes.includes(o.key)).length])) }]);
  const profRows = blocs.map((b) => { const tv = themeVector(blocTweets[b.key]); return { key: b.key, label: L(b, "label"), n: tv.n, avatar: false, values: Object.fromEntries(themes.map((o, i) => [o.key, tv.v[i]])) }; }).filter((r) => r.n > 0);
  renderHeat(prof.querySelector(".chart"), "appro-blocs", profRows, cols, { rowHeader: t("th_family"), note: t("multi_themes"), empty: t("empty_eco_period") });
  const stats = byCandidate(tweets).filter((s) => s.eco >= 5);
  const simRows = stats.map((s) => {
    const mine = themeVector(s.tweets).v;
    const values = {};
    for (const b of blocs) { const others = blocTweets[b.key].filter((tw) => tw.c !== s.key); const tv = themeVector(others); values[b.key] = tv.n >= 5 ? cosine(mine, tv.v) : null; }
    return { key: s.key, label: candName(s.key), n: s.eco, values };
  }).sort((a, b) => byBloc(a.key, b.key));
  renderHeat(sim.querySelector(".chart"), "appro-sim", simRows, blocs.map((b) => ({ key: b.key, label: L(b, "label") })), { domain: "minmax", format: f2, unit: t("similarity"),
    empty: t("appro_sim_empty"), note: t("appro_sim_note") });
}

/* =================================================================== réseau */
// Quatre réseaux : candidats – formules (tout le corpus), candidats – thèmes, proximité des discours et « qui nomme qui »
// (période et famille choisies). Disposition à ressorts animée, points déplaçables, zoom.
const BLOC_COLOR = { gauche_radicale: "#c8382f", gauche: "#e0679c", ecologistes: "#2f9e5c", centre: "#e8a01c", droite: "#2f6fd0", souverainistes: "#8a5cc2", extreme_droite: "#4a4f9e" };
const blocColor = (k) => BLOC_COLOR[(S.cand.get(k) || {}).bloc] || "#8a8a84";
const GROUP_COLOR = ["#e69f00", "#56b4e9", "#009e73", "#cc79a7", "#0072b2", "#d55e00", "#8a8a84"];
// Profil de discours : part des tweets écologie dans chaque catégorie de ces variables, chaque variable pesant autant
const PROX_VARS = ["themes", "position", "cadrage", "vision", "retardement", "adversaire", "topoi"];
const PROX_MIN = 8, PROX_K = 3, RES_MIN = 0.5, RES_MAX = 3;

function proxProfiles() {
  const out = [];
  for (const s of byCandidate(filtered())) {
    const eco = s.tweets.filter((tw) => tw.e);
    if (eco.length < PROX_MIN) continue;
    const vec = [];
    for (const key of PROX_VARS) {
      const v = V(key);
      if (!v) continue;
      const block = v.options.filter((o) => !NULLISH.has(o.key))
        .map((o) => eco.filter((tw) => (Array.isArray(tw[key]) ? tw[key].includes(o.key) : tw[key] === o.key)).length / eco.length);
      const norm = Math.hypot(...block) || 1;
      vec.push(...block.map((x) => x / norm));
    }
    out.push({ key: s.key, n: eco.length, vec });
  }
  return out.sort((a, b) => byBloc(a.key, b.key));
}
// Détection de communautés par la méthode de Louvain (Blondel et coauteurs, 2008), graphe pondéré non orienté
// gamma : résolution ; au-dessus de 1, des groupes plus nombreux et plus petits
function louvain(n, links, gamma = 1) {
  let part = Array.from({ length: n }, (_, i) => i);
  let adj = Array.from({ length: n }, () => new Map());
  for (const { a, b, w } of links) { adj[a].set(b, (adj[a].get(b) || 0) + w); adj[b].set(a, (adj[b].get(a) || 0) + w); }
  for (let level = 0; level < 10; level++) {
    const N = adj.length, k = adj.map((m) => [...m.values()].reduce((s, x) => s + x, 0)), m2 = k.reduce((s, x) => s + x, 0);
    if (!m2) break;
    const com = Array.from({ length: N }, (_, i) => i), tot = [...k];
    let moved = true, any = false;
    while (moved) {
      moved = false;
      for (let i = 0; i < N; i++) {
        const ci = com[i], wTo = new Map();
        for (const [j, w] of adj[i]) if (j !== i) wTo.set(com[j], (wTo.get(com[j]) || 0) + w);
        tot[ci] -= k[i];
        let best = ci, gain = (wTo.get(ci) || 0) - (gamma * tot[ci] * k[i]) / m2;
        for (const [c, w] of wTo) { const g = w - (gamma * tot[c] * k[i]) / m2; if (g > gain + 1e-12) { gain = g; best = c; } }
        tot[best] += k[i];
        if (best !== ci) { com[i] = best; moved = true; any = true; }
      }
    }
    if (!any) break;
    const ids = new Map();
    com.forEach((c, i) => { if (!ids.has(c)) ids.set(c, ids.size); com[i] = ids.get(c); });
    part = part.map((c) => com[c]);
    const next = Array.from({ length: ids.size }, () => new Map());
    adj.forEach((m, i) => m.forEach((w, j) => next[com[i]].set(com[j], (next[com[i]].get(com[j]) || 0) + w)));
    adj = next;
  }
  return part;
}
function modularity(n, links, part) {
  const k = new Array(n).fill(0), inC = new Map(), tot = new Map();
  let m2 = 0;
  for (const { a, b, w } of links) { k[a] += w; k[b] += w; m2 += 2 * w; if (part[a] === part[b]) inC.set(part[a], (inC.get(part[a]) || 0) + 2 * w); }
  if (!m2) return 0;
  k.forEach((x, i) => tot.set(part[i], (tot.get(part[i]) || 0) + x));
  let q = 0;
  for (const [c, x] of tot) q += (inC.get(c) || 0) / m2 - (x / m2) ** 2;
  return q;
}

function networkData(mode) {
  const nodes = new Map(), edges = [];
  const node = (id, props) => { if (!nodes.has(id)) nodes.set(id, { id, w: 0, ...props }); return nodes.get(id); };
  const cand = (k) => node("c:" + k, { type: "cand", key: k, label: candName(k) });
  const done = (extra) => ({ nodes: [...nodes.values()], edges, ...extra });
  if (mode === "formules") {
    // formules employées dans les tweets de la période et de la famille choisies, comme les thèmes
    const list = (S.data.lexique || {}).formules || [], pairs = new Map();
    for (const tw of filtered()) for (const i of tw.fm || []) { const id = tw.c + " " + i; pairs.set(id, (pairs.get(id) || 0) + 1); }
    for (const [id, n] of pairs) {
      const [k, i] = id.split(" "), f = list[Number(i)];
      if (!f || !S.cand.has(k)) continue;
      cand(k).w += n;
      node("f:" + f.key, { type: "term", label: LANG === "en" && f.en ? f.en : f.label.replace(/[«»]/g, "").trim(), title: f.label }).w += n;
      edges.push({ s: "c:" + k, t: "f:" + f.key, w: n });
    }
    return done();
  }
  if (mode === "themes") {
    for (const s of byCandidate(filtered())) {
      const eco = s.tweets.filter((tw) => tw.e);
      for (const o of V("themes").options) {
        const n = eco.filter((tw) => tw.themes.includes(o.key)).length;
        // seuls les thèmes qui pèsent dans le discours du candidat : au moins 2 tweets et 10 % de ses tweets écologie
        if (n < Math.max(2, 0.1 * eco.length)) continue;
        cand(s.key).w += n;
        node("t:" + o.key, { type: "term", label: L(o, "label") }).w += n;
        edges.push({ s: "c:" + s.key, t: "t:" + o.key, w: n });
      }
    }
    return done();
  }
  if (mode === "mentions") {
    const pairs = new Map();
    for (const tw of filtered()) {
      if (S.netScope === "eco" && !tw.e) continue;
      for (const j of tw.nm || []) {
        const to = (S.cands[j] || {}).key;
        if (to && to !== tw.c) pairs.set(tw.c + " " + to, (pairs.get(tw.c + " " + to) || 0) + 1);
      }
    }
    for (const [id, n] of pairs) { const [a, b] = id.split(" "); cand(a); cand(b).w += n; edges.push({ s: "c:" + a, t: "c:" + b, w: n }); }
    return done({ directed: true });
  }
  // Proximité : chaque candidat relié à ses trois voisins de discours les plus proches (similarité cosinus)
  const P = proxProfiles();
  if (P.length < 3) return done();
  const sim = P.map((a) => P.map((b) => cosine(a.vec, b.vec)));
  const pairs = new Map();
  P.forEach((_, i) => P.map((__, j) => j).filter((j) => j !== i).sort((x, y) => sim[i][y] - sim[i][x]).slice(0, PROX_K)
    .forEach((j) => pairs.set(Math.min(i, j) + "-" + Math.max(i, j), sim[i][j])));
  const links = [...pairs].map(([id, w]) => { const [a, b] = id.split("-").map(Number); return { a, b, w }; });
  // résolution choisie au curseur, sinon la plus basse qui donne au moins trois groupes
  const count = (g) => new Set(louvain(P.length, links, g)).size;
  let res = S.netRes;
  if (res === null || res === undefined) { res = 1; while (res < RES_MAX && count(res) < 3) res = Math.round((res + 0.1) * 10) / 10; }
  const raw = louvain(P.length, links, res);
  // groupes numérotés du plus grand au plus petit
  const sizes = new Map();
  raw.forEach((g) => sizes.set(g, (sizes.get(g) || 0) + 1));
  const order = [...sizes.keys()].sort((a, b) => sizes.get(b) - sizes.get(a) || raw.indexOf(a) - raw.indexOf(b));
  const part = raw.map((g) => order.indexOf(g));
  P.forEach((p, i) => Object.assign(cand(p.key), { w: p.n, group: part[i], near: P.map((q, j) => [q.key, sim[i][j]]).filter(([k]) => k !== p.key).sort((a, b) => b[1] - a[1]).slice(0, 4) }));
  for (const { a, b, w } of links) edges.push({ s: "c:" + P[a].key, t: "c:" + P[b].key, w: Math.round(w * 1000) / 1000 });
  const groups = order.map((_, g) => P.filter((__, i) => part[i] === g).map((p) => p.key));
  // accord avec les familles : part des candidats qui appartiennent à la famille majoritaire de leur groupe
  const agree = groups.reduce((s, keys) => { const c = new Map(); keys.forEach((k) => { const b = (S.cand.get(k) || {}).bloc; c.set(b, (c.get(b) || 0) + 1); }); return s + Math.max(...c.values()); }, 0) / P.length;
  return done({ groups, q: modularity(P.length, links, part), agree, res });
}

function convexHull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
const xmlEsc = (x) => String(x).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// Fichier GEXF pour Gephi, avec les positions affichées (y compris les points déplacés)
function gexf(net, mode) {
  const { nodes, edges, directed } = net;
  const attrs = (n) => `<attvalues><attvalue for="0" value="${n.type === "cand" ? "candidat" : mode}"/><attvalue for="1" value="${xmlEsc(n.type === "cand" ? blocLabel((S.cand.get(n.key) || {}).bloc) : "")}"/>${n.group !== undefined ? `<attvalue for="2" value="${n.group + 1}"/>` : ""}</attvalues>`;
  const color = (n) => { const [r, g, b] = n.type === "cand" ? hexRgb(blocColor(n.key)) : [150, 150, 140]; return `<viz:color r="${r}" g="${g}" b="${b}"/>`; };
  return `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft" xmlns:viz="http://www.gexf.net/1.2draft/viz" version="1.2">
  <meta lastmodifieddate="${S.data.generated_at.slice(0, 10)}"><creator>${xmlEsc(t("brand"))}</creator><description>${xmlEsc(t("net_desc_" + mode))}</description></meta>
  <graph mode="static" defaultedgetype="${directed ? "directed" : "undirected"}">
    <attributes class="node"><attribute id="0" title="type" type="string"/><attribute id="1" title="famille" type="string"/><attribute id="2" title="groupe" type="integer"/></attributes>
    <nodes>
${nodes.map((n) => `      <node id="${xmlEsc(n.id)}" label="${xmlEsc(n.label)}">${attrs(n)}<viz:size value="${(4 + Math.sqrt(n.w) * 2).toFixed(1)}"/>${color(n)}<viz:position x="${n.x.toFixed(1)}" y="${(-n.y).toFixed(1)}" z="0"/></node>`).join("\n")}
    </nodes>
    <edges>
${edges.map((e, i) => `      <edge id="${i}" source="${xmlEsc(e.s)}" target="${xmlEsc(e.t)}" weight="${e.w}"/>`).join("\n")}
    </edges>
  </graph>
</gexf>
`;
}

function renderNetwork(box) {
  cancelAnimationFrame(S.netFrame || 0);
  box.replaceChildren();
  const mode = S.netMode, net = networkData(mode), { nodes, edges, directed } = net;
  if (edges.length < 2) { box.append(el("p", { class: "empty", text: t("net_empty") })); setTable("reseau", [], []); return; }
  const W = Math.max(300, box.clientWidth || 700), H = Math.round(W < 600 ? W * 1.15 : Math.min(620, W * 0.62)), narrow = W < 600;
  const prox = mode === "proximite", maxTerm = Math.max(...nodes.filter((n) => n.type === "term").map((n) => n.w), 1);
  const maxIn = Math.max(...nodes.map((n) => n.w), 1), base = narrow ? 26 : 34;
  for (const n of nodes) {
    if (n.type === "cand") { n.size = Math.round(directed ? base * (0.75 + 0.75 * Math.sqrt(n.w / maxIn)) : base); n.r = n.size / 2 + 3; n.h = n.size + 6; }
    else { n.font = (narrow ? 10.5 : 12) + Math.sqrt(n.w / maxTerm) * (narrow ? 3 : 5); n.r = (n.label.length * n.font * 0.56) / 2 + 12; n.h = n.font + 10; }
  }
  const at = new Map(nodes.map((n, i) => [n.id, i])), byId = new Map(nodes.map((n) => [n.id, n]));
  // Seuil des liens : par mode, conservé d'un affichage à l'autre
  const weights = [...new Set(edges.map((e) => e.w))].sort((a, b) => a - b);
  const maxIdx = Math.max(0, weights.findLastIndex((w) => edges.filter((e) => e.w >= w).length >= 3));
  S.netMin = S.netMin || {};
  let minIdx = clamp(weights.indexOf(S.netMin[mode] ?? weights[0]), 0, maxIdx);
  const active = () => edges.filter((e) => e.w >= weights[minIdx]);

  // --- simulation : Fruchterman et Reingold, avec écartement des étiquettes à chaque pas
  const k = Math.sqrt((W * H) / Math.max(nodes.length, 1)) * 0.8;
  const start = () => {
    const saved = S.netKeep && S.netPos && S.netPos.mode === mode && S.netPos.W === W ? S.netPos.at : null;
    S.netKeep = false;
    if (saved && nodes.every((n) => saved.has(n.id))) {
      nodes.forEach((n) => Object.assign(n, saved.get(n.id)));
      if (nodes.some((n) => n.fixed)) requestAnimationFrame(() => nodes.forEach((n) => n.fixed && n.el.classList.add("pinned")));
      sim.temp = W / 900;
      return;
    }
    const cands = nodes.filter((n) => n.type === "cand").sort((a, b) => byBloc(a.key, b.key)), terms = nodes.filter((n) => n.type === "term");
    cands.forEach((n, i) => { const a = (2 * Math.PI * i) / cands.length - Math.PI / 2; n.x = W / 2 + Math.cos(a) * W * 0.36; n.y = H / 2 + Math.sin(a) * H * 0.36; n.fixed = false; });
    terms.forEach((n, i) => { const a = (2 * Math.PI * i) / terms.length + 0.3; n.x = W / 2 + Math.cos(a) * W * 0.14; n.y = H / 2 + Math.sin(a) * H * 0.14; });
    sim.temp = W / 6;
  };
  const sim = { temp: 0, edges: active() };
  const PAD = 8, keepIn = (n) => { n.x = clamp(n.x, n.r + PAD, W - n.r - PAD); n.y = clamp(n.y, n.h / 2 + PAD, H - n.h / 2 - PAD); };
  const collide = (passes) => {
    for (let it = 0; it < passes; it++) {
      let moved = false;
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j], ox = a.r + b.r - Math.abs(a.x - b.x), oy = (a.h + b.h) / 2 + 2 - Math.abs(a.y - b.y);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        const wa = a.fixed ? 0 : b.fixed ? 1 : 0.5, wb = 1 - wa;
        if (ox < oy) { const s = a.x < b.x ? -ox : ox; a.x += s * wa; b.x -= s * wb; } else { const s = a.y < b.y ? -oy : oy; a.y += s * wa; b.y -= s * wb; }
      }
      nodes.forEach(keepIn);
      if (!moved) break;
    }
  };
  const step = () => {
    const dx = new Float64Array(nodes.length), dy = new Float64Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const ex = nodes[i].x - nodes[j].x, ey = nodes[i].y - nodes[j].y, d = Math.max(1, Math.hypot(ex, ey)), f = (k * k) / d;
      dx[i] += (ex / d) * f; dy[i] += (ey / d) * f; dx[j] -= (ex / d) * f; dy[j] -= (ey / d) * f;
    }
    const lo = Math.min(...sim.edges.map((e) => e.w)), hi = Math.max(...sim.edges.map((e) => e.w));
    for (const e of sim.edges) {
      const i = at.get(e.s), j = at.get(e.t), ex = nodes[i].x - nodes[j].x, ey = nodes[i].y - nodes[j].y, d = Math.max(1, Math.hypot(ex, ey));
      const f = ((d * d) / k) * (0.4 + (hi > lo ? (e.w - lo) / (hi - lo) : 1));
      dx[i] -= (ex / d) * f; dy[i] -= (ey / d) * f; dx[j] += (ex / d) * f; dy[j] += (ey / d) * f;
    }
    nodes.forEach((n, i) => {
      if (n.fixed) return;
      dx[i] -= (n.x - W / 2) * 0.008 * k; dy[i] -= (n.y - H / 2) * 0.008 * k;
      const d = Math.max(1, Math.hypot(dx[i], dy[i])), s = Math.min(d, sim.temp);
      n.x += (dx[i] / d) * s; n.y += (dy[i] / d) * s; keepIn(n);
    });
    if (sim.temp < W / 15) collide(2);
    sim.temp *= 0.985;
  };
  const settled = () => sim.temp < W / 1200;

  // --- dessin
  const edgeSvg = svg("svg", { class: "net-edges", viewBox: `0 0 ${W} ${H}`, width: W, height: H, "aria-hidden": "true" });
  const hullSvg = prox ? svg("svg", { class: "net-hulls", viewBox: `0 0 ${W} ${H}`, width: W, height: H, "aria-hidden": "true" }) : null;
  const maxE = Math.max(...edges.map((e) => e.w)), minE = Math.min(...edges.map((e) => e.w));
  const thick = (w) => (prox ? 0.8 + ((w - minE) / (maxE - minE || 1)) * 4 : 0.8 + (w / maxE) * (directed ? 4 : 5)).toFixed(2);
  const edgeEls = edges.map((e) => {
    if (!directed) { const l = svg("line", { "stroke-width": thick(e.w) }); edgeSvg.append(l); return l; }
    const g = svg("g", { class: "dir" }), p = svg("path", { "stroke-width": thick(e.w) }), head = svg("polygon", {});
    g.style.color = blocColor(byId.get(e.s).key);
    g.append(p, head); edgeSvg.append(g); return g;
  });
  const hulls = prox ? net.groups.map((keys, g) => {
    const shape = svg("polygon", { fill: GROUP_COLOR[g % GROUP_COLOR.length], stroke: GROUP_COLOR[g % GROUP_COLOR.length] });
    const label = svg("text", { class: "net-hull-label", "text-anchor": "middle" });
    label.textContent = t("net_group", { n: g + 1 });
    const wrapG = svg("g", { class: "hull" }); wrapG.append(shape); hullSvg.append(wrapG, label);
    return { members: keys.map((k2) => byId.get("c:" + k2)), shape, label };
  }) : [];
  const draw = () => {
    for (const n of nodes) { n.el.style.left = n.x.toFixed(1) + "px"; n.el.style.top = n.y.toFixed(1) + "px"; }
    S.netPos = { mode, W, at: new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y, fixed: n.fixed }])) };
    edges.forEach((e, i) => {
      const a = byId.get(e.s), b = byId.get(e.t), node = edgeEls[i];
      if (!directed) { node.setAttribute("x1", a.x.toFixed(1)); node.setAttribute("y1", a.y.toFixed(1)); node.setAttribute("x2", b.x.toFixed(1)); node.setAttribute("y2", b.y.toFixed(1)); return; }
      // flèche courbe : les liens A→B et B→A s'écartent l'un de l'autre
      const dx = b.x - a.x, dy = b.y - a.y, cx = (a.x + b.x) / 2 - dy * 0.16, cy = (a.y + b.y) / 2 + dx * 0.16;
      const u = (x, y) => { const d = Math.hypot(x, y) || 1; return [x / d, y / d]; };
      const [ux, uy] = u(b.x - cx, b.y - cy), [vx, vy] = u(cx - a.x, cy - a.y), hs = 7;
      const tx = b.x - ux * (b.r + 1), ty = b.y - uy * (b.r + 1), sx = a.x + vx * (a.r - 2), sy = a.y + vy * (a.r - 2);
      node.firstChild.setAttribute("d", `M${sx.toFixed(1)},${sy.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${(tx - ux * hs * 0.8).toFixed(1)},${(ty - uy * hs * 0.8).toFixed(1)}`);
      node.lastChild.setAttribute("points", [[tx, ty], [tx - ux * hs * 1.6 - uy * hs * 0.7, ty - uy * hs * 1.6 + ux * hs * 0.7], [tx - ux * hs * 1.6 + uy * hs * 0.7, ty - uy * hs * 1.6 - ux * hs * 0.7]].map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "));
    });
    for (const h of hulls) {
      const pts = convexHull(h.members.map((n) => [n.x, n.y]));
      h.shape.setAttribute("points", pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "));
      h.shape.setAttribute("stroke-width", base + 22);
      const top = h.members.reduce((m, n) => (n.y < m.y ? n : m));
      h.label.setAttribute("x", (h.members.reduce((s, n) => s + n.x, 0) / h.members.length).toFixed(1));
      h.label.setAttribute("y", Math.max(12, top.y - base / 2 - 14).toFixed(1));
    }
  };
  const loop = () => {
    if (!wrap.isConnected) { S.netFrame = 0; return; }
    for (let i = 0; i < 5 && !settled(); i++) step();
    if (settled()) collide(150);
    draw();
    S.netFrame = settled() ? 0 : requestAnimationFrame(loop);
  };
  const run = (heat) => {
    sim.temp = Math.max(sim.temp, heat);
    if (reducedMotion()) { while (!settled()) step(); collide(150); draw(); return; }
    if (!S.netFrame) S.netFrame = requestAnimationFrame(loop);
  };

  // --- points
  const layer = el("div", { class: "net-layer", style: `width:${W}px;height:${H}px` }, hullSvg, edgeSvg);
  const wrap = el("div", { class: "net", style: `height:${H}px`, role: "group", "aria-label": t("net_aria") }, layer);
  const neighbours = (id) => edges.map((e, i) => [e, i]).filter(([e]) => e.s === id || e.t === id);
  const highlight = (id) => {
    wrap.classList.toggle("hovering", !!id);
    nodes.forEach((n) => n.el.classList.remove("hl"));
    edgeEls.forEach((l) => l.classList.remove("hl"));
    if (!id) return;
    byId.get(id).el.classList.add("hl");
    for (const [e, i] of neighbours(id)) { edgeEls[i].classList.add("hl"); byId.get(e.s === id ? e.t : e.s).el.classList.add("hl"); }
  };
  let suppressClick = false;
  const tip = (n) => {
    if (prox) return { title: n.label, rows: n.near.map(([k2, s]) => ({ value: pct(s, 0), label: candName(k2) })), note: t("net_tt_proximite", { g: n.group + 1, fam: blocLabel((S.cand.get(n.key) || {}).bloc) }) };
    if (directed) {
      const out = edges.filter((e) => e.s === n.id).sort((a, b) => b.w - a.w).slice(0, 4).map((e) => ({ value: num(e.w), label: "→ " + byId.get(e.t).label }));
      const inc = edges.filter((e) => e.t === n.id).sort((a, b) => b.w - a.w).slice(0, 4).map((e) => ({ value: num(e.w), label: "← " + byId.get(e.s).label }));
      return { title: n.label, rows: [...out, ...inc], note: t("net_tt_mentions", { n: num(n.w) }) };
    }
    const links = neighbours(n.id).map(([e]) => [e.s === n.id ? e.t : e.s, e.w]).sort((a, b) => b[1] - a[1]);
    return { title: n.label, rows: links.slice(0, 6).map(([id, w]) => ({ value: num(w), label: byId.get(id).label })),
      note: links.length > 6 ? t("net_more", { n: links.length - 6 }) : t(mode === "formules" ? "net_tt_formules" : "net_tt_themes") };
  };
  for (const n of nodes) {
    const style = n.type === "term" ? `font-size:${n.font.toFixed(1)}px` : `--ring:${blocColor(n.key)}`;
    n.el = n.type === "cand"
      ? el("button", { class: "net-node cand" + (S.focus === n.key ? " focus" : ""), type: "button", style, "aria-label": n.label,
          onclick: () => { if (suppressClick) { suppressClick = false; return; } setFilter({ focus: S.focus === n.key ? "" : n.key }, "#reseau"); } }, avatar(n.key, n.size))
      : el("span", { class: "net-node term", style, title: n.title || null }, n.label);
    n.el.addEventListener("dblclick", (e) => { e.preventDefault(); n.fixed = false; n.el.classList.remove("pinned"); run(W / 30); });
    hoverable(n.el, () => tip(n));
    n.el.addEventListener("pointerenter", () => highlight(n.id));
    n.el.addEventListener("focus", () => highlight(n.id));
    n.el.addEventListener("pointerleave", () => highlight(null));
    n.el.addEventListener("blur", () => highlight(null));
    layer.append(n.el);
  }
  const dim = () => {
    const live = new Set(sim.edges.flatMap((e) => [e.s, e.t]));
    nodes.forEach((n) => n.el.classList.toggle("dim", !live.has(n.id)));
    edges.forEach((e, i) => edgeEls[i].classList.toggle("off", e.w < weights[minIdx]));
  };

  // --- zoom et déplacement
  const view = { k: 1, x: 0, y: 0 };
  const applyView = () => {
    view.x = clamp(view.x, W - W * view.k, 0); view.y = clamp(view.y, H - H * view.k, 0);
    layer.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
    wrap.classList.toggle("zoomed", view.k > 1.01);
  };
  const zoomAt = (f, px = W / 2, py = H / 2) => {
    const k2 = clamp(view.k * f, 1, 4);
    view.x = px - ((px - view.x) * k2) / view.k; view.y = py - ((py - view.y) * k2) / view.k; view.k = k2; applyView();
  };
  let drag = null;
  wrap.addEventListener("pointerdown", (e) => {
    suppressClick = false;
    if (e.button > 0 || e.target.closest(".net-tools")) return;
    const target = e.target.closest(".net-node");
    if (target) { drag = { n: nodes.find((n) => n.el === target), id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false }; target.setPointerCapture(e.pointerId); }
    else if (e.pointerType === "mouse" || view.k > 1.01) { drag = { pan: true, id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false }; wrap.setPointerCapture(e.pointerId); }
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) { drag.moved = true; hideTip(); wrap.classList.add("dragging"); }
    if (drag.pan) { view.x = drag.vx + dx; view.y = drag.vy + dy; applyView(); return; }
    const r = wrap.getBoundingClientRect(), n = drag.n;
    n.fixed = true; n.el.classList.add("pinned");
    n.x = (e.clientX - r.left - view.x) / view.k; n.y = (e.clientY - r.top - view.y) / view.k; keepIn(n);
    if (reducedMotion()) draw(); else run(W / 45);
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved && drag.n) suppressClick = true;
    wrap.classList.remove("dragging"); drag = null;
  };
  wrap.addEventListener("pointerup", end);
  wrap.addEventListener("pointercancel", end);
  wrap.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const r = wrap.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  const tool = (label, text, onclick) => el("button", { type: "button", class: "net-tool", "aria-label": label, title: label, text, onclick });
  const tools = (el("div", { class: "net-tools" },
    tool(t("net_zoom_in"), "+", () => zoomAt(1.4)), tool(t("net_zoom_out"), "−", () => zoomAt(1 / 1.4)),
    tool(t("net_fit"), "⤢", () => { view.k = 1; view.x = 0; view.y = 0; applyView(); }),
    tool(t("net_relayout"), "↻", () => { nodes.forEach((n) => n.el.classList.remove("pinned")); start(); run(0); })));

  // --- seuil des liens
  const fmtW = (w) => (prox ? pct(w, 0) : num(w));
  const value = el("output", { class: "net-min-val", text: fmtW(weights[minIdx]) });
  const range = el("input", { type: "range", min: 0, max: maxIdx, step: 1, value: minIdx, "aria-label": t(prox ? "net_min_sim" : "net_min_n") });
  range.addEventListener("input", () => {
    minIdx = Number(range.value); S.netMin[mode] = weights[minIdx]; value.textContent = fmtW(weights[minIdx]);
    sim.edges = active(); dim(); run(W / 14);
  });
  // découpage des groupes en direct : la résolution de Louvain, les points restent en place
  const resCtl = prox ? (() => {
    const out = el("output", { class: "net-min-val", text: t("net_groups_n", { k: net.groups.length }) });
    const r = el("input", { type: "range", min: RES_MIN, max: RES_MAX, step: 0.1, value: net.res, "aria-label": t("net_res") });
    r.addEventListener("change", () => { S.netRes = Number(r.value); S.netKeep = true; render(); });
    r.addEventListener("input", () => { out.textContent = "…"; });
    return el("label", { class: "net-min" }, el("span", { text: t("net_res") }), r, out);
  })() : null;
  const bar = el("div", { class: "net-bar" },
    el("div", { class: "net-ctls" }, maxIdx > 0 ? el("label", { class: "net-min" }, el("span", { text: t(prox ? "net_min_sim" : "net_min_n") }), range, value) : null, resCtl), tools);

  // --- légende
  const blocsHere = [...new Set(nodes.filter((n) => n.type === "cand").map((n) => (S.cand.get(n.key) || {}).bloc))]
    .sort((a, b) => (S.data.study.blocs || []).findIndex((x) => x.key === a) - (S.data.study.blocs || []).findIndex((x) => x.key === b));
  const legend = el("div", { class: "legend net-legend" }, el("span", { class: "legend-title", text: t("net_legend_family") }),
    blocsHere.map((b) => el("span", { class: "key" }, el("span", { class: "ring-dot", style: `--ring:${BLOC_COLOR[b] || "#8a8a84"}` }), blocLabel(b))),
    directed ? el("span", { class: "key", text: t("net_legend_arrow") }) : null);
  const groupsBox = prox ? el("div", { class: "net-groups" },
    el("p", { class: "net-groups-sum", text: t("net_groups", { k: net.groups.length, q: FMT.sig2.format(net.q), p: pct(net.agree, 0) }) }),
    el("ul", {}, net.groups.map((keys, g) => el("li", {},
      el("span", { class: "swatch", style: `background:${GROUP_COLOR[g % GROUP_COLOR.length]}` }), el("b", { text: t("net_group", { n: g + 1 }) + " · " }),
      keys.map((k2, i) => el("span", { class: "grp-member" }, el("span", { class: "ring-dot", style: `--ring:${blocColor(k2)}` }), shortName(candName(k2)) + (i < keys.length - 1 ? ", " : ""))))))) : null;

  const dl = el("a", { class: "ghost-btn", href: "#", download: `reseau-${mode}-${S.data.generated_at.slice(0, 10)}.gexf` }, t("net_download"));
  dl.addEventListener("click", () => {
    if (S.netUrl) URL.revokeObjectURL(S.netUrl);
    S.netUrl = URL.createObjectURL(new Blob([gexf(net, mode)], { type: "application/gexf+xml" }));
    dl.href = S.netUrl;
  });
  box.append(bar, wrap, el("p", { class: "note-small net-hint", text: t("net_hint") }), legend, groupsBox, el("div", { class: "btn-row" }, dl), el("p", { class: "note-small", text: t("net_note_" + mode, { n: PROX_MIN }) }));

  start();
  dim();
  applyView();
  draw();
  run(0);

  const head = prox ? [t("net_th_from"), t("net_th_near"), t("similarity")] : directed ? [t("net_th_from"), t("net_th_named"), t("th_tweets")] : [t("net_th_from"), t("net_th_to"), t("th_tweets")];
  setTable("reseau", head.map((label, i) => ({ label, num: i === 2 })),
    [...edges].sort((a, b) => b.w - a.w).map((e) => [byId.get(e.s).label, byId.get(e.t).label, fmtW(e.w)]));
}

/* =================================================================== onglet Mots */
function renderMots(panel) {
  const lx = S.data.lexique;
  panel.replaceChildren(sectionIntro(t("mots_title"), t("mots_intro"), LANG === "en" ? el("p", { class: "note-small", text: t("mots_fr_note") }) : null));
  if (!lx) { panel.append(el("p", { class: "empty", text: t("no_data_yet") })); return; }
  const used = lx.formules.filter((f) => f.total > 0).sort((a, b) => b.total - a.total);
  const fCard = card("formules", t("formulas_title"), "formules", t("formulas_sub"), el("div", { class: "chart" }));
  panel.append(fCard);
  const fBox = fCard.querySelector(".chart");
  const gloss = (f) => (LANG === "en" && f.en ? el("span", { class: "gloss", text: f.en }) : null);
  if (!used.length) { fBox.append(el("p", { class: "empty", text: t("formulas_empty") })); setTable("formules", [], []); }
  else {
    const table = el("table", { class: "wrap-cells" }, el("thead", {}, el("tr", {}, [t("th_formula"), t("th_uses"), t("th_first"), t("th_users"), t("th_assoc")].map((h, i) => el("th", { class: i === 1 ? "num" : null, text: h })))),
      el("tbody", {}, used.map((f) => {
        const c = S.cand.get(f.premiere.c);
        const top = Object.entries(f.par_candidat).slice(0, 3);
        return el("tr", {}, el("td", {}, f.label, gloss(f)), el("td", { class: "num", text: num(f.total) }),
          el("td", {}, el("span", { class: "who-inline" }, avatar(f.premiere.c, 20), `${candName(f.premiere.c)}, ${fmtDay(f.premiere.date)}`), " ",
            c && c.handle ? el("a", { href: `https://x.com/${c.handle}/status/${f.premiere.id}`, target: "_blank", rel: "noopener", text: t("see") }) : null),
          el("td", {}, top.map(([k, n]) => el("div", { class: "who-row" }, avatar(k, 20), t("kv", { k: candName(k), v: num(n) })))),
          el("td", { text: (f.mots_associes || []).slice(0, 6).map((m) => m[0]).join(", ") }));
      })));
    fBox.append(el("div", { class: "table-view" }, table));
    const rows = [...S.cands].map((c) => ({ key: c.key, label: c.name, values: Object.fromEntries(used.map((f) => [f.key, f.par_candidat[c.key] || 0])) }))
      // tous les candidats collectés, y compris ceux qui n'emploient aucune formule : l'absence est une information
      .filter((r) => S.tweets.some((tw) => tw.c === r.key)).sort((a, b) => byBloc(a.key, b.key));
    const heat = el("div", { class: "heat-gap" });
    fBox.append(heat);
    renderHeat(heat, "formules", rows, used.map((f) => ({ key: f.key, label: LANG === "en" && f.en ? f.en : f.label.replace(/[«»]/g, "").trim(), title: f.label })), { format: (v) => num(v), min0: "0", unit: t("uses") });
  }
  const net = card("reseau", t("net_title"), "reseau", t("net_sub"),
    el("div", { class: "controls" },
      segCtrl([["formules", t("net_formules")], ["themes", t("net_themes")], ["proximite", t("net_proximite")], ["mentions", t("net_mentions")]], S.netMode, (k) => { S.netMode = k; render(); }, t("net_mode")),
      S.netMode === "mentions" ? segCtrl([["tous", t("net_scope_all")], ["eco", t("net_scope_eco")]], S.netScope, (k) => { S.netScope = k; render(); }, t("net_scope")) : null),
    el("div", { class: "chart" }));
  panel.append(net);
  renderNetwork(net.querySelector(".chart"));
  const groups = S.mots.mode === "blocs" ? lx.blocs : lx.candidats;
  const keys = Object.keys(groups).filter((k) => groups[k].length);
  if (!keys.includes(S.mots.who)) S.mots.who = S.mots.mode === "candidats" && keys.includes(S.focus) ? S.focus : keys[0];
  const name = (k) => (S.mots.mode === "blocs" ? blocLabel(k) : candName(k));
  const sel = el("select", { "aria-label": t("choose") }, keys.sort((a, b) => FMT.coll.compare(name(a), name(b))).map((k) => option(k, name(k), k === S.mots.who)));
  sel.addEventListener("change", () => { S.mots.who = sel.value; render(); });
  const kwBox = el("div", { class: "chart" });
  const kCard = card("lexique", t("lex_title"), "lexique", t("lex_sub"),
    el("div", { class: "controls" }, segCtrl([["candidats", t("by_candidate")], ["blocs", t("by_family")]], S.mots.mode, (k) => { S.mots.mode = k; S.mots.who = ""; render(); }, t("group_by")),
      keys.length ? el("label", { class: "field" }, sel) : null), kwBox);
  panel.append(kCard);
  const words = groups[S.mots.who] || [];
  if (!words.length) { kwBox.append(el("p", { class: "empty", text: t("lex_empty") })); setTable("lexique", [], []); return; }
  const mx = words[0][2];
  kwBox.append(el("div", { class: "kw" }, words.map(([w, n, g, docs]) => [el("span", { lang: "fr", text: w }), el("div", { class: "b", style: `width:${(g / mx) * 100}%` }),
    el("span", { class: "v", text: docs ? `${tn("n_uses", n)} · ${tn("n_in_tweets", docs)}` : tn("n_uses", n) })])));
  const foreign = (lx.corpus || {}).tweets_autre_langue;
  kwBox.append(el("p", { class: "note-small", text: [t("lex_rules"), foreign ? tn("lex_foreign", foreign) : null].filter(Boolean).join(" ") }));
  setTable("lexique", [{ label: t("th_word") }, { label: t("th_uses"), num: true }, { label: t("th_in_tweets"), num: true }, { label: "G²", num: true }],
    words.map(([w, n, g, docs]) => [w, num(n), docs ? num(docs) : "–", FMT.p1.format(g)]));
}

/* =================================================================== tweets */
const POS_COLOR = { favorable_transition: "var(--accent)", critique_ecologie: "var(--accent-2)", neutre: "var(--neutral-mark)" };
function chip(text, varKey, optKey, extra) {
  return el("span", { class: "chip" + (extra ? " " + extra : "") }, text, varKey ? catInfoBtn(varKey, optKey) : null);
}
// Même seuils que jev_client.level : la zone grise de l'écologie et les confiances sous 0,6 sont « faibles »
const levelOf = (kind, v) => (kind === "noul" ? (v >= 0.3 && v <= 0.7 ? 0 : v > 0.1 && v < 0.9 ? 1 : 2) : v < 0.6 ? 0 : v < 0.8 ? 1 : 2);
// Badge de confiance de Jev : niveau, détail par variable dans l'infobulle, explication dans la bulle « i »
function confidenceBadge(tw) {
  if (tw.cj === null || tw.cj === undefined) return null;
  const badge = el("span", { class: `conf-badge lv${tw.cj}`, "aria-label": t("conf_aria", { level: t("conf_" + LEVELS[tw.cj]) }) },
    el("span", { class: "dot", style: `background:${LEVEL_COLOR[tw.cj]}` }), t("conf_label", { level: t("conf_" + LEVELS[tw.cj]) }));
  hoverable(badge, () => ({ title: t("conf_tt_title"),
    rows: [...(tw.p !== null && tw.p !== undefined ? [{ value: f2(tw.p), label: t("conf_tt_eco"), key: LEVEL_COLOR[levelOf("noul", tw.p)], keyShape: "swatch" }] : []),
      ...Object.entries(tw.cf || {}).map(([short, v]) => ({ value: f2(v), label: varLabel((S.data.codebook.variables.find((x) => x.short === short) || {}).key),
        key: LEVEL_COLOR[levelOf("choice", v)], keyShape: "swatch" }))],
    note: tw.s === "c" ? t("conf_tt_claude") : tw.cj === 0 ? t("conf_tt_low") : null }));
  return el("span", { class: "who-inline" }, badge, infoBtn("confiance"));
}
// Ligne d'engagement : métriques à 48 h (ou à la collecte), engagement relatif, réactualisation éventuelle
function engagementRow(tw) {
  const parts = [["l", "n_likes"], ["rt", "n_reposts"], ["rp", "n_replies"], ["qt", "n_quotes"], ["bm", "n_bookmarks"]]
    .map(([k, key]) => tn(key, tw[k] || 0));
  if (tw.vw !== null && tw.vw !== undefined) parts.push(tn("n_views", tw.vw));
  const rel = relEng(tw);
  const maj = (S.data.maj || {})[tw.i];
  const line = el("span", { class: "eng-line" }, parts.join(" · "));
  hoverable(line, () => ({ title: tw.ma !== null && tw.ma !== undefined ? t("eng_tt_h48", { h: num(tw.ma) }) : t("eng_tt_collect"),
    rows: [{ value: num(interactions(tw)), label: t("eng_tt_inter") }, ...(rel !== null ? [{ value: times(rel), label: t("eng_tt_rel", { name: candName(tw.c) }) }] : [])],
    note: maj ? t("eng_tt_maj", { date: fmtDay(maj[0]), likes: num(maj[1] || 0), views: maj[2] === null || maj[2] === undefined ? "–" : num(maj[2]) }) : null }));
  return el("div", { class: "tweet-eng" }, line,
    rel !== null ? el("span", { class: "rel-badge" + (rel >= 1.5 ? " up" : rel <= 0.67 ? " down" : ""), title: t("eng_rel_title", { name: candName(tw.c) }) }, times(rel)) : null,
    infoBtn("engagement"));
}
function tweetItem(tw) {
  const c = S.cand.get(tw.c) || { name: tw.c };
  const all = [];
  if (tw.position) all.push(el("span", { class: "chip" }, el("span", { class: "dot", style: `background:${POS_COLOR[tw.position] || "var(--muted)"}` }), optLabel("position", tw.position)));
  (tw.themes || []).forEach((k) => all.push(chip(optLabel("themes", k))));
  for (const key of ["cadrage", "vision", "ethos"]) if (tw[key] && !NULLISH.has(tw[key])) all.push(chip(t("kv", { k: varLabel(key), v: optLabel(key, tw[key]) }), key, tw[key]));
  for (const key of ["procedes", "topoi", "legitimation", "retardement"]) (tw[key] || []).forEach((k) => all.push(chip(optLabel(key, k), key, k)));
  (tw.lx || []).forEach((w) => all.push(el("span", { class: "chip lex", lang: "fr", text: LANG === "fr" ? `« ${w} »` : `“${w}”` })));
  const chips = el("div", { class: "chips" });
  const draw = () => {
    const open = S.openChips.has(tw.i) || all.length <= CHIP_LIMIT + 1;
    const more = all.length - CHIP_LIMIT;
    chips.replaceChildren(open ? all : all.slice(0, CHIP_LIMIT),
      all.length > CHIP_LIMIT + 1 ? el("button", { class: "chip-more", type: "button", "aria-expanded": String(open), "aria-label": open ? t("chips_less") : t("chips_more_aria", { n: more }), text: open ? t("chips_less") : `+${more}`,
        onclick: () => { if (open) S.openChips.delete(tw.i); else S.openChips.add(tw.i); draw(); chips.querySelector(".chip-more").focus(); } }) : null);
  };
  draw();
  // Version anglaise : traduction automatique si elle existe, original en français à un clic
  const translated = LANG === "en" && !!tw.te, orig = translated && S.showOriginal.has(tw.i);
  const en = translated && !orig, im = en && tw.ie ? tw.ie : tw.im;
  const foot = [t("coded_by", { engine: tw.s === "c" ? "Claude" : "Jev" }), tw.p !== null && tw.p !== undefined ? t("p_eco", { p: f2(tw.p) }) : null, im ? t("presupposed", { x: im }) : null].filter(Boolean).join(" · ");
  const li = el("li", { class: "tweet" });
  const toggle = translated ? el("button", { class: "tr-toggle", type: "button", "aria-pressed": String(orig),
    text: orig ? t("tr_show_translation") : t("tr_show_original"),
    onclick: () => { if (orig) S.showOriginal.delete(tw.i); else S.showOriginal.add(tw.i); const next = tweetItem(tw); li.replaceWith(next); next.querySelector(".tr-toggle").focus(); } }) : null;
  li.append(
    el("div", { class: "tweet-head" }, avatar(tw.c, 28), el("strong", { text: c.name }), el("span", { text: fmtDay(tw.d) }),
      LANG === "en" && !en ? el("span", { class: "lang-tag", title: t("in_french"), text: "FR" }) : null,
      c.handle ? el("a", { href: `https://x.com/${c.handle}/status/${tw.i}`, target: "_blank", rel: "noopener", text: t("see_on_x") }) : null),
    el("p", { class: "tweet-text", lang: en ? "en" : "fr", text: (en ? tw.te : tw.t) || "" }),
    translated ? el("p", { class: "tr-note" }, el("span", { text: en ? t("tr_machine") : t("tr_original") }), " · ", toggle) : null,
    (en && tw.re) || tw.rs ? el("p", { class: "tweet-resume", lang: en && tw.re ? "en" : "fr", text: en && tw.re ? tw.re : tw.rs }) : null, chips,
    engagementRow(tw),
    el("div", { class: "tweet-foot" }, confidenceBadge(tw), el("span", { text: foot })));
  return li;
}
function renderTweets(panel) {
  const x = S.x;
  const sel = (id, items, cur, all = t("all_m")) => el("select", { id }, option("", all, !cur), items.map(([k, l]) => option(k, l, k === cur)));
  const optsOf = (v) => V(v).options.filter((o) => !NULLISH.has(o.key)).map((o) => [o.key, L(o, "label")]);
  const concept = el("select", { id: "x-concept" }, option("", t("all_m"), !x.concept),
    ["procedes", "topoi", "legitimation", "retardement", "vision", "ethos"].map((vk) => el("optgroup", { label: varLabel(vk) }, optsOf(vk).map(([k, l]) => option(`${vk}:${k}`, l, x.concept === `${vk}:${k}`)))));
  const q = el("input", { id: "x-q", type: "search", placeholder: t("search_ph"), value: x.q });
  const fields = el("div", { class: "explorer-filters" },
    el("label", { class: "field" }, el("span", { text: t("f_candidate") }), sel("x-cand", [...S.cands].sort(byName).map((c) => [c.key, c.name]), x.cand)),
    el("label", { class: "field" }, el("span", { text: t("f_theme") }), sel("x-theme", optsOf("themes"), x.theme)),
    el("label", { class: "field" }, el("span", { text: t("f_position") }), sel("x-pos", optsOf("position"), x.pos, t("all_f"))),
    el("label", { class: "field" }, el("span", { text: t("f_frame") }), sel("x-cad", optsOf("cadrage"), x.cad)),
    el("label", { class: "field" }, el("span", { text: t("f_concept") }), concept),
    el("label", { class: "field" }, el("span", { class: "who-inline" }, t("f_conf")), sel("x-conf", [2, 1, 0].map((lv) => [String(lv), t("conf_" + LEVELS[lv])]), x.conf, t("all_f"))),
    el("label", { class: "field grow" }, el("span", { text: t("f_search") }), q),
    el("label", { class: "field" }, el("span", { text: t("f_sort") }), sel("x-sort", [["likes", t("sort_likes")], ["rel", t("sort_rel")], ["conf", t("sort_conf")]], x.sort === "date" ? "" : x.sort, t("sort_recent"))));
  const list = el("ol", { class: "tweet-list" });
  const more = el("button", { class: "ghost-btn", type: "button", text: t("show_more") });
  const sub = el("p", { class: "sub", role: "status" });
  panel.replaceChildren(sectionIntro(t("tweets_title"), t("tweets_intro"), LANG === "en" ? el("p", { class: "note-small", text: t(S.tweets.some((tw) => tw.te) ? "tweets_tr_note" : "tweets_fr_note") }) : null),
    el("section", { class: "card" }, fields, sub, list, el("div", { class: "btn-row" }, more)));
  const update = () => {
    let items = filtered().filter((tw) => tw.e && tw.t && (!x.cand || tw.c === x.cand) && (!x.theme || tw.themes.includes(x.theme)) && (!x.pos || tw.position === x.pos) && (!x.cad || tw.cadrage === x.cad));
    if (x.concept) { const [vk, ok] = x.concept.split(":"); items = items.filter((tw) => (Array.isArray(tw[vk]) ? tw[vk].includes(ok) : tw[vk] === ok)); }
    if (x.conf !== "") items = items.filter((tw) => String(tw.cj) === x.conf);
    if (x.q) { const n = x.q.toLowerCase(); items = items.filter((tw) => [tw.t, tw.rs, tw.te, tw.re].some((s) => (s || "").toLowerCase().includes(n))); }
    const byDate = (a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0);
    const sorters = { likes: (a, b) => b.l - a.l, rel: (a, b) => (relEng(b) ?? -1) - (relEng(a) ?? -1) || byDate(a, b),
      conf: (a, b) => (a.cj ?? 3) - (b.cj ?? 3) || (Math.abs((a.p ?? 1) - 0.5) - Math.abs((b.p ?? 1) - 0.5)) };
    items.sort(sorters[x.sort] || byDate);
    sub.textContent = tn("tweets_count", items.length);
    list.replaceChildren(...(items.length ? items.slice(0, x.shown).map(tweetItem) : [el("li", { class: "empty", text: t("tweets_none") })]));
    more.hidden = items.length <= x.shown;
  };
  const sync = () => { Object.assign(x, { cand: $("#x-cand").value, theme: $("#x-theme").value, pos: $("#x-pos").value, cad: $("#x-cad").value, concept: $("#x-concept").value,
    conf: $("#x-conf").value, q: $("#x-q").value.trim(), sort: $("#x-sort").value || "date", shown: 15 }); update(); };
  $$("select", fields).forEach((s) => s.addEventListener("change", sync));
  q.addEventListener("input", debounce(sync, 200));
  more.addEventListener("click", () => { x.shown += 15; update(); });
  update();
}

/* =================================================================== onglet Méthode */
function agreementTable(ev) {
  const fmt = (v) => (v === null || v === undefined ? "–" : f2(v));
  const status = (raw) => {
    const a = raw === null || raw === undefined ? null : Math.round(raw * 100) / 100;
    if (a === null) return el("span", { text: "–" });
    if (a >= 0.8) return el("span", { class: "status good" }, el("span", { class: "ico", "aria-hidden": "true", text: "✓" }), t("rel_good"));
    if (a >= 0.667) return el("span", { class: "status warning" }, el("span", { class: "ico", "aria-hidden": "true", text: "~" }), t("rel_warn"));
    return el("span", { class: "status critical" }, el("span", { class: "ico", "aria-hidden": "true", text: "✕" }), t("rel_bad"));
  };
  const rows = ev.variables.map((v) => [varLabel(v.variable), num(v.n), v.accord === null ? "–" : pct(v.accord), fmt(v.kappa), fmt(v.alpha), status(v.alpha)]);
  for (const [k, m] of Object.entries(ev.multi || {})) rows.push([t("multi_mean", { label: varLabel(k) }), num(m.n), m.jaccard_moyen === null ? "–" : `Jaccard ${fmt(m.jaccard_moyen)}`, "–", fmt(m.alpha_moyen), status(m.alpha_moyen)]);
  return el("div", { class: "table-view" }, el("table", {},
    el("thead", {}, el("tr", {}, [t("th_variable"), "n", t("th_agreement"), "Kappa", "Alpha", t("th_reading")].map((h, i) => el("th", { class: i && i < 5 ? "num" : null, text: h })))),
    el("tbody", {}, rows.map((r) => el("tr", {}, r.map((v, i) => el("td", { class: i && i < 5 ? "num" : null }, v instanceof Node ? v : String(v))))))));
}
const METHODE_SECTIONS = ["questions", "corpus", "moteurs", "fiabilite", "confiance", "comptes", "limites", "codebook", "credits"];
// Confiance de Jev : répartition des niveaux par variable, et accord avec Claude selon ce niveau
function confidenceSection() {
  const d = S.data, spread = d.confiance || {};
  const keys = Object.keys(spread);
  const box = el("div", { class: "chart" });
  const c = card("m-confiance", t("m_conf_title"), "confiance", t("m_conf_sub"), box);
  if (!keys.length) { box.append(el("p", { class: "empty", text: t("no_data_yet") })); return { node: c, draw: () => setTable("m-confiance", [], []) }; }
  box.append(el("div", { class: "legend" }, LEVELS.map((lv, i) => el("span", { class: "key" }, el("span", { class: "swatch", style: `background:${LEVEL_COLOR[i]}` }), t("conf_" + lv)))),
    el("div", { class: "bars" }, keys.map((k) => {
      const counts = spread[k], n = counts.reduce((a, b) => a + b, 0);
      const track = el("div", { class: "bar-track", "aria-label": t("conf_row_aria", { name: varLabel(k), low: pct(counts[0] / n, 0), mid: pct(counts[1] / n, 0), high: pct(counts[2] / n, 0) }) },
        el("div", { class: "stack100" }, counts.map((x, i) => (x ? el("span", { style: `flex:${x};background:${LEVEL_COLOR[i]}` }) : null))));
      hoverable(track, () => ({ title: varLabel(k), rows: counts.map((x, i) => ({ value: pct(x / n, 0), label: t("conf_" + LEVELS[i]), key: LEVEL_COLOR[i], keyShape: "swatch" })), note: tn("n_tweets", n) }));
      return el("div", { class: "bar-row" }, el("div", { class: "bar-name", text: varLabel(k) }), track);
    })));
  const agree = (d.validation || {}).par_confiance;
  if (agree && Object.keys(agree).length) {
    const cell = (b) => (b && b.n ? `${pct(b.accord, 0)} (n=${num(b.n)})` : "–");
    box.append(el("h3", { class: "block-sub", text: t("m_conf_agree_title") }), el("p", { class: "note-small", text: t("m_conf_agree_note") }),
      el("div", { class: "table-view" }, el("table", {}, el("thead", {}, el("tr", {}, el("th", { text: t("th_variable") }), LEVELS.map((lv) => el("th", { class: "num", text: t("conf_" + lv) })))),
        el("tbody", {}, Object.entries(agree).map(([k, bins]) => el("tr", {}, el("td", { text: varLabel(k) }), bins.map((b) => el("td", { class: "num", text: cell(b) }))))))));
  } else box.append(el("p", { class: "note-small", text: t("m_conf_agree_none") }));
  return { node: c, draw: () => setTable("m-confiance", [{ label: t("th_variable") }, ...LEVELS.map((lv) => ({ label: t("conf_" + lv), num: true }))],
    keys.map((k) => { const n = spread[k].reduce((a, b) => a + b, 0); return [varLabel(k), ...spread[k].map((x) => pct(x / n, 0))]; })) };
}
function renderMethode(panel) {
  const d = S.data;
  const section = (key, ...body) => el("section", { class: "card", id: "m-" + key }, ...body);
  const parts = [sectionIntro(t("methode_title"), t("methode_intro")),
    el("nav", { class: "toc", "aria-label": t("toc_aria") }, METHODE_SECTIONS.map((k) => el("a", { class: "tab", href: `#methode/${k}`, text: t("m_" + k) })))];
  if ((d.study.questions || []).length) parts.push(section("questions", el("h2", { text: t("m_questions_title") }),
    el("dl", { class: "cat-list" }, d.study.questions.map((q) => el("div", {}, el("dt", { text: L(q, "titre") }), el("dd", { text: L(q, "texte") }))))));
  parts.push(section("corpus", el("h2", { text: t("m_corpus") }), el("p", { class: "sub", text: t("m_corpus_text", { date: fmtDay(d.study.start) }) }),
    el("div", { class: "table-view" }, el("table", {}, el("thead", {}, el("tr", {}, [t("th_phase"), t("th_start"), t("th_end")].map((h) => el("th", { text: h })))),
      el("tbody", {}, (d.study.phases || []).map((p) => el("tr", {}, el("td", { text: L(p, "label") }), el("td", { text: fmtDay(p.start) }), el("td", { text: fmtDay(p.end) }))))))));
  parts.push(el("div", { id: "m-moteurs" }, el("h2", { class: "block-title", text: t("m_moteurs") }), ...d.codebook.engines.filter((e) => !["fiabilite", "confiance"].includes(e.key)).map(frameworkCard)));
  const val = section("fiabilite", titleWithInfo("h2", t("m_reliability_title"), "fiabilite"));
  const v = d.validation;
  if (!v || !v.double_code || !v.double_code.n) {
    val.append(el("p", { class: "sub", text: t("m_no_claude") }));
    if (v && v.routage) val.append(el("p", { class: "note-small", text: t("m_routing", { jev: num(v.routage.tweets_codes_jev), pending: num(v.routage.incertains_en_attente) }) }));
  } else {
    const s = v.echantillon && v.echantillon.aleatoire;
    val.append(el("p", { class: "sub", text: t("m_routing_both", { jev: num(v.routage.tweets_codes_jev), claude: num(v.routage.tweets_codes_claude) }) }));
    if (s && s.n) val.append(el("h3", { class: "block-sub", text: t("m_sample", { n: num(s.n) }) }), agreementTable(s));
    val.append(el("h3", { class: "block-sub", text: t("m_double", { n: num(v.double_code.n) }) }), el("p", { class: "note-small", text: t("m_double_note") }), agreementTable(v.double_code));
  }
  parts.push(val);
  const conf = confidenceSection();
  parts.push(conf.node);
  parts.push(section("comptes", el("h2", { text: t("m_comptes") }), el("div", { class: "table-view" }, el("table", { class: "wrap-cells" },
    el("thead", {}, el("tr", {}, [t("th_candidate"), t("th_account"), t("th_status"), t("th_last"), t("th_note")].map((h) => el("th", { text: h })))),
    el("tbody", {}, [...S.cands].sort((a, b) => byBloc(a.key, b.key)).map((c) => el("tr", {},
      el("td", {}, el("span", { class: "who-inline" }, avatar(c.key, 20), c.name)),
      el("td", {}, c.handle ? el("a", { href: `https://x.com/${c.handle}`, target: "_blank", rel: "noopener", text: "@" + c.handle }) : t("none_m")),
      el("td", { text: accountText(c.compte) }), el("td", { text: c.dernier_tweet ? fmtDay(c.dernier_tweet) : "–" }), el("td", { text: L(c, "note") }))))))));
  parts.push(section("limites", el("h2", { text: t("m_limites") }), el("ul", { class: "sub" }, [1, 2, 3, 4, 5].map((i) => el("li", { text: t("limit_" + i, { n: MIN_N }) })))));
  const book = el("details", { class: "fold" }, el("summary", { text: t("m_codebook_full") }));
  for (const fw of d.codebook.frameworks) {
    const vars = d.codebook.variables.filter((x) => x.framework === fw.key);
    book.append(el("h3", { class: "block-sub", text: `${L(fw, "label")} · ${L(fw, "auteurs")}` }), el("p", { class: "note-small", text: L(fw, "dans_l_etude") }));
    for (const x of vars) book.append(el("p", {}, el("strong", { text: L(x, "label") }), x.scope === "ecologie" ? " " + t("eco_scope") : ""),
      el("dl", { class: "defs" }, x.options.map((o) => [el("dt", { text: L(o, "label") }), el("dd", { text: LANG === "en" ? o.en : [o.fr, t("model_def", { d: o.en })].filter(Boolean).join(" ") })])));
  }
  parts.push(section("codebook", el("h2", { text: t("m_codebook") }), el("p", { class: "sub", text: t("m_codebook_sub") }), book));
  const photos = S.cands.filter((c) => c.photo);
  if (photos.length) parts.push(section("credits", el("h2", { text: t("m_credits") }), el("ul", { class: "note-small credits" },
    photos.map((c) => el("li", {}, `${t("kv", { k: c.name, v: `${L(c.photo, "auteur") || t("unknown_author")}${c.photo.licence ? ", " + c.photo.licence : ""}` })}, `,
      c.photo.source ? el("a", { href: c.photo.source, target: "_blank", rel: "noopener", text: t("source") }) : null)))));
  panel.replaceChildren(...parts);
  conf.draw();
}

/* =================================================================== jeux */
const GAMES = { qui: { rounds: 8, min: 4, minutes: 3 }, agent: { rounds: 6, min: 3, minutes: 5 }, situer: { rounds: 12, min: 6, minutes: 3 } };
const GAME_KEYS = Object.keys(GAMES);
function gameItems(key) {
  const items = S.games.items;
  if (key === "agent") return items.filter((it) => it.jev && it.jev.position && it.jev.cadrage);
  if (key === "situer") { const g = growthMap(); return items.filter((it) => STANCE[it.codes.position] && it.codes.vision in g); }
  return items;
}
function gameAvailable(key) {
  if (!S.data || gameItems(key).length < GAMES[key].min) return false;
  if (key === "qui") return new Set(S.games.items.map((it) => it.c)).size >= 2;
  if (key === "situer") return compassRows(S.tweets).rows.length >= 2;
  return true;
}
// Tirage qui alterne les candidats, pour ne pas enchaîner les tweets d'un même auteur
function pickSpread(items, n, rnd = Math.random) {
  items = [...items].sort((a, b) => (a.i < b.i ? -1 : 1)); // ordre stable, pour que la graine suffise
  const by = new Map();
  for (const it of shuffle(items, rnd)) { if (!by.has(it.c)) by.set(it.c, []); by.get(it.c).push(it); }
  const out = [];
  while (out.length < n && [...by.values()].some((l) => l.length)) for (const l of shuffle([...by.values()], rnd)) { if (l.length && out.length < n) out.push(l.pop()); }
  return out;
}
// Générateur pseudo-aléatoire à graine : le défi du jour tire les mêmes tweets pour tout le monde
function seeded(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) { h = Math.imul(h ^ text.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h |= 0; h = (h + 0x6d2b79f5) | 0; let x = Math.imul(h ^ (h >>> 15), 1 | h); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
const today = () => new Date().toISOString().slice(0, 10);
function newGame(key, daily = false) {
  if (!gameAvailable(key)) return null;
  const g = GAMES[key], items = gameItems(key), rnd = daily ? seeded(`${today()}|${key}`) : Math.random;
  const mix = (a) => shuffle(a, rnd);
  if (key === "qui") {
    const pool = [...new Set(S.games.items.map((it) => it.c))].sort();
    return { key, daily, i: 0, rounds: pickSpread(items, g.rounds, rnd).map((it) => {
      // le bon auteur, un candidat de sa famille, et un candidat de chacune de deux autres familles
      const blocOf = (k) => (S.cand.get(k) || {}).bloc, bloc = blocOf(it.c);
      const same = mix(pool.filter((k) => k !== it.c && blocOf(k) === bloc)).slice(0, 1);
      const families = mix([...new Set(pool.map(blocOf))].filter((b) => b !== bloc));
      const other = families.slice(0, 3 - same.length).map((b) => mix(pool.filter((k) => blocOf(k) === b))[0]);
      // famille unique ou trop peu de familles : compléter avec n'importe quel autre candidat
      const rest = mix(pool.filter((k) => k !== it.c && !same.includes(k) && !other.includes(k)));
      const opts = [it.c, ...same, ...other, ...rest].slice(0, 4);
      return { it, options: mix(opts), pick: null, hint: false };
    }) };
  }
  if (key === "agent") {
    return { key, daily, i: 0, rounds: pickSpread(items, g.rounds, rnd).map((it) => {
      const pr = Object.entries(it.jev.procedes || {}).sort((a, b) => b[1] - a[1]);
      return { it, procOpts: mix([...pr.slice(0, 3), ...mix(pr.slice(3)).slice(0, 3)].map(([k]) => k)), answer: null, agree: null };
    }) };
  }
  // Où vous situez-vous : strates position × signe du rapport à la croissance, tirées à tour de rôle
  const growth = growthMap();
  const strata = new Map();
  for (const it of items) { const k = `${it.codes.position}|${Math.sign(growth[it.codes.vision])}`; if (!strata.has(k)) strata.set(k, []); strata.get(k).push(it); }
  const lists = [...strata.keys()].sort().map((k) => pickSpread(strata.get(k), strata.get(k).length, rnd));
  const out = [];
  while (out.length < g.rounds && lists.some((l) => l.length)) for (const l of mix(lists)) if (l.length && out.length < g.rounds) out.push(l.shift());
  return { key, daily, i: 0, rounds: mix(out).map((it) => ({ it, r: undefined })) };
}
// Rejouer : de nouveaux tweets (le défi du jour, lui, ne change qu'une fois par jour)
function replay(key) { if (S.play && S.play.daily) { go("jouer", key); return; } S.play = newGame(key); S.scrollTo = "top"; S.focusTo = "[data-autofocus]"; render(); }
// Qui a tweeté : 1 point pour le bon auteur, ½ pour la bonne famille politique, ½ de moins avec l'indice
const sameBloc = (a, b) => (S.cand.get(a) || {}).bloc === (S.cand.get(b) || {}).bloc;
const quiPoints = (r) => (r.pick === null ? 0 : Math.max(0, (r.pick === r.it.c ? 1 : sameBloc(r.pick, r.it.c) ? 0.5 : 0) - (r.hint ? 0.5 : 0)));
function quiStreak(P) { let n = 0; for (const r of P.rounds) { if (r.pick === null) break; n = r.pick === r.it.c ? n + 1 : 0; } return n; }
function nextRound() { S.play.i++; S.scrollTo = { sel: ".game", block: "start" }; S.focusTo = "[data-autofocus]"; render(); }
function answerQui(k) {
  const round = S.play.rounds[S.play.i];
  if (!round || round.pick !== null) return;
  round.pick = k;
  S.scrollTo = { sel: "#reveal", block: "nearest" }; S.focusTo = "#next-btn";
  render();
}
function answerAgent(ans) {
  const round = S.play.rounds[S.play.i], it = round.it;
  const top = (probs) => (Object.entries(probs || {}).sort((a, b) => b[1] - a[1])[0] || [])[0];
  const jevProc = round.procOpts.filter((k) => (it.jev.procedes || {})[k] >= 0.5);
  const a = new Set(ans.procedes), b = new Set(jevProc), union = new Set([...a, ...b]);
  round.answer = ans;
  round.agree = ((ans.position === top(it.jev.position)) + (ans.cadrage === top(it.jev.cadrage)) + (union.size ? [...a].filter((k) => b.has(k)).length / union.size : 1)) / 3;
  S.scrollTo = { sel: "#reveal", block: "start" }; S.focusTo = "#next-btn";
  render();
}
function reactSituer(v) {
  const round = S.play.rounds[S.play.i];
  if (!round) return;
  round.r = v;
  nextRound();
}
// Raccourcis clavier des jeux
document.addEventListener("keydown", (e) => {
  if (S.tab !== "jouer" || !S.play || e.ctrlKey || e.metaKey || e.altKey || !$("#popover").hidden) return;
  if (e.target.closest && e.target.closest("input, select, textarea")) return;
  const P = S.play, round = P.rounds[P.i];
  if (!round) return;
  const onControl = e.target.closest && e.target.closest("button, a");
  if (P.key === "qui") {
    if (round.pick === null && /^[1-4]$/.test(e.key) && round.options[+e.key - 1]) { e.preventDefault(); answerQui(round.options[+e.key - 1]); }
    else if (round.pick !== null && e.key === "Enter" && !onControl) { e.preventDefault(); nextRound(); }
  } else if (P.key === "situer") {
    const map = { 1: 1, 2: 0, 3: -1, 0: null };
    if (Object.hasOwn(map, e.key)) { e.preventDefault(); reactSituer(map[e.key]); }
  } else if (P.key === "agent" && round.answer && e.key === "Enter" && !onControl) { e.preventDefault(); nextRound(); }
});

const itemText = (it) => (LANG === "en" && it.t_en ? it.t_en : it.t);
function quote(it) {
  const translated = LANG === "en" && !!it.t_en;
  const meta = [t(it.m === "claude" ? "quote_meta_claude" : "quote_meta_auto", { date: fmtDay(it.d) }), translated ? t("quote_translated") : null, LANG === "en" && !translated ? t("quote_fr_only") : null];
  return [el("blockquote", { class: "quote", lang: translated ? "en" : "fr", text: itemText(it) }), el("p", { class: "quote-meta", text: meta.filter(Boolean).join(" ") })];
}
function originalLink(it) { const c = S.cand.get(it.c); return c && c.handle ? el("a", { href: `https://x.com/${c.handle}/status/${it.i}`, target: "_blank", rel: "noopener", text: t("see_original") }) : null; }
function cluesFor(it) {
  const ind = LANG === "en" ? it.ind_en : it.ind;
  if (ind && ind.length) return ind.map((x) => el("li", { text: x }));
  const c = it.codes || {}, li = [];
  const one = (key, msg, fw) => { if (c[key] && !NULLISH.has(c[key])) li.push(el("li", {}, t(msg, { v: optLabel(key, c[key]) }), " ", infoBtn(fw))); };
  const many = (key, msg, fw) => { if ((c[key] || []).length) li.push(el("li", {}, t(msg, { v: c[key].map((k) => optLabel(key, k).toLowerCase()).join(", ") }), " ", infoBtn(fw))); };
  one("cadrage", "clue_frame", "cadrage");
  one("vision", "clue_vision", "visions");
  one("polarisation", "clue_square", "carre");
  many("topoi", "clue_topoi", "topoi");
  many("procedes", "clue_devices", "procedes");
  many("retardement", "clue_delay", "retardement");
  return li.length ? li : [el("li", { text: t("clue_none") })];
}
function hint(parts) {
  return el("p", { class: "hint" }, t("shortcuts"), " ", parts.map(([keys, text], i) => [i ? " · " : "", keys.map((k, j) => [j ? " " : "", el("kbd", { text: k })]), " ", text]));
}
function scorePill(P) {
  if (P.key === "qui") {
    const streak = quiStreak(P);
    return el("span", { class: "score-pill" }, t("score_pill", { n: num(P.rounds.reduce((a, r) => a + quiPoints(r), 0)) }), streak >= 2 ? el("span", { class: "streak", text: t("streak", { n: streak }) }) : null);
  }
  if (P.key === "agent") { const done = P.rounds.filter((r) => r.answer); return done.length ? el("span", { class: "score-pill", text: t("agree_pill", { v: pct(mean(done, (r) => r.agree), 0) }) }) : null; }
  return null;
}
function roundClass(P, r) {
  if (P.key === "qui") return r.pick === null ? "" : r.pick === r.it.c ? "ok" : sameBloc(r.pick, r.it.c) ? "half" : "ko";
  if (P.key === "agent") return r.answer ? "done" : "";
  return r.r !== undefined ? "done" : "";
}
function gameTop(P) {
  const n = P.rounds.length;
  return el("div", { class: "game-top" },
    el("button", { class: "ghost-btn", type: "button", onclick: () => go("jouer") }, icon("arrowL", 16), t("all_games")),
    el("span", { class: "game-title" }, t("g_" + P.key), P.daily ? el("span", { class: "daily-tag", text: t("daily_tag", { date: fmtShort(today()) }) }) : null),
    el("div", { class: "dots", role: "img", "aria-label": P.i < n ? t("round_of", { i: P.i + 1, n }) : t("game_over") }, P.rounds.map((r, i) => el("i", { class: [roundClass(P, r), i === P.i ? "cur" : ""].join(" ").trim() || null }))),
    scorePill(P));
}
const tier = (x) => (x >= 0.75 ? t("tier_high") : x >= 0.4 ? t("tier_mid") : t("tier_low"));
async function shareResult(key, text) {
  const url = location.origin + location.pathname + (LANG === "en" ? "?lang=en" : "") + `#jouer/${key}` + (S.play && S.play.daily ? "/jour" : "");
  if (navigator.share) {
    try { await navigator.share({ title: t("doc_title"), text, url }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast(t("link_copied")); } catch (e) { toast(t("copy_failed")); }
}
function endButtons(key, share) {
  // Enchaînement en boucle : qui, agent, situer
  const i = GAME_KEYS.indexOf(key);
  const next = [1, 2].map((d) => GAME_KEYS[(i + d) % GAME_KEYS.length]).find(gameAvailable);
  return el("div", { class: "btn-row" },
    el("button", { class: "primary-btn", type: "button", "data-autofocus": true, onclick: () => replay(key) }, icon("replay", 18),
      S.play && S.play.daily ? t("replay_free") : key === "situer" ? t("replay_other") : t("replay")),
    next ? el("button", { class: "secondary-btn", type: "button", onclick: () => go("jouer", next) }, t("next_game", { name: t("g_" + next) })) : null,
    el("button", { class: "ghost-btn", type: "button", onclick: () => shareResult(key, share) }, icon("share", 16), t("share")));
}
function endCard({ key, big, label, tierText, text, extra, share }) {
  return el("section", { class: "card end" }, el("p", { class: "eyebrow", text: t("game_over") }),
    big ? el("div", { class: "big", text: big }) : null, label ? el("p", { class: "end-label", text: label }) : null,
    tierText ? el("div", { class: "tier", text: tierText }) : null, text ? el("p", { text }) : null, extra, endButtons(key, share));
}
function recapCard(items) {
  return el("section", { class: "card" }, el("h3", { text: t("recap_title") }), el("ul", { class: "recap" }, items.map((x) =>
    el("li", {}, avatar(x.c, 28), el("span", { class: "snip", title: x.text }, el("strong", { text: candName(x.c) }), " · ", x.text), el("span", { class: `res ${x.res || ""}`, text: x.label })))));
}
function theoriesCard(keys) {
  return el("section", { class: "card" }, el("h3", { text: t("theories_met") }), el("p", { class: "sub", text: t("theories_sub") }),
    el("div", { class: "chips spaced" }, keys.filter((k) => S.fw.has(k)).map((k) => el("span", { class: "chip" }, fwLabel(k), infoBtn(k)))),
    el("div", { class: "btn-row" }, el("a", { class: "secondary-btn", href: "#discours" }, t("explore_discourse"), icon("arrowR", 16)), el("a", { class: "ghost-btn", href: "#apercu", text: t("explore_results") })));
}

function renderQui(box, P) {
  const round = P.rounds[P.i];
  if (!round) {
    const n = P.rounds.length, score = P.rounds.reduce((a, r) => a + quiPoints(r), 0), best = Math.max(...P.rounds.map((r, i) => quiStreak({ rounds: P.rounds.slice(0, i + 1) })));
    // le grand chiffre compte les auteurs exacts ; les demi-points (bonne famille) apparaissent à part, dans le score
    const found = P.rounds.filter((r) => r.pick === r.it.c).length, family = P.rounds.filter((r) => r.pick !== null && r.pick !== r.it.c && sameBloc(r.pick, r.it.c)).length;
    box.append(gameTop(P), endCard({ key: "qui", big: `${found}/${n}`, label: t("qui_end_label"), tierText: tier(n ? found / n : 0),
      text: t("qui_end_p"), extra: el("div", {}, el("p", { class: "end-label", text: t("qui_end_detail", { family, score: num(score), n }) }),
        best >= 2 ? el("p", { class: "end-label", text: t("best_streak", { n: best }) }) : null),
      share: t(P.daily ? "share_qui_daily" : "share_qui", { score: found, n, date: fmtShort(today()) }) }),
      recapCard(P.rounds.map((r) => ({ c: r.it.c, text: itemText(r.it), res: r.pick === r.it.c ? "ok" : sameBloc(r.pick, r.it.c) ? "half" : "ko", label: num(quiPoints(r)) }))),
      theoriesCard(["carre", "cadrage", "topoi", "procedes", "visions", "retardement"]));
    return;
  }
  const answered = round.pick !== null;
  box.append(gameTop(P), ...quote(round.it), el("p", { class: "q-title", id: "q-title", text: t("qui_q") }),
    el("div", { class: "choices", role: "group", "aria-labelledby": "q-title" }, round.options.map((k, idx) => {
      const c = S.cand.get(k);
      const cls = answered ? (k === round.it.c ? " right" : k === round.pick ? " wrong" : "") : "";
      return el("button", { class: "choice" + cls, type: "button", disabled: answered ? true : null, "data-autofocus": !answered && idx === 0 ? true : null, onclick: () => answerQui(k) },
        avatar(k, 44), el("span", {}, c.name, el("span", { class: "sub2", text: L(c, "party") })), el("span", { class: "k", "aria-hidden": "true", text: String(idx + 1) }));
    })));
  if (!answered) {
    const clue = cluesFor(round.it)[0];
    box.append(round.hint ? el("div", { class: "hint-box", role: "status" }, el("strong", { text: t("hint_title") }), el("ul", {}, clue))
      : el("div", { class: "skip-row" }, el("button", { class: "ghost-btn", type: "button", onclick: () => { round.hint = true; render(); } }, t("hint_btn"))),
      hint([[["1", "2", "3", "4"], t("hint_answer")]]));
    return;
  }
  const good = round.pick === round.it.c, half = !good && sameBloc(round.pick, round.it.c), c = S.cand.get(round.it.c);
  box.append(el("div", { class: "reveal", id: "reveal" },
    el("div", { class: `verdict ${good ? "good" : half ? "half" : "bad"}`, role: "status" }, el("span", { class: "ico", "aria-hidden": "true", text: good ? "✓" : half ? "½" : "✕" }),
      good ? t("qui_right") : half ? t("qui_family", { name: c.name, family: blocLabel(c.bloc) }) : t("qui_wrong", { name: c.name })),
    el("p", { class: "note-small", text: t("qui_points", { n: num(quiPoints(round)) }) + (round.hint ? " " + t("qui_hint_cost") : "") + (good && quiStreak(P) >= 2 ? " " + t("streak", { n: quiStreak(P) }) : "") }),
    el("p", {}, `${c.name}, ${L(c, "party")}. `, originalLink(round.it)),
    el("h3", { text: t("clues_title") }), el("ul", {}, cluesFor(round.it)),
    el("div", { class: "btn-row" }, el("button", { class: "primary-btn", id: "next-btn", type: "button", onclick: nextRound }, P.i + 1 < P.rounds.length ? t("next_tweet") : t("see_score"), icon("arrowR", 18))),
    hint([[[t("key_enter")], t("hint_next")]])));
}

function compareBlock(title, fwKey, varKey, probs, mine, claude, keys) {
  const sorted = Object.entries(probs || {}).sort((a, b) => b[1] - a[1]);
  const jevPick = sorted.length ? sorted[0][0] : null;
  let entries;
  if (keys) entries = keys.map((k) => [k, probs[k] || 0]).sort((a, b) => b[1] - a[1]);
  else {
    const top = sorted.filter(([k]) => !NULLISH.has(k)).slice(0, 3);
    const extra = [mine, jevPick].filter((k) => k && !top.some(([x]) => x === k));
    entries = [...top, ...[...new Set(extra)].map((k) => [k, probs[k] || 0])].sort((a, b) => b[1] - a[1]);
  }
  const claudeText = claude === null || claude === undefined ? "" : Array.isArray(claude) ? (claude.length ? claude.map((k) => optLabel(varKey, k)).join(", ") : t("none_m")) : optLabel(varKey, claude);
  return el("div", { class: "q-block" }, el("div", { class: "q-title" }, title, infoBtn(fwKey)),
    el("div", { class: "cmp" }, entries.map(([k, p]) => {
      const isMine = Array.isArray(mine) ? mine.includes(k) : mine === k;
      return [el("span", { class: "lbl" + (isMine ? " mine" : ""), text: optLabel(varKey, k) + (isMine ? ` · ${t("you_tag")}` : "") }),
        el("div", { class: "track" }, el("div", { class: "fill", style: `width:${p * 100}%` })), el("span", { class: "num", text: pct(p, 0) })];
    })),
    el("p", { class: "note-small", text: (keys || !jevPick ? t("cmp_jev") : t("cmp_jev_pick", { v: optLabel(varKey, jevPick) })) + (claudeText ? " " + t("cmp_claude", { v: claudeText }) : "") }));
}
// Définitions des catégories en jeu : le choix du joueur et celui de Jev, quand ils diffèrent
function codebookNotes(it, answer) {
  const top = (probs) => (Object.entries(probs || {}).sort((a, b) => b[1] - a[1])[0] || [])[0];
  const items = [];
  for (const v of ["position", "cadrage"]) {
    const keys = [...new Set([answer[v], top(it.jev[v])])].filter((k) => k && !NULLISH.has(k));
    for (const k of keys) { const def = optDef(v, k) || (opt(v, k) || {}).en; if (def) items.push(el("li", {}, el("strong", { text: optLabel(v, k) }), t("colon"), def)); }
  }
  return items.length ? el("details", { class: "fold" }, el("summary", { text: t("codebook_says") }), el("ul", {}, items)) : null;
}
function renderAgent(box, P) {
  const round = P.rounds[P.i];
  if (!round) {
    const done = P.rounds.filter((r) => r.answer);
    const rate = mean(done, (r) => r.agree);
    box.append(gameTop(P), endCard({ key: "agent", big: pct(rate, 0), label: t("agent_end_label"), tierText: tier(rate), text: t("agent_end_p"),
      extra: el("p", {}, el("a", { href: "#methode/fiabilite", text: t("agent_end_link") })), share: t("share_agent", { v: pct(rate, 0) }) }),
      recapCard(P.rounds.map((r) => ({ c: r.it.c, text: itemText(r.it), res: r.agree >= 0.5 ? "ok" : "ko", label: r.answer ? pct(r.agree, 0) : "–" }))),
      theoriesCard(["cadrage", "procedes", "fiabilite"]));
    return;
  }
  const it = round.it;
  box.append(gameTop(P), ...quote(it));
  if (!round.answer) {
    const form = el("form", {});
    const group = (name, title, fwKey, varKey, keys, type, first) => el("fieldset", {}, el("legend", { class: "q-title" }, title, infoBtn(fwKey)),
      el("div", { class: "opts" }, keys.map((k, i) => el("label", { class: "opt", title: optDef(varKey, k) || null },
        el("input", { type, name, value: k, required: type === "radio" ? true : null, "data-autofocus": first && i === 0 ? true : null }), el("span", { text: optLabel(varKey, k) })))));
    form.append(
      group("position", t("agent_position_q"), "cadrage", "position", ["favorable_transition", "neutre", "critique_ecologie"], "radio", true),
      group("cadrage", t("agent_frame_q"), "cadrage", "cadrage", V("cadrage").options.filter((o) => !NULLISH.has(o.key)).map((o) => o.key), "radio"),
      round.procOpts.length ? group("procedes", t("agent_devices_q"), "procedes", "procedes", round.procOpts, "checkbox") : null,
      el("div", { class: "btn-row" }, el("button", { class: "primary-btn", type: "submit" }, t("agent_compare"))));
    form.addEventListener("submit", (e) => { e.preventDefault(); const f = new FormData(form); answerAgent({ position: f.get("position"), cadrage: f.get("cadrage"), procedes: f.getAll("procedes") }); });
    box.append(form);
    return;
  }
  const cl = it.claude || {};
  box.append(el("div", { class: "reveal", id: "reveal" },
    el("h3", { text: t("agent_vs") }), el("p", { class: "sub", text: t("agent_round_agree", { v: pct(round.agree, 0) }) }),
    compareBlock(t("cmp_position"), "cadrage", "position", it.jev.position, round.answer.position, cl.position),
    compareBlock(t("cmp_frame"), "cadrage", "cadrage", it.jev.cadrage, round.answer.cadrage, cl.cadrage),
    round.procOpts.length ? compareBlock(t("cmp_devices"), "procedes", "procedes", it.jev.procedes || {}, round.answer.procedes, cl.procedes ? cl.procedes.filter((k) => round.procOpts.includes(k)) : null, round.procOpts) : null,
    codebookNotes(it, round.answer),
    el("p", {}, t("author_is", { name: candName(it.c) }), " ", originalLink(it)),
    el("div", { class: "btn-row" }, el("button", { class: "primary-btn", id: "next-btn", type: "button", onclick: nextRound }, P.i + 1 < P.rounds.length ? t("next_tweet") : t("see_summary"), icon("arrowR", 18))),
    hint([[[t("key_enter")], t("hint_next")]])));
}

const REACTIONS = [[1, "up", "r_agree"], [0, "mixed", "r_mixed"], [-1, "down", "r_disagree"]];
const reactionText = (r) => (r === null || r === undefined ? t("r_skipped") : t(REACTIONS.find(([v]) => v === r)[2]));
function visionDef(key) {
  let def = optDef("vision", key) || (opt("vision", key) || {}).en || "";
  if (LANG === "en") def = def.replace(/^[^:]{2,40}:\s*/, "");
  return def.charAt(0).toLowerCase() + def.slice(1);
}
function renderSituer(box, P) {
  const round = P.rounds[P.i];
  if (round) {
    box.append(gameTop(P), ...quote(round.it), el("p", { class: "q-title", id: "q-title", text: t("situer_q") }),
      el("div", { class: "react", role: "group", "aria-labelledby": "q-title" }, REACTIONS.map(([v, ic, k], i) =>
        el("button", { class: "choice", type: "button", "data-autofocus": i === 0 ? true : null, onclick: () => reactSituer(v) }, icon(ic, 22), t(k), el("span", { class: "k", "aria-hidden": "true", text: String(i + 1) })))),
      el("div", { class: "skip-row" }, el("button", { class: "ghost-btn", type: "button", onclick: () => reactSituer(null) }, t("r_skip"))),
      hint([[["1", "2", "3"], t("hint_react")], [["0"], t("hint_skip")]]));
    return;
  }
  const growth = growthMap();
  const rated = P.rounds.filter((r) => r.r !== null && r.r !== undefined);
  const { rows } = compassRows(S.tweets);
  box.append(gameTop(P));
  if (rated.length < 4 || rows.length < 2) {
    box.append(el("section", { class: "card end" }, el("p", { text: rows.length < 2 ? t("situer_no_profiles") : t("situer_few") }),
      el("div", { class: "btn-row" }, el("button", { class: "primary-btn", type: "button", "data-autofocus": true, onclick: () => replay("situer") }, icon("replay", 18), t("restart")))));
    return;
  }
  const you = { x: mean(rated, (r) => r.r * STANCE[r.it.codes.position]), y: mean(rated, (r) => r.r * growth[r.it.codes.vision]) };
  const ranked = rows.map((r) => ({ ...r, d: Math.hypot(r.x - you.x, r.y - you.y) })).sort((a, b) => a.d - b.d);
  const near = ranked.slice(0, 3), far = ranked[ranked.length - 1];
  const visions = V("vision").options.map((o) => o.key).filter((k) => k in growth);
  const uv = visions.map((k) => rated.reduce((a, r) => a + (r.it.codes.vision === k ? r.r : 0), 0));
  const best = uv.indexOf(Math.max(...uv));
  const nearItem = (r) => el("div", { class: "near-item" }, avatar(r.key, 40),
    el("span", {}, el("strong", { text: candName(r.key) }), el("small", { text: `${candParty(r.key)} · ${t("distance", { d: f2(r.d) })}` })));
  const wrap = compassFrame();
  const result = el("section", { class: "card", id: "situer-result" },
    el("header", { class: "card-head" }, el("div", {}, titleWithInfo("h2", t("situer_title_res"), "boussole"), el("p", { class: "sub", text: t("situer_end_p") })), tableToggle("situer")),
    el("div", { class: "compass-layout" }, wrap, el("div", { class: "compass-side" },
      el("h3", { text: t("situer_near") }), el("div", { class: "near-list" }, near.map(nearItem)),
      far && !near.includes(far) ? [el("h3", { class: "block-sub", text: t("situer_far") }), el("div", { class: "near-list" }, nearItem(far))] : null,
      uv[best] > 0 ? el("p", {}, t("situer_vision_pre"), " ", el("strong", { text: optLabel("vision", visions[best]).toLowerCase() }), t("colon"), visionDef(visions[best]), " ", infoBtn("visions")) : null)),
    el("div", { class: "table-view", id: "situer-table", hidden: !S.openTables.has("situer") }));
  box.append(result, el("section", { class: "card end" }, el("p", { class: "eyebrow", text: t("game_over") }), el("p", { class: "disclaimer", text: t("situer_disclaimer") }), endButtons("situer", t("share_situer"))),
    recapCard(P.rounds.map((r) => ({ c: r.it.c, text: itemText(r.it), res: "", label: reactionText(r.r) }))),
    theoriesCard(["boussole", "visions", "cadrage"]));
  drawCompass(wrap, rows, { you, near: new Set(near.map((r) => r.key)) });
  compassTable("situer", rows);
}

function gameArt(key) {
  if (key === "qui") {
    const order = (S.data.study.blocs || []).map((b) => b.key);
    const faces = [];
    for (const b of order) { const c = S.cands.find((x) => x.enabled && x.bloc === b && x.photo && !faces.includes(x)); if (c && faces.length < 3) faces.push(c); }
    return el("div", { class: "stack" }, faces.map((c) => avatar(c.key, 56)), el("span", { class: "avatar art-q", style: "width:56px;height:56px;font-size:24px", text: "?" }));
  }
  if (key === "agent") return el("div", { class: "art-bars" }, el("span", { style: "width:86%" }), el("span", { style: "width:58%" }), el("span", { style: "width:34%" }));
  return el("div", { class: "art-compass" }, [[16, 22], [66, 16], [74, 62], [30, 66], [50, 36]].map(([x, y]) => el("i", { style: `left:${x}%;top:${y}%` })), el("i", { class: "me", style: "left:56%;top:52%" }));
}
function renderJouer(panel) {
  panel.replaceChildren();
  if (S.play) {
    const box = el("div", { class: "game" });
    panel.append(box);
    ({ qui: renderQui, agent: renderAgent, situer: renderSituer })[S.play.key](box, S.play);
    return;
  }
  const cards = GAME_KEYS.map((k) => {
    const ok = gameAvailable(k), g = GAMES[k];
    return el("article", { class: "game-card" + (ok ? "" : " off") },
      el("div", { class: "game-art", "aria-hidden": "true" }, gameArt(k)),
      el("div", { class: "game-body" },
        el("h3", { text: t("g_" + k) }), el("p", { text: t(`g_${k}_text`) }),
        el("div", { class: "game-meta" }, el("span", { class: "badge", text: tn("n_rounds", g.rounds) }), el("span", { class: "badge", text: t("minutes", { n: g.minutes }) }), el("span", { class: "badge", text: t(`g_${k}_level`) })),
        el("div", { class: "card-btns" },
          el("button", { class: "primary-btn", type: "button", disabled: ok ? null : true, onclick: () => go("jouer", k) }, icon("play", 18), t("play_btn")),
          el("button", { class: "secondary-btn", type: "button", disabled: ok ? null : true, title: t("daily_hint"), onclick: () => go("jouer", `${k}/jour`) }, t("daily_btn"))),
        ok ? null : el("p", { class: "note-small", text: t("game_unavailable") })));
  });
  const nFw = DISCOURS_ORDER.filter((k) => S.fw.has(k)).length;
  panel.append(
    sectionIntro(t("play_title"), t("play_intro")),
    el("div", { class: "game-cards" }, cards),
    el("p", { class: "note-small daily-note", text: t("daily_hint") }),
    el("div", { class: "steps-row" }, [1, 2, 3].map((i) => el("div", { class: "step" }, el("span", { class: "n", text: String(i) }), el("div", {}, el("h3", { text: t(`step${i}_t`) }), el("p", { text: t(`step${i}_p`) }))))),
    el("section", { class: "learn" }, el("h3", { text: t("learn_title") }),
      el("div", { class: "chips" }, ["carre", "cadrage", "topoi", "procedes", "retardement", "visions", "boussole"].filter((k) => S.fw.has(k)).map((k) => el("span", { class: "chip" }, fwLabel(k), infoBtn(k))))),
    el("section", { class: "card teaser" }, el("h2", { text: t("teaser_title") }), el("p", { class: "sub", text: t("teaser_text") }),
      el("div", { class: "btn-row" },
        el("a", { class: "secondary-btn", href: "#apercu" }, icon("chart", 16), t("teaser_apercu")),
        el("a", { class: "secondary-btn", href: "#discours" }, icon("talk", 16), t("teaser_discours", { n: nFw })),
        el("a", { class: "secondary-btn", href: "#methode" }, icon("book", 16), t("teaser_methode")))));
}

/* =================================================================== en-tête, navigation, pied de page */
const TABS = [["jouer", "play"], ["apercu", "chart"], ["discours", "talk"], ["mots", "words"], ["tweets", "list"], ["methode", "book"]];
const isDark = () => getComputedStyle(document.documentElement).colorScheme.includes("dark");
function themeButton() {
  const b = el("button", { class: "icon-btn", type: "button", "aria-label": t("theme_toggle"), title: t("theme_toggle") }, icon(isDark() ? "sun" : "moon"));
  b.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) { /* stockage indisponible */ }
    b.replaceChildren(icon(isDark() ? "sun" : "moon"));
  });
  return b;
}
function langSwitch() {
  return el("div", { class: "lang", role: "group", "aria-label": t("lang_aria") }, LANGS.map((l) =>
    el("button", { type: "button", lang: l, "aria-pressed": String(l === LANG), title: l === "fr" ? "Français" : "English", text: l.toUpperCase(), onclick: () => setLang(l, true) })));
}
function heroFaces() {
  const order = (S.data.study.blocs || []).map((b) => b.key);
  const list = S.cands.filter((c) => c.enabled).sort((a, b) => order.indexOf(a.bloc) - order.indexOf(b.bloc) || byName(a, b));
  return el("div", { class: "faces hero-extra", role: "group", "aria-label": t("faces_aria") }, list.map((c, i) => {
    const b = el("button", { class: "face", type: "button", style: `--k:${i}`, title: c.name, "aria-label": t("face_label", { name: c.name }), onclick: () => focusCandidate(c.key) });
    if (c.photo && c.photo.url) {
      const img = el("img", { src: c.photo.url, alt: "", decoding: "async", referrerpolicy: "no-referrer" });
      img.addEventListener("error", () => b.replaceChildren(el("span", { class: "ini", text: initials(c.name) })));
      b.append(framePhoto(img, c.photo.cadrage));
    } else b.append(el("span", { class: "ini", text: initials(c.name) }));
    return b;
  }));
}
function renderTop() {
  const d = S.data;
  $("#top").replaceChildren(
    el("div", { class: "wrap topbar" },
      el("a", { class: "brand", href: "#jouer" }, logo(), el("span", { text: t("brand") })),
      el("div", { class: "top-actions" }, langSwitch(), themeButton())),
    el("div", { class: "wrap hero" },
      el("div", { class: "hero-text" },
        el("p", { class: "eyebrow", text: t("hero_eyebrow") }),
        el("h1", { text: t("hero_title") }),
        el("p", { class: "lede hero-extra", text: t("hero_lede") }),
        el("div", { class: "cta hero-extra" },
          el("button", { class: "primary-btn", type: "button", onclick: () => go("jouer", "qui") }, icon("play", 20), t("hero_cta_play")),
          el("a", { class: "secondary-btn", href: "#apercu" }, t("hero_cta_explore"), icon("arrowR", 18))),
        d ? el("p", { class: "meta" },
          el("span", {}, rich(tn("meta_tweets", S.tweets.length))),
          el("span", {}, rich(tn("meta_cands", S.cands.filter((c) => c.enabled).length))),
          el("span", {}, rich(t("meta_updated", { date: fmtDay(d.generated_at.slice(0, 10)) })))) : null),
      d ? heroFaces() : null));
}
function renderTabs() {
  const nav = $("#tabs");
  nav.setAttribute("aria-label", t("tabs_aria"));
  nav.replaceChildren(...TABS.map(([k, ic]) => el("a", { href: `#${k}`, "data-tab": k, class: k === "jouer" ? "play" : null }, icon(ic, 17), el("span", { text: t("tab_" + k) }))));
  updateTabs();
}
function updateTabs() {
  for (const a of $$("#tabs a")) { if (a.dataset.tab === S.tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }
}
function renderFilters() {
  const box = $("#filters");
  box.hidden = !S.data || S.tab === "jouer" || S.tab === "methode";
  if (box.hidden) return;
  const active = box.contains(document.activeElement) ? document.activeElement.id : "";
  const period = el("select", { id: "f-period" }, S.periods.map((p) => option(p.key, p.label, p.key === S.period)));
  const bloc = el("select", { id: "f-bloc" }, option("", t("all_families"), !S.bloc), (S.data.study.blocs || []).map((b) => option(b.key, L(b, "label"), b.key === S.bloc)));
  const focus = el("select", { id: "f-focus" }, option("", t("nobody"), !S.focus), [...S.cands].sort(byName).map((c) => option(c.key, c.name, c.key === S.focus)));
  const on = () => setFilter({ period: period.value, bloc: bloc.value, focus: focus.value });
  [period, bloc, focus].forEach((s) => s.addEventListener("change", on));
  const summary = [currentPeriod().short, S.bloc ? blocLabel(S.bloc) : t("all_families_short"), S.focus ? candName(S.focus) : null].filter(Boolean).join(" · ");
  const toggle = el("button", { class: "filters-toggle", id: "filters-toggle", type: "button", "aria-expanded": String(S.filtersOpen), "aria-controls": "filters-inner" },
    el("span", {}, rich(t("filters_summary", { s: summary }))), el("span", { "aria-hidden": "true", text: S.filtersOpen ? "▴" : "▾" }));
  toggle.addEventListener("click", () => { S.filtersOpen = !S.filtersOpen; renderFilters(); });
  box.classList.toggle("open", S.filtersOpen);
  box.replaceChildren(toggle, el("div", { class: "wrap filters-inner", id: "filters-inner" },
    el("label", { class: "field" }, el("span", { text: t("f_period") }), period),
    el("label", { class: "field" }, el("span", { text: t("f_bloc") }), bloc),
    el("label", { class: "field" }, el("span", { text: t("f_focus") }), focus),
    S.period !== "all" || S.bloc || S.focus ? el("button", { class: "reset-link", id: "f-reset", type: "button", text: t("reset"), onclick: () => setFilter({ period: "all", bloc: "", focus: "" }) }) : null));
  if (active) { const n = document.getElementById(active); if (n) n.focus({ preventScroll: true }); }
}
function renderFooter() {
  const d = S.data;
  $("#footer").replaceChildren(el("div", { class: "wrap footer-inner" },
    el("div", {},
      el("p", {}, el("strong", { text: t("brand") }), " · ", t("footer_about")),
      el("p", { text: t("footer_privacy") }),
      d ? el("p", { text: t("footer_updated", { date: fmtDay(d.generated_at.slice(0, 10)) }) }) : null),
    el("div", { class: "links" },
      el("a", { href: "#methode", text: t("tab_methode") }),
      el("a", { href: REPO_URL, target: "_blank", rel: "noopener", text: t("source_code") }),
      el("a", { href: "#top", text: t("footer_top"), onclick: (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: smooth() }); } }))));
}
function showNotice(text) {
  const n = $("#notice");
  n.hidden = !text;
  n.replaceChildren(...(text ? [icon("info", 18), el("p", { text })] : []));
}
function toast(text) {
  const n = $("#toast");
  n.textContent = text; n.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { n.hidden = true; }, 2600);
}

/* =================================================================== navigation */
function syncUrl() {
  const q = new URLSearchParams();
  if (S.langInUrl) q.set("lang", LANG);
  if (S.period !== "all") q.set("periode", S.period);
  if (S.bloc) q.set("bloc", S.bloc);
  if (S.focus) q.set("candidat", S.focus);
  const s = q.toString();
  history.replaceState(null, "", (s ? "?" + s : location.pathname) + location.hash);
}
// anchor : sélecteur d'un bloc à garder à la même hauteur d'écran pendant le nouveau rendu
function setFilter(changes, anchor) {
  const node = anchor && $(anchor);
  const before = node ? node.getBoundingClientRect().top : null;
  if (changes.focus && changes.focus !== S.focus && !anchor && !S.scrollTo && S.tab === "apercu") S.scrollTo = { sel: "#profile", block: "start" };
  Object.assign(S, changes);
  S.x.shown = 15;
  syncUrl();
  render();
  const after = anchor && $(anchor);
  if (after && before !== null) scrollBy(0, after.getBoundingClientRect().top - before);
}
function focusCandidate(key) {
  S.focus = key;
  syncUrl();
  S.scrollTo = { sel: "#profile", block: "start" };
  if (S.tab === "apercu") render(); else go("apercu");
}
function go(tab, sub) {
  const h = "#" + (sub ? `${tab}/${sub}` : tab);
  if (location.hash === h) onHash(); else location.hash = h;
}
function readHash() {
  const [tab, sub = "", extra = ""] = location.hash.replace(/^#/, "").split("/");
  S.tab = TABS.some(([k]) => k === tab) ? tab : "jouer";
  if (S.tab === "discours" && DISCOURS_ORDER.includes(sub) && S.fw.has(sub)) { if (S.discours !== sub) S.selectedCell = null; S.discours = sub; }
  const daily = extra === "jour";
  if (S.tab === "jouer" && GAME_KEYS.includes(sub)) { if (!S.play || S.play.key !== sub || S.play.daily !== daily) { S.play = newGame(sub, daily); S.focusTo = "[data-autofocus]"; } }
  else S.play = null;
  return sub;
}
function onHash() {
  const prev = { tab: S.tab, disc: S.discours, play: S.play };
  const sub = readHash();
  if (S.tab === "methode" && METHODE_SECTIONS.includes(sub)) S.scrollTo = { sel: "#m-" + sub, block: "start" };
  else if (!S.scrollTo && (prev.tab !== S.tab || (S.tab === "discours" && prev.disc !== S.discours) || (S.tab === "jouer" && prev.play !== S.play))) S.scrollTo = "top";
  render();
}
const RENDER = { jouer: renderJouer, apercu: renderApercu, discours: renderDiscours, mots: renderMots, tweets: renderTweets, methode: renderMethode };
function render() {
  if (!S.data) return;
  hideTip(); closePopover();
  document.body.dataset.tab = S.tab;
  document.body.dataset.hero = S.tab === "jouer" && !S.play ? "full" : "compact";
  updateTabs();
  renderFilters();
  for (const p of $$("[data-panel]")) p.hidden = p.dataset.panel !== S.tab;
  document.documentElement.style.scrollPaddingTop = $("#sticky").offsetHeight + 16 + "px";
  // Entrée d'onglet : cartes qui montent, barres qui poussent, chiffres qui défilent (une fois par onglet)
  const panel = $(`[data-panel="${S.tab}"]`), entering = S.lastTab !== S.tab;
  S.lastTab = S.tab;
  if (entering) { panel.classList.add("enter"); clearTimeout(S.enterTimer); S.enterTimer = setTimeout(() => panel.classList.remove("enter"), 1400); }
  RENDER[S.tab](panel);
  if (entering && !reducedMotion()) $$(".kpi .value", panel).forEach((n) => countUp(n));
  const target = S.scrollTo, focus = S.focusTo;
  S.scrollTo = null; S.focusTo = null;
  if (target === "top") scrollTo({ top: 0 });
  else if (target) { const n = $(target.sel); if (n) n.scrollIntoView({ block: target.block || "start", behavior: smooth() }); }
  if (focus) { const n = $(focus, $(`[data-panel="${S.tab}"]`)) || $(focus); if (n) n.focus({ preventScroll: true }); }
}

/* =================================================================== langue : bascule */
function detectLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (LANGS.includes(q)) { S.langInUrl = true; return q; }
  try { const s = localStorage.getItem("lang"); if (LANGS.includes(s)) return s; } catch (e) { /* stockage indisponible */ }
  return /^fr\b/i.test(navigator.language || "") ? "fr" : "en";
}
function applyLang() {
  document.documentElement.lang = LANG;
  document.title = t("doc_title");
  const skip = $(".skip");
  if (skip) skip.textContent = t("skip");
  setupFormats();
}
function setLang(lang, byUser) {
  if (!LANGS.includes(lang)) return;
  LANG = lang;
  if (byUser) { S.langInUrl = true; try { localStorage.setItem("lang", lang); } catch (e) { /* stockage indisponible */ } }
  applyLang();
  if (S.data) buildPeriods();
  syncUrl();
  renderTop(); renderTabs(); renderFooter();
  if (byUser) { const b = $(`.lang button[lang="${lang}"]`); if (b) b.focus({ preventScroll: true }); }
  if (S.data) { showNotice(S.tweets.length ? "" : t("notice_empty")); render(); }
}

/* =================================================================== démarrage */
async function fetchJson(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${url} : ${r.status}`);
  return r.json();
}
async function main() {
  LANG = detectLang();
  applyLang();
  renderTop(); renderTabs(); renderFooter();
  const loading = $(".loading");
  if (loading) loading.textContent = t("loading");
  const [data, games] = await Promise.allSettled([fetchJson("data.json"), fetchJson("games.json")]);
  if (data.status !== "fulfilled") {
    showNotice(t("notice_load_error"));
    $$("[data-panel]").forEach((p) => p.replaceChildren());
    return;
  }
  decode(data.value);
  S.games = { items: ((games.status === "fulfilled" && games.value.items) || []).filter((it) => S.cand.has(it.c) && it.t && it.codes) };
  buildPeriods();
  const params = new URLSearchParams(location.search);
  S.period = S.periods.some((p) => p.key === params.get("periode")) ? params.get("periode") : "all";
  S.bloc = (S.data.study.blocs || []).some((b) => b.key === params.get("bloc")) ? params.get("bloc") : "";
  S.focus = S.cand.has(params.get("candidat")) ? params.get("candidat") : "";
  if (!S.tweets.length) showNotice(t("notice_empty"));
  renderTop(); renderFooter();
  if (S.focus && location.hash.startsWith("#apercu")) S.scrollTo = { sel: "#profile", block: "start" };
  addEventListener("hashchange", onHash);
  let lastW = innerWidth;
  addEventListener("resize", debounce(() => {
    if (innerWidth === lastW) return;
    lastW = innerWidth;
    // Les graphiques dépendent de la largeur ; on évite de redessiner un jeu en cours (formulaire)
    if (S.tab !== "jouer" || (S.play && S.play.key === "situer" && !S.play.rounds[S.play.i])) render();
  }, 200));
  onHash();
}
main();
