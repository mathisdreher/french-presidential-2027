"use strict";

/* ------------------------------------------------------------------ utilitaires */
const $ = (sel, root = document) => root.querySelector(sel);
function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "style") node.setAttribute("style", v);
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
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
function weekStart(day) {
  const d = parseDay(day);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return isoDay(d);
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

const SHORT = { po: "position", ca: "cadrage", pl: "polarisation", ad: "adversaire", vi: "victime", ac: "acte_discursif", re: "registre", n: "niveau" };
const NULLISH = new Set(["non_applicable", "aucun", "aucune"]);
const MIN_N = 20;  // en dessous, un pourcentage est signalé comme fragile
const MIN_N_SCALE = 10;  // les lignes plus petites ne fixent pas le haut de l'échelle des heatmaps

/* ------------------------------------------------------------------ état */
const state = {
  data: null, cand: new Map(), labels: {}, themeLabels: {}, periods: [],
  period: "all", bloc: "", focus: "",
  themesTab: "th", discoursTab: "pl",
  x: { cand: "", theme: "", pos: "", cad: "", q: "", sort: "date", shown: 15 },
  tables: new Map(),
};

/* ------------------------------------------------------------------ infobulle */
const tip = () => $("#tooltip");
function showTip(anchor, title, rows, note) {
  const t = tip();
  t.replaceChildren();
  if (title) t.append(el("div", { class: "tt-title", text: title }));
  for (const r of rows) {
    const row = el("div", { class: "tt-row" });
    if (r.key) row.append(el("span", { class: r.keyShape === "swatch" ? "swatch" : "linekey", style: `background:${r.key}` }));
    row.append(el("strong", { text: r.value }), el("span", { text: r.label }));
    t.append(row);
  }
  if (note) t.append(el("div", { class: "tt-note", text: note }));
  t.hidden = false;
  let x, y;
  if (anchor instanceof Event && anchor.clientX !== undefined && anchor.type !== "focus") { x = anchor.clientX; y = anchor.clientY; }
  else { const r = (anchor.currentTarget || anchor.target || anchor).getBoundingClientRect(); x = r.left + r.width / 2; y = r.bottom; }
  const w = t.offsetWidth, h = t.offsetHeight;
  let left = x + 14, top = y + 14;
  if (left + w > window.innerWidth - 8) left = Math.max(8, x - w - 14);
  if (top + h > window.innerHeight - 8) top = Math.max(8, y - h - 14);
  t.style.left = left + "px"; t.style.top = top + "px";
}
function hideTip() { tip().hidden = true; }
function hoverable(node, build) {
  node.tabIndex = 0;
  const on = (e) => { const b = build(); showTip(e, b.title, b.rows, b.note); };
  node.addEventListener("pointermove", on);
  node.addEventListener("focus", on);
  node.addEventListener("pointerleave", hideTip);
  node.addEventListener("blur", hideTip);
}

/* ------------------------------------------------------------------ tableaux */
function setTable(cardId, headers, rows) {
  state.tables.set(cardId, { headers, rows });
  const card = document.getElementById(cardId);
  const btn = card.querySelector(".table-toggle");
  if (btn && btn.getAttribute("aria-expanded") === "true") renderTable(card);
}
function renderTable(card) {
  const view = card.querySelector(".table-view");
  const spec = state.tables.get(card.id);
  view.replaceChildren();
  if (!spec || !spec.rows.length) { view.append(el("p", { class: "empty", text: "Aucune donnée pour cette sélection." })); return; }
  const table = el("table");
  table.append(el("thead", {}, el("tr", {}, spec.headers.map((h) => el("th", { class: h.num ? "num" : null, text: h.label })))));
  const body = el("tbody");
  for (const r of spec.rows) body.append(el("tr", {}, r.map((v, i) => el("td", { class: spec.headers[i].num ? "num" : null, text: v }))));
  table.append(body);
  view.append(table);
}
function wireTableToggles() {
  document.querySelectorAll(".table-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "Masquer le tableau" : "Tableau";
      const view = card.querySelector(".table-view");
      view.hidden = !open;
      if (open) renderTable(card);
    });
  });
}

/* ------------------------------------------------------------------ données */
function indexData(data) {
  state.data = data;
  for (const c of data.candidates) state.cand.set(c.key, c);
  for (const v of data.codebook.variables) {
    state.labels[v.key] = {};
    for (const o of v.options || []) state.labels[v.key][o.key] = o.label;
  }
  for (const t of data.codebook.themes) state.themeLabels[t.key] = t.label;

  const anchor = (data.generated_at || new Date().toISOString()).slice(0, 10);
  const minus = (n) => { const d = parseDay(anchor); d.setUTCDate(d.getUTCDate() - n + 1); return isoDay(d); };
  state.periods = [
    { key: "all", label: `Toute l'étude (depuis le ${fmtDay(data.study.start)})`, start: data.study.start, end: null },
    { key: "d90", label: "90 derniers jours", start: minus(90), end: anchor },
    { key: "d30", label: "30 derniers jours", start: minus(30), end: anchor },
    { key: "d7", label: "7 derniers jours", start: minus(7), end: anchor },
    ...(data.study.phases || []).map((p) => ({ key: p.key, label: `${p.label} (${fmtShort(p.start)} – ${fmtShort(p.end)})`, start: p.start, end: p.end })),
  ];
}
const lab = (variable, key) => (state.labels[variable] || {})[key] || key || "–";
const candName = (k) => (state.cand.get(k) || { name: k }).name;

