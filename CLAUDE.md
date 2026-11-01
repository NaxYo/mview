# Markdown Viewer (mdview)

The simplest Markdown **viewer** for Ignacio's Ubuntu 22.04 desktop. Tauri 2 app, built
and installed locally. It is the default app for `.md` files on this machine.

## Why it exists

He tried ready-made viewers and rejected all of them: Inkwell (prebuilt for glibc 2.39,
and asks for a paid licence), ReText ("absolutely awful"), Kindling (a novel-writing tool,
not a viewer). So we built our own. **Do not suggest third-party viewers again** — improve
this one.

## Scope — read this first

It is a VIEWER. Not an editor. Do not add editing, file trees, sync, export,
plugins or settings screens. Exactly four features:

1. **Double-click a `.md` file → it opens.** The file manager passes the path as the
   first argument; the app renders it. Dropping a file on the window also opens it.
   Each double-click opens its own window.
2. **Themes** — 25 presets of colours + fonts + size + line spacing, plus A−/A+ text size.
   A star on a theme pins it to the top of the list. Everything is remembered between launches.
3. **Full width / Line breaks switch.** "Full width" joins the file's soft line breaks so
   paragraphs fill the whole window (Claude hard-wraps Markdown at ~80 chars; this undoes
   it). "Line breaks" keeps every line break as in the file. There is never a max-width
   column — text always uses the full window. Do not add one.

4. **Following links: breadcrumbs + tabs** (asked for 2026-11-01). Each tab keeps the trail
   of `.md` links followed in it, shown as breadcrumbs at the top; a click on a crumb goes
   back (later crumbs stay, dimmed, until a new link is followed — browser-style). Ctrl+click
   or middle-click opens a link in a background tab; Ctrl+Shift+click in front. The tab
   strip shows only with 2+ tabs, the breadcrumbs only after a link was followed — a plain
   single file looks exactly as before. Only the active tab is rendered. Tabs are not
   remembered between launches.

All settings sit behind one round "Aa" floating button at the bottom right that opens a
mobile-style menu (text size, Full width / Line breaks, theme list with stars). Esc or a
click outside closes it. Keep it that way — no toolbars, no menu bars, no settings window.

Small conveniences that exist and should stay: web links open in the browser, relative
`.md` links open in the same window, relative images display, in-page `#heading` links
work (also `file.md#heading` across files), Ctrl +/−/0 for size, Ctrl W closes the tab
(the window when it is the last), Ctrl Q closes the window, Ctrl Tab / Ctrl PgUp/PgDn
switch tabs, Alt ←/→ and the mouse back/forward buttons move along the trail.

Not built (on purpose, until he asks): syntax highlighting in code blocks, live reload
when the file changes, table of contents, search, printing/export.

## Files

| Path | What it is |
|---|---|
| `src/index.html` | The page: document area, floating button, menu markup |
| `src/style.css` | Layout, menu styles, Markdown styles. All colours/fonts are CSS variables |
| `src/themes.js` | The theme list (data only) |
| `src/app.js` | Settings, theme menu + stars, rendering calls, links, images, shortcuts |
| `src-tauri/src/main.rs` | Rust: read file + render Markdown, initial path from argv, open web links via `xdg-open` |
| `src-tauri/tauri.conf.json` | Window, CSP, asset protocol (for local images), bundling off |
| `src-tauri/capabilities/default.json` | `core:default` + window close |
| `src-tauri/icons/` | App icon (generated with PIL; brown "M↓" on paper) |
| `install.sh` | Build + install + set as default `.md` app |

## How it works

- Rust renders Markdown with `pulldown-cmark` (GFM: tables, task lists, strikethrough,
  footnotes, alerts; YAML front matter hidden). The line-break switch re-renders with soft
  breaks turned into hard breaks. Rust also sets the window title to the file name.
- Front end is plain HTML/CSS/JS — no npm, no bundler, no framework. Tauri API is used
  through `window.__TAURI__` (`withGlobalTauri: true`).
- Themes are data in `src/themes.js` (`bg, fg, muted, accent, codeBg, border, sel, font,
  head?, mono?, size, lh, dark?`); `app.js` turns the chosen one into CSS variables.
  Add a theme = add one entry. **Never rename an existing id**: ids are stored in settings
  and in the starred list. Fonts are system fonts on this machine (Bitstream Charter,
  Rethink Sans, Ubuntu, P052, C059, URW Bookman, URW Gothic, Rasa, MesloLGS NF, Verdana,
  Georgia, DejaVu…) — check `fc-list` before using a new one.
- Settings: `localStorage` key `settings` = `{ theme, zoom, breaks, starred[] }`, stored
  by WebKit under `~/.local/share/dev.nax.mdview/localstorage/`. Keep new settings
  backward compatible (defaults merged over saved values).
- Raw HTML in Markdown is passed through; the CSP blocks scripts and inline handlers.

## Build, install, test

```
./install.sh
```

Builds a release binary with plain `cargo` (no Tauri CLI, the `custom-protocol` feature is
on in Cargo.toml), installs it to `~/.local/bin/mdview`, writes
`~/.local/share/applications/mdview.desktop` (`Exec=… %f`) and sets it as the default for
`text/markdown` and `text/x-markdown`. No sudo. Clean build ≈ 2.5 min, incremental ≈ 1 min.
Run it after every change — he only uses the app by double-clicking files.

Checking the UI: do **not** click around his real screen with xdotool (dual monitors,
3840×1080; clicks landed in his browser). Instead load `src/` in headless Chrome:
a scratch HTML copy of `index.html` with absolute `file://` paths to the project's
css/js, a `stub.js` defining `window.__TAURI__` (`core.invoke` returning fake
`initial_path`/`render` results, `core.convertFileSrc`, `event.listen`,
`window.getCurrentWindow`), optional `localStorage` seed, and a script that clicks `#fab`
on load. Then:
`google-chrome --headless=new --disable-gpu --allow-file-access-from-files --user-data-dir=<scratch> --window-size=1100,850 --virtual-time-budget=2000 --screenshot=<png> file://<scratch>/index.html`
and read the PNG. Headless screenshots of a scrolled page come out blank: check scroll
behaviour by logging values, not by picture. There is no Xvfb. Do not name a global `top`
in `app.js` (it is `window.top`; the whole script fails).

Rendering check in the real app: `src-tauri/target/release/mdview /path/file.md`, then
capture with `import -window root -crop …` (the reported window geometry is offset by the
client-side shadow, ~45 px).

## Working here

- Commit on `main` after each meaningful change (no branches, no push).
- Keep it small. When a request would grow it beyond a viewer, say so first.
- Machine: Ubuntu 22.04, glibc 2.35 — building locally avoids the glibc problems of
  prebuilt apps. System libs already installed: libwebkit2gtk-4.1-dev, libgtk-3-dev,
  librsvg2-dev, libssl-dev, build-essential. Rust 1.96, Node 22 (not used).
