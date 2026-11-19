// Verde Heat — entry program (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ from beside this file
// into the output directory and writes /output/dossier.json with the
// vendored make.fun library, exactly as the kit's starter does, but in
// this file's own structure.
//
// Run locally:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameSource = join(repoRoot, 'game');
const shotsSource = join(repoRoot, 'screenshots');

function prepareOutput() {
  mkdirSync(outputDir, { recursive: true });
  cpSync(gameSource, join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  if (existsSync(shotsSource)) {
    cpSync(shotsSource, join(outputDir, 'screenshots'), { recursive: true });
  }
}

function writeDossier() {
  // The scorer's own caps (reference/gate.json): only text_max_bytes shapes
  // the bytes; the others refuse an entry the scorer would refuse.
  const dossierOptions = {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  };
  const dossierText = buildDossier(outputDir, dossierOptions);
  writeFileSync(join(outputDir, 'dossier.json'), dossierText);
}

prepareOutput();
writeDossier();

// A short human-readable confirmation so a local run shows what landed.
console.log(`Verde Heat handed in: game/ + screenshots/ + dossier.json in ${outputDir}`);
