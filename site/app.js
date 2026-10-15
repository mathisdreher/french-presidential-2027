"use strict";
/* L'écologie dans la campagne sur X : site statique, sans dépendance.
   Les agrégats sont calculés dans le navigateur à partir de data.json. */

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
const SVG = "http://www.w3.org/2000/svg";
function svg(tag, attrs) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) node.setAttribute(k, v);
  return node;
}
const NF = new Intl.NumberFormat("fr-FR");
const PF = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const PF0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const F2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (x, digits = 1) => (digits ? PF : PF0).format(100 * x) + " %";
const num = (x) => NF.format(x);
const DF = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const DFS = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const parseDay = (s) => new Date(s + "T00:00:00Z");
const fmtDay = (s) => DF.format(parseDay(s)).replace(/^1 /, "1er ");
const fmtShort = (s) => DFS.format(parseDay(s));
const isoDay = (d) => d.toISOString().slice(0, 10);
function weekStart(day) { const d = parseDay(day); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return isoDay(d); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function shuffle(arr, rnd = Math.random) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const NULLISH = new Set(["non_applicable", "aucun", "aucune", "indetermine"]);
const MIN_N = 20;
const MIN_N_SCALE = 10;

/* =================================================================== état */
const S = {
  data: null, games: null, cands: [], cand: new Map(), vars: new Map(), fw: new Map(), tweets: [],
  periods: [], period: "all", bloc: "", focus: "", tab: "apercu",
  apercuHeat: "themes", discours: "carre", discoursVar: {}, discoursScope: "ecologie", selectedCell: null,
  x: { cand: "", theme: "", pos: "", cad: "", concept: "", q: "", sort: "date", shown: 15 },
  mots: { who: "", mode: "candidats" },
  tables: new Map(), openTables: new Set(),
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
    const t = { i: r[at.i], c: S.cands[r[at.c]].key, d: r[at.d], e: r[at.e], p: r[at.p], s: r[at.s], l: r[at.l], rt: r[at.rt] };
    for (const v of vars) {
      const raw = r[at[v.short]];
      if (raw === null || raw === undefined) { t[v.key] = v.kind === "multi" ? [] : null; continue; }
      if (v.kind === "noul") t[v.key] = !!raw;
      else if (v.kind === "multi") t[v.key] = v.options.filter((_, i) => raw & (1 << i)).map((o) => o.key);
      else t[v.key] = (v.options[raw] || {}).key || null;
    }
    const tx = data.texts[t.i];
    if (tx) Object.assign(t, { t: tx.t, rs: tx.rs, lx: tx.lx, im: tx.im });
    return t;
  });
  const anchor = data.generated_at.slice(0, 10);
  const minus = (n) => { const d = parseDay(anchor); d.setUTCDate(d.getUTCDate() - n + 1); return isoDay(d); };
  S.periods = [
    { key: "all", label: `Toute l'étude, depuis le ${fmtDay(data.study.start)}`, start: data.study.start, end: null },
    { key: "d90", label: "90 derniers jours", start: minus(90), end: anchor },
    { key: "d30", label: "30 derniers jours", start: minus(30), end: anchor },
    { key: "d7", label: "7 derniers jours", start: minus(7), end: anchor },
    ...(data.study.phases || []).map((p) => ({ key: p.key, label: `${p.label} : ${fmtShort(p.start)} au ${fmtShort(p.end)}`, start: p.start, end: p.end })),
  ];
}
const V = (key) => S.vars.get(key);
const optLabel = (varKey, optKey) => ((V(varKey)?.options || []).find((o) => o.key === optKey) || { label: optKey || "–" }).label;
const optFr = (varKey, optKey) => ((V(varKey)?.options || []).find((o) => o.key === optKey) || {}).fr || "";
const candName = (k) => (S.cand.get(k) || { name: k }).name;
function shortName(name) {
  const w = name.split(" ");
  if (w.length < 2) return name;
  const i = w.length >= 3 && /^(le|la|de|du|des|d'|van)$/i.test(w[w.length - 2]) ? w.length - 2 : w.length - 1;
  return w.slice(i).join(" ");
}
const blocLabel = (k) => ((S.data.study.blocs || []).find((b) => b.key === k) || { label: k || "Autre" }).label;

function filtered() {
  const p = S.periods.find((x) => x.key === S.period) || S.periods[0];
  return S.tweets.filter((t) => {
    if (p.start && t.d < p.start) return false;
    if (p.end && t.d > p.end) return false;
    if (S.bloc && (S.cand.get(t.c) || {}).bloc !== S.bloc) return false;
    return true;
  });
}
function byCandidate(tweets) {
  const m = new Map();
  for (const t of tweets) {
    let s = m.get(t.c);
    if (!s) { s = { key: t.c, n: 0, eco: 0, fav: 0, neu: 0, cri: 0, tweets: [] }; m.set(t.c, s); }
    s.n++; s.tweets.push(t);
    if (t.e) { s.eco++; if (t.position === "favorable_transition") s.fav++; else if (t.position === "critique_ecologie") s.cri++; else s.neu++; }
  }
  return [...m.values()].sort((a, b) => b.eco / b.n - a.eco / a.n || b.n - a.n);
}

/* =================================================================== infobulle */
function showTip(anchor, title, rows, note) {
  const t = $("#tooltip");
  t.replaceChildren();
  if (title) t.append(el("div", { class: "tt-title", text: title }));
  for (const r of rows || []) {
    const row = el("div", { class: "tt-row" });
    if (r.key) row.append(el("span", { class: r.keyShape === "swatch" ? "swatch" : "linekey", style: `background:${r.key}` }));
    row.append(el("strong", { text: r.value }), el("span", { text: r.label }));
    t.append(row);
  }
  if (note) t.append(el("div", { class: "tt-note", text: note }));
  t.hidden = false;
  let x, y;
  if (anchor && anchor.clientX !== undefined && anchor.type !== "focus") { x = anchor.clientX; y = anchor.clientY; }
  else { const r = (anchor.currentTarget || anchor.target || anchor).getBoundingClientRect(); x = r.left + r.width / 2; y = r.bottom; }
  const w = t.offsetWidth, h = t.offsetHeight;
  let left = x + 14, top = y + 14;
  if (left + w > innerWidth - 8) left = Math.max(8, x - w - 14);
  if (top + h > innerHeight - 8) top = Math.max(8, y - h - 14);
  t.style.left = left + "px"; t.style.top = top + "px";
}
function hideTip() { $("#tooltip").hidden = true; }
function hoverable(node, build) {
  if (!node.hasAttribute("tabindex")) node.tabIndex = 0;
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
  pop.replaceChildren(el("button", { class: "close", type: "button", "aria-label": "Fermer", onclick: closePopover, text: "×" }), ...build());
  pop.hidden = false;
  popoverAnchor = btn; btn.setAttribute("aria-expanded", "true");
  const r = btn.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let left = Math.min(Math.max(16, r.left - 12), innerWidth - w - 16);
  let top = r.bottom + 8;
  if (top + h > innerHeight - 12) top = Math.max(12, r.top - h - 8);
  pop.style.left = left + "px"; pop.style.top = top + "px";
  pop.querySelector(".close").focus({ preventScroll: true });
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#popover").hidden) { const a = popoverAnchor; closePopover(); a && a.focus(); } });
document.addEventListener("pointerdown", (e) => { if (!$("#popover").hidden && !e.target.closest("#popover") && !e.target.closest(".info-btn")) closePopover(); });
addEventListener("scroll", debounce(closePopover, 50), { passive: true });

function infoBtn(fwKey) {
  const f = S.fw.get(fwKey);
  if (!f) return null;
  const btn = el("button", { class: "info-btn", type: "button", "aria-label": `En savoir plus : ${f.label}`, "aria-expanded": "false", text: "i" });
  btn.addEventListener("click", () => openPopover(btn, () => [
    el("h3", { text: f.label }), el("p", { class: "who", text: f.auteurs }),
    el("p", { text: f.resume }), el("p", {}, el("strong", { text: "Dans cette étude. " }), f.dans_l_etude),
    refsList(f.refs),
  ]));
  return btn;
}
function catInfoBtn(varKey, optKey) {
  const fr = optFr(varKey, optKey);
  const v = V(varKey);
  if (!fr || !v) return null;
  const btn = el("button", { class: "info-btn", type: "button", "aria-label": `Définition : ${optLabel(varKey, optKey)}`, "aria-expanded": "false", text: "i" });
  btn.addEventListener("click", () => openPopover(btn, () => {
    const f = S.fw.get(v.framework);
    return [el("h3", { text: optLabel(varKey, optKey) }), el("p", { class: "who", text: `${v.label} · ${f ? f.auteurs : ""}` }), el("p", { text: fr }),
      f ? el("p", {}, el("a", { href: `#discours/${f.key}`, text: `Le cadre : ${f.label}` })) : null, f ? refsList(f.refs) : null];
  }));
  return btn;
}
function titleWithInfo(tag, text, fwKey) { return el("div", { class: "title-row" }, el(tag, { text }), fwKey ? infoBtn(fwKey) : null); }

/* =================================================================== avatars */
function initials(name) { return name.split(/[\s-]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }
function avatar(key, size = 28) {
  const c = S.cand.get(key) || { name: key };
  const box = el("span", { class: "avatar", style: `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px`, "aria-hidden": "true" });
  if (c.photo && c.photo.url) {
    const img = el("img", { src: c.photo.url, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer",
      title: `Photo : ${c.photo.auteur || "auteur inconnu"}${c.photo.licence ? ", " + c.photo.licence : ""}` });
    img.addEventListener("error", () => { box.replaceChildren(initials(c.name)); });
    box.append(img);
  } else box.append(initials(c.name));
  return box;
}
const ACCOUNT = {
  actif: null,
  peu_actif: { cls: "warning", ico: "!", text: "Peu actif sur X" },
  introuvable: { cls: "critical", ico: "✕", text: "Compte X introuvable" },
  protege: { cls: "warning", ico: "!", text: "Compte X protégé" },
  sans_compte: { cls: "critical", ico: "✕", text: "Pas de compte X" },
  en_attente: { cls: "", ico: "…", text: "Collecte à venir" },
};
function accountBadge(c) {
  const a = ACCOUNT[c.compte];
  if (!a) return null;
  return el("span", { class: `badge ${a.cls}`, title: c.note || a.text }, el("span", { class: "ico", text: a.ico }), a.text);
}

/* =================================================================== tableaux */
function tableToggle(id) {
  const isOpen = S.openTables.has(id);
  const btn = el("button", { class: "table-toggle", type: "button", "aria-expanded": String(isOpen), text: isOpen ? "Masquer le tableau" : "Tableau" });
  btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") !== "true";
    if (open) S.openTables.add(id); else S.openTables.delete(id);
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Masquer le tableau" : "Tableau";
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
  if (!spec || !spec.rows.length) { view.append(el("p", { class: "empty", text: "Aucune donnée pour cette sélection." })); return; }
  view.append(el("table", {},
    el("thead", {}, el("tr", {}, spec.headers.map((h) => el("th", { class: h.num ? "num" : null, text: h.label })))),
    el("tbody", {}, spec.rows.map((r) => el("tr", {}, r.map((v, i) => el("td", { class: spec.headers[i].num ? "num" : null, text: v })))))));
}
function card(id, title, fwKey, sub, ...body) {
  return el("section", { class: "card", id },
    el("header", { class: "card-head" }, el("div", {}, titleWithInfo("h2", title, fwKey), sub ? el("p", { class: "sub", id: id + "-sub", text: sub }) : null), tableToggle(id)),
    ...body, el("div", { class: "table-view", id: id + "-table", hidden: !S.openTables.has(id) }));
}

/* =================================================================== graphiques */
function barName(key, n, threshold = MIN_N) {
  return el("div", { class: "bar-name", title: candName(key) }, avatar(key, 22), el("span", { class: "nm", text: candName(key) }),
    n < threshold ? el("small", { text: `n=${n}` }) : null);
}

function renderSaillance(box, stats) {
  box.replaceChildren();
  if (!stats.length) { box.append(el("p", { class: "empty", text: "Aucun tweet sur cette période." })); setTable("saillance", [], []); return; }
  const max = Math.max(...stats.map((s) => s.eco / s.n), 0.0001);
  const grid = el("div", { class: "bars" });
  for (const s of stats) {
    const share = s.eco / s.n, focus = S.focus === s.key, dim = S.focus && !focus;
    const track = el("div", { class: "bar-track", "aria-label": `${candName(s.key)} : ${pct(share)}, ${s.eco} sur ${s.n}` },
      el("div", { class: "bar" + (dim ? " dim" : ""), style: `width:${(share / max) * 80}%` }), el("span", { class: "bar-value", text: pct(share) }));
    hoverable(track, () => ({ title: candName(s.key), rows: [{ value: pct(share), label: "des tweets parlent d'écologie" }, { value: num(s.eco), label: `tweets écologie sur ${num(s.n)}` }],
      note: s.n < MIN_N ? "Moins de 20 tweets : pourcentage fragile." : null }));
    grid.append(el("div", { class: "bar-row" + (focus ? " is-focus" : "") }, barName(s.key, s.n), track));
  }
  box.append(grid);
  setTable("saillance", [{ label: "Candidat" }, { label: "Tweets", num: true }, { label: "Tweets écologie", num: true }, { label: "Part", num: true }],
    stats.map((s) => [candName(s.key), num(s.n), num(s.eco), pct(s.eco / s.n)]));
}

function renderPosition(box, stats) {
  box.replaceChildren(el("div", { class: "legend" },
    el("span", { class: "key" }, el("span", { class: "swatch", style: "background:var(--accent-2)" }), optLabel("position", "critique_ecologie")),
    el("span", { class: "key" }, el("span", { class: "swatch", style: "background:var(--neutral-mark)" }), "Neutre"),
    el("span", { class: "key" }, el("span", { class: "swatch", style: "background:var(--accent)" }), optLabel("position", "favorable_transition"))));
  const rows = stats.filter((s) => s.eco >= 3).map((s) => ({ ...s, f: s.fav / s.eco, u: s.neu / s.eco, c: s.cri / s.eco })).sort((a, b) => (b.f - b.c) - (a.f - a.c));
  const excluded = stats.filter((s) => s.eco > 0 && s.eco < 3).length;
  if (!rows.length) { box.append(el("p", { class: "empty", text: "Pas assez de tweets écologie sur cette période, 3 au minimum par candidat." })); setTable("position", [], []); return; }
  const M = Math.max(...rows.map((r) => Math.max(r.c + r.u / 2, r.f + r.u / 2)), 0.5);
  const narrow = innerWidth <= 760;
  const trackW = Math.max(140, narrow ? ((box.clientWidth || 340) - 12) * 0.66 : (box.clientWidth || 900) - 202);
  const half = Math.min(46, 50 - (40 / trackW) * 100);
  const sc = (x) => (x / M) * half;
  const grid = el("div", { class: "bars" });
  for (const r of rows) {
    const focus = S.focus === r.key, dim = S.focus && !focus;
    const track = el("div", { class: "div-track" + (dim ? " dimmed" : ""), "aria-label": `${candName(r.key)} : ${pct(r.f)} favorable, ${pct(r.u)} neutre, ${pct(r.c)} critique` });
    const nl = 50 - sc(r.u / 2), nr = 50 + sc(r.u / 2);
    const segs = [];
    if (r.c > 0) segs.push(el("div", { class: "seg cri", style: `left:${nl - sc(r.c)}%;width:${sc(r.c)}%` }));
    if (r.u > 0) segs.push(el("div", { class: "seg neu", style: `left:${nl}%;width:${nr - nl}%` }));
    if (r.f > 0) segs.push(el("div", { class: "seg fav", style: `left:${nr}%;width:${sc(r.f)}%` }));
    segs.forEach((sg, i) => { const a = i === 0 ? 4 : 0, b = i === segs.length - 1 ? 4 : 0; sg.style.borderRadius = `${a}px ${b}px ${b}px ${a}px`; });
    track.append(...segs);
    if (r.c > 0) track.append(el("span", { class: "seg-label", style: `right:${100 - (nl - sc(r.c)) + 1}%`, text: pct(r.c, 0) }));
    if (r.f > 0) track.append(el("span", { class: "seg-label", style: `left:${nr + sc(r.f) + 1}%`, text: pct(r.f, 0) }));
    hoverable(track, () => ({ title: `${candName(r.key)} · ${num(r.eco)} tweets écologie`, rows: [
      { value: pct(r.f), label: "favorable", key: "var(--accent)", keyShape: "swatch" },
      { value: pct(r.u), label: "neutre", key: "var(--neutral-mark)", keyShape: "swatch" },
      { value: pct(r.c), label: "critique", key: "var(--accent-2)", keyShape: "swatch" }],
      note: r.eco < MIN_N ? "Moins de 20 tweets écologie : répartition fragile." : null }));
    grid.append(el("div", { class: "bar-row" + (focus ? " is-focus" : "") }, barName(r.key, r.eco), track));
  }
  box.append(grid, el("div", { class: "div-axis" }, el("span"), el("div", { class: "div-axis-inner" }, el("span", { text: "← plus critique" }), el("span", { text: "plus favorable →" }))));
  if (excluded) box.append(el("p", { class: "note-small", text: `${excluded} candidat${excluded > 1 ? "s" : ""} avec moins de 3 tweets écologie sur la période ${excluded > 1 ? "ne sont" : "n'est"} pas affiché${excluded > 1 ? "s" : ""}.` }));
  setTable("position", [{ label: "Candidat" }, { label: "Tweets écologie", num: true }, { label: "Favorable", num: true }, { label: "Neutre", num: true }, { label: "Critique", num: true }],
    rows.map((r) => [candName(r.key), num(r.eco), pct(r.f), pct(r.u), pct(r.c)]));
}

function weekly(tweets) {
  const m = new Map();
  for (const t of tweets) { const w = weekStart(t.d); const s = m.get(w) || { n: 0, eco: 0 }; s.n++; s.eco += t.e; m.set(w, s); }
  return m;
}
function renderEvolution(box, legend, tweets) {
  box.replaceChildren();
  if (!tweets.length) { legend.replaceChildren(); box.append(el("p", { class: "empty", text: "Aucun tweet sur cette période." })); setTable("evolution", [], []); return; }
  const all = weekly(tweets);
  const weeks = [...all.keys()].sort();
  const full = [];
  for (let d = parseDay(weeks[0]); isoDay(d) <= weeks[weeks.length - 1]; d.setUTCDate(d.getUTCDate() + 7)) full.push(isoDay(d));
  const series = [{ name: S.bloc ? "Famille sélectionnée" : "Ensemble des candidats", data: all, color: S.focus ? "var(--muted)" : "var(--accent)" }];
  if (S.focus) series.push({ name: candName(S.focus), data: weekly(tweets.filter((t) => t.c === S.focus)), color: "var(--accent)" });
  legend.replaceChildren(...(series.length > 1 ? series.map((s) => el("span", { class: "key" }, el("span", { class: "linekey", style: `background:${s.color}` }), s.name)) : []));
  const W = Math.max(320, box.clientWidth || 640), H = 280, m = { t: 22, r: 16, b: 28, l: 44 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const values = series.flatMap((s) => full.map((w) => s.data.get(w)).filter(Boolean).map((v) => v.eco / v.n));
  const ymax = [0.04, 0.08, 0.12, 0.2, 0.4, 0.6, 0.8, 1].find((s) => s >= Math.max(...values, 0.01) * 1.08) || 1;
  const x = (i) => m.l + (full.length === 1 ? iw / 2 : (i / (full.length - 1)) * iw);
  const y = (v) => m.t + ih - (v / ymax) * ih;
  const root = svg("svg", { class: "line-chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Part des tweets écologie par semaine" });
  for (let i = 0; i <= 4; i++) {
    const v = (ymax * i) / 4;
    root.append(svg("line", { class: i === 0 ? "base-line" : "grid-line", x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
    const tx = svg("text", { class: "axis-text", x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }); tx.textContent = pct(v, 0); root.append(tx);
  }
  const every = Math.max(1, Math.ceil(full.length / Math.floor(iw / 70)));
  full.forEach((w, i) => { if (i % every) return; const tx = svg("text", { class: "axis-text", x: x(i), y: H - 8, "text-anchor": "middle" }); tx.textContent = fmtShort(w); root.append(tx); });
  let lastX = -1e9;
  for (const ev of S.data.study.events || []) {
    const i = full.indexOf(weekStart(ev.date));
    if (i < 0) continue;
    const ex = x(i);
    root.append(svg("line", { class: "event-line", x1: ex, x2: ex, y1: m.t - 6, y2: m.t + ih }));
    if (ex - lastX > 110) { const end = ex > W - 120; const tx = svg("text", { class: "event-text", x: end ? ex - 4 : ex + 4, y: m.t - 8, "text-anchor": end ? "end" : "start" }); tx.textContent = ev.label; root.append(tx); lastX = ex; }
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
  const cross = svg("line", { class: "crosshair", y1: m.t, y2: m.t + ih, visibility: "hidden" });
  const hit = svg("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent", tabindex: 0 });
  root.append(cross, hit);
  const at = (i) => { cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible"); const w = full[i];
    return { title: `Semaine du ${fmtDay(w)}`, rows: series.map((s) => { const v = s.data.get(w); return { value: v ? pct(v.eco / v.n) : "–", label: v ? `${s.name} (${v.eco}/${v.n})` : `${s.name} (aucun tweet)`, key: s.color }; }) }; };
  let cur = full.length - 1;
  hit.addEventListener("pointermove", (e) => { const r = root.getBoundingClientRect(); cur = Math.max(0, Math.min(full.length - 1, Math.round(((((e.clientX - r.left) / r.width) * W - m.l) / iw) * (full.length - 1)))); const b = at(cur); showTip(e, b.title, b.rows); });
  hit.addEventListener("pointerleave", () => { hideTip(); cross.setAttribute("visibility", "hidden"); });
  hit.addEventListener("focus", (e) => { const b = at(cur); showTip(e, b.title, b.rows); });
  hit.addEventListener("blur", () => { hideTip(); cross.setAttribute("visibility", "hidden"); });
  hit.addEventListener("keydown", (e) => { if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return; e.preventDefault(); cur = Math.max(0, Math.min(full.length - 1, cur + (e.key === "ArrowRight" ? 1 : -1))); const b = at(cur); showTip(hit, b.title, b.rows); });
  box.append(root);
  setTable("evolution", [{ label: "Semaine" }, ...series.flatMap((s) => [{ label: `${s.name} : tweets`, num: true }, { label: "part écologie", num: true }])],
    full.map((w) => [fmtDay(w), ...series.flatMap((s) => { const v = s.data.get(w); return v ? [num(v.n), pct(v.eco / v.n)] : ["0", "–"]; })]));
}

/* Heatmap générique. rows : [{key, label, n, values:{col:share}, counts:{col:count}, avatar?}] */
function renderHeat(box, id, rows, cols, opts = {}) {
  box.replaceChildren();
  if (!rows.length) { box.append(el("p", { class: "empty", text: opts.empty || "Aucun tweet sur cette période." })); setTable(id, [], []); return; }
  const scaleRows = rows.some((r) => r.n >= MIN_N_SCALE) ? rows.filter((r) => r.n >= MIN_N_SCALE) : rows;
  const vals = scaleRows.flatMap((r) => cols.map((c) => r.values[c.key])).filter((v) => v !== null && v !== undefined);
  const lo = opts.domain === "minmax" ? Math.min(...vals) : 0;
  const max = Math.max(...vals, lo + 0.0001);
  const q = (v) => (v <= lo ? 0 : Math.min(6, Math.ceil(((v - lo) / (max - lo)) * 7) - 1));
  const clamped = rows.length !== scaleRows.length;
  const fmt = opts.format || ((v) => pct(v));
  const grid = el("div", { class: "heat", style: `--cols:${cols.length}` });
  grid.append(el("div"));
  cols.forEach((c) => grid.append(el("div", { class: "col-head", title: c.title || c.label, text: c.label })));
  for (const r of rows) {
    const focus = S.focus && S.focus === r.key;
    grid.append(el("div", { class: "row-head" + (focus ? " is-focus" : "") + (r.n < MIN_N_SCALE ? " small-n" : ""), title: r.label },
      r.avatar === false ? null : avatar(r.key, 18), " ", el("span", { class: "full", text: r.label }), el("span", { class: "short", text: S.cand.has(r.key) ? shortName(r.label) : r.label }),
      r.n !== undefined ? el("small", { text: `n=${r.n}` }) : null));
    for (const c of cols) {
      const raw = r.values[c.key];
      if (raw === null || raw === undefined) {
        const empty = el("div", { class: "cell", "aria-label": `${r.label}, ${c.label} : pas assez de données` });
        hoverable(empty, () => ({ title: `${r.label} · ${c.label}`, rows: [], note: "Pas assez de données." }));
        grid.append(empty); continue;
      }
      const v = raw;
      const selected = S.selectedCell && S.selectedCell.row === r.key && S.selectedCell.col === c.key && S.selectedCell.id === id;
      const cell = el("div", { class: `cell q${q(v)}` + (S.focus && S.cand.has(r.key) && !focus ? " dim" : "") + (selected ? " selected" : ""),
        role: opts.onCell ? "button" : null, "aria-label": `${r.label}, ${c.label} : ${fmt(v)}` });
      hoverable(cell, () => ({ title: `${r.label} · ${c.label}`, rows: [{ value: fmt(v), label: opts.unit || "" }, ...(r.counts ? [{ value: num(r.counts[c.key] || 0), label: `tweets sur ${num(r.n)}` }] : [])],
        note: r.n < MIN_N ? "Moins de 20 tweets : pourcentage fragile." : (opts.onCell ? "Cliquez pour voir des exemples." : null) }));
      if (opts.onCell) {
        const go = () => opts.onCell(r, c);
        cell.addEventListener("click", go);
        cell.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      }
      grid.append(cell);
    }
  }
  const notes = [opts.note, clamped ? `Lignes en gris : moins de ${MIN_N_SCALE} tweets, exclues du calcul du maximum de l'échelle.` : null].filter(Boolean);
  box.append(el("div", { class: "heat-scroll" }, grid),
    el("div", { class: "scale" }, el("span", { text: opts.min0 || "0 %" }), el("span", { class: "steps" }, [0, 1, 2, 3, 4, 5, 6].map((i) => el("span", { class: `q${i}` }))), el("span", { text: (clamped ? "≥ " : "") + fmt(max) })),
    notes.length ? el("p", { class: "note-small", text: notes.join(" ") }) : null);
  setTable(id, [{ label: opts.rowHeader || "Candidat" }, ...(rows[0].n !== undefined ? [{ label: "Tweets", num: true }] : []), ...cols.map((c) => ({ label: c.label, num: true }))],
    rows.map((r) => [r.label, ...(r.n !== undefined ? [num(r.n)] : []), ...cols.map((c) => (r.values[c.key] === null || r.values[c.key] === undefined ? "–" : fmt(r.values[c.key])))]));
}

/* Répartition d'une variable par candidat */
function distribution(stats, variable, ecologyOnly) {
  const v = V(variable);
  const cols = v.kind === "noul" ? [{ key: "oui", label: v.label }]
    : v.options.filter((o) => !NULLISH.has(o.key)).map((o) => ({ key: o.key, label: o.label, title: o.fr || o.label }));
  const rows = stats.map((s) => {
    const pool = ecologyOnly ? s.tweets.filter((t) => t.e) : s.tweets;
    const counts = Object.fromEntries(cols.map((c) => [c.key, 0]));
    for (const t of pool) {
      const val = t[variable];
      if (Array.isArray(val)) val.forEach((k) => { if (k in counts) counts[k]++; });
      else if (val === true) counts[cols[0].key]++;
      else if (val in counts) counts[val]++;
    }
    return { key: s.key, label: candName(s.key), n: pool.length, counts, values: Object.fromEntries(cols.map((c) => [c.key, pool.length ? counts[c.key] / pool.length : 0])) };
  }).filter((r) => r.n > 0);
  return { rows, cols };
}

/* =================================================================== onglet Aperçu */
function kpis(tweets) {
  const eco = tweets.filter((t) => t.e);
  const cri = eco.filter((t) => t.position === "critique_ecologie").length;
  const active = new Set(tweets.map((t) => t.c)).size;
  const tile = (label, value, note, hero) => el("div", { class: "kpi" + (hero ? " hero" : "") }, el("p", { class: "label", text: label }), el("p", { class: "value", text: value }), note ? el("p", { class: "note", text: note }) : null);
  return el("section", { class: "kpi-row", "aria-label": "Chiffres clés" },
    tile("Part des tweets qui parlent d'écologie", tweets.length ? pct(eco.length / tweets.length) : "–", `${num(eco.length)} sur ${num(tweets.length)} tweets`, true),
    tile("Tweets analysés", num(tweets.length), `${active} candidat${active > 1 ? "s" : ""} actif${active > 1 ? "s" : ""}`),
    tile("Tweets écologie", num(eco.length)),
    tile("Critiques de l'écologie", eco.length ? pct(cri / eco.length) : "–", "parmi les tweets écologie"));
}

function peopleCard() {
  const list = [...S.cands].filter((c) => !S.bloc || c.bloc === S.bloc).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const grid = el("div", { class: "people" }, list.map((c) => {
    const btn = el("button", { class: "person", type: "button", "aria-pressed": String(S.focus === c.key), title: c.note || `Mettre en avant ${c.name}` },
      avatar(c.key, 64), el("span", { class: "nm", text: c.name }), el("span", { class: "pt", text: `${c.party} · ${blocLabel(c.bloc)}` }), accountBadge(c));
    btn.addEventListener("click", () => setFilter({ focus: S.focus === c.key ? "" : c.key }));
    return btn;
  }));
  const flagged = list.filter((c) => ACCOUNT[c.compte]);
  return el("section", { class: "card", id: "candidats" },
    el("header", { class: "card-head" }, el("div", {}, el("h2", { text: "Les candidats suivis" }),
      el("p", { class: "sub", text: "Cliquez sur un candidat pour le mettre en avant dans tous les graphiques. Les comptes absents, introuvables ou peu actifs sur X sont signalés : leur discours est sous-représenté dans cette étude." }))),
    grid, flagged.length ? el("p", { class: "note-small", text: flagged.map((c) => `${c.name} : ${(ACCOUNT[c.compte] || {}).text}${c.note ? ` (${c.note})` : ""}`).join(" · ") } ) : null);
}

function renderApercu(panel) {
  const tweets = filtered();
  const stats = byCandidate(tweets);
  panel.replaceChildren(kpis(tweets), peopleCard());
  const sail = card("saillance", "Qui parle d'écologie ?", "macro", "Part des tweets originaux de chaque candidat qui abordent l'écologie, l'environnement ou l'énergie.", el("div", { class: "chart" }));
  const pos = card("position", "Pour ou contre l'action écologique ?", "cadrage", "Position exprimée dans les tweets écologie : critique de l'écologie à gauche de l'axe, favorable à la transition à droite, neutre au centre.", el("div", { class: "chart" }));
  const evoLegend = el("div", { class: "legend" });
  const evo = card("evolution", "Évolution semaine par semaine", null, "Part des tweets consacrés à l'écologie, par semaine. Mettez un candidat en avant pour le comparer à l'ensemble.", evoLegend, el("div", { class: "chart" }));
  const heatBox = el("div", { class: "chart" });
  const tabs = el("div", { class: "tabs", role: "tablist" }, [["themes", "Thèmes", "macro"], ["cadrage", "Cadrage", "cadrage"]].map(([k, label]) =>
    el("button", { class: "tab", type: "button", role: "tab", "aria-selected": String(S.apercuHeat === k), text: label, onclick: () => { S.apercuHeat = k; render(); } })));
  const heat = card("apercu-heat", "De quoi parlent-ils, et comment ?", S.apercuHeat === "themes" ? "macro" : "cadrage",
    "Part des tweets écologie de chaque candidat. Plus la case est foncée, plus la part est élevée. Cliquez sur une case pour lire des exemples dans l'onglet Discours.", tabs, heatBox);
  panel.append(sail, pos, evo, heat);
  renderSaillance(sail.querySelector(".chart"), stats);
  renderPosition(pos.querySelector(".chart"), stats);
  renderEvolution(evo.querySelector(".chart"), evoLegend, tweets);
  const d = distribution(stats, S.apercuHeat, true);
  renderHeat(heatBox, "apercu-heat", d.rows, d.cols, { empty: "Aucun tweet écologie sur cette période.", note: S.apercuHeat === "themes" ? "Un tweet peut aborder plusieurs thèmes." : null,
    onCell: (r, c) => { S.discours = S.apercuHeat === "themes" ? "macro" : "cadrage"; S.discoursVar[S.discours] = S.apercuHeat; S.selectedCell = { id: "discours-heat", row: r.key, col: c.key }; go("discours"); } });
}

/* =================================================================== onglet Discours */
const DISCOURS_ORDER = ["carre", "procedes", "topoi", "legitimation", "retardement", "visions", "ethos", "grammaire", "enonciation", "cadrage", "macro", "appropriation"];
function frameworkCard(fw) {
  return el("section", { class: "framework" }, el("h2", { text: fw.label }), el("p", { class: "who", text: fw.auteurs }),
    el("p", { text: fw.resume }), el("p", {}, el("strong", { text: "Dans cette étude. " }), fw.dans_l_etude), refsList(fw.refs));
}
function segCtrl(items, current, onPick, label) {
  return el("div", { class: "seg-ctrl", role: "group", "aria-label": label }, items.map(([k, text]) =>
    el("button", { type: "button", "aria-pressed": String(k === current), text, onclick: () => onPick(k) })));
}
function examplesFor(row, col, variable) {
  const pool = S.tweets.length ? filtered() : [];
  const match = (t) => { const v = t[variable]; return Array.isArray(v) ? v.includes(col) : (V(variable).kind === "noul" ? v === true : v === col); };
  const list = pool.filter((t) => t.c === row && t.e && t.t && match(t)).sort((a, b) => b.l - a.l).slice(0, 4);
  const box = el("div", { class: "examples", id: "examples" }, el("h3", { text: `${candName(row)} · ${variable === "reactivite" ? V(variable).label : optLabel(variable, col)}` }));
  const fr = optFr(variable, col);
  if (fr) box.append(el("p", { class: "note-small", text: fr }));
  if (!list.length) box.append(el("p", { class: "empty", text: "Aucun tweet écologie correspondant sur cette période. Le texte n'est publié que pour les tweets écologie." }));
  box.append(el("ol", { class: "tweet-list" }, list.map(tweetItem)));
  return box;
}
function renderDiscours(panel) {
  const keys = DISCOURS_ORDER.filter((k) => S.fw.has(k));
  if (!keys.includes(S.discours)) S.discours = keys[0];
  const fw = S.fw.get(S.discours);
  panel.replaceChildren(
    el("div", { class: "section-intro" }, el("h2", { text: "Lire le discours" }),
      el("p", { text: "Chaque onglet présente une théorie de l'analyse critique ou socio-cognitive du discours, puis la manière dont les candidats l'illustrent. Cliquez sur une case pour lire des tweets." })),
    el("nav", { class: "subnav", "aria-label": "Cadres théoriques" }, keys.map((k) => el("a", { class: "tab", href: `#discours/${k}`, "aria-selected": String(k === S.discours), text: S.fw.get(k).label }))),
    frameworkCard(fw));
  if (S.discours === "appropriation") { renderAppropriation(panel); return; }
  const vars = S.data.codebook.variables.filter((v) => v.framework === S.discours && v.key !== "parle_ecologie");
  const varKey = vars.some((v) => v.key === S.discoursVar[S.discours]) ? S.discoursVar[S.discours] : vars[0].key;
  const v = V(varKey);
  const ecologyOnly = v.scope === "ecologie" || S.discoursScope === "ecologie";
  const controls = el("div", { class: "controls" });
  if (vars.length > 1) controls.append(segCtrl(vars.map((x) => [x.key, x.label]), varKey, (k) => { S.discoursVar[S.discours] = k; S.selectedCell = null; render(); }, "Variable"));
  if (v.scope !== "ecologie") controls.append(segCtrl([["ecologie", "Tweets écologie"], ["tous", "Tous les tweets"]], S.discoursScope, (k) => { S.discoursScope = k; S.selectedCell = null; render(); }, "Corpus"));
  const heatBox = el("div", { class: "chart" });
  const c = card("discours-heat", v.label, null, ecologyOnly ? "Part des tweets écologie de chaque candidat dans chaque catégorie." : "Part de l'ensemble des tweets de chaque candidat dans chaque catégorie, écologie ou non.", controls, heatBox);
  panel.append(c);
  const stats = byCandidate(filtered());
  const d = distribution(stats, varKey, ecologyOnly);
  renderHeat(heatBox, "discours-heat", d.rows, d.cols, {
    empty: ecologyOnly ? "Aucun tweet écologie sur cette période." : "Aucun tweet sur cette période.",
    note: v.kind === "multi" ? "Un tweet peut relever de plusieurs catégories." : (NULLISH.has((v.options[v.options.length - 1] || {}).key) ? "La catégorie « aucun » n'a pas de colonne : une ligne ne totalise donc pas 100 %." : null),
    onCell: (r, col) => { S.selectedCell = { id: "discours-heat", row: r.key, col: col.key }; render(); const ex = $("#examples"); ex && ex.scrollIntoView({ behavior: "smooth", block: "nearest" }); },
  });
  if (v.options.length) c.append(el("details", { class: "codebook" }, el("summary", { text: "Les catégories" }),
    el("dl", { class: "cat-list" }, v.options.filter((o) => !NULLISH.has(o.key)).map((o) => el("div", {}, el("dt", { text: o.label }), el("dd", { text: o.fr || "" }))))));
  if (S.selectedCell && S.selectedCell.id === "discours-heat") c.append(examplesFor(S.selectedCell.row, S.selectedCell.col, varKey));
}

function themeVector(tweets) {
  const keys = V("themes").options.map((o) => o.key);
  const eco = tweets.filter((t) => t.e);
  return { n: eco.length, v: keys.map((k) => (eco.length ? eco.filter((t) => t.themes.includes(k)).length / eco.length : 0)) };
}
function cosine(a, b) { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return x && y ? d / Math.sqrt(x * y) : 0; }
function renderAppropriation(panel) {
  const tweets = filtered();
  const blocs = (S.data.study.blocs || []).filter((b) => tweets.some((t) => (S.cand.get(t.c) || {}).bloc === b.key));
  const themes = V("themes").options;
  const blocTweets = Object.fromEntries(blocs.map((b) => [b.key, tweets.filter((t) => (S.cand.get(t.c) || {}).bloc === b.key)]));
  const sal = card("appro-sal", "Qui parle d'écologie, par famille politique", null, "Part des tweets consacrés à l'écologie dans chaque famille politique.", el("div", { class: "chart" }));
  const prof = card("appro-blocs", "Le profil thématique de chaque famille", null, "Part des tweets écologie de chaque famille qui abordent chaque thème. C'est le « terrain » écologique de chaque camp.", el("div", { class: "chart" }));
  const sim = card("appro-sim", "Sur le terrain de qui ?", null, "Ressemblance entre les thèmes écologiques de chaque candidat et ceux de chaque famille, de 0 à 1. Le candidat est retiré du calcul du profil de sa propre famille.", el("div", { class: "chart" }));
  panel.append(sal, prof, sim);
  const salBox = sal.querySelector(".chart");
  const salRows = blocs.map((b) => { const ts = blocTweets[b.key]; return { b, n: ts.length, eco: ts.filter((t) => t.e).length }; }).sort((a, b) => b.eco / b.n - a.eco / a.n);
  const max = Math.max(...salRows.map((r) => r.eco / r.n), 0.0001);
  salBox.append(el("div", { class: "bars" }, salRows.map((r) => el("div", { class: "bar-row" }, el("div", { class: "bar-name", text: r.b.label }),
    el("div", { class: "bar-track" }, el("div", { class: "bar", style: `width:${(r.eco / r.n / max) * 80}%` }), el("span", { class: "bar-value", text: pct(r.eco / r.n) }))))));
  setTable("appro-sal", [{ label: "Famille" }, { label: "Tweets", num: true }, { label: "Tweets écologie", num: true }, { label: "Part", num: true }], salRows.map((r) => [r.b.label, num(r.n), num(r.eco), pct(r.eco / r.n)]));
  const cols = themes.map((o) => ({ key: o.key, label: o.label }));
  const profRows = blocs.map((b) => { const tv = themeVector(blocTweets[b.key]); return { key: b.key, label: b.label, n: tv.n, avatar: false, values: Object.fromEntries(themes.map((o, i) => [o.key, tv.v[i]])) }; }).filter((r) => r.n > 0);
  renderHeat(prof.querySelector(".chart"), "appro-blocs", profRows, cols, { rowHeader: "Famille", note: "Un tweet peut aborder plusieurs thèmes." });
  const stats = byCandidate(tweets).filter((s) => s.eco >= 5);
  const simRows = stats.map((s) => {
    const mine = themeVector(s.tweets).v;
    const values = {};
    for (const b of blocs) { const others = blocTweets[b.key].filter((t) => t.c !== s.key); const tv = themeVector(others); values[b.key] = tv.n >= 5 ? cosine(mine, tv.v) : null; }
    return { key: s.key, label: candName(s.key), n: s.eco, values };
  });
  renderHeat(sim.querySelector(".chart"), "appro-sim", simRows, blocs.map((b) => ({ key: b.key, label: b.label })), { domain: "minmax", format: (v) => F2.format(v), unit: "ressemblance",
    empty: "Pas assez de tweets écologie : 5 au minimum par candidat.", note: "Plus la case est foncée, plus la ressemblance est forte ; l'échelle va de la plus faible à la plus forte ressemblance observée. Un candidat qui ressemble surtout à une autre famille que la sienne parle d'écologie sur le terrain de cette famille. Case vide : moins de 5 tweets écologie dans la famille, une fois le candidat retiré." });
}

/* =================================================================== onglet Mots */
function renderMots(panel) {
  const lx = S.data.lexique;
  panel.replaceChildren(el("div", { class: "section-intro" }, el("h2", { text: "Les mots du débat" }),
    el("p", { text: "Deux approches sans modèle de langage : suivre les formules qui structurent le débat, et repérer le vocabulaire propre à chaque candidat. Les calculs portent sur toute la période et tous les candidats." })));
  if (!lx) { panel.append(el("p", { class: "empty", text: "Pas encore de données." })); return; }
  const used = lx.formules.filter((f) => f.total > 0).sort((a, b) => b.total - a.total);
  const fCard = card("formules", "Les formules", "formules", "Qui lance une expression, qui la reprend. Les variantes repérées sont listées dans config/formules.yaml.", el("div", { class: "chart" }));
  panel.append(fCard);
  const fBox = fCard.querySelector(".chart");
  if (!used.length) fBox.append(el("p", { class: "empty", text: "Aucune formule suivie n'apparaît encore dans le corpus." }));
  else {
    const table = el("table", { class: "formula-table" }, el("thead", {}, el("tr", {}, ["Formule", "Emplois", "Première occurrence", "Principaux utilisateurs", "Mots associés"].map((h, i) => el("th", { class: i === 1 ? "num" : null, text: h })))),
      el("tbody", {}, used.map((f) => {
        const c = S.cand.get(f.premiere.c);
        const top = Object.entries(f.par_candidat).slice(0, 3);
        return el("tr", {}, el("td", { text: f.label }), el("td", { class: "num", text: num(f.total) }),
          el("td", {}, el("span", { class: "who-inline" }, avatar(f.premiere.c, 20), `${candName(f.premiere.c)}, ${fmtDay(f.premiere.date)}`), " ",
            c && c.handle ? el("a", { href: `https://x.com/${c.handle}/status/${f.premiere.id}`, target: "_blank", rel: "noopener", text: "voir" }) : null),
          el("td", {}, top.map(([k, n]) => el("div", { class: "who-inline" }, avatar(k, 20), `${candName(k)} : ${n}`))),
          el("td", { text: (f.mots_associes || []).slice(0, 6).map((m) => m[0]).join(", ") }));
      })));
    fBox.append(el("div", { class: "table-view" }, table));
    const rows = [...S.cands].map((c) => ({ key: c.key, label: c.name, counts: {}, values: Object.fromEntries(used.map((f) => [f.key, f.par_candidat[c.key] || 0])) }))
      .filter((r) => Object.values(r.values).some((v) => v > 0));
    const heat = el("div", { style: "margin-top:16px" });
    fBox.append(heat);
    renderHeat(heat, "formules", rows, used.map((f) => ({ key: f.key, label: f.label.replace(/[«»]/g, "").trim() })), { format: (v) => num(v), min0: "0", unit: "emplois" });
  }
  const groups = S.mots.mode === "blocs" ? lx.blocs : lx.candidats;
  const keys = Object.keys(groups).filter((k) => groups[k].length);
  if (!keys.includes(S.mots.who)) S.mots.who = S.mots.mode === "candidats" && keys.includes(S.focus) ? S.focus : keys[0];
  const name = (k) => (S.mots.mode === "blocs" ? blocLabel(k) : candName(k));
  const sel = el("select", { "aria-label": "Choisir" }, keys.sort((a, b) => name(a).localeCompare(name(b), "fr")).map((k) => el("option", { value: k, selected: k === S.mots.who ? true : null, text: name(k) })));
  sel.addEventListener("change", () => { S.mots.who = sel.value; render(); });
  const kwBox = el("div", { class: "chart" });
  const kCard = card("lexique", "Le vocabulaire spécifique", "lexique", "Les mots que chacun emploie significativement plus que les autres dans ses tweets écologie.",
    el("div", { class: "controls" }, segCtrl([["candidats", "Par candidat"], ["blocs", "Par famille"]], S.mots.mode, (k) => { S.mots.mode = k; S.mots.who = ""; render(); }, "Regrouper"), keys.length ? el("label", { class: "field" }, sel) : null), kwBox);
  panel.append(kCard);
  const words = groups[S.mots.who] || [];
  if (!words.length) { kwBox.append(el("p", { class: "empty", text: "Pas assez de tweets écologie pour dégager un vocabulaire spécifique." })); setTable("lexique", [], []); return; }
  const mx = words[0][2];
  kwBox.append(el("div", { class: "kw" }, words.map(([w, n, g]) => [el("span", { text: w }), el("div", { class: "b", style: `width:${(g / mx) * 100}%` }), el("span", { class: "v", text: `${n} emplois` })])));
  setTable("lexique", [{ label: "Mot" }, { label: "Emplois", num: true }, { label: "G²", num: true }], words.map(([w, n, g]) => [w, num(n), PF.format(g)]));
}

/* =================================================================== tweets */
const POS_COLOR = { favorable_transition: "var(--accent)", critique_ecologie: "var(--accent-2)", neutre: "var(--neutral-mark)" };
function chip(text, varKey, optKey, extra) {
  return el("span", { class: "chip" + (extra ? " " + extra : "") }, text, varKey ? catInfoBtn(varKey, optKey) : null);
}
function tweetItem(t) {
  const c = S.cand.get(t.c) || { name: t.c };
  const chips = el("div", { class: "chips" });
  if (t.position) chips.append(el("span", { class: "chip" }, el("span", { class: "dot", style: `background:${POS_COLOR[t.position] || "var(--muted)"}` }), optLabel("position", t.position)));
  (t.themes || []).forEach((k) => chips.append(chip(optLabel("themes", k))));
  for (const key of ["cadrage", "vision", "ethos"]) if (t[key] && !NULLISH.has(t[key])) chips.append(chip(`${V(key).label} : ${optLabel(key, t[key])}`, key, t[key]));
  for (const key of ["procedes", "topoi", "legitimation", "retardement"]) (t[key] || []).forEach((k) => chips.append(chip(optLabel(key, k), key, k)));
  (t.lx || []).forEach((w) => chips.append(el("span", { class: "chip lex", text: `« ${w} »` })));
  const foot = [t.s === "c" ? "Codé par Claude" : "Codé par Jev", t.p !== null && t.p !== undefined ? `p(écologie) = ${F2.format(t.p)}` : null, t.im ? `Présupposé : ${t.im}` : null].filter(Boolean).join(" · ");
  return el("li", { class: "tweet" },
    el("div", { class: "tweet-head" }, avatar(t.c, 28), el("strong", { text: c.name }), el("span", { text: fmtDay(t.d) }), el("span", { text: `${num(t.l)} j'aime` }),
      c.handle ? el("a", { href: `https://x.com/${c.handle}/status/${t.i}`, target: "_blank", rel: "noopener", text: "Voir sur X" }) : null),
    el("p", { class: "tweet-text", text: t.t || "" }), t.rs ? el("p", { class: "tweet-resume", text: t.rs }) : null, chips, el("div", { class: "tweet-foot", text: foot }));
}
function option(value, label, selected) { return el("option", { value, selected: selected ? true : null, text: label }); }
function renderTweets(panel) {
  const x = S.x;
  const sel = (id, items, cur, all = "Tous") => { const s = el("select", { id }, option("", all, !cur), items.map(([k, l]) => option(k, l, k === cur))); return s; };
  const optsOf = (v) => V(v).options.filter((o) => !NULLISH.has(o.key)).map((o) => [o.key, o.label]);
  const concept = el("select", { id: "x-concept" }, option("", "Tous", !x.concept),
    ["procedes", "topoi", "legitimation", "retardement", "vision", "ethos"].map((vk) => el("optgroup", { label: V(vk).label }, optsOf(vk).map(([k, l]) => option(`${vk}:${k}`, l, x.concept === `${vk}:${k}`)))));
  const q = el("input", { id: "x-q", type: "search", placeholder: "Mot, expression…", value: x.q });
  const fields = el("div", { class: "explorer-filters" },
    el("label", { class: "field" }, el("span", { text: "Candidat" }), sel("x-cand", [...S.cands].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((c) => [c.key, c.name]), x.cand)),
    el("label", { class: "field" }, el("span", { text: "Thème" }), sel("x-theme", optsOf("themes"), x.theme)),
    el("label", { class: "field" }, el("span", { text: "Position" }), sel("x-pos", optsOf("position"), x.pos, "Toutes")),
    el("label", { class: "field" }, el("span", { text: "Cadrage" }), sel("x-cad", optsOf("cadrage"), x.cad)),
    el("label", { class: "field" }, el("span", { text: "Concept" }), concept),
    el("label", { class: "field grow" }, el("span", { text: "Rechercher" }), q),
    el("label", { class: "field" }, el("span", { text: "Trier" }), sel("x-sort", [["likes", "Plus aimés"]], x.sort === "likes" ? "likes" : "", "Plus récents")));
  const list = el("ol", { class: "tweet-list" });
  const more = el("button", { class: "ghost-btn more", type: "button", text: "Afficher plus" });
  const sub = el("p", { class: "sub" });
  panel.replaceChildren(el("div", { class: "section-intro" }, el("h2", { text: "Explorer les tweets écologie" }),
    el("p", { text: "Chaque tweet avec son codage complet. Les bulles « i » donnent la définition de chaque catégorie. Les filtres s'ajoutent à la période et à la famille politique choisies en haut de page." })),
    el("section", { class: "card" }, fields, sub, list, more));
  const update = () => {
    let items = filtered().filter((t) => t.e && t.t && (!x.cand || t.c === x.cand) && (!x.theme || t.themes.includes(x.theme)) && (!x.pos || t.position === x.pos) && (!x.cad || t.cadrage === x.cad));
    if (x.concept) { const [vk, ok] = x.concept.split(":"); items = items.filter((t) => (Array.isArray(t[vk]) ? t[vk].includes(ok) : t[vk] === ok)); }
    if (x.q) { const n = x.q.toLowerCase(); items = items.filter((t) => (t.t || "").toLowerCase().includes(n) || (t.rs || "").toLowerCase().includes(n)); }
    items.sort(x.sort === "likes" ? (a, b) => b.l - a.l : (a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
    sub.textContent = `${num(items.length)} tweet${items.length > 1 ? "s" : ""} écologie correspondant à la sélection.`;
    list.replaceChildren(...(items.length ? items.slice(0, x.shown).map(tweetItem) : [el("li", { class: "empty", text: "Aucun tweet ne correspond." })]));
    more.hidden = items.length <= x.shown;
  };
  const sync = () => { Object.assign(x, { cand: $("#x-cand").value, theme: $("#x-theme").value, pos: $("#x-pos").value, cad: $("#x-cad").value, concept: $("#x-concept").value, q: $("#x-q").value.trim(), sort: $("#x-sort").value || "date", shown: 15 }); update(); };
  $$("select", fields).forEach((s) => s.addEventListener("change", sync));
  q.addEventListener("input", debounce(sync, 200));
  more.addEventListener("click", () => { x.shown += 15; update(); });
  update();
}

/* =================================================================== onglet Méthode */
function agreementTable(ev) {
  const fmt = (v) => (v === null || v === undefined ? "–" : F2.format(v));
  const status = (raw) => { const a = raw === null || raw === undefined ? raw : Math.round(raw * 100) / 100; return a === null || a === undefined ? el("span", { text: "–" })
    : a >= 0.8 ? el("span", { class: "status good" }, el("span", { class: "ico", text: "✓" }), "fiable")
    : a >= 0.667 ? el("span", { class: "status warning" }, el("span", { class: "ico", text: "~" }), "à confirmer")
    : el("span", { class: "status critical" }, el("span", { class: "ico", text: "✕" }), "insuffisant"); };
  const rows = ev.variables.map((v) => [V(v.variable)?.label || v.variable, v.n, v.accord === null ? "–" : pct(v.accord), fmt(v.kappa), fmt(v.alpha), status(v.alpha)]);
  for (const [k, m] of Object.entries(ev.multi || {})) rows.push([`${V(k)?.label || k} (moyenne par catégorie)`, m.n, m.jaccard_moyen === null ? "–" : `Jaccard ${fmt(m.jaccard_moyen)}`, "–", fmt(m.alpha_moyen), status(m.alpha_moyen)]);
  return el("div", { class: "table-view" }, el("table", { class: "small-table" },
    el("thead", {}, el("tr", {}, ["Variable", "n", "Accord", "Kappa", "Alpha", "Lecture"].map((h, i) => el("th", { class: i && i < 5 ? "num" : null, text: h })))),
    el("tbody", {}, rows.map((r) => el("tr", {}, r.map((v, i) => el("td", { class: i && i < 5 ? "num" : null }, v instanceof Node ? v : String(v))))))));
}
function renderMethode(panel) {
  const d = S.data;
  const parts = [el("div", { class: "section-intro" }, el("h2", { text: "Méthode" }),
    el("p", { text: "Comment les tweets sont collectés, codés et vérifiés, et ce que cette étude ne permet pas de dire." }))];
  if ((d.study.questions || []).length) parts.push(el("section", { class: "card" }, el("h2", { text: "Les questions de l'étude" }),
    el("dl", { class: "cat-list" }, d.study.questions.map((q) => el("div", {}, el("dt", { text: q.titre }), el("dd", { text: q.texte }))))));
  parts.push(el("section", { class: "card" }, el("h2", { text: "Le corpus" }),
    el("p", { class: "sub", text: `Tweets originaux des comptes personnels des candidats, réponses et reposts exclus, depuis le ${fmtDay(d.study.start)}. Chaque compte est d'abord rattrapé intégralement, puis collecté chaque jour. Le texte n'est publié ici que pour les tweets qui parlent d'écologie.` }),
    el("div", { class: "table-view" }, el("table", {}, el("thead", {}, el("tr", {}, ["Phase", "Début", "Fin"].map((h) => el("th", { text: h })))),
      el("tbody", {}, (d.study.phases || []).map((p) => el("tr", {}, el("td", { text: p.label }), el("td", { text: fmtDay(p.start) }), el("td", { text: fmtDay(p.end) }))))))));
  parts.push(el("h2", { text: "Les moteurs de codage", style: "margin:28px 0 12px" }), ...d.codebook.engines.filter((e) => e.key !== "fiabilite").map(frameworkCard));
  const val = el("section", { class: "card" }, titleWithInfo("h2", "Fiabilité du codage", "fiabilite"));
  const v = d.validation;
  if (!v || !v.double_code || !v.double_code.n) {
    val.append(el("p", { class: "sub", text: "Claude n'a pas encore servi de second codeur : les résultats reposent sur le seul codage de Jev." }));
    if (v && v.routage) val.append(el("p", { class: "note-small", text: `${num(v.routage.tweets_codes_jev)} tweets codés par Jev, dont ${num(v.routage.incertains_en_attente)} décisions incertaines en attente.` }));
  } else {
    const s = v.echantillon.aleatoire;
    val.append(el("p", { class: "sub", text: `${num(v.routage.tweets_codes_jev)} tweets codés par Jev, ${num(v.routage.tweets_codes_claude)} par Claude. Lecture de l'alpha de Krippendorff : 0,8 et plus fiable, de 0,667 à 0,8 à confirmer, en dessous insuffisant.` }));
    if (s && s.n) val.append(el("h3", { text: `Échantillon de validation aléatoire, ${num(s.n)} tweets` }), agreementTable(s));
    val.append(el("h3", { text: `Tous les tweets codés par les deux moteurs, ${num(v.double_code.n)}` }),
      el("p", { class: "note-small", text: "Inclut les tweets confiés à Claude parce qu'ils étaient incertains : l'accord y est mécaniquement plus faible." }), agreementTable(v.double_code));
  }
  parts.push(val);
  parts.push(el("section", { class: "card" }, el("h2", { text: "Les comptes suivis" }), el("div", { class: "table-view" }, el("table", {},
    el("thead", {}, el("tr", {}, ["Candidat", "Compte X", "Statut", "Dernier tweet", "Remarque"].map((h) => el("th", { text: h })))),
    el("tbody", {}, [...S.cands].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((c) => el("tr", {},
      el("td", {}, el("span", { class: "who-inline" }, avatar(c.key, 20), c.name)), el("td", { text: c.handle ? "@" + c.handle : "aucun" }),
      el("td", { text: (ACCOUNT[c.compte] || { text: "Actif" }).text }), el("td", { text: c.dernier_tweet ? fmtDay(c.dernier_tweet) : "–" }), el("td", { text: c.note || "" }))))))));
  parts.push(el("section", { class: "card" }, el("h2", { text: "Limites" }), el("ul", { class: "sub" },
    el("li", { text: "X n'est qu'un fragment du discours de campagne, souvent rédigé par des équipes, et certains candidats y sont peu présents." }),
    el("li", { text: "Les modèles se trompent, notamment sur l'ironie, les tweets très courts et les concepts les plus subtils de la grille." }),
    el("li", { text: "Un pourcentage calculé sur moins de 20 tweets est fragile ; il est signalé comme tel." }),
    el("li", { text: "L'accord entre deux modèles mesure leur convergence, pas la justesse du codage." }),
    el("li", { text: "Les jeux comparent des réactions à des tweets, pas des programmes. Ce ne sont ni des sondages ni des conseils de vote." }))));
  const book = el("details", { class: "codebook" }, el("summary", { text: "Le livre de codes complet" }));
  for (const fw of d.codebook.frameworks) {
    const vars = d.codebook.variables.filter((x) => x.framework === fw.key);
    book.append(el("h3", { text: `${fw.label} · ${fw.auteurs}` }), el("p", { class: "note-small", text: fw.dans_l_etude }));
    for (const x of vars) book.append(el("p", {}, el("strong", { text: x.label }), x.scope === "ecologie" ? " (tweets écologie)" : ""),
      el("dl", {}, x.options.map((o) => [el("dt", { text: o.label }), el("dd", { text: [o.fr, `Définition donnée aux modèles : ${o.description}`].filter(Boolean).join(" ") })])));
  }
  parts.push(el("section", { class: "card" }, el("h2", { text: "Livre de codes" }), el("p", { class: "sub", text: "Les définitions données aux modèles sont en anglais, langue principale de Jev ; les tweets sont analysés en français." }), book));
  const photos = S.cands.filter((c) => c.photo);
  if (photos.length) parts.push(el("section", { class: "card" }, el("h2", { text: "Crédits photographiques" }), el("ul", { class: "note-small" },
    photos.map((c) => el("li", {}, `${c.name} : ${c.photo.auteur || "auteur inconnu"}${c.photo.licence ? ", " + c.photo.licence : ""}, `, c.photo.source ? el("a", { href: c.photo.source, target: "_blank", rel: "noopener", text: "source" }) : null)))));
  panel.replaceChildren(...parts);
}

/* =================================================================== jeux */
const GAMES = [
  { key: "qui", title: "Qui a tweeté ?", text: "Un tweet anonymisé, quatre candidats. Retrouvez l'auteur, puis découvrez les indices du discours qui le trahissaient.", rounds: 8 },
  { key: "agent", title: "Classez comme un agent", text: "Codez un tweet comme le font nos agents : position, cadrage, procédés. Puis comparez vos réponses à celles de Jev et de Claude.", rounds: 6 },
  { key: "situer", title: "Où vous situez-vous ?", text: "Réagissez à douze tweets anonymisés et découvrez de quels candidats, et de quelle vision de l'écologie, vous êtes le plus proche.", rounds: 12 },
];
async function loadGames() {
  if (S.games) return S.games;
  try { const r = await fetch("games.json", { cache: "no-cache" }); S.games = r.ok ? await r.json() : { items: [] }; } catch (e) { S.games = { items: [] }; }
  S.games.items = (S.games.items || []).filter((it) => S.cand.has(it.c) && it.t);
  return S.games;
}
function pickSpread(items, n, rnd = Math.random) {
  const by = new Map();
  for (const it of shuffle(items, rnd)) { if (!by.has(it.c)) by.set(it.c, []); by.get(it.c).push(it); }
  const out = [];
  while (out.length < n && [...by.values()].some((l) => l.length)) for (const l of shuffle([...by.values()], rnd)) { if (l.length && out.length < n) out.push(l.pop()); }
  return out;
}
function cluesFor(it) {
  if (it.ind && it.ind.length) return it.ind.map((t) => el("li", { text: t }));
  const c = it.codes || {}, li = [];
  if (c.cadrage && !NULLISH.has(c.cadrage)) li.push(el("li", {}, `Cadrage : ${optLabel("cadrage", c.cadrage)}. `, infoBtn("cadrage")));
  if (c.vision && !NULLISH.has(c.vision)) li.push(el("li", {}, `Vision de l'écologie : ${optLabel("vision", c.vision)}. `, infoBtn("visions")));
  if (c.polarisation && !NULLISH.has(c.polarisation)) li.push(el("li", {}, `Carré idéologique : ${optLabel("polarisation", c.polarisation).toLowerCase()}. `, infoBtn("carre")));
  if ((c.topoi || []).length) li.push(el("li", {}, `Topoï : ${c.topoi.map((k) => optLabel("topoi", k).toLowerCase()).join(", ")}. `, infoBtn("topoi")));
  if ((c.procedes || []).length) li.push(el("li", {}, `Procédés : ${c.procedes.map((k) => optLabel("procedes", k).toLowerCase()).join(", ")}. `, infoBtn("procedes")));
  if ((c.retardement || []).length) li.push(el("li", {}, `Retardement : ${c.retardement.map((k) => optLabel("retardement", k).toLowerCase()).join(", ")}. `, infoBtn("retardement")));
  return li;
}
function quote(it) {
  return [el("blockquote", { class: "quote", text: it.t }),
    el("p", { class: "quote-meta", text: `Tweet anonymisé ${it.m === "claude" ? "par Claude" : "automatiquement"}, publié le ${fmtDay(it.d)}.` })];
}
function originalLink(it) { const c = S.cand.get(it.c); return c && c.handle ? el("a", { href: `https://x.com/${c.handle}/status/${it.i}`, target: "_blank", rel: "noopener", text: "Voir le tweet original sur X" }) : null; }
function gameShell(panel, title, i, total, extra) {
  panel.replaceChildren(el("div", { class: "game" },
    el("div", { class: "game-top" }, el("button", { class: "ghost-btn", type: "button", text: "← Tous les jeux", onclick: () => { S.play = null; render(); } }), el("span", { text: `${title} · ${Math.min(i + 1, total)} sur ${total}${extra ? " · " + extra : ""}` })),
    el("div", { class: "progress" }, el("span", { style: `width:${(i / total) * 100}%` }))));
  return panel.querySelector(".game");
}
function endLinks() {
  return el("p", {}, "Pour aller plus loin : ", ["carre", "cadrage", "topoi", "procedes", "visions"].map((k, i) => [i ? " · " : "", el("a", { href: `#discours/${k}`, text: S.fw.get(k).label })]));
}

function startGame(key) {
  const items = S.games.items;
  const g = GAMES.find((x) => x.key === key);
  if (key === "qui") {
    const chosen = pickSpread(items, g.rounds);
    const pool = [...new Set(items.map((it) => it.c))];
    S.play = { key, i: 0, score: 0, answered: null, rounds: chosen.map((it) => {
      const same = shuffle(pool.filter((k) => k !== it.c && S.cand.get(k).bloc === S.cand.get(it.c).bloc)).slice(0, 1);
      const other = shuffle(pool.filter((k) => k !== it.c && !same.includes(k))).slice(0, 3 - same.length);
      return { it, options: shuffle([it.c, ...same, ...other]) };
    }) };
  } else if (key === "agent") {
    S.play = { key, i: 0, agree: 0, total: 0, answered: null, rounds: pickSpread(items.filter((it) => it.jev && it.jev.position && it.jev.cadrage), g.rounds).map((it) => {
      const pr = Object.entries(it.jev.procedes || {}).sort((a, b) => b[1] - a[1]);
      const opts = shuffle([...pr.slice(0, 3), ...shuffle(pr.slice(3)).slice(0, 3)].map(([k]) => k));
      return { it, procOpts: opts };
    }) };
  } else {
    const ok = items.filter((it) => ["favorable_transition", "critique_ecologie"].includes(it.codes.position) && it.codes.vision && !NULLISH.has(it.codes.vision));
    const fav = pickSpread(ok.filter((it) => it.codes.position === "favorable_transition"), g.rounds / 2);
    const cri = pickSpread(ok.filter((it) => it.codes.position === "critique_ecologie"), g.rounds - fav.length);
    S.play = { key, i: 0, rounds: shuffle([...fav, ...cri]).map((it) => ({ it, r: null })) };
  }
  render();
}

function renderQui(panel) {
  const P = S.play, round = P.rounds[P.i];
  if (!round) {
    const box = gameShell(panel, "Qui a tweeté ?", P.rounds.length, P.rounds.length);
    box.append(el("div", { class: "reveal" }, el("h3", { text: `Score : ${P.score} sur ${P.rounds.length}` }),
      el("p", { text: "Pour reconnaître un camp sans voir de nom, vous avez lu son discours : ses cadrages, sa manière d'opposer « nous » et « eux », ses arguments implicites. C'est exactement ce que décrit l'analyse critique du discours." }),
      endLinks(), el("button", { class: "primary-btn", type: "button", text: "Rejouer", onclick: () => startGame("qui") })));
    return;
  }
  const box = gameShell(panel, "Qui a tweeté ?", P.i, P.rounds.length, `score ${P.score}`);
  box.append(...quote(round.it), el("p", { class: "q-title", text: "Qui a écrit ce tweet ?" }));
  const choices = el("div", { class: "choices" }, round.options.map((k) => {
    const c = S.cand.get(k);
    const b = el("button", { class: "choice" + (P.answered ? (k === round.it.c ? " right" : k === P.answered ? " wrong" : "") : ""), type: "button", disabled: P.answered ? true : null },
      avatar(k, 40), el("span", {}, c.name, el("span", { class: "sub2", text: c.party })));
    b.addEventListener("click", () => { P.answered = k; if (k === round.it.c) P.score++; render(); });
    return b;
  }));
  box.append(choices);
  if (P.answered) {
    const good = P.answered === round.it.c, c = S.cand.get(round.it.c);
    box.append(el("div", { class: "reveal" },
      el("div", { class: `verdict ${good ? "good" : "bad"}` }, el("span", { class: "ico", text: good ? "✓" : "✕" }), good ? "Bien vu." : `Non : c'était ${c.name}.`),
      el("p", {}, `${c.name}, ${c.party}. `, originalLink(round.it)),
      el("h3", { text: "Les indices dans le discours" }), el("ul", {}, cluesFor(round.it)),
      el("button", { class: "primary-btn", type: "button", text: P.i + 1 < P.rounds.length ? "Tweet suivant" : "Voir mon score", onclick: () => { P.i++; P.answered = null; render(); } })));
  }
}

function compareBlock(title, fwKey, varKey, probs, mine, claude, keys) {
  let entries = (keys || Object.keys(probs).filter((k) => !NULLISH.has(k))).map((k) => [k, probs[k] || 0]).sort((a, b) => b[1] - a[1]);
  if (!keys) {
    const top = entries.slice(0, 3);
    const extra = [mine, Object.entries(probs).sort((a, b) => b[1] - a[1])[0][0]].filter((k) => k && !top.some(([x]) => x === k));
    entries = [...top, ...[...new Set(extra)].map((k) => [k, probs[k] || 0])].sort((a, b) => b[1] - a[1]);
  }
  const jevPick = Object.entries(probs).sort((a, b) => b[1] - a[1])[0][0];
  return el("div", { class: "q-block" }, el("div", { class: "q-title" }, title, infoBtn(fwKey)),
    el("div", { class: "cmp" }, entries.map(([k, p]) => {
      const isMine = Array.isArray(mine) ? mine.includes(k) : mine === k;
      return [el("span", { class: "lbl" + (isMine ? " mine" : ""), text: optLabel(varKey, k) + (isMine ? " · vous" : "") }),
        el("div", { class: "track" }, el("div", { class: "fill", style: `width:${p * 100}%` })), el("span", { class: "num", text: pct(p, 0) })];
    })),
    el("p", { class: "note-small", text: `Barres : probabilités de Jev${keys ? "" : `, qui choisit « ${optLabel(varKey, jevPick)} »`}.${claude ? ` Claude : ${Array.isArray(claude) ? (claude.length ? claude.map((k) => optLabel(varKey, k)).join(", ") : "aucun") : optLabel(varKey, claude)}.` : ""}` }));
}
function renderAgent(panel) {
  const P = S.play, round = P.rounds[P.i];
  if (!round) {
    const box = gameShell(panel, "Classez comme un agent", P.rounds.length, P.rounds.length);
    const rate = P.total ? P.agree / P.total : 0;
    box.append(el("div", { class: "reveal" }, el("h3", { text: `Accord avec Jev : ${pct(rate, 0)}` }),
      el("p", {}, "Coder un discours, c'est trancher des cas ambigus. Deux codeurs, humains ou machines, ne sont jamais d'accord sur tout : c'est pourquoi on mesure leur accord, avec l'alpha de Krippendorff. ", infoBtn("fiabilite")),
      el("p", {}, el("a", { href: "#methode", text: "Voir la fiabilité du codage de cette étude" })),
      el("button", { class: "primary-btn", type: "button", text: "Rejouer", onclick: () => startGame("agent") })));
    return;
  }
  const box = gameShell(panel, "Classez comme un agent", P.i, P.rounds.length);
  box.append(...quote(round.it));
  const it = round.it;
  if (!P.answered) {
    const form = el("form", {});
    const radios = (name, title, fwKey, varKey, keys) => el("fieldset", {}, el("legend", { class: "q-title" }, title, infoBtn(fwKey)),
      el("div", { class: "opts" }, keys.map((k) => el("label", { class: "opt", title: optFr(varKey, k) }, el("input", { type: "radio", name, value: k, required: true }), el("span", { text: optLabel(varKey, k) })))));
    form.append(radios("position", "Quelle position ?", "cadrage", "position", ["favorable_transition", "neutre", "critique_ecologie"]),
      radios("cadrage", "Quel cadrage dominant ?", "cadrage", "cadrage", V("cadrage").options.filter((o) => !NULLISH.has(o.key)).map((o) => o.key)),
      el("fieldset", {}, el("legend", { class: "q-title" }, "Quels procédés repérez-vous ? Plusieurs réponses possibles.", infoBtn("procedes")),
        el("div", { class: "opts" }, round.procOpts.map((k) => el("label", { class: "opt", title: optFr("procedes", k) }, el("input", { type: "checkbox", name: "procedes", value: k }), el("span", { text: optLabel("procedes", k) }))))),
      el("button", { class: "primary-btn", type: "submit", text: "Comparer avec les agents" }));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(form);
      P.answered = { position: f.get("position"), cadrage: f.get("cadrage"), procedes: f.getAll("procedes") };
      const jp = (v) => Object.entries(it.jev[v]).sort((a, b) => b[1] - a[1])[0][0];
      const jevProc = round.procOpts.filter((k) => (it.jev.procedes || {})[k] >= 0.5);
      const a = new Set(P.answered.procedes), b = new Set(jevProc), union = new Set([...a, ...b]);
      P.agree += (P.answered.position === jp("position")) + (P.answered.cadrage === jp("cadrage")) + (union.size ? [...a].filter((k) => b.has(k)).length / union.size : 1);
      P.total += 3;
      render();
    });
    box.append(form);
  } else {
    const cl = it.claude || {};
    box.append(el("div", { class: "reveal" }, el("h3", { text: "Vos réponses face aux agents" }),
      compareBlock("Position", "cadrage", "position", it.jev.position, P.answered.position, cl.position),
      compareBlock("Cadrage", "cadrage", "cadrage", it.jev.cadrage, P.answered.cadrage, cl.cadrage),
      compareBlock("Procédés", "procedes", "procedes", it.jev.procedes || {}, P.answered.procedes, cl.procedes ? cl.procedes.filter((k) => round.procOpts.includes(k)) : null, round.procOpts),
      el("p", {}, `Auteur : ${candName(it.c)}. `, originalLink(it)),
      el("button", { class: "primary-btn", type: "button", text: P.i + 1 < P.rounds.length ? "Tweet suivant" : "Voir le bilan", onclick: () => { P.i++; P.answered = null; render(); } })));
  }
}

function profiles() {
  const visions = V("vision").options.filter((o) => !NULLISH.has(o.key)).map((o) => o.key);
  const cadrages = V("cadrage").options.filter((o) => !NULLISH.has(o.key)).map((o) => o.key);
  const pv = { favorable_transition: 1, critique_ecologie: -1 };
  const rows = byCandidate(S.tweets).filter((s) => s.eco >= 8).map((s) => {
    const eco = s.tweets.filter((t) => t.e);
    return { key: s.key, pos: eco.reduce((a, t) => a + (pv[t.position] || 0), 0) / eco.length,
      vis: visions.map((k) => eco.filter((t) => t.vision === k).length / eco.length), cad: cadrages.map((k) => eco.filter((t) => t.cadrage === k).length / eco.length) };
  });
  const mean = (arrs) => arrs[0].map((_, i) => arrs.reduce((a, x) => a + x[i], 0) / arrs.length);
  if (rows.length) { const mv = mean(rows.map((r) => r.vis)), mc = mean(rows.map((r) => r.cad)); rows.forEach((r) => { r.vec = [2 * r.pos, ...r.vis.map((x, i) => x - mv[i]), ...r.cad.map((x, i) => x - mc[i])]; }); }
  return { rows, visions, cadrages, pv };
}
function renderSituer(panel) {
  const P = S.play, round = P.rounds[P.i];
  if (round) {
    const box = gameShell(panel, "Où vous situez-vous ?", P.i, P.rounds.length);
    box.append(...quote(round.it), el("p", { class: "q-title", text: "Êtes-vous d'accord avec ce tweet ?" }),
      el("div", { class: "react" }, [[1, "D'accord"], [0, "Partagé"], [-1, "Pas d'accord"], [null, "Je passe"]].map(([v, l]) =>
        el("button", { class: v === null ? "ghost-btn" : "choice", type: "button", text: l, onclick: () => { round.r = v; P.i++; render(); } }))));
    return;
  }
  const box = gameShell(panel, "Où vous situez-vous ?", P.rounds.length, P.rounds.length);
  const rated = P.rounds.filter((r) => r.r !== null);
  const { rows, visions, cadrages, pv } = profiles();
  if (rated.length < 4 || !rows.length) {
    box.append(el("div", { class: "reveal" }, el("p", { text: rows.length ? "Réagissez à au moins quatre tweets pour obtenir un résultat." : "Pas encore assez de tweets pour établir les profils des candidats." }),
      el("button", { class: "primary-btn", type: "button", text: "Recommencer", onclick: () => startGame("situer") })));
    return;
  }
  const n = rated.length;
  const u = [2 * rated.reduce((a, r) => a + r.r * (pv[r.it.codes.position] || 0), 0) / n,
    ...visions.map((k) => rated.reduce((a, r) => a + (r.it.codes.vision === k ? r.r : 0), 0) / n),
    ...cadrages.map((k) => rated.reduce((a, r) => a + (r.it.codes.cadrage === k ? r.r : 0), 0) / n)];
  const ranked = rows.map((r) => ({ key: r.key, sim: cosine(u, r.vec) })).sort((a, b) => b.sim - a.sim);
  const uv = u.slice(1, 1 + visions.length), best = uv.indexOf(Math.max(...uv));
  const row = (x) => el("div", { class: "result-row" }, avatar(x.key, 40), el("span", {}, el("strong", { text: candName(x.key) }), el("span", { class: "sub2", text: ` ${S.cand.get(x.key).party}` })),
    el("div", {}, el("div", { class: "track", title: `Proximité : ${F2.format(x.sim)}` }, el("div", { class: "fill", style: `width:${((x.sim + 1) / 2) * 100}%` })),
      el("span", { class: "sub2", text: `proximité ${F2.format(x.sim)}` })));
  box.append(el("div", { class: "reveal" },
    el("h3", { text: "Les candidats dont le discours vous ressemble le plus" }), el("div", { class: "result-list" }, ranked.slice(0, 3).map(row)),
    el("h3", { text: "Le plus éloigné" }), el("div", { class: "result-list" }, row(ranked[ranked.length - 1])),
    uv[best] > 0 ? el("p", {}, "Votre vision de l'écologie ressemble à celle que Dryzek appelle ", el("strong", { text: optLabel("vision", visions[best]).toLowerCase() }), ` : ${optFr("vision", visions[best]).replace(/^./, (c) => c.toLowerCase())} `, infoBtn("visions")) : null,
    el("h3", { text: "Les auteurs des tweets" }),
    el("div", { class: "table-view" }, el("table", { class: "small-table" }, el("tbody", {}, P.rounds.map((r) => el("tr", {},
      el("td", { text: r.it.t.slice(0, 90) + (r.it.t.length > 90 ? "…" : "") }), el("td", {}, el("span", { class: "who-inline" }, avatar(r.it.c, 20), candName(r.it.c))),
      el("td", { text: r.r === 1 ? "D'accord" : r.r === 0 ? "Partagé" : r.r === -1 ? "Pas d'accord" : "Passé" })))))),
    el("p", { class: "disclaimer", text: "Jeu pédagogique : il compare vos réactions à douze tweets avec le discours tenu sur X par chaque candidat, sur la position, la vision de l'écologie et le cadrage. Ce n'est ni un sondage ni un conseil de vote. Rien n'est enregistré : tout se passe dans votre navigateur." }),
    endLinks(), el("button", { class: "primary-btn", type: "button", text: "Rejouer avec d'autres tweets", onclick: () => startGame("situer") })));
}

async function renderJouer(panel) {
  panel.replaceChildren(el("p", { class: "empty", text: "Chargement des jeux…" }));
  await loadGames();
  if (S.tab !== "jouer") return;
  if (S.play) { ({ qui: renderQui, agent: renderAgent, situer: renderSituer })[S.play.key](panel); return; }
  const n = S.games.items.length;
  panel.replaceChildren(el("div", { class: "section-intro" }, el("h2", { text: "Jouer avec le discours" }),
    el("p", { text: "Trois jeux pour s'exercer à lire un discours politique comme le font les chercheurs. Les tweets sont anonymisés : noms, partis et hashtags trop reconnaissables sont retirés. Rien n'est enregistré." })),
    el("div", { class: "game-cards" }, GAMES.map((g) => el("div", { class: "game-card" }, el("h3", { text: g.title }), el("p", { text: g.text }),
      el("button", { class: "primary-btn", type: "button", text: "Jouer", disabled: n < 4 ? true : null, onclick: () => startGame(g.key) })))),
    n < 4 ? el("p", { class: "note-small", text: "Les jeux ouvriront dès que la collecte aura réuni assez de tweets écologie." }) : null);
}

/* =================================================================== navigation */
const TABS = ["apercu", "discours", "mots", "tweets", "jouer", "methode"];
function go(tab, sub) { location.hash = sub ? `${tab}/${sub}` : tab; }
function readHash() {
  const [tab, sub] = location.hash.replace(/^#/, "").split("/");
  S.tab = TABS.includes(tab) ? tab : "apercu";
  if (S.tab === "discours" && sub && S.fw.has(sub)) { if (S.discours !== sub) S.selectedCell = null; S.discours = sub; }
}
function setFilter(changes) {
  Object.assign(S, changes);
  S.x.shown = 15;
  const q = new URLSearchParams();
  if (S.period !== "all") q.set("periode", S.period);
  if (S.bloc) q.set("bloc", S.bloc);
  if (S.focus) q.set("candidat", S.focus);
  history.replaceState(null, "", (q.toString() ? "?" + q : location.pathname) + location.hash);
  $("#f-period").value = S.period; $("#f-bloc").value = S.bloc; $("#f-focus").value = S.focus;
  render();
}
function setupFilters() {
  const params = new URLSearchParams(location.search);
  S.period = S.periods.some((p) => p.key === params.get("periode")) ? params.get("periode") : "all";
  S.bloc = params.get("bloc") || "";
  S.focus = S.cand.has(params.get("candidat")) ? params.get("candidat") : "";
  $("#f-period").replaceChildren(...S.periods.map((p) => option(p.key, p.label, p.key === S.period)));
  $("#f-bloc").replaceChildren(option("", "Toutes", !S.bloc), ...(S.data.study.blocs || []).map((b) => option(b.key, b.label, b.key === S.bloc)));
  $("#f-focus").replaceChildren(option("", "Personne", !S.focus), ...[...S.cands].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((c) => option(c.key, c.name, c.key === S.focus)));
  const on = () => setFilter({ period: $("#f-period").value, bloc: $("#f-bloc").value, focus: $("#f-focus").value });
  ["#f-period", "#f-bloc", "#f-focus"].forEach((s) => $(s).addEventListener("change", on));
}
function render() {
  hideTip(); closePopover();
  $$(".main-tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === S.tab ? "page" : "false"));
  $("#filters").hidden = S.tab === "jouer" || S.tab === "methode";
  for (const p of $$("[data-panel]")) p.hidden = p.dataset.panel !== S.tab;
  const panel = $(`[data-panel="${S.tab}"]`);
  ({ apercu: renderApercu, discours: renderDiscours, mots: renderMots, tweets: renderTweets, jouer: renderJouer, methode: renderMethode })[S.tab](panel);
}

async function main() {
  $("#theme-toggle").addEventListener("click", () => {
    const next = getComputedStyle(document.documentElement).colorScheme.includes("dark") ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) { /* stockage indisponible */ }
  });
  let data;
  try { const r = await fetch("data.json", { cache: "no-cache" }); if (!r.ok) throw new Error(r.status); data = await r.json(); }
  catch (e) { const b = $("#banner"); b.hidden = false; b.textContent = "Les données n'ont pas pu être chargées. Réessayez dans quelques minutes."; return; }
  decode(data);
  $("#updated").textContent = fmtDay(data.generated_at.slice(0, 10));
  $("#updated").setAttribute("datetime", data.generated_at);
  if (!S.tweets.length) { const b = $("#banner"); b.hidden = false; b.textContent = "La première collecte n'a pas encore eu lieu : les graphiques se rempliront après le premier passage quotidien."; }
  setupFilters();
  readHash();
  addEventListener("hashchange", () => { const prev = S.tab; readHash(); if (prev !== S.tab && S.tab !== "jouer") S.play = null; render(); if (prev !== S.tab) scrollTo({ top: 0 }); });
  let lastW = innerWidth;
  addEventListener("resize", debounce(() => { if (innerWidth !== lastW && S.tab === "apercu") { lastW = innerWidth; render(); } }, 200));
  render();
}
main();
