// Markdown Viewer — front end. Rendering happens in Rust; this file only
// shows the result and remembers the view settings.

const { invoke, convertFileSrc } = window.__TAURI__.core;
const THEMES = window.THEMES;
const byId = Object.fromEntries(THEMES.map((t) => [t.id, t]));

// ---------- Settings (kept between launches) ----------

const DEFAULTS = { theme: "paper", zoom: 1, breaks: false, starred: [] };

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("settings") || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}
function saveSettings() {
  try { localStorage.setItem("settings", JSON.stringify(settings)); } catch {}
}

const settings = loadSettings();
if (!byId[settings.theme]) settings.theme = DEFAULTS.theme;
if (!Array.isArray(settings.starred)) settings.starred = [];
settings.starred = settings.starred.filter((id) => byId[id]);

// ---------- Elements ----------

const $ = (id) => document.getElementById(id);
const doc = $("doc"), fab = $("fab"), menu = $("menu"), list = $("themes");

// ---------- Applying the view ----------

function applyTheme() {
  const t = byId[settings.theme];
  const s = document.documentElement.style;
  s.setProperty("--bg", t.bg);
  s.setProperty("--fg", t.fg);
  s.setProperty("--muted", t.muted);
  s.setProperty("--accent", t.accent);
  s.setProperty("--code-bg", t.codeBg);
  s.setProperty("--border", t.border);
  s.setProperty("--sel", t.sel);
  s.setProperty("--font", t.font);
  s.setProperty("--head", t.head || t.font);
  s.setProperty("--mono", t.mono || "'Ubuntu Mono', 'DejaVu Sans Mono', monospace");
  s.setProperty("--size", t.size + "px");
  s.setProperty("--lh", t.lh);
  s.colorScheme = t.dark ? "dark" : "light";
}

function applyView() {
  applyTheme();
  document.documentElement.style.setProperty("--zoom", settings.zoom);
  $("zoomval").textContent = Math.round(settings.zoom * 100) + "%";
  $("full").setAttribute("aria-checked", String(!settings.breaks));
  $("breaks").setAttribute("aria-checked", String(settings.breaks));
  for (const row of list.querySelectorAll(".theme")) {
    row.setAttribute("aria-selected", String(row.dataset.id === settings.theme));
  }
}

// ---------- Theme list (starred first) ----------

function themeRow(t) {
  const row = document.createElement("div");
  row.className = "theme";
  row.setAttribute("role", "option");
  row.dataset.id = t.id;

  const sw = document.createElement("span");
  sw.className = "swatch";
  sw.textContent = "Aa";
  sw.style.background = t.bg;
  sw.style.color = t.fg;
  sw.style.fontFamily = t.font;
  sw.style.setProperty("--sw-accent", t.accent);

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = t.name;

  const on = settings.starred.includes(t.id);
  const star = document.createElement("button");
  star.className = "star" + (on ? " on" : "");
  star.textContent = on ? "★" : "☆";
  star.title = on ? "Unstar" : "Star (keeps it at the top)";
  star.setAttribute("aria-label", star.title + ": " + t.name);
  star.addEventListener("click", (e) => {
    e.stopPropagation();
    settings.starred = on
      ? settings.starred.filter((id) => id !== t.id)
      : [...settings.starred, t.id];
    saveSettings();
    buildList();
  });

  row.append(sw, name, star);
  row.addEventListener("click", () => {
    settings.theme = t.id;
    saveSettings();
    applyView();
  });
  return row;
}

function heading(text) {
  const h = document.createElement("h3");
  h.textContent = text;
  return h;
}

function buildList() {
  const scroll = list.scrollTop;
  list.replaceChildren();
  const starred = settings.starred.map((id) => byId[id]);
  const rest = THEMES.filter((t) => !settings.starred.includes(t.id));
  if (starred.length) {
    list.append(heading("Starred"), ...starred.map(themeRow), heading("All themes"));
  }
  list.append(...rest.map(themeRow));
  list.scrollTop = scroll;
  applyView();
}

// ---------- Menu open / close ----------

function setMenu(open) {
  menu.hidden = !open;
  fab.setAttribute("aria-expanded", String(open));
  if (open) list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
}
fab.addEventListener("click", () => setMenu(menu.hidden));
document.addEventListener("pointerdown", (e) => {
  if (!menu.hidden && !menu.contains(e.target) && !fab.contains(e.target)) setMenu(false);
});

// ---------- Tabs and history ----------
// Each tab keeps its own trail of visited files: hist[i] is the file shown.
// The trail is drawn as breadcrumbs; a click on a crumb goes back to it.
// Only the active tab is rendered; the others render when you switch to them.

const start = $("start"), bar = $("top"), tabBar = $("tabs"), crumbs = $("crumbs");
const tabs = [];   // { hist: [{ path, text?, hash, y }], i }  (text = pasted, no file)
let active = -1;
let current = null; // { path, dir } of the rendered file
let seq = 0;        // drops renders that finish after a newer one started

