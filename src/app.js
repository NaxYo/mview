// Markdown Viewer — front end. Rendering happens in Rust; this file only
// shows the result and remembers the view settings.

const { invoke, convertFileSrc } = window.__TAURI__.core;

const THEMES = {
  paper: "Paper",
  clean: "Clean",
  night: "Night",
  sepia: "Sepia",
  ember: "Ember (dark serif)",
  terminal: "Terminal",
  large: "Large print",
  compact: "Compact",
};

// ---------- Settings (kept between launches) ----------

const DEFAULTS = { theme: "paper", zoom: 1, breaks: false };

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
if (!THEMES[settings.theme]) settings.theme = DEFAULTS.theme;

// ---------- Elements ----------

const doc = document.getElementById("doc");
const themeSel = document.getElementById("theme");
const wrapBtn = document.getElementById("wrap");

for (const [id, label] of Object.entries(THEMES)) {
  themeSel.add(new Option(label, id));
}

function applyView() {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.style.setProperty("--zoom", settings.zoom);
  themeSel.value = settings.theme;
  wrapBtn.textContent = settings.breaks ? "↵ Line breaks" : "⟷ Full width";
}

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

themeSel.addEventListener("change", () => {
  settings.theme = themeSel.value;
  saveSettings(); applyView();
});

function zoomBy(step) {
  settings.zoom = Math.min(2.5, Math.max(0.6, Math.round((settings.zoom + step) * 10) / 10));
  saveSettings(); applyView();
}
document.getElementById("smaller").addEventListener("click", () => zoomBy(-0.1));
document.getElementById("bigger").addEventListener("click", () => zoomBy(0.1));

wrapBtn.addEventListener("click", () => {
  settings.breaks = !settings.breaks;
  saveSettings(); applyView();
  if (current) open(current.path, true);
});

document.addEventListener("keydown", (e) => {
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

applyView();
invoke("initial_path").then((p) => { if (p) open(p); });
