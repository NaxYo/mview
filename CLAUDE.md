# Markdown Viewer (mdview)

The simplest Markdown **viewer** for Ignacio's Ubuntu 22.04 desktop. Tauri 2 app.

## Scope — read this first

It is a VIEWER. Not an editor. Do not add editing, file trees, tabs, sync, export,
plugins or settings screens. Exactly three features:

1. **Double-click a `.md` file → it opens.** The file manager passes the path as the
   first argument; the app renders it. Dropping a file on the window also opens it.
2. **Themes** — presets of colours + fonts + size + line spacing, plus A−/A+ text size.
   The choice is remembered between launches.
3. **Full width / Line breaks switch.** "Full width" joins the file's soft line breaks so
   paragraphs fill the whole window (Claude hard-wraps Markdown at ~80 chars; this undoes
   it). "Line breaks" keeps every line break as in the file. There is never a max-width
   column — text always uses the full window.

Small conveniences that exist and should stay: web links open in the browser, relative
`.md` links open in the same window, relative images display, in-page `#heading` links
work, Ctrl +/−/0 for size, Ctrl W/Q to close.

## How it works

- Rust renders Markdown with `pulldown-cmark` (GFM: tables, task lists, strikethrough,
  footnotes, alerts; YAML front matter hidden). The line-break switch re-renders with soft
  breaks turned into hard breaks.
- Front end is plain HTML/CSS/JS in `src/` — no npm, no bundler, no framework.
- Themes are CSS variable blocks in `src/style.css`; their names are listed in
  `THEMES` in `src/app.js`. Add a theme = add both.
- Settings live in the webview's `localStorage` (under `~/.local/share/dev.nax.mdview/`).
- Raw HTML in Markdown is passed through; the CSP blocks scripts and inline handlers.

## Build and install

```
./install.sh
```

Builds a release binary with plain `cargo` (no Tauri CLI needed), installs it to
`~/.local/bin/mdview`, writes `~/.local/share/applications/mdview.desktop` and sets it as
the default for `text/markdown`. No sudo. A first build takes a few minutes; later builds
are fast.

Quick test without installing: `cd src-tauri && cargo run -- /path/to/file.md`.

## Machine notes

- Ubuntu 22.04, glibc 2.35. Building locally avoids the glibc mismatch that broke the
  prebuilt viewers he tried.
- System libs needed (already installed): libwebkit2gtk-4.1-dev, libgtk-3-dev,
  librsvg2-dev, libssl-dev, build-essential.