const tab = () => tabs[active];
const entry = () => tab()?.hist[tab().i];
const baseName = (p) => p.split("/").pop();
const label = (h) => h.text != null ? "Pasted" : baseName(h.path).replace(/\.(md|markdown)$/i, "");
const where = (h) => h.text != null ? "Pasted Markdown" : h.path;

function saveScroll() {
  if (entry()) entry().y = window.scrollY;
}

// Go to a file in the active tab (forward entries are dropped, like a browser).
function navigate(path, hash = "") {
  if (!tab()) { newTab(path, hash, true); return; }
  saveScroll();
  const t = tab();
  t.hist.splice(t.i + 1);
  t.hist.push({ path, hash, y: null });
  t.i++;
  show();
}

function newTab(path, hash = "", focus = false) {
  tabs.splice(active + 1, 0, { hist: [{ path, hash, y: null }], i: 0 });
  if (focus || active < 0) { saveScroll(); active++; show(); }
  else drawBar();
}

function goTo(i) {
  const t = tab();
  if (!t || i < 0 || i >= t.hist.length || i === t.i) return;
  saveScroll();
  t.i = i;
  show();
}

function activate(k) {
  if (k < 0 || k >= tabs.length || k === active) return;
  saveScroll();
  active = k;
  show();
}

function closeTab(k) {
  if (tabs.length <= 1) { window.__TAURI__.window.getCurrentWindow().close(); return; }
  if (k !== active) {
    tabs.splice(k, 1);
    if (k < active) active--;
    drawBar();
    return;
  }
  tabs.splice(k, 1);
  active = Math.min(k, tabs.length - 1);
  show();
}

// Tab strip (only with 2+ tabs) and breadcrumbs (only after following a link).
function drawBar() {
  tabBar.replaceChildren(...tabs.map((t, k) => {
    const h = t.hist[t.i];
    const el = document.createElement("div");
    el.className = "tab";
    el.title = where(h);
    el.setAttribute("aria-selected", String(k === active));
    const name = document.createElement("span");
    name.textContent = label(h);
    const x = document.createElement("button");
    x.className = "close";
    x.textContent = "×";
    x.title = "Close tab (Ctrl+W)";
    x.addEventListener("click", (e) => { e.stopPropagation(); closeTab(k); });
    el.append(name, x);
    el.addEventListener("click", () => activate(k));
    el.addEventListener("auxclick", (e) => { if (e.button === 1) closeTab(k); });
    return el;
  }));
  tabBar.hidden = tabs.length < 2;

  const t = tab();
  crumbs.replaceChildren();
  if (t) t.hist.forEach((h, i) => {
    if (i) {
      const sep = document.createElement("span");
      sep.className = "sep";
      sep.textContent = "›";
      crumbs.append(sep);
    }
    const c = document.createElement("button");
    c.className = "crumb" + (i > t.i ? " ahead" : "");
    c.textContent = label(h);
    c.title = where(h);
    if (i === t.i) c.setAttribute("aria-current", "page");
    c.addEventListener("click", () => goTo(i));
    crumbs.append(c);
  });
  crumbs.hidden = !t || t.hist.length < 2;

  bar.hidden = tabBar.hidden && crumbs.hidden;
  crumbs.querySelector("[aria-current]")?.scrollIntoView({ inline: "nearest", block: "nearest" });
  document.documentElement.style.scrollPaddingTop = (bar.hidden ? 0 : bar.offsetHeight) + "px";
}

// ---------- Rendering ----------

// Render the active tab's current file. `y` overrides the remembered scroll.
async function show(y) {
  drawBar();
  const e = entry();
  if (!e) return;
  start.hidden = true;
  doc.hidden = false;
  const n = ++seq;
  try {
    const res = e.text != null
      ? await invoke("render_text", { text: e.text, breaks: settings.breaks })
      : await invoke("render", { path: e.path, breaks: settings.breaks });
    if (n !== seq) return;
    if (e.text == null) e.path = res.path;
    current = { path: res.path, dir: res.dir };
    doc.innerHTML = res.html;
    if (res.dir) fixImages(res.dir);
    addHeadingIds();
  } catch (err) {
    if (n !== seq) return;
    current = null;
    doc.innerHTML = "";
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = String(err);
    doc.append(p);
  }
  const to = y ?? e.y;
  if (to != null) window.scrollTo(0, to);
  else if (e.hash) scrollToId(e.hash);
  else window.scrollTo(0, 0);
}

function scrollToId(id) {
  const el = document.getElementById(id) || document.getElementsByName(id)[0];
  if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
}

function isRelative(url) {
  return url && !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith("#");
}

function resolve(dir, rel) {
  if (rel.startsWith("/")) return rel;
  const parts = (dir + "/" + rel).split("/");
  const out = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p && p !== ".") out.push(p);
  }
  return "/" + out.join("/");
}

// Relative images point next to the .md file on disk.
function fixImages(dir) {
  for (const img of doc.querySelectorAll("img")) {
    const src = img.getAttribute("src");
    if (isRelative(src)) img.src = convertFileSrc(resolve(dir, decodeURI(src)));
  }
}

