#!/usr/bin/env node
/*
 * Builds a Debian/Ubuntu .deb installer for YapAtMe.
 *
 * The package bundles a Node.js runtime, so end users only need Google Chrome.
 * Layout once installed:
 *   /opt/yapatme/node            bundled Node runtime
 *   /opt/yapatme/dist/           built web assets
 *   /opt/yapatme/tools/yapatme.cjs   launcher
 *   /usr/bin/yapatme             wrapper -> bundled node + launcher
 *   /usr/share/applications/yapatme.desktop
 *   /usr/share/icons/hicolor/scalable/apps/yapatme.svg
 *
 * Output: dist/yapatme_<version>_<arch>.deb
 *
 * Run on Linux:  npm run pkg:deb
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ensureNodeBinary, PROJECT_ROOT } = require('./lib/bundle-node.cjs');

const pkg = require(path.join(PROJECT_ROOT, 'package.json'));
const VERSION = pkg.version || '0.0.0';
const MAINTAINER =
  (pkg.author && `${pkg.author.name} <${pkg.author.email}>`) || 'YapAtMe';

const DEB_ARCH = process.arch === 'arm64' ? 'arm64' : 'amd64';
const NODE_ARCH = process.arch === 'arm64' ? 'arm64' : 'x64';

const STAGE = path.join(PROJECT_ROOT, 'build', 'deb', `yapatme_${VERSION}_${DEB_ARCH}`);
const OUT_DIR = path.join(PROJECT_ROOT, 'dist');
const OUT_DEB = path.join(OUT_DIR, `yapatme_${VERSION}_${DEB_ARCH}.deb`);

function sh(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', cwd: PROJECT_ROOT, ...opts });
}

function rimraf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

function write(file, content, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  if (mode) fs.chmodSync(file, mode);
}

function main() {
  if (process.platform !== 'linux') {
    console.error('pkg:deb must be run on Linux.');
    process.exit(1);
  }

  console.log('[deb] building web assets...');
  sh('npm', ['run', 'build']);

  console.log('[deb] preparing bundled Node runtime...');
  const nodeBin = ensureNodeBinary('linux', NODE_ARCH);

  console.log('[deb] staging package tree...');
  rimraf(STAGE);

  const optDir = path.join(STAGE, 'opt', 'yapatme');
  fs.mkdirSync(optDir, { recursive: true });
  copyDir(path.join(PROJECT_ROOT, 'dist'), path.join(optDir, 'dist'));
  fs.mkdirSync(path.join(optDir, 'tools'), { recursive: true });
  fs.copyFileSync(
    path.join(PROJECT_ROOT, 'tools', 'yapatme.cjs'),
    path.join(optDir, 'tools', 'yapatme.cjs'),
  );
  fs.copyFileSync(
    path.join(PROJECT_ROOT, 'package.json'),
    path.join(optDir, 'package.json'),
  );
  fs.copyFileSync(nodeBin, path.join(optDir, 'node'));
  fs.chmodSync(path.join(optDir, 'node'), 0o755);

  // CLI wrapper.
  write(
    path.join(STAGE, 'usr', 'bin', 'yapatme'),
    '#!/bin/sh\nexec /opt/yapatme/node /opt/yapatme/tools/yapatme.cjs "$@"\n',
    0o755,
  );

  // Desktop entry.
  write(
    path.join(STAGE, 'usr', 'share', 'applications', 'yapatme.desktop'),
    [
      '[Desktop Entry]',
      'Type=Application',
      'Name=YapAtMe',
      'Comment=AI note processing workspace',
      'Exec=yapatme',
      'Icon=yapatme',
      'Terminal=false',
      'Categories=Office;Utility;',
      'StartupWMClass=YapAtMe',
      '',
    ].join('\n'),
    0o644,
  );

  // App icon. Prefer a PNG (better looking with 3D gradients/shadows); fall
  // back to the scalable SVG.
  const pngSrc = path.join(PROJECT_ROOT, 'build', 'icon.png');
  const svgSrc = path.join(PROJECT_ROOT, 'build', 'icon.svg');
  if (fs.existsSync(pngSrc)) {
    // 512x512 is a safe, widely-supported hicolor size for a square PNG.
    const iconDest = path.join(
      STAGE, 'usr', 'share', 'icons', 'hicolor', '512x512', 'apps', 'yapatme.png',
    );
    fs.mkdirSync(path.dirname(iconDest), { recursive: true });
    fs.copyFileSync(pngSrc, iconDest);
  } else if (fs.existsSync(svgSrc)) {
    const iconDest = path.join(
      STAGE, 'usr', 'share', 'icons', 'hicolor', 'scalable', 'apps', 'yapatme.svg',
    );
    fs.mkdirSync(path.dirname(iconDest), { recursive: true });
    fs.copyFileSync(svgSrc, iconDest);
  }

  // Control metadata.
  write(
    path.join(STAGE, 'DEBIAN', 'control'),
    [
      'Package: yapatme',
      `Version: ${VERSION}`,
      'Section: utils',
      'Priority: optional',
      `Architecture: ${DEB_ARCH}`,
      `Maintainer: ${MAINTAINER}`,
      'Recommends: google-chrome-stable | chromium-browser | chromium',
      'Description: YapAtMe - AI note processing workspace',
      ' Local-first AI notes app. Dictate or write quick notes; the AI routes',
      ' them into people, projects, ideas and tasks as plain Markdown files.',
      ' Runs in Google Chrome app mode; a Node.js runtime is bundled.',
      '',
    ].join('\n'),
    0o644,
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('[deb] building .deb...');
  sh('dpkg-deb', ['--build', '--root-owner-group', STAGE, OUT_DEB]);

  console.log(`\n[deb] done: ${path.relative(PROJECT_ROOT, OUT_DEB)}`);
  console.log('Install with:  sudo apt install ./' + path.relative(PROJECT_ROOT, OUT_DEB));
}

main();
