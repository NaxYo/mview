# mdview

A small, fast Markdown **viewer** for Linux, built with Tauri 2. It is not an editor.

- Double-click a `.md` file to open it, or drop one on the window. Open the app with no
  file to see your recent files, or to paste Markdown.
- 25 themes (colours, fonts, size, line spacing). Star the ones you like.
- **Full width** joins hard-wrapped lines so paragraphs fill the window. **Line breaks**
  keeps them as in the file.
- Follow links to other `.md` files with breadcrumbs to go back. Ctrl+click or
  middle-click opens them in tabs.
- When the open file changes on disk, a ↻ button appears. Click it to reload.

All settings sit behind the round **Aa** button at the bottom right.

## Install

Needs Rust and the Tauri system libraries (`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`,
`librsvg2-dev`, `libssl-dev`, `build-essential`).

```
./install.sh
```

This builds a release binary, installs it to `~/.local/bin/mdview`, adds a desktop entry
and makes it the default app for Markdown files. It does not need sudo.

## Shortcuts

| Keys | Action |
|---|---|
| Ctrl + / − / 0 | Text size |
| F5, Ctrl+R | Reload |
| Alt ← / → | Back / forward |
| Ctrl+Tab, Ctrl+PgUp/PgDn | Switch tabs |
| Ctrl+W | Close tab (window when it is the last) |
| Ctrl+Q | Close window |