// GitHub-style ids so in-page links like [x](#some-heading) work.
function addHeadingIds() {
  const seen = {};
  for (const h of doc.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    if (h.id) continue;
    let slug = h.textContent.trim().toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
    if (seen[slug] !== undefined) slug += "-" + ++seen[slug]; else seen[slug] = 0;
    h.id = slug;
  }
}

// ---------- Links ----------
// Click: open here. Ctrl+click or middle click: new tab in the background.
// Ctrl+Shift+click: new tab in front.

function follow(e, inTab) {
  const a = e.target.closest("a");
  if (!a) return;
  const href = a.getAttribute("href") || "";
  e.preventDefault();

  if (href.startsWith("#")) {
    scrollToId(decodeURIComponent(href.slice(1)));
  } else if (/^(https?:|mailto:)/i.test(href)) {
    invoke("open_external", { url: href });
  } else if (current && isRelative(href)) {
    const [rel, hash = ""] = href.split("#");
    const file = decodeURI(rel);
    if (!/\.(md|markdown)$/i.test(file)) return;
    // Pasted text has no folder: only absolute paths can be followed.
    if (!current.dir && !file.startsWith("/")) return;
    const path = resolve(current.dir || "/", file);
    const id = decodeURIComponent(hash);
    if (inTab) newTab(path, id, e.shiftKey);
    else navigate(path, id);
  }
}
doc.addEventListener("click", (e) => { if (e.button === 0) follow(e, e.ctrlKey || e.metaKey); });
doc.addEventListener("auxclick", (e) => { if (e.button === 1) follow(e, true); });
// Middle click must not start autoscroll or paste.
doc.addEventListener("mousedown", (e) => { if (e.button === 1 && e.target.closest("a")) e.preventDefault(); });

// Mouse back / forward buttons.
document.addEventListener("mouseup", (e) => {
  if (e.button === 3) { e.preventDefault(); goTo(tab()?.i - 1); }
  else if (e.button === 4) { e.preventDefault(); goTo(tab()?.i + 1); }
});

// ---------- Controls ----------

function zoomBy(step) {
  settings.zoom = Math.min(2.5, Math.max(0.6, Math.round((settings.zoom + step) * 10) / 10));
  saveSettings(); applyView();
}
$("smaller").addEventListener("click", () => zoomBy(-0.1));
$("bigger").addEventListener("click", () => zoomBy(0.1));

function setBreaks(on) {
  if (settings.breaks === on) return;
  settings.breaks = on;
  saveSettings(); applyView();
  if (entry()) show(window.scrollY);
}
$("full").addEventListener("click", () => setBreaks(false));
$("breaks").addEventListener("click", () => setBreaks(true));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { setMenu(false); return; }
  if (e.altKey && !e.ctrlKey) {
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(tab()?.i - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); goTo(tab()?.i + 1); }
    return;
  }
  if (!e.ctrlKey) return;
  const n = tabs.length;
  if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(0.1); }
  else if (e.key === "-") { e.preventDefault(); zoomBy(-0.1); }
  else if (e.key === "0") { e.preventDefault(); settings.zoom = 1; saveSettings(); applyView(); }
  else if (e.key === "Tab" || e.key === "PageDown" || e.key === "PageUp") {
    e.preventDefault();
    const step = e.key === "PageUp" || (e.key === "Tab" && e.shiftKey) ? -1 : 1;
    if (n > 1) activate((active + step + n) % n);
  }
  else if (e.key === "w") { e.preventDefault(); closeTab(active); }
  else if (e.key === "q") { e.preventDefault(); window.__TAURI__.window.getCurrentWindow().close(); }
});

// Drop a file on the window to open it.
window.__TAURI__.event.listen("tauri://drag-drop", (ev) => {
  const p = ev.payload?.paths?.[0];
  if (p) navigate(p);
});

// ---------- Start ----------

buildList();
// ---------- Paste (start screen when opened without a file) ----------
// Paste Markdown and it opens like a file. There is no editing after that.

const pasteBox = $("paste");

function openPasted(text) {
  if (!text.trim() || tabs.length) return;
  tabs.push({ hist: [{ path: null, text, hash: "", y: null }], i: 0 });
  active = 0;
  show();
}

// Ctrl+V anywhere on the start screen (the box has focus anyway).
document.addEventListener("paste", (e) => {
  if (tabs.length) return;
  e.preventDefault();
  openPasted(e.clipboardData?.getData("text/plain") || "");
});
// Middle-click paste (X primary selection) arrives as an input, not a paste event.
pasteBox.addEventListener("input", (e) => {
  if (/^insertFrom(Paste|Drop)/.test(e.inputType || "")) openPasted(pasteBox.value);
});
// Typed text: Ctrl+Enter shows it.
pasteBox.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); openPasted(pasteBox.value); }
});

invoke("initial_path").then((p) => {
  if (p) navigate(p);
  else { doc.hidden = true; pasteBox.parentElement.hidden = false; pasteBox.focus(); }
});
