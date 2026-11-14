#!/usr/bin/env node
/*
 * Build a self-contained HTML video manual from a storyboard.
 *
 *   node build.mjs <storyboard.json> [--profile <product-profile.json>] [--out <manual.html>]
 *
 * Validates the storyboard, resolves the product profile, checks every caption
 * against the profile's voice rules, inlines the screenshots, and prints the
 * scene timings. No dependencies.
 */
import path from 'node:path';
import { buildFile, timingLines, UserError } from './lib.mjs';

function fail(msg) {
  console.error('error: ' + msg);
  process.exit(1);
}

const args = { _: [] };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
  else args._.push(a);
}
if (!args._[0]) fail('usage: node build.mjs <storyboard.json> [--profile <product-profile.json>] [--out <manual.html>]');

const sbPath = path.resolve(args._[0]);
const rel = (p) => path.relative(process.cwd(), p);
let r;
try {
  r = buildFile(sbPath, { profileFlag: args.profile, out: args.out });
} catch (e) {
  if (e instanceof UserError) fail(e.message);
  throw e;
}

r.warnings.forEach((w) => console.warn('warning: ' + w));
if (r.errors.length) {
  r.errors.forEach((e) => console.error('error: ' + e));
  fail(`${r.errors.length} problem(s) in ${rel(sbPath)} — fix them and build again.`);
}

const label = r.profileSource ? rel(r.profileSource) : r.extendsName;
console.log(`profile: ${label} (${r.profile.text.animation} text, ${r.profile.transition.type} transitions)`);
timingLines(r.TL).forEach((l) => console.log(l));
console.log(`wrote ${rel(r.outPath)} (${(r.size / 1048576).toFixed(1)} MB)`);
