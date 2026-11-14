#!/usr/bin/env node
/*
 * Video Manual Studio: a local web app for the four-step workflow, plus the
 * commands an AI agent uses to pick up and answer requests made in it.
 *
 *   node studio.mjs [serve] <project-root> [--port 4173] [--open]
 *       Serve the studio for a project (default root: ./video-manual).
 *
 *   node studio.mjs wait <project-root> [--timeout 540]
 *       Block until the user sends a request from the studio, then print the
 *       pending requests as JSON and mark them as being worked on. Prints
 *       {"status":"idle"} if the timeout passes first.
 *
 *   node studio.mjs pending <project-root>
 *       Print every unanswered request without waiting or changing anything.
 *
 *   node studio.mjs done <project-root> <request-id> --reply "<what you did>"
 *                   [--comment <comment-id>:"<reply to that comment>" ...]
 *       Mark a request as done. The reply is shown to the user in the studio.
 *
 * The studio and the agent only ever talk through files in the project
 * folder, so the agent can also simply read and edit those files directly.
 * The server listens on 127.0.0.1 only. No dependencies.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as lib from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMMANDS = ['serve', 'wait', 'pending', 'done'];
const MAX_UPLOAD = 40 * 1024 * 1024;

// --- Arguments ------------------------------------------------------------

const pos = [];
const flags = { comment: [] };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--open') flags.open = true;
  else if (a === '--comment') flags.comment.push(process.argv[++i]);
  else if (a.startsWith('--')) flags[a.slice(2)] = process.argv[++i];
  else pos.push(a);
}
const cmd = COMMANDS.includes(pos[0]) ? pos.shift() : 'serve';
const root = path.resolve(pos[0] || 'video-manual');
const rel = (p) => path.relative(process.cwd(), p) || '.';

// --- Project files --------------------------------------------------------

const profilePath = path.join(root, lib.PROFILE_FILE);
const requestsPath = path.join(root, 'requests.json');
const brandDir = path.join(root, 'brand');
const guidePath = path.join(brandDir, 'guide.md');

function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
// Write through a temp file so a reader never sees a half-written file.
function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
const writeJson = (file, value) => writeAtomic(file, JSON.stringify(value, null, 2) + '\n');
const newId = (prefix) => prefix + crypto.randomBytes(3).toString('hex');
const now = () => new Date().toISOString();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function manualDir(slug) {
  if (!slug || slug !== path.basename(slug) || slug.startsWith('.') || slug === 'brand') throw new HttpError(400, 'bad manual name');
  return path.join(root, slug);
}
const commentsPath = (slug) => path.join(manualDir(slug), 'comments.json');
const loadRequests = () => readJsonSafe(requestsPath, []);
const loadComments = (slug) => readJsonSafe(commentsPath(slug), []);
const logoFile = () => (fs.existsSync(brandDir) ? fs.readdirSync(brandDir).find((f) => /^logo\.(png|jpe?g|svg|webp)$/i.test(f)) : null);

// --- Agent commands -------------------------------------------------------

// Everything the agent needs to act on a request without hunting for paths.
function expand(r) {
  const out = { ...r, paths: { project: rel(root), profile: rel(profilePath) } };
  if (fs.existsSync(guidePath)) out.paths.brandGuide = rel(guidePath);
  if (r.manual) {
    const dir = path.join(root, r.manual);
    Object.assign(out.paths, { manual: rel(dir), storyboard: rel(path.join(dir, 'storyboard.json')), screens: rel(path.join(dir, 'screens')) });
    if (r.type === 'revise') {
      const ids = (r.payload && r.payload.commentIds) || [];
      out.comments = loadComments(r.manual).filter((c) => ids.includes(c.id));
    }
  }
  return out;
}

async function cmdWait() {
  const timeout = Number(flags.timeout == null ? 540 : flags.timeout) * 1000;
  const until = Date.now() + timeout;
  for (;;) {
    const all = loadRequests();
    const pending = all.filter((r) => r.status === 'pending');
    if (pending.length) {
      pending.forEach((r) => {
        r.status = 'working';
        r.startedAt = now();
      });
      writeJson(requestsPath, all);
      console.log(JSON.stringify({ status: 'requests', requests: pending.map(expand) }, null, 2));
      return;
    }
    if (Date.now() >= until) {
      console.log(JSON.stringify({ status: 'idle' }));
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

function cmdPending() {
  const open = loadRequests().filter((r) => r.status !== 'done');
  console.log(JSON.stringify({ status: open.length ? 'requests' : 'idle', requests: open.map(expand) }, null, 2));
}

function cmdDone() {
  const id = pos[1];
  const all = loadRequests();
  const r = all.find((x) => x.id === id);
  if (!r) {
    console.error(`error: no request with id "${id}". Open requests: ${all.filter((x) => x.status !== 'done').map((x) => x.id).join(', ') || 'none'}`);
    process.exit(1);
  }
  r.status = 'done';
  r.reply = flags.reply || '';
  r.resolvedAt = now();
  writeJson(requestsPath, all);

  if (r.type === 'revise' && r.manual) {
    const replies = Object.fromEntries(
      flags.comment.map((s) => {
        const i = s.indexOf(':');
        return [s.slice(0, i), s.slice(i + 1)];
      }),
    );
    const comments = loadComments(r.manual);
    for (const c of comments) {
      if (c.requestId !== r.id) continue;
      c.status = 'resolved';
      c.reply = replies[c.id] || r.reply;
      c.resolvedAt = r.resolvedAt;
    }
    writeJson(commentsPath(r.manual), comments);
  }
  console.log(`request ${id} marked done`);
}

// --- Server: state --------------------------------------------------------

const stat = (file) => {
  try {
    const s = fs.statSync(file);
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return '-';
  }
};

function listManuals() {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'brand' && !d.name.startsWith('.'))
    .filter((d) => fs.existsSync(path.join(root, d.name, 'storyboard.json')) || fs.existsSync(path.join(root, d.name, 'screens')))
    .map((d) => d.name)
    .sort();
}

const sizeCache = new Map();
function listScreens(slug) {
  const dir = path.join(manualDir(slug), 'screens');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort()
    .map((name) => {
      const file = path.join(dir, name);
      const key = file + stat(file);
      if (!sizeCache.has(key)) {
        try {
          const s = lib.imageSize(fs.readFileSync(file), file);
          sizeCache.set(key, { width: s.width, height: s.height });
        } catch {
          sizeCache.set(key, { width: 0, height: 0 });
        }
      }
      return { name, v: stat(file), ...sizeCache.get(key) };
    });
}

const renders = new Map();
const emptyStoryboard = (title) => ({ meta: { title: title || '', lang: 'ko' }, scenes: [] });

function version(manual) {
  const parts = [stat(profilePath), stat(guidePath), stat(requestsPath), logoFile() || '', listManuals().join(',')];
  if (manual) {
    const dir = manualDir(manual);
    parts.push(stat(path.join(dir, 'storyboard.json')), stat(commentsPath(manual)));
    parts.push(listScreens(manual).map((s) => s.name + s.v).join(','));
    const job = renders.get(manual);
    if (job) parts.push(job.status + job.progress);
  }
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12);
}

const fileUrl = (file) => '/files/' + path.relative(root, file).split(path.sep).map(encodeURIComponent).join('/') + '?v=' + encodeURIComponent(stat(file));

function getState(manual) {
  const manuals = listManuals();
  if (manual && !manuals.includes(manual)) manual = null;
  manual = manual || manuals[0] || null;

  const rawProfile = readJsonSafe(profilePath, null);
  let profile;
  let profileError = null;
  try {
    profile = lib.resolveProfile(rawProfile || {}, { baseDir: root, logoUrl: fileUrl });
  } catch (e) {
    profileError = e.message;
    profile = lib.resolveProfile({});
  }

  const state = {
    project: path.basename(path.dirname(root)) + '/' + path.basename(root),
    manuals,
    manual,
    rawProfile,
    hasProfile: !!rawProfile,
    profile,
    profileError,
    presets: Object.fromEntries(lib.presetNames().map((n) => [n, lib.loadPreset(n)])),
    brandGuide: fs.existsSync(guidePath) ? fs.readFileSync(guidePath, 'utf8') : '',
    logo: logoFile(),
    requests: loadRequests(),
    version: version(manual),
  };

  if (manual) {
    const dir = manualDir(manual);
    const storyboard = readJsonSafe(path.join(dir, 'storyboard.json'), emptyStoryboard(manual));
    const screens = listScreens(manual);
    const images = Object.fromEntries(screens.map((s) => ['screens/' + s.name, { width: s.width, height: s.height }]));
    let lint = { errors: [], warnings: [] };
    if (Array.isArray(storyboard.scenes) && storyboard.scenes.length) {
      try {
        lint = lib.validate(storyboard, profile, images);
      } catch (e) {
        lint = { errors: [e.message], warnings: [] };
      }
    }
    const mp4 = path.join(dir, 'out', 'manual.mp4');
    Object.assign(state, {
      storyboard,
      screens,
      comments: loadComments(manual),
      lint,
      render: renders.get(manual) || null,
      video: fs.existsSync(mp4) ? fileUrl(mp4) : null,
    });
  }
  return state;
}

// --- Server: actions ------------------------------------------------------

function slugify(name) {
  const slug = String(name || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return slug || 'manual';
}

function createManual(name) {
  let slug = slugify(name);
  if (slug === 'brand') slug = 'brand-manual';
  for (let n = 2; fs.existsSync(path.join(root, slug)); n++) slug = `${slugify(name)}-${n}`;
  fs.mkdirSync(path.join(root, slug, 'screens'), { recursive: true });
  writeJson(path.join(root, slug, 'storyboard.json'), emptyStoryboard(name));
  return slug;
}

function saveScreen(manual, name, buf) {
  lib.imageSize(buf, name); // throws unless it really is a PNG or JPEG
  const dir = path.join(manualDir(manual), 'screens');
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(name).toLowerCase();
  let base = path.basename(name, path.extname(name)).replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'screen';
  // Keep screens in the order they were added.
  if (!/^\d/.test(base)) base = String(listScreens(manual).length + 1).padStart(2, '0') + '-' + base;
  let file = base + ext;
  for (let n = 2; fs.existsSync(path.join(dir, file)); n++) file = `${base}-${n}${ext}`;
  fs.writeFileSync(path.join(dir, file), buf);
  return file;
}

function saveLogo(name, buf) {
  const ext = path.extname(name).toLowerCase();
  if (!/^\.(png|jpe?g|svg|webp)$/.test(ext)) throw new HttpError(400, 'logo must be PNG, JPEG, SVG or WebP');
  fs.mkdirSync(brandDir, { recursive: true });
  const old = logoFile();
  if (old) fs.rmSync(path.join(brandDir, old));
  fs.writeFileSync(path.join(brandDir, 'logo' + ext), buf);
  const raw = readJsonSafe(profilePath, {});
  raw.brand = { logoPlacement: 'cards', ...(raw.brand || {}), logo: 'brand/logo' + ext };
  writeJson(profilePath, raw);
}

function removeLogo() {
  const old = logoFile();
  if (old) fs.rmSync(path.join(brandDir, old));
  const raw = readJsonSafe(profilePath, {});
  if (raw.brand) delete raw.brand.logo;
  writeJson(profilePath, raw);
}

function addRequest({ type, manual, payload }) {
  if (!['profile', 'scenes', 'draft', 'produce', 'revise'].includes(type)) throw new HttpError(400, 'unknown request type');
  const r = { id: newId('r'), type, manual: manual || null, payload: payload || {}, status: 'pending', createdAt: now() };
  if (type === 'revise') {
    const comments = loadComments(manual);
    const open = comments.filter((c) => c.status === 'open');
    if (!open.length) throw new HttpError(400, 'no open comments to send');
    open.forEach((c) => {
      c.status = 'sent';
      c.requestId = r.id;
    });
    r.payload = { ...r.payload, commentIds: open.map((c) => c.id) };
    writeJson(commentsPath(manual), comments);
  }
  const all = loadRequests();
  all.push(r);
  writeJson(requestsPath, all);
  return r;
}

// Withdraw a request the agent has not picked up yet.
function cancelRequest(id) {
  const all = loadRequests();
  const r = all.find((x) => x.id === id);
  if (!r || r.status !== 'pending') throw new HttpError(409, 'only a request that has not been picked up can be cancelled');
  writeJson(requestsPath, all.filter((x) => x !== r));
  if (r.type === 'revise' && r.manual) {
    const comments = loadComments(r.manual);
    comments.forEach((c) => {
      if (c.requestId === id) {
        c.status = 'open';
        delete c.requestId;
      }
    });
    writeJson(commentsPath(r.manual), comments);
  }
}

function startRender(manual) {
  const dir = manualDir(manual);
  const existing = renders.get(manual);
  if (existing && existing.status === 'running') return existing;
  const job = { status: 'running', progress: 0, error: null, log: '' };
  renders.set(manual, job);
  try {
    const r = lib.buildFile(path.join(dir, 'storyboard.json'));
    if (r.errors.length) throw new Error(r.errors.join('\n'));
  } catch (e) {
    Object.assign(job, { status: 'error', error: e.message });
    return job;
  }
  const child = spawn(process.execPath, [path.join(HERE, 'render.mjs'), path.join(dir, 'out', 'manual.html'), '--out', path.join(dir, 'out', 'manual.mp4')], { cwd: HERE });
  child.stdout.on('data', (d) => {
    const m = String(d).match(/(\d+)%/g);
    if (m) job.progress = parseInt(m[m.length - 1], 10);
  });
  child.stderr.on('data', (d) => (job.log += d));
  child.on('error', (e) => Object.assign(job, { status: 'error', error: e.message }));
  child.on('close', (code) => {
    if (code === 0) Object.assign(job, { status: 'done', progress: 100 });
    else Object.assign(job, { status: 'error', error: job.log.trim() || 'render failed' });
  });
  return job;
}

// --- Server: HTTP ---------------------------------------------------------

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
};

function send(res, status, body, type) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(data);
}

// Serve one file from inside `base`; anything that resolves outside is refused.
function sendFile(res, base, relPath, allowed) {
  const file = path.resolve(base, relPath);
  const ext = path.extname(file).toLowerCase();
  if (!file.startsWith(path.resolve(base) + path.sep) || !allowed.includes(ext) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new HttpError(404, 'not found');
  }
  send(res, 200, fs.readFileSync(file), TYPES[ext]);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_UPLOAD) {
        reject(new HttpError(413, 'file is too large (40 MB limit)'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const readJsonBody = async (req) => {
  try {
    return JSON.parse((await readBody(req)).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'body is not valid JSON');
  }
};

async function route(req, res) {
  // Only answer requests addressed to this machine, and only accept changes
  // from the studio page itself (a custom header other sites cannot send).
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) throw new HttpError(403, 'forbidden');
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);
  const q = url.searchParams;
  const manual = q.get('manual');

  if (req.method === 'GET') {
    if (p === '/favicon.ico') return send(res, 204, '');
    if (p === '/') return sendFile(res, path.join(lib.ASSETS, 'studio'), 'studio.html', ['.html']);
    if (p.startsWith('/studio/')) return sendFile(res, path.join(lib.ASSETS, 'studio'), p.slice(8), ['.js', '.css']);
    if (p.startsWith('/player/')) return sendFile(res, path.join(lib.ASSETS, 'player'), p.slice(8), ['.js', '.css']);
    if (p.startsWith('/files/')) return sendFile(res, root, p.slice(7), ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.mp4']);
    if (p === '/api/state') return send(res, 200, getState(manual));
    if (p === '/api/version') {
      const open = loadRequests().filter((r) => r.status !== 'done').length;
      return send(res, 200, { version: version(manual && listManuals().includes(manual) ? manual : null), open });
    }
    throw new HttpError(404, 'not found');
  }

  if (req.headers['x-video-manual'] !== '1') throw new HttpError(403, 'forbidden');
  const key = req.method + ' ' + p;
  switch (key) {
    case 'PUT /api/profile': {
      // The studio form owns only some of the profile. Everything else on disk
      // (voice rules, pacing and other tuning written by the agent, the logo
      // path) is kept, so a save from the form can never wipe the agent's work.
      const ui = await readJsonBody(req);
      const disk = readJsonSafe(profilePath, {});
      const { extends: _e, product: _p, colors: _c, canvas: _v, ...rest } = disk;
      const next = { extends: ui.extends || disk.extends || lib.DEFAULT_PRESET, product: ui.product || disk.product, ...rest };
      if (ui.colors) next.colors = ui.colors;
      if (ui.canvas) next.canvas = ui.canvas;
      if (ui.brand && ui.brand.logoPlacement) next.brand = { ...(disk.brand || {}), logoPlacement: ui.brand.logoPlacement };
      try {
        lib.resolveProfile(next);
      } catch (e) {
        throw new HttpError(400, e.message);
      }
      writeJson(profilePath, next);
      break;
    }
    case 'PUT /api/brand-guide': {
      const { text } = await readJsonBody(req);
      if (text && text.trim()) writeAtomic(guidePath, text);
      else fs.rmSync(guidePath, { force: true });
      break;
    }
    case 'POST /api/logo':
      saveLogo(q.get('name') || '', await readBody(req));
      break;
    case 'DELETE /api/logo':
      removeLogo();
      break;
    case 'POST /api/manuals': {
      const { name } = await readJsonBody(req);
      return send(res, 200, { manual: createManual(name) });
    }
    case 'POST /api/screens':
      try {
        return send(res, 200, { name: saveScreen(manual, q.get('name') || 'screen.png', await readBody(req)) });
      } catch (e) {
        throw e instanceof lib.UserError ? new HttpError(400, e.message) : e;
      }
    case 'DELETE /api/screens': {
      const name = path.basename(q.get('name') || '');
      fs.rmSync(path.join(manualDir(manual), 'screens', name), { force: true });
      break;
    }
    case 'PUT /api/storyboard': {
      const sb = await readJsonBody(req);
      if (!Array.isArray(sb.scenes)) throw new HttpError(400, 'storyboard needs a "scenes" array');
      writeJson(path.join(manualDir(manual), 'storyboard.json'), sb);
      break;
    }
    case 'PUT /api/comments': {
      const comments = await readJsonBody(req);
      if (!Array.isArray(comments)) throw new HttpError(400, 'comments must be an array');
      writeJson(commentsPath(manual), comments);
      break;
    }
    case 'POST /api/requests':
      addRequest(await readJsonBody(req));
      break;
    case 'DELETE /api/requests':
      cancelRequest(q.get('id'));
      break;
    case 'POST /api/render':
      startRender(manual);
      break;
    default:
      throw new HttpError(404, 'not found');
  }
  send(res, 200, { ok: true, version: version(manual && listManuals().includes(manual) ? manual : null) });
}

function cmdServe() {
  fs.mkdirSync(root, { recursive: true });
  const server = http.createServer((req, res) => {
    route(req, res).catch((e) => {
      if (!(e instanceof HttpError)) console.error(e);
      if (!res.headersSent) send(res, e.status || 500, { error: e.message });
    });
  });
  let port = Number(flags.port || 4173);
  let tries = 0;
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && !flags.port && tries++ < 20) server.listen(++port, '127.0.0.1');
    else {
      console.error('error: ' + e.message);
      process.exit(1);
    }
  });
  server.on('listening', () => {
    const address = `http://localhost:${port}`;
    console.log(`Video Manual Studio: ${address}`);
    console.log(`project: ${rel(root)}`);
    console.log('Requests sent from the studio are picked up with: node studio.mjs wait ' + rel(root));
    if (flags.open) {
      const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      spawn(opener, [address], { stdio: 'ignore', shell: process.platform === 'win32', detached: true }).on('error', () => {});
    }
  });
  server.listen(port, '127.0.0.1');
}

if (cmd === 'wait') await cmdWait();
else if (cmd === 'pending') cmdPending();
else if (cmd === 'done') cmdDone();
else cmdServe();