function filtered() {
  const p = state.periods.find((x) => x.key === state.period) || state.periods[0];
  return state.data.tweets.filter((t) => {
    if (p.start && t.d < p.start) return false;
    if (p.end && t.d > p.end) return false;
    if (state.bloc) { const c = state.cand.get(t.c); if (!c || c.bloc !== state.bloc) return false; }
    return true;
  });
}
function byCandidate(tweets) {
  const m = new Map();
  for (const t of tweets) {
    let s = m.get(t.c);
    if (!s) { s = { key: t.c, n: 0, eco: 0, fav: 0, neu: 0, cri: 0, tweets: [] }; m.set(t.c, s); }
    s.n++; s.tweets.push(t);
    if (t.e) {
      s.eco++;
      if (t.po === "favorable_transition") s.fav++;
      else if (t.po === "critique_ecologie") s.cri++;
      else s.neu++;
    }
  }
  return [...m.values()].sort((a, b) => b.eco / b.n - a.eco / a.n || b.n - a.n);
}

/* ------------------------------------------------------------------ filtres */
function option(value, label, selected) { return el("option", { value, selected: selected ? true : null, text: label }); }
function setupFilters() {
  const params = new URLSearchParams(location.search);
  state.period = state.periods.some((p) => p.key === params.get("periode")) ? params.get("periode") : "all";
  state.bloc = params.get("bloc") || "";
  state.focus = state.cand.has(params.get("candidat")) ? params.get("candidat") : "";

  $("#f-period").replaceChildren(...state.periods.map((p) => option(p.key, p.label, p.key === state.period)));
  $("#f-bloc").replaceChildren(option("", "Toutes", !state.bloc), ...(state.data.study.blocs || []).map((b) => option(b.key, b.label, b.key === state.bloc)));
  const cands = [...state.cand.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  $("#f-focus").replaceChildren(option("", "Personne", !state.focus), ...cands.map((c) => option(c.key, c.name, c.key === state.focus)));

  const onChange = () => {
    state.period = $("#f-period").value; state.bloc = $("#f-bloc").value; state.focus = $("#f-focus").value;
    state.x.shown = 15;
    const q = new URLSearchParams();
    if (state.period !== "all") q.set("periode", state.period);
    if (state.bloc) q.set("bloc", state.bloc);
    if (state.focus) q.set("candidat", state.focus);
    history.replaceState(null, "", q.toString() ? "?" + q : location.pathname);
    renderAll();
  };
  ["#f-period", "#f-bloc", "#f-focus"].forEach((s) => $(s).addEventListener("change", onChange));
}

/* ------------------------------------------------------------------ chiffres clés */
function renderKpis(tweets) {
  const eco = tweets.filter((t) => t.e);
  const cri = eco.filter((t) => t.po === "critique_ecologie").length;
  const active = new Set(tweets.map((t) => t.c)).size;
  const tile = (label, value, note, hero) => el("div", { class: "kpi" + (hero ? " hero" : "") },
    el("p", { class: "label", text: label }), el("p", { class: "value", text: value }), note ? el("p", { class: "note", text: note }) : null);
  $("#kpis").replaceChildren(
    tile("Part des tweets qui parlent d'écologie", tweets.length ? pct(eco.length / tweets.length) : "–", `${num(eco.length)} sur ${num(tweets.length)} tweets`, true),
    tile("Tweets analysés", num(tweets.length), `${active} candidat${active > 1 ? "s" : ""} actif${active > 1 ? "s" : ""}`),
    tile("Tweets écologie", num(eco.length)),
    tile("Critiques de l'écologie", eco.length ? pct(cri / eco.length) : "–", "parmi les tweets écologie"),
  );
}

/* ------------------------------------------------------------------ saillance */
function renderSaillance(stats) {
  const box = $("#saillance-chart");
  box.replaceChildren();
  if (!stats.length) { box.append(el("p", { class: "empty", text: "Aucun tweet sur cette période." })); setTable("saillance", [], []); return; }
  const max = Math.max(...stats.map((s) => s.eco / s.n), 0.0001);
  const grid = el("div", { class: "bars" });
  for (const s of stats) {
    const share = s.eco / s.n;
    const focus = state.focus === s.key;
    const dim = state.focus && !focus;
    const track = el("div", { class: "bar-track", "aria-label": `${candName(s.key)} : ${pct(share)} (${s.eco} sur ${s.n})` },
      el("div", { class: "bar" + (dim ? " dim" : ""), style: `width:${(share / max) * 82}%` }),
      el("span", { class: "bar-value", text: pct(share) }));
    hoverable(track, () => ({
      title: candName(s.key),
      rows: [{ value: pct(share), label: "des tweets parlent d'écologie" }, { value: num(s.eco), label: `tweets écologie sur ${num(s.n)}` }],
      note: s.n < MIN_N ? "Moins de 20 tweets : pourcentage fragile." : null,
    }));
    grid.append(el("div", { class: "bar-row" + (focus ? " is-focus" : "") },
      el("div", { class: "bar-name", title: candName(s.key) }, candName(s.key), el("small", { text: s.n < MIN_N ? `n=${s.n}` : "" })), track));
  }
  box.append(grid);
  setTable("saillance", [{ label: "Candidat" }, { label: "Tweets", num: true }, { label: "Tweets écologie", num: true }, { label: "Part", num: true }],
    stats.map((s) => [candName(s.key), num(s.n), num(s.eco), pct(s.eco / s.n)]));
}

/* ------------------------------------------------------------------ position */
function renderPosition(stats) {
  $("#position-legend").replaceChildren(
    el("span", { class: "key" }, el("span", { class: "swatch", style: "background:var(--accent-2)" }), "Critique de l'écologie"),
    el("span", { class: "key" }, el("span", { class: "swatch", style: "background:var(--neutral-mark)" }), "Neutre"),
    el("span", { class: "key" }, el("span", { class: "swatch", style: "background:var(--accent)" }), "Favorable à la transition"));
  const box = $("#position-chart");
  box.replaceChildren();
  const rows = stats.filter((s) => s.eco >= 3).map((s) => ({ ...s, f: s.fav / s.eco, u: s.neu / s.eco, c: s.cri / s.eco }))
    .sort((a, b) => (b.f - b.c) - (a.f - a.c));
  const excluded = stats.filter((s) => s.eco > 0 && s.eco < 3).length;
  if (!rows.length) { box.append(el("p", { class: "empty", text: "Pas assez de tweets écologie sur cette période (3 au minimum par candidat)." })); setTable("position", [], []); return; }
  const M = Math.max(...rows.map((r) => Math.max(r.c + r.u / 2, r.f + r.u / 2)), 0.5);
  // % de la piste de chaque côté : on réserve ~40 px aux étiquettes de valeur aux extrémités
  const narrow = window.innerWidth <= 760;
  const trackW = Math.max(140, narrow ? (box.clientWidth - 12) * 0.66 : box.clientWidth - 202);
  const half = Math.min(46, 50 - (40 / trackW) * 100);
  const scale = (x) => (x / M) * half;
  const grid = el("div", { class: "bars" });
  for (const r of rows) {
    const focus = state.focus === r.key;
    const dim = state.focus && !focus;
    const track = el("div", { class: "div-track" + (dim ? " dimmed" : ""), "aria-label": `${candName(r.key)} : ${pct(r.f)} favorable, ${pct(r.u)} neutre, ${pct(r.c)} critique` });
    const nl = 50 - scale(r.u / 2), nr = 50 + scale(r.u / 2);
    if (r.c > 0) track.append(el("div", { class: "seg cri", style: `left:${nl - scale(r.c)}%;width:${scale(r.c)}%` }));
    if (r.u > 0) track.append(el("div", { class: "seg neu", style: `left:${nl}%;width:${nr - nl}%`, "data-r": "" }));
    if (r.f > 0) track.append(el("div", { class: "seg fav", style: `left:${nr}%;width:${scale(r.f)}%` }));
    if (r.c > 0) track.append(el("span", { class: "seg-label", style: `right:${100 - (nl - scale(r.c)) + 1}%`, text: pct(r.c, 0) }));
    if (r.f > 0) track.append(el("span", { class: "seg-label", style: `left:${nr + scale(r.f) + 1}%`, text: pct(r.f, 0) }));
    // arrondis : seulement aux extrémités réelles de la barre
    const segs = track.querySelectorAll(".seg");
    segs.forEach((sg, i) => { sg.style.borderRadius = `${i === 0 ? 4 : 0}px ${i === segs.length - 1 ? 4 : 0}px ${i === segs.length - 1 ? 4 : 0}px ${i === 0 ? 4 : 0}px`; });
    hoverable(track, () => ({
      title: `${candName(r.key)} · ${num(r.eco)} tweets écologie`,
      rows: [
        { value: pct(r.f), label: "favorable", key: "var(--accent)", keyShape: "swatch" },
        { value: pct(r.u), label: "neutre", key: "var(--neutral-mark)", keyShape: "swatch" },
        { value: pct(r.c), label: "critique", key: "var(--accent-2)", keyShape: "swatch" },
      ],
      note: r.eco < MIN_N ? "Moins de 20 tweets écologie : répartition fragile." : null,
    }));
    grid.append(el("div", { class: "bar-row" + (focus ? " is-focus" : "") },
      el("div", { class: "bar-name", title: candName(r.key) }, candName(r.key), el("small", { text: `n=${r.eco}` })), track));
  }
  box.append(grid,
    el("div", { class: "div-axis" }, el("span"), el("div", { class: "div-axis-inner" }, el("span", { text: "← plus critique" }), el("span", { text: "plus favorable →" }))));
  if (excluded) box.append(el("p", { class: "note-small", text: `${excluded} candidat${excluded > 1 ? "s" : ""} avec moins de 3 tweets écologie sur la période ne ${excluded > 1 ? "sont" : "est"} pas affiché${excluded > 1 ? "s" : ""}.` }));
  setTable("position", [{ label: "Candidat" }, { label: "Tweets écologie", num: true }, { label: "Favorable", num: true }, { label: "Neutre", num: true }, { label: "Critique", num: true }],
    rows.map((r) => [candName(r.key), num(r.eco), pct(r.f), pct(r.u), pct(r.c)]));
}

/* ------------------------------------------------------------------ évolution */
function weekly(tweets) {
  const m = new Map();
  for (const t of tweets) {
    const w = weekStart(t.d);
    const s = m.get(w) || { n: 0, eco: 0 };
    s.n++; s.eco += t.e; m.set(w, s);
  }
  return m;
}
function niceMax(v) {
  const steps = [0.04, 0.08, 0.12, 0.2, 0.4, 0.6, 0.8, 1];  // 4 graduations rondes
  return steps.find((s) => s >= v) || 1;
}
function renderEvolution(tweets) {
  const box = $("#evolution-chart");
  box.replaceChildren();
  const legend = $("#evolution-legend");
  if (!tweets.length) { legend.replaceChildren(); box.append(el("p", { class: "empty", text: "Aucun tweet sur cette période." })); setTable("evolution", [], []); return; }
  const all = weekly(tweets);
  const weeks = [...all.keys()].sort();
  // compléter les semaines manquantes
  const full = [];
  for (let d = parseDay(weeks[0]); isoDay(d) <= weeks[weeks.length - 1]; d.setUTCDate(d.getUTCDate() + 7)) full.push(isoDay(d));
  const series = [{ key: "all", name: state.bloc ? "Famille sélectionnée" : "Ensemble des candidats", data: all, color: state.focus ? "var(--muted)" : "var(--accent)" }];
  if (state.focus) series.push({ key: state.focus, name: candName(state.focus), data: weekly(tweets.filter((t) => t.c === state.focus)), color: "var(--accent)" });
  legend.replaceChildren(...(series.length > 1 ? series.map((s) => el("span", { class: "key" }, el("span", { class: "linekey", style: `background:${s.color}` }), s.name)) : []));

  const W = Math.max(320, box.clientWidth || 640), H = 280;
  const m = { t: 22, r: 16, b: 28, l: 44 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const values = series.flatMap((s) => full.map((w) => s.data.get(w)).filter(Boolean).map((v) => v.eco / v.n));
  const ymax = niceMax(Math.max(...values, 0.01) * 1.08);
  const x = (i) => m.l + (full.length === 1 ? iw / 2 : (i / (full.length - 1)) * iw);
  const y = (v) => m.t + ih - (v / ymax) * ih;
  const root = svg("svg", { class: "line-chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Part des tweets écologie par semaine" });

  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = (ymax * i) / ticks;
    root.append(svg("line", { class: i === 0 ? "base-line" : "grid-line", x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
    const tx = svg("text", { class: "axis-text", x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }); tx.textContent = pct(v, 0); root.append(tx);
  }
  const every = Math.max(1, Math.ceil(full.length / Math.floor(iw / 70)));
  full.forEach((w, i) => {
    if (i % every) return;
    const tx = svg("text", { class: "axis-text", x: x(i), y: H - 8, "text-anchor": "middle" }); tx.textContent = fmtShort(w); root.append(tx);
  });
  // événements
  let lastEventX = -1e9;
  for (const ev of state.data.study.events || []) {
    const w = weekStart(ev.date);
    const i = full.indexOf(w);
    if (i < 0) continue;
    const ex = x(i);
    root.append(svg("line", { class: "event-line", x1: ex, x2: ex, y1: m.t - 6, y2: m.t + ih }));
    if (ex - lastEventX > 110) {
      const anchorEnd = ex > W - 120;
      const tx = svg("text", { class: "event-text", x: anchorEnd ? ex - 4 : ex + 4, y: m.t - 8, "text-anchor": anchorEnd ? "end" : "start" });
      tx.textContent = ev.label; root.append(tx); lastEventX = ex;
    }
  }
  // courbes
  const ends = [];
  for (const s of series) {
    let d = "", pen = false, last = null;
    full.forEach((w, i) => {
      const v = s.data.get(w);
      if (!v) { pen = false; return; }
      const px = x(i), py = y(v.eco / v.n);
      d += (pen ? "L" : "M") + px.toFixed(1) + "," + py.toFixed(1);
      pen = true; last = { px, py, v, i };
    });
    root.append(svg("path", { class: "series", d, style: `stroke:${s.color}` }));
    if (last) {
      root.append(svg("circle", { cx: last.px, cy: last.py, r: 4, style: `fill:${s.color};stroke:var(--surface);stroke-width:2` }));
      ends.push({ ...last, s });
    }
  }
  // étiquettes de fin, seulement si elles ne se chevauchent pas
  const collide = ends.length > 1 && Math.abs(ends[0].py - ends[1].py) < 16;
  if (!collide) for (const e of ends) {
    const right = e.px > W - 130;
    const tx = svg("text", { class: "end-label", x: right ? e.px - 8 : e.px + 8, y: e.py - 8, "text-anchor": right ? "end" : "start" });
    tx.textContent = pct(e.v.eco / e.v.n, 0); root.append(tx);
  }
  // réticule
  const cross = svg("line", { class: "crosshair", y1: m.t, y2: m.t + ih, visibility: "hidden" });
  const hit = svg("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent", tabindex: 0 });
  root.append(cross, hit);
  const at = (i) => {
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
    const w = full[i];
    return {
      title: `Semaine du ${fmtDay(w)}`,
      rows: series.map((s) => { const v = s.data.get(w); return { value: v ? pct(v.eco / v.n) : "–", label: v ? `${s.name} (${v.eco}/${v.n})` : `${s.name} (aucun tweet)`, key: s.color }; }),
    };
  };
  let cur = full.length - 1;
  hit.addEventListener("pointermove", (e) => {
    const r = root.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    cur = Math.max(0, Math.min(full.length - 1, Math.round(((px - m.l) / iw) * (full.length - 1))));
    const b = at(cur); showTip(e, b.title, b.rows);
  });
  hit.addEventListener("pointerleave", () => { hideTip(); cross.setAttribute("visibility", "hidden"); });
  hit.addEventListener("focus", (e) => { const b = at(cur); showTip(e, b.title, b.rows); });
  hit.addEventListener("blur", () => { hideTip(); cross.setAttribute("visibility", "hidden"); });
  hit.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault(); cur = Math.max(0, Math.min(full.length - 1, cur + (e.key === "ArrowRight" ? 1 : -1)));
    const b = at(cur); showTip(hit, b.title, b.rows);
  });
  box.append(root);
  setTable("evolution", [{ label: "Semaine" }, ...series.flatMap((s) => [{ label: `${s.name} : tweets`, num: true }, { label: "part écologie", num: true }])],
    full.map((w) => [fmtDay(w), ...series.flatMap((s) => { const v = s.data.get(w); return v ? [num(v.n), pct(v.eco / v.n)] : ["0", "–"]; })]));
}

/* ------------------------------------------------------------------ heatmaps */
const THEME_TABS = [
  { key: "th", label: "Thèmes", variable: "themes" },
  { key: "ca", label: "Cadrage", variable: "cadrage" },
  { key: "ac", label: "Acte de discours", variable: "acte_discursif" },
  { key: "re", label: "Registre", variable: "registre" },
];
const DISCOURS_TABS = [
  { key: "pl", label: "Polarisation", variable: "polarisation" },
  { key: "ad", label: "Adversaire désigné", variable: "adversaire" },
  { key: "vi", label: "Victime désignée", variable: "victime" },
  { key: "ac", label: "Acte de discours", variable: "acte_discursif" },
  { key: "re", label: "Registre", variable: "registre" },
];
function columnsFor(tab) {
  if (tab.variable === "themes") return state.data.codebook.themes.map((t) => ({ key: t.key, label: t.label }));
  const v = state.data.codebook.variables.find((x) => x.key === tab.variable);
  return (v.options || []).filter((o) => !NULLISH.has(o.key)).map((o) => ({ key: o.key, label: o.label }));
}
function renderTabs(containerId, tabs, current, onPick) {
  const box = $(containerId);
  box.replaceChildren(...tabs.map((t) => el("button", {
    class: "tab", type: "button", role: "tab", "aria-selected": String(t.key === current), text: t.label,
    onclick: () => onPick(t.key),
  })));
}
function renderHeat(cardId, stats, tab, ecologyOnly) {
  const box = $(`#${cardId}-chart`);
  box.replaceChildren();
  const cols = columnsFor(tab);
  const rows = stats.map((s) => {
    const pool = ecologyOnly ? s.tweets.filter((t) => t.e) : s.tweets;
    const counts = Object.fromEntries(cols.map((c) => [c.key, 0]));
    for (const t of pool) {
      if (tab.key === "th") (t.th || []).forEach((k) => { if (k in counts) counts[k]++; });
      else if (t[tab.key] in counts) counts[t[tab.key]]++;
    }
    return { key: s.key, n: pool.length, counts };
  }).filter((r) => r.n > 0);
  if (!rows.length) { box.append(el("p", { class: "empty", text: ecologyOnly ? "Aucun tweet écologie sur cette période." : "Aucun tweet sur cette période." })); setTable(cardId, [], []); return; }
  const scaleRows = rows.some((r) => r.n >= MIN_N_SCALE) ? rows.filter((r) => r.n >= MIN_N_SCALE) : rows;
  const max = Math.max(...scaleRows.flatMap((r) => cols.map((c) => r.counts[c.key] / r.n)), 0.0001);
  const q = (v) => (v <= 0 ? 0 : Math.min(6, Math.ceil((v / max) * 7) - 1));
  const clamped = rows.length !== scaleRows.length;
  const grid = el("div", { class: "heat", style: `--cols:${cols.length}` });
  grid.append(el("div"));
  cols.forEach((c) => grid.append(el("div", { class: "col-head", title: c.label, text: c.label })));
  for (const r of rows) {
    const focus = state.focus === r.key;
    grid.append(el("div", { class: "row-head" + (focus ? " is-focus" : "") + (r.n < MIN_N_SCALE ? " small-n" : ""), title: candName(r.key) }, candName(r.key), el("small", { text: `n=${r.n}` })));
    for (const c of cols) {
      const v = r.counts[c.key] / r.n;
      const cell = el("div", { class: `cell q${q(v)}` + (state.focus && !focus ? " dim" : ""), "aria-label": `${candName(r.key)}, ${c.label} : ${pct(v)}` });
      hoverable(cell, () => ({
        title: `${candName(r.key)} · ${c.label}`,
        rows: [{ value: pct(v), label: ecologyOnly ? "des tweets écologie" : "des tweets" }, { value: num(r.counts[c.key]), label: `tweets sur ${num(r.n)}` }],
        note: r.n < MIN_N ? "Moins de 20 tweets : pourcentage fragile." : null,
      }));
      grid.append(cell);
    }
  }
  const steps = el("span", { class: "steps" }, [0, 1, 2, 3, 4, 5, 6].map((i) => el("span", { class: `q${i}` })));
  const notes = [tab.key === "th" ? "Un tweet peut aborder plusieurs thèmes." : null,
    clamped ? `Lignes en gris : moins de ${MIN_N_SCALE} tweets, exclues du calcul du maximum de l'échelle.` : null].filter(Boolean);
  box.append(grid,
    el("div", { class: "scale" }, el("span", { text: "0\u202f%" }), steps, el("span", { text: (clamped ? "\u2265\u202f" : "") + pct(max, 0) })),
    ...(notes.length ? [el("p", { class: "note-small", text: notes.join(" ") })] : []));
  setTable(cardId, [{ label: "Candidat" }, { label: "Tweets", num: true }, ...cols.map((c) => ({ label: c.label, num: true }))],
    rows.map((r) => [candName(r.key), num(r.n), ...cols.map((c) => pct(r.counts[c.key] / r.n))]));
}

/* ------------------------------------------------------------------ explorateur */
function setupExplorer() {
  const cands = [...state.cand.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  $("#x-cand").replaceChildren(option("", "Tous"), ...cands.map((c) => option(c.key, c.name)));
  $("#x-theme").replaceChildren(option("", "Tous"), ...state.data.codebook.themes.map((t) => option(t.key, t.label)));
  const optsOf = (v) => (state.data.codebook.variables.find((x) => x.key === v).options || []).filter((o) => !NULLISH.has(o.key));
  $("#x-pos").replaceChildren(option("", "Toutes"), ...optsOf("position").map((o) => option(o.key, o.label)));
  $("#x-cad").replaceChildren(option("", "Tous"), ...optsOf("cadrage").map((o) => option(o.key, o.label)));
  const sync = () => {
    Object.assign(state.x, { cand: $("#x-cand").value, theme: $("#x-theme").value, pos: $("#x-pos").value, cad: $("#x-cad").value, q: $("#x-q").value.trim().toLowerCase(), sort: $("#x-sort").value, shown: 15 });
    renderExplorer(filtered());
  };
  ["#x-cand", "#x-theme", "#x-pos", "#x-cad", "#x-sort"].forEach((s) => $(s).addEventListener("change", sync));
  $("#x-q").addEventListener("input", debounce(sync, 200));
  $("#x-more").addEventListener("click", () => { state.x.shown += 15; renderExplorer(filtered()); });
}
const POS_COLOR = { favorable_transition: "var(--accent)", critique_ecologie: "var(--accent-2)", neutre: "var(--neutral-mark)" };
function renderExplorer(tweets) {
  const x = state.x;
  let list = tweets.filter((t) => t.e && (!x.cand || t.c === x.cand) && (!x.theme || (t.th || []).includes(x.theme))
    && (!x.pos || t.po === x.pos) && (!x.cad || t.ca === x.cad)
    && (!x.q || (t.t || "").toLowerCase().includes(x.q) || (t.rs || "").toLowerCase().includes(x.q)));
  list = list.sort(x.sort === "likes" ? (a, b) => b.l - a.l : (a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
  $("#explorer-sub").textContent = `${num(list.length)} tweet${list.length > 1 ? "s" : ""} écologie correspondant à la sélection. Les filtres ci-dessous s'ajoutent à la période et à la famille politique.`;
  const ol = $("#x-list");
  ol.replaceChildren();
  if (!list.length) ol.append(el("li", { class: "empty", text: "Aucun tweet ne correspond." }));
  for (const t of list.slice(0, x.shown)) {
    const c = state.cand.get(t.c) || { name: t.c, handle: t.c };
    const chips = el("div", { class: "chips" });
    if (t.po) chips.append(el("span", { class: "chip" }, el("span", { class: "dot", style: `background:${POS_COLOR[t.po] || "var(--muted)"}` }), lab("position", t.po)));
    (t.th || []).forEach((k) => chips.append(el("span", { class: "chip", text: state.themeLabels[k] || k })));
    if (t.ca && !NULLISH.has(t.ca)) chips.append(el("span", { class: "chip", text: "Cadrage : " + lab("cadrage", t.ca) }));
    if (t.ad && !NULLISH.has(t.ad)) chips.append(el("span", { class: "chip", text: "Adversaire : " + lab("adversaire", t.ad) }));
    (t.lx || []).forEach((w) => chips.append(el("span", { class: "chip lex", text: `« ${w} »` })));
    const src = t.s === "c" ? "Codé par Claude" : "Codé par Jev";
    const foot = [src, t.p !== undefined ? `p(écologie) = ${F2.format(t.p)}` : null, t.im ? `Implicite : ${t.im}` : null].filter(Boolean).join(" · ");
    ol.append(el("li", { class: "tweet" },
      el("div", { class: "tweet-head" }, el("strong", { text: c.name }), el("span", { text: fmtDay(t.d) }), el("span", { text: `${num(t.l)} j'aime` }),
        el("a", { href: `https://x.com/${c.handle}/status/${t.i}`, target: "_blank", rel: "noopener", text: "Voir sur X" })),
      el("p", { class: "tweet-text", text: t.t || "" }),
      t.rs ? el("p", { class: "tweet-resume", text: t.rs }) : null,
      chips,
      el("div", { class: "tweet-foot", text: foot })));
  }
  $("#x-more").hidden = list.length <= x.shown;
}

/* ------------------------------------------------------------------ fiabilité */
const VAR_LABEL = (k) => (state.data.codebook.variables.find((v) => v.key === k) || { label: k }).label;
function statusOf(alpha) {
  if (alpha === null || alpha === undefined) return el("span", { class: "status", text: "–" });
  if (alpha >= 0.8) return el("span", { class: "status good" }, el("span", { class: "ico", text: "✓" }), "fiable");
  if (alpha >= 0.667) return el("span", { class: "status warning" }, el("span", { class: "ico", text: "~" }), "à confirmer");
  return el("span", { class: "status critical" }, el("span", { class: "ico", text: "✕" }), "insuffisant");
}
function agreementTable(ev) {
  const fmt = (v) => (v === null || v === undefined ? "–" : F2.format(v));
  const table = el("table");
  table.append(el("thead", {}, el("tr", {}, ["Variable", "n", "Accord", "Kappa", "Alpha", "Lecture"].map((h, i) => el("th", { class: i && i < 5 ? "num" : null, text: h })))));
  const body = el("tbody");
  for (const v of ev.variables) body.append(el("tr", {},
    el("td", { text: VAR_LABEL(v.variable) + (v.metrique === "ordinale" ? " (ordinale)" : "") }),
    el("td", { class: "num", text: num(v.n) }), el("td", { class: "num", text: v.accord === null ? "–" : pct(v.accord) }),
    el("td", { class: "num", text: fmt(v.kappa) }), el("td", { class: "num", text: fmt(v.alpha) }), el("td", {}, statusOf(v.alpha))));
  table.append(body);
  return el("div", { class: "table-view" }, table);
}
function renderValidation() {
  const box = $("#validation");
  box.replaceChildren();
  const v = state.data.validation;
  if (!v || !v.double_code || !v.double_code.n) {
    box.append(el("p", { class: "empty", text: "Le double codage par Claude n'a pas encore été lancé. Les résultats affichés reposent sur le seul codage de Jev." }));
    if (v && v.routage) box.append(el("p", { class: "note-small", text: `${num(v.routage.tweets_codes_jev)} tweets codés par Jev, dont ${num(v.routage.incertains_en_attente)} décisions incertaines en attente d'un second codage.` }));
    return;
  }
  const s = v.echantillon.aleatoire;
  const r = v.routage;
  const grid = el("div", { class: "validation-grid" });
  grid.append(el("p", { class: "sub", text: `${num(r.tweets_codes_jev)} tweets codés par Jev, ${num(r.tweets_codes_claude)} par Claude, ${num(r.incertains_en_attente)} décisions incertaines en attente. Lecture de l'alpha de Krippendorff : 0,8 et plus fiable, entre 0,667 et 0,8 à confirmer, en dessous insuffisant.` }));
  if (s && s.n) grid.append(el("div", {}, el("h3", { text: `Échantillon de validation aléatoire (${num(s.n)} tweets)` }), agreementTable(s)));
  grid.append(el("div", {}, el("h3", { text: `Tous les tweets codés par les deux moteurs (${num(v.double_code.n)})` }),
    el("p", { class: "note-small", text: "Inclut les tweets envoyés à Claude parce qu'ils sont incertains : l'accord y est mécaniquement plus faible." }), agreementTable(v.double_code)));
  const cal = (s && s.n ? s : v.double_code).calibration_ecologie;
  if (cal && cal.bins && cal.bins.length) {
    const t = el("table");
    t.append(el("thead", {}, el("tr", {}, ["p(écologie) annoncée par Jev", "Tweets", "p moyenne", "Part jugée écologie par Claude"].map((h, i) => el("th", { class: i ? "num" : null, text: h })))));
    const b = el("tbody");
    cal.bins.forEach((row) => b.append(el("tr", {}, el("td", { text: row.bin.split("-").map((x) => PF.format(+x)).join(" – ") }), el("td", { class: "num", text: num(row.n) }), el("td", { class: "num", text: F2.format(row.p_moyenne) }), el("td", { class: "num", text: pct(row.frequence_observee) }))));
    t.append(b);
    grid.append(el("div", {}, el("h3", { text: "Calibration de Jev" }),
      el("p", { class: "note-small", text: `Une probabilité bien calibrée de 0,7 correspond à 70 % de tweets jugés écologie. Score de Brier : ${cal.brier === null ? "–" : F2.format(cal.brier)} (0 = parfait).` }),
      el("div", { class: "table-view" }, t)));
  }
  box.append(grid);
}

/* ------------------------------------------------------------------ méthode */
function renderCodebook() {
  const box = $("#codebook");
  const parts = [el("p", { class: "note-small", text: "Les définitions sont celles fournies aux modèles, en anglais, langue principale de Jev. Les tweets sont analysés en français." })];
  for (const v of state.data.codebook.variables) {
    const dl = el("dl");
    for (const o of v.options || []) dl.append(el("dt", { text: o.label }), el("dd", { text: o.description }));
    parts.push(el("h3", { text: v.label }), el("p", { class: "note-small", text: v.instructions }), dl);
  }
  const dl = el("dl");
  for (const t of state.data.codebook.themes) dl.append(el("dt", { text: t.label }), el("dd", { text: t.description }));
  parts.push(el("h3", { text: "Thèmes" }), dl);
  box.replaceChildren(...parts);
  $("#m-start").textContent = fmtDay(state.data.study.start);
}

/* ------------------------------------------------------------------ rendu */
function renderAll() {
  hideTip();
  const tweets = filtered();
  const stats = byCandidate(tweets);
  renderKpis(tweets);
  renderSaillance(stats);
  renderPosition(stats);
  renderEvolution(tweets);
  const tTab = THEME_TABS.find((t) => t.key === state.themesTab);
  const dTab = DISCOURS_TABS.find((t) => t.key === state.discoursTab);
  renderTabs("#themes-tabs", THEME_TABS, state.themesTab, (k) => { state.themesTab = k; renderAll(); });
  renderTabs("#discours-tabs", DISCOURS_TABS, state.discoursTab, (k) => { state.discoursTab = k; renderAll(); });
  $("#themes-sub").textContent = `Part des tweets écologie de chaque candidat, par ${tTab.label.toLowerCase()}. Plus la case est foncée, plus la part est élevée.`;
  $("#discours-sub").textContent = `Part de l'ensemble des tweets de chaque candidat, écologie ou non, par ${dTab.label.toLowerCase()}. Les tweets sans catégorie n'ont pas de colonne : une ligne ne totalise donc pas 100 %.`;
  renderHeat("themes", stats, tTab, true);
  renderHeat("discours", stats, dTab, false);
  renderExplorer(tweets);
}

function setupTheme() {
  $("#theme-toggle").addEventListener("click", () => {
    const dark = getComputedStyle(document.documentElement).colorScheme.includes("dark");
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) { /* stockage indisponible */ }
  });
}

async function main() {
  setupTheme();
  wireTableToggles();
  let data;
  try {
    const res = await fetch("data.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
  } catch (e) {
    const b = $("#banner"); b.hidden = false; b.textContent = "Les données n'ont pas pu être chargées. Réessayez dans quelques minutes.";
    return;
  }
  indexData(data);
  $("#updated").textContent = fmtDay(data.generated_at.slice(0, 10));
  $("#updated").setAttribute("datetime", data.generated_at);
  if (!data.tweets.length) {
    const b = $("#banner"); b.hidden = false;
    b.textContent = "La première collecte n'a pas encore eu lieu : les graphiques se rempliront après le premier passage quotidien.";
  }
  setupFilters();
  setupExplorer();
  renderCodebook();
  renderValidation();
  renderAll();
  let lastW = window.innerWidth;
  window.addEventListener("resize", debounce(() => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; const t = filtered(); renderPosition(byCandidate(t)); renderEvolution(t); } }, 150));
}
main();
