#!/usr/bin/env bash
# Build the viewer and make it the default app for .md files (current user only, no sudo).
set -euo pipefail
cd "$(dirname "$0")"

BIN="$HOME/.local/bin/mdview"
ICON="$HOME/.local/share/icons/mdview.png"
DESKTOP="$HOME/.local/share/applications/mdview.desktop"

(cd src-tauri && cargo build --release)

mkdir -p "$(dirname "$BIN")" "$(dirname "$ICON")" "$(dirname "$DESKTOP")"
install -m 755 src-tauri/target/release/mdview "$BIN"
install -m 644 src-tauri/icons/icon.png "$ICON"

cat > "$DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=Markdown Viewer
Comment=Read Markdown files
Exec=$BIN %f
Icon=$ICON
StartupWMClass=mdview
Terminal=false
Categories=Utility;Viewer;
MimeType=text/markdown;text/x-markdown;
EOF

update-desktop-database "$(dirname "$DESKTOP")" 2>/dev/null || true
xdg-mime default mdview.desktop text/markdown text/x-markdown

echo "Installed. Default for .md: $(xdg-mime query default text/markdown)"
