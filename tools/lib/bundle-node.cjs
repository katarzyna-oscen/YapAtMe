/*
 * Downloads an official Node.js runtime binary for a given platform/arch and
 * returns the path to the extracted `node` executable. Cached under build/cache.
 *
 * Used by the packaging scripts to bundle Node into the installers so end users
 * only need Google Chrome installed (not Node).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Pin to the Node version this project is developed against.
const NODE_VERSION = process.env.YAPATME_NODE_VERSION || 'v20.20.2';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CACHE_DIR = path.join(PROJECT_ROOT, 'build', 'cache');

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    run('curl', ['-fSL', '--retry', '3', '-o', dest, url]);
  } catch {
    run('wget', ['-O', dest, url]);
  }
}

/**
 * @param {'linux'|'darwin'} platform
 * @param {'x64'|'arm64'} arch
 * @returns {string} absolute path to the extracted node binary
 */
function ensureNodeBinary(platform, arch) {
  const ext = 'tar.xz';
  const name = `node-${NODE_VERSION}-${platform}-${arch}`;
  const url = `https://nodejs.org/dist/${NODE_VERSION}/${name}.${ext}`;
  const archivePath = path.join(CACHE_DIR, `${name}.${ext}`);
  const extractedDir = path.join(CACHE_DIR, name);
  const nodeBin = path.join(extractedDir, 'bin', 'node');

  if (fs.existsSync(nodeBin)) return nodeBin;

  if (!fs.existsSync(archivePath)) {
    console.log(`[bundle-node] downloading ${url}`);
    download(url, archivePath);
  }

  console.log(`[bundle-node] extracting ${name}`);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  // System tar handles .xz on Linux and macOS.
  run('tar', ['-xf', archivePath, '-C', CACHE_DIR]);

  if (!fs.existsSync(nodeBin)) {
    throw new Error(`node binary not found after extraction: ${nodeBin}`);
  }
  return nodeBin;
}

module.exports = { ensureNodeBinary, NODE_VERSION, CACHE_DIR, PROJECT_ROOT };
