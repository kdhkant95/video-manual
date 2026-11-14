#!/usr/bin/env node
/*
 * Capture a built video manual to MP4, or to still frames for checking.
 *
 *   node render.mjs <manual.html> [--out <manual.mp4>] [--stills <dir>] [--scale 1]
 *   node render.mjs <manual.html> --at <seconds> [--mark <x,y>] --out <frame.jpg>
 *
 *   --at <seconds>  write the single frame at that time instead of a video.
 *                   With --mark x,y (stage pixels) a marker is drawn there —
 *                   use it to see exactly what a reviewer's comment points at.
 *   --stills <dir>  write one JPEG per key moment (each click, each settled
 *                   scene) instead of a video. Use it to check that the cursor
 *                   and highlights land on the right elements.
 *   --out <file>    MP4 path (default: manual.mp4 next to the HTML).
 *   --scale <n>     device scale factor, e.g. 2 for a 3840x2160 video.
 *
 * Needs `npm install` in this folder (playwright-core, ffmpeg-static) and
 * either Google Chrome or `npx playwright install chromium`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

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
if (!args._[0]) fail('usage: node render.mjs <manual.html> [--out <manual.mp4>] [--stills <dir>] [--scale 1]');
const htmlPath = path.resolve(args._[0]);
if (!fs.existsSync(htmlPath)) fail(`not found: ${htmlPath} — run build.mjs first.`);

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  fail('playwright-core is not installed. Run `npm install` in the skill\'s scripts folder, then try again.');
}

async function launch() {
  const attempts = [{ channel: 'chrome' }, {}, { channel: 'msedge' }];
  for (const opts of attempts) {
    try {
      return await chromium.launch({ headless: true, ...opts });
    } catch {
      /* try the next browser */
    }
  }
  fail('no browser found. Install Google Chrome, or run `npx playwright install chromium` in the scripts folder.');
}

async function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0) return 'ffmpeg';
  try {
    const bin = (await import('ffmpeg-static')).default;
    if (bin && fs.existsSync(bin)) return bin;
  } catch {
    /* fall through */
  }
  fail('ffmpeg not found. Install ffmpeg, set FFMPEG_PATH, or run `npm install` in the scripts folder (ffmpeg-static).');
}

const browser = await launch();
try {
  const scale = Number(args.scale || 1);
  const page = await browser.newPage({ deviceScaleFactor: scale });
  const url = pathToFileURL(htmlPath).href + '?capture=1';
  await page.goto(url);
  const info = await page.evaluate(() => window.__vm && { ...window.__vm, seek: undefined });
  if (!info) fail('this HTML is not a video manual build (window.__vm is missing).');
  await page.setViewportSize({ width: info.width, height: info.height });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (img) => img.decode().catch(() => {})));
  });
  const seek = (t) => page.evaluate((s) => window.__vm.seek(s), t);

  if (args.at != null) {
    const t = Number(args.at);
    if (!Number.isFinite(t)) fail('--at needs a time in seconds, e.g. --at 12.4');
    const out = path.resolve(args.out || path.join(path.dirname(htmlPath), `frame-${t.toFixed(2)}.jpg`));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await seek(t);
    if (args.mark) {
      const [x, y] = String(args.mark).split(',').map(Number);
      await page.evaluate(([mx, my]) => {
        const m = document.createElement('div');
        m.style.cssText = `position:absolute;left:${mx - 22}px;top:${my - 22}px;width:44px;height:44px;border:4px solid #ff2d55;border-radius:50%;box-shadow:0 0 0 3px #fff;z-index:9999`;
        document.getElementById('stage').appendChild(m);
      }, [x, y]);
    }
    await page.screenshot({ path: out, type: 'jpeg', quality: 85 });
    console.log(`wrote ${path.relative(process.cwd(), out)}  t=${t.toFixed(2)}s`);
  } else if (args.stills) {
    const dir = path.resolve(args.stills);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < info.stills.length; i++) {
      const s = info.stills[i];
      await seek(s.t);
      const name = `${String(i + 1).padStart(2, '0')}-${s.label}.jpg`;
      await page.screenshot({ path: path.join(dir, name), type: 'jpeg', quality: 82 });
      console.log(`${name}  t=${s.t.toFixed(2)}s`);
    }
    console.log(`wrote ${info.stills.length} stills to ${path.relative(process.cwd(), dir)}`);
  } else {
    const out = path.resolve(args.out || path.join(path.dirname(htmlPath), 'manual.mp4'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const ffmpeg = await findFfmpeg();
    const frames = Math.ceil(info.duration * info.fps);
    const ff = spawn(
      ffmpeg,
      ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(info.fps), '-c:v', 'mjpeg', '-i', '-',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    );
    const done = new Promise((resolve, reject) => {
      ff.on('error', reject);
      ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exited with code ' + code))));
    });
    ff.stdin.on('error', () => {}); // surfaced through `done`

    const started = Date.now();
    for (let i = 0; i < frames; i++) {
      await seek(i / info.fps);
      const jpg = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % info.fps === 0) process.stdout.write(`\rrendering ${Math.round((i / frames) * 100)}%`);
    }
    ff.stdin.end();
    await done;
    const mb = (fs.statSync(out).size / 1048576).toFixed(1);
    console.log(`\rwrote ${path.relative(process.cwd(), out)} — ${info.duration.toFixed(1)}s, ${frames} frames, ${mb} MB, took ${Math.round((Date.now() - started) / 1000)}s`);
  }
} finally {
  await browser.close();
}
