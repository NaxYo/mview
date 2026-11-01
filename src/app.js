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

// ---------- Rendering ----------

let current = null; // { path, dir }

async function open(path, keepScroll = false) {
  const y = window.scrollY;
  try {
    const res = await invoke("render", { path, breaks: settings.breaks });
    current = { path: res.path, dir: res.dir };
    doc.innerHTML = res.html;
    fixImages(res.dir);
    addHeadingIds();
    window.scrollTo(0, keepScroll ? y : 0);
  } catch (e) {
    doc.innerHTML = "";
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = String(e);
    doc.append(p);
  }
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

doc.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (!a) return;
  const href = a.getAttribute("href") || "";
  e.preventDefault();

  if (href.startsWith("#")) {
    const id = decodeURIComponent(href.slice(1));
    (document.getElementById(id) || document.getElementsByName(id)[0])?.scrollIntoView();
  } else if (/^(https?:|mailto:)/i.test(href)) {
    invoke("open_external", { url: href });
  } else if (current && isRelative(href)) {
    const file = decodeURI(href.split("#")[0]);
    if (/\.(md|markdown)$/i.test(file)) open(resolve(current.dir, file));
  }
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
  if (current) open(current.path, true);
}
$("full").addEventListener("click", () => setBreaks(false));
$("breaks").addEventListener("click", () => setBreaks(true));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { setMenu(false); return; }
  if (!e.ctrlKey) return;
  if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(0.1); }
  else if (e.key === "-") { e.preventDefault(); zoomBy(-0.1); }
  else if (e.key === "0") { e.preventDefault(); settings.zoom = 1; saveSettings(); applyView(); }
  else if (e.key === "w" || e.key === "q") { e.preventDefault(); window.__TAURI__.window.getCurrentWindow().close(); }
});

// Drop a file on the window to open it.
window.__TAURI__.event.listen("tauri://drag-drop", (ev) => {
  const p = ev.payload?.paths?.[0];
  if (p) open(p);
});

// ---------- Start ----------

buildList();
invoke("initial_path").then((p) => { if (p) open(p); });
