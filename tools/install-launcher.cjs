#!/usr/bin/env node
/*
 * Cross-platform clickable-launcher installer for YapAtMe.
 *
 *   - Linux : writes a .desktop entry into ~/.local/share/applications
 *             (delegates to tools/install-desktop.sh).
 *   - macOS : creates a YapAtMe.app bundle in ~/Applications that runs the
 *             Node launcher, so it can be opened from Spotlight/Finder/Dock.
 *
 * Windows users can launch with `npm run app:launch` or a shortcut to
 * `node tools/yapatme.cjs`.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const LAUNCHER = path.join(PROJECT_ROOT, 'tools', 'yapatme.cjs');

function findNode() {
  return process.execPath || 'node';
}

function ensureBuild() {
  if (!fs.existsSync(path.join(PROJECT_ROOT, 'dist', 'index.html'))) {
    console.log("No build found - running 'npm run build'...");
    execFileSync('npm', ['run', 'build'], { cwd: PROJECT_ROOT, stdio: 'inherit' });
  }
}

function installLinux() {
  execFileSync('bash', [path.join(PROJECT_ROOT, 'tools', 'install-desktop.sh')], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });
}

function installMac() {
  ensureBuild();
  const node = findNode();
  const appsDir = path.join(os.homedir(), 'Applications');
  const appDir = path.join(appsDir, 'YapAtMe.app');
  const macOsDir = path.join(appDir, 'Contents', 'MacOS');
  const resDir = path.join(appDir, 'Contents', 'Resources');
  fs.mkdirSync(macOsDir, { recursive: true });
  fs.mkdirSync(resDir, { recursive: true });

  // Launcher executable inside the bundle.
  const runScript = `#!/bin/bash
exec "${node}" "${LAUNCHER}"
`;
  const runPath = path.join(macOsDir, 'YapAtMe');
  fs.writeFileSync(runPath, runScript);
  fs.chmodSync(runPath, 0o755);

  // Minimal Info.plist.
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>YapAtMe</string>
  <key>CFBundleDisplayName</key><string>YapAtMe</string>
  <key>CFBundleIdentifier</key><string>com.yapatme.app</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>YapAtMe</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`;
  fs.writeFileSync(path.join(appDir, 'Contents', 'Info.plist'), plist);

  // Optional icon, if provided.
  const iconCandidate = path.join(PROJECT_ROOT, 'build', 'icon.icns');
  if (fs.existsSync(iconCandidate)) {
    fs.copyFileSync(iconCandidate, path.join(resDir, 'icon.icns'));
  }

  console.log(`Installed: ${appDir}`);
  console.log('Open it from Spotlight/Finder, or drag it to your Dock.');
}

function main() {
  if (process.platform === 'darwin') {
    installMac();
  } else if (process.platform === 'linux') {
    installLinux();
  } else {
    console.log(
      'Clickable install is supported on Linux and macOS.\n' +
        'On Windows, launch with "npm run app:launch" or create a shortcut to:\n' +
        `  node "${LAUNCHER}"`,
    );
  }
}

main();
