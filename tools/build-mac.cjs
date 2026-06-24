#!/usr/bin/env node
/*
 * Builds a macOS app bundle (YapAtMe.app) and a .dmg installer.
 *
 * The bundle includes a Node.js runtime, so end users only need Google Chrome.
 * Must be run ON macOS (uses hdiutil; optionally sips/iconutil for the icon).
 *
 * Bundle layout:
 *   YapAtMe.app/Contents/MacOS/YapAtMe   launcher (shell) + bundled `node`
 *   YapAtMe.app/Contents/Resources/app/  dist/ + tools/yapatme.cjs + package.json
 *
 * Output: dist/YapAtMe-<version>-<arch>.dmg
 *
 * Run on macOS:  npm run pkg:mac
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ensureNodeBinary, PROJECT_ROOT } = require('./lib/bundle-node.cjs');

const pkg = require(path.join(PROJECT_ROOT, 'package.json'));
const VERSION = pkg.version || '0.0.0';
const ARCH = process.arch === 'arm64' ? 'arm64' : 'x64';

const BUILD_DIR = path.join(PROJECT_ROOT, 'build', 'mac');
const APP_DIR = path.join(BUILD_DIR, 'YapAtMe.app');
const DMG_STAGE = path.join(BUILD_DIR, 'dmg');
const OUT_DIR = path.join(PROJECT_ROOT, 'dist');
const OUT_DMG = path.join(OUT_DIR, `YapAtMe-${VERSION}-${ARCH}.dmg`);

function sh(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', cwd: PROJECT_ROOT, ...opts });
}

function rimraf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function tryMakeIcns(resourcesDir) {
  const icnsSrc = path.join(PROJECT_ROOT, 'build', 'icon.icns');
  if (fs.existsSync(icnsSrc)) {
    fs.copyFileSync(icnsSrc, path.join(resourcesDir, 'icon.icns'));
    return true;
  }
  const pngSrc = path.join(PROJECT_ROOT, 'build', 'icon.png');
  if (!fs.existsSync(pngSrc)) {
    console.log('[mac] no build/icon.icns or build/icon.png — skipping icon.');
    return false;
  }
  try {
    const iconset = path.join(BUILD_DIR, 'icon.iconset');
    rimraf(iconset);
    fs.mkdirSync(iconset, { recursive: true });
    const sizes = [16, 32, 64, 128, 256, 512, 1024];
    for (const s of sizes) {
      sh('sips', ['-z', String(s), String(s), pngSrc, '--out', path.join(iconset, `icon_${s}x${s}.png`)]);
      if (s <= 512) {
        sh('sips', ['-z', String(s * 2), String(s * 2), pngSrc, '--out', path.join(iconset, `icon_${s}x${s}@2x.png`)]);
      }
    }
    sh('iconutil', ['-c', 'icns', iconset, '-o', path.join(resourcesDir, 'icon.icns')]);
    return true;
  } catch (err) {
    console.log('[mac] icon generation failed, continuing without icon:', err.message);
    return false;
  }
}

function main() {
  if (process.platform !== 'darwin') {
    console.error('pkg:mac must be run on macOS.');
    process.exit(1);
  }

  console.log('[mac] building web assets...');
  sh('npm', ['run', 'build']);

  console.log('[mac] preparing bundled Node runtime...');
  const nodeBin = ensureNodeBinary('darwin', ARCH);

  console.log('[mac] assembling YapAtMe.app...');
  rimraf(APP_DIR);
  const macOsDir = path.join(APP_DIR, 'Contents', 'MacOS');
  const resourcesDir = path.join(APP_DIR, 'Contents', 'Resources');
  const appPayload = path.join(resourcesDir, 'app');
  fs.mkdirSync(macOsDir, { recursive: true });
  fs.mkdirSync(path.join(appPayload, 'tools'), { recursive: true });

  fs.cpSync(path.join(PROJECT_ROOT, 'dist'), path.join(appPayload, 'dist'), { recursive: true });
  fs.copyFileSync(path.join(PROJECT_ROOT, 'tools', 'yapatme.cjs'), path.join(appPayload, 'tools', 'yapatme.cjs'));
  fs.copyFileSync(path.join(PROJECT_ROOT, 'package.json'), path.join(appPayload, 'package.json'));

  fs.copyFileSync(nodeBin, path.join(macOsDir, 'node'));
  fs.chmodSync(path.join(macOsDir, 'node'), 0o755);

  const launcher = [
    '#!/bin/bash',
    'DIR="$(cd "$(dirname "$0")" && pwd)"',
    'exec "$DIR/node" "$DIR/../Resources/app/tools/yapatme.cjs"',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(macOsDir, 'YapAtMe'), launcher);
  fs.chmodSync(path.join(macOsDir, 'YapAtMe'), 0o755);

  const hasIcon = tryMakeIcns(resourcesDir);

  const plist = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>CFBundleName</key><string>YapAtMe</string>',
    '  <key>CFBundleDisplayName</key><string>YapAtMe</string>',
    '  <key>CFBundleIdentifier</key><string>com.yapatme.app</string>',
    `  <key>CFBundleVersion</key><string>${VERSION}</string>`,
    `  <key>CFBundleShortVersionString</key><string>${VERSION}</string>`,
    '  <key>CFBundlePackageType</key><string>APPL</string>',
    '  <key>CFBundleExecutable</key><string>YapAtMe</string>',
    hasIcon ? '  <key>CFBundleIconFile</key><string>icon.icns</string>' : '',
    '  <key>LSMinimumSystemVersion</key><string>10.15</string>',
    '  <key>NSHighResolutionCapable</key><true/>',
    '  <key>NSMicrophoneUsageDescription</key><string>YapAtMe uses the microphone for voice dictation.</string>',
    '</dict>',
    '</plist>',
    '',
  ].filter(Boolean).join('\n');
  fs.writeFileSync(path.join(APP_DIR, 'Contents', 'Info.plist'), plist);

  console.log('[mac] creating .dmg...');
  rimraf(DMG_STAGE);
  fs.mkdirSync(DMG_STAGE, { recursive: true });
  fs.cpSync(APP_DIR, path.join(DMG_STAGE, 'YapAtMe.app'), { recursive: true });
  try {
    fs.symlinkSync('/Applications', path.join(DMG_STAGE, 'Applications'));
  } catch {
    /* symlink may already exist */
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  rimraf(OUT_DMG);
  sh('hdiutil', [
    'create', '-volname', 'YapAtMe',
    '-srcfolder', DMG_STAGE,
    '-ov', '-format', 'UDZO',
    OUT_DMG,
  ]);

  console.log(`\n[mac] done: ${path.relative(PROJECT_ROOT, OUT_DMG)}`);
  console.log('Open the .dmg and drag YapAtMe to Applications.');
}

main();
