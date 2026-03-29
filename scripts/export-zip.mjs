#!/usr/bin/env node
/**
 * Export script: builds front-end (Vite) and API (esbuild), then packages
 * the full project into qr-asset-manager-export.zip for self-hosting.
 *
 * Usage (from project root):
 *   pnpm run export-zip
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT_ZIP = path.join(ROOT, "qr-asset-manager-export.zip");

function log(msg) {
  console.log(`[export-zip] ${msg}`);
}

function run(cmd, cwd = ROOT, extraEnv = {}) {
  log(`Running: ${cmd}`);
  execSync(cmd, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: process.env.PORT || "3000",
      BASE_PATH: process.env.BASE_PATH || "/",
      ...extraEnv,
    },
  });
}

// ─── Step 1: Build front-end ───────────────────────────────────────────────
log("Building front-end (Vite)…");
run("pnpm --filter @workspace/qr-manager run build");
log("Front-end build complete.");

// ─── Step 2: Build API ─────────────────────────────────────────────────────
log("Building API server (esbuild)…");
run("pnpm --filter @workspace/api-server run build");
log("API build complete.");

// ─── Step 3: Build shared libs ─────────────────────────────────────────────
log("Building shared libraries…");
run("pnpm --filter './lib/**' run build --if-present");
log("Library builds complete.");

// ─── Step 4: Package into ZIP ──────────────────────────────────────────────
log("Creating ZIP archive…");

const zip = new AdmZip();

/**
 * Recursively add a directory to the zip.
 * @param {string} absPath   Absolute path on disk.
 * @param {string} zipPrefix Path inside the zip archive.
 * @param {string[]} exclude  Exact entry names to skip at every level.
 */
function addDir(absPath, zipPrefix, exclude = []) {
  if (!existsSync(absPath)) return;

  const entries = readdirSync(absPath);
  for (const entry of entries) {
    if (exclude.includes(entry)) continue;
    if (entry.startsWith(".") && entry !== ".env.example") continue;

    const fullPath = path.join(absPath, entry);
    const zipPath = path.join(zipPrefix, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      addDir(fullPath, zipPath, exclude);
    } else {
      zip.addFile(zipPath, readFileSync(fullPath));
    }
  }
}

// Names excluded from every addDir call (node_modules, vcs, platform-specific)
const COMMON_EXCLUDE = [
  "node_modules",
  ".git",
  ".replit",
  "replit.nix",
  ".local",
  ".upm",
  ".cache",
];

// ─── Root-level config files ────────────────────────────────────────────────
const ROOT_FILES = [
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "railway.toml",
  "tsconfig.json",
  "tsconfig.base.json",
  ".railwayignore",
  "DEPLOY.md",
];

for (const file of ROOT_FILES) {
  const abs = path.join(ROOT, file);
  if (existsSync(abs)) {
    zip.addFile(file, readFileSync(abs));
    log(`Added root file: ${file}`);
  }
}

// ─── attached_assets (required for front-end source builds) ─────────────────
const assetsDir = path.join(ROOT, "attached_assets");
if (existsSync(assetsDir)) {
  addDir(assetsDir, "attached_assets", COMMON_EXCLUDE);
  log("Added attached_assets/");
}

// ─── Shared libraries (source + built output) ───────────────────────────────
const LIBS = ["api-zod", "api-client-react", "api-spec", "db"];
for (const lib of LIBS) {
  const absLib = path.join(ROOT, "lib", lib);
  addDir(absLib, path.join("lib", lib), COMMON_EXCLUDE);
  log(`Added lib/${lib}`);
}

// ─── API Server artifact (source + built dist) ───────────────────────────────
addDir(
  path.join(ROOT, "artifacts", "api-server"),
  path.join("artifacts", "api-server"),
  COMMON_EXCLUDE
);
log("Added artifacts/api-server");

// ─── QR Manager front-end artifact (source + built dist/public) ─────────────
addDir(
  path.join(ROOT, "artifacts", "qr-manager"),
  path.join("artifacts", "qr-manager"),
  COMMON_EXCLUDE
);
log("Added artifacts/qr-manager");

// ─── scripts ────────────────────────────────────────────────────────────────
addDir(path.join(ROOT, "scripts"), "scripts", COMMON_EXCLUDE);
log("Added scripts/");

// ─── Write the ZIP ──────────────────────────────────────────────────────────
zip.writeZip(OUTPUT_ZIP);
log(`ZIP created at: ${OUTPUT_ZIP}`);

// ─── Summary ────────────────────────────────────────────────────────────────
const allEntries = zip.getEntries();
log(`Total files in archive: ${allEntries.length}`);
log("Done! Upload qr-asset-manager-export.zip and follow DEPLOY.md to deploy.");
