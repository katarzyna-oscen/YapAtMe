#!/usr/bin/env bash
#
# Installs YapAtMe as a clickable desktop application (no terminal needed).
# Creates a .desktop entry in ~/.local/share/applications pointing at the
# Node launcher in tools/yapatme.cjs.
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCHER="$PROJECT_ROOT/tools/yapatme.cjs"
APPS_DIR="$HOME/.local/share/applications"
DESKTOP_FILE="$APPS_DIR/yapatme.desktop"

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "Error: 'node' was not found on PATH. Install Node.js first." >&2
  exit 1
fi

# Build the app if there's no production build yet.
if [[ ! -f "$PROJECT_ROOT/dist/index.html" ]]; then
  echo "No build found - running 'npm run build'..."
  (cd "$PROJECT_ROOT" && npm run build)
fi

# Pick an icon if one is available, otherwise fall back to a generic name.
ICON_PATH="utilities-terminal"
for candidate in \
  "$PROJECT_ROOT/build/icon.png" \
  "$PROJECT_ROOT/build/icon.svg" \
  "$PROJECT_ROOT/public/favicon.ico" \
  "$PROJECT_ROOT/public/icon.png"; do
  if [[ -f "$candidate" ]]; then
    ICON_PATH="$candidate"
    break
  fi
done

mkdir -p "$APPS_DIR"

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=YapAtMe
Comment=AI note processing workspace
Exec="$NODE_BIN" "$LAUNCHER"
Icon=$ICON_PATH
Terminal=false
Categories=Office;Utility;
StartupWMClass=YapAtMe
EOF

chmod +x "$LAUNCHER"
chmod 644 "$DESKTOP_FILE"

# Refresh the desktop database so the launcher shows up immediately.
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true
fi

echo "Installed: $DESKTOP_FILE"
echo "Launcher : $LAUNCHER"
echo "Icon     : $ICON_PATH"
echo
echo "YapAtMe should now appear in your applications menu."
echo "Search for 'YapAtMe' and click it - no terminal required."
