/*
 * Shared logic for build.mjs and studio.mjs: presets, profile resolution,
 * image sizes, storyboard validation (including voice rules) and HTML output.
 * No dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ASSETS = path.join(HERE, '..', 'assets');
export const PRESETS = path.join(ASSETS, 'profiles');
export const DEFAULT_PRESET = 'calm-professional';
export const PROFILE_FILE = 'product-profile.json';

export const TEXT_ANIMS = ['fade', 'fade-up', 'slide-in', 'pop', 'blur-in', 'typewriter'];
const TEXT_UNITS = ['line', 'word', 'char'];
const TRANSITIONS = ['crossfade', 'slide', 'cut'];
const CHROMES = ['auto', 'browser', 'phone', 'none'];
const ACTIONS = ['move', 'click', 'highlight', 'zoom', 'zoom-out', 'type', 'caption', 'text', 'wait'];
const IMAGE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif' };

// A problem the user can fix (bad path, bad JSON), as opposed to a bug.
export class UserError extends Error {}

const asset = (...p) => fs.readFileSync(path.join(ASSETS, ...p), 'utf8');
const timelineJs = asset('player', 'timeline.js');
vm.runInThisContext(timelineJs, { filename: 'timeline.js' });
export const T = globalThis.VMTimeline;

export function readJson(file, what) {
  if (!fs.existsSync(file)) throw new UserError(`${what} not found: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new UserError(`${what} is not valid JSON (${file}): ${e.message}`);
  }
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export function merge(base, over) {
  const out = { ...base };
  for (const k of Object.keys(over || {})) out[k] = isObj(base[k]) && isObj(over[k]) ? merge(base[k], over[k]) : over[k];
  return out;
}

export const presetNames = () => fs.readdirSync(PRESETS).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
export function loadPreset(name) {
  const file = path.join(PRESETS, name + '.json');
  if (!fs.existsSync(file)) throw new UserError(`unknown preset "${name}". Available: ${presetNames().join(', ')}`);
  return readJson(file, 'preset');
}

export const imageMime = (file) => IMAGE_TYPES[path.extname(file).toLowerCase()] || null;

/*
 * A profile only has to list what it changes: everything else comes from the
 * preset named in "extends". The logo path is turned into something the page
 * can load: a data URI for a standalone build, or a URL when `logoUrl` maps a
 * file path to one (the studio serves files itself).
 */
export function resolveProfile(raw, { baseDir, logoUrl } = {}) {
  const profile = merge(loadPreset((raw && raw.extends) || DEFAULT_PRESET), raw || {});
  const logo = profile.brand && profile.brand.logo;
  if (logo && baseDir) {
    const file = path.resolve(baseDir, logo);
    if (fs.existsSync(file) && imageMime(file)) {
      profile.brand = {
        ...profile.brand,
        logoSrc: logoUrl ? logoUrl(file) : `data:${imageMime(file)};base64,${fs.readFileSync(file).toString('base64')}`,
      };
    }
  }
  return profile;
}

// Where a storyboard's profile comes from: a flag, the storyboard's own
// "profile" field, or product-profile.json beside it or one folder up.
export function findProfile(sbPath, sb, flag) {
  const dir = path.dirname(sbPath);
  if (flag) return { raw: readJson(path.resolve(flag), 'product profile'), source: path.resolve(flag) };
  if (isObj(sb.profile)) return { raw: sb.profile, source: null };
  if (typeof sb.profile === 'string') {
    if (presetNames().includes(sb.profile)) return { raw: { extends: sb.profile }, source: null };
    const file = path.resolve(dir, sb.profile);
    return { raw: readJson(file, 'product profile'), source: file };
  }
  const found = [path.join(dir, PROFILE_FILE), path.join(dir, '..', PROFILE_FILE)].find((p) => fs.existsSync(p));
  return found ? { raw: readJson(found, 'product profile'), source: found } : { raw: {}, source: null, missing: true };
}

export function imageSize(buf, file) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), mime: 'image/png' };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) { o++; continue; }
      const m = buf[o + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { width: buf.readUInt16BE(o + 7), height: buf.readUInt16BE(o + 5), mime: 'image/jpeg' };
      }
      o += 2 + buf.readUInt16BE(o + 2);
    }
  }
  throw new UserError(`unsupported image (use PNG or JPEG): ${file}`);
}

// Sizes (and optionally inlined data) of every screenshot a storyboard uses.
export function loadImages(sb, sbDir, { inline = true } = {}) {
  const images = {};
  for (const sc of Array.isArray(sb.scenes) ? sb.scenes : []) {
    if (sc.type !== 'screen' || !sc.image || images[sc.image]) continue;
    const file = path.resolve(sbDir, sc.image);
    if (!fs.existsSync(file)) continue; // reported by validate()
    const buf = fs.readFileSync(file);
    const size = imageSize(buf, file);
    images[sc.image] = { width: size.width, height: size.height };
    if (inline) images[sc.image].src = `data:${size.mime};base64,${buf.toString('base64')}`;
  }
  return images;
}

export function validate(sb, profile, images) {
  const errors = [];
  const warnings = [];
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const oneOf = (v, list, what) => { if (!list.includes(v)) errors.push(`profile ${what} "${v}" is not one of: ${list.join(', ')}`); };

  oneOf(profile.text.animation, TEXT_ANIMS, 'text.animation');
  oneOf(profile.text.unit, TEXT_UNITS, 'text.unit');
  oneOf(profile.transition.type, TRANSITIONS, 'transition.type');
  oneOf(profile.frame.chrome, CHROMES, 'frame.chrome');
  oneOf(profile.cursor.style, ['arrow', 'dot'], 'cursor.style');
  oneOf(profile.caption.style, ['bar', 'plain'], 'caption.style');
  for (const [where, name] of [
    ['text', profile.text.easing],
    ['cursor', profile.cursor.easing],
    ['highlight', profile.highlight.easing],
    ['zoom', profile.zoom.easing],
    ['transition', profile.transition.easing],
  ]) {
    if (!T.EASINGS[name]) errors.push(`profile ${where}.easing "${name}" is not one of: ${Object.keys(T.EASINGS).join(', ')}`);
  }

  if (!Array.isArray(sb.scenes) || !sb.scenes.length) {
    errors.push('"scenes" must be a non-empty array');
    return { errors, warnings };
  }

  // A caption is comfortable up to about two lines.
  const perLine = profile.caption.maxWidth / (profile.font.captionSize * 0.95);
  const meta = { width: 1920, height: 1080, ...(sb.meta || {}) };

  // Voice rules from the product profile, applied to everything a viewer reads.
  const voice = profile.voice || {};
  const avoid = Array.isArray(voice.avoid) ? voice.avoid : [];
  const endings = Array.isArray(voice.endings) ? voice.endings : [];
  const bare = (s) => T.plain(s).trim();
  const lintWords = (text, where) => {
    for (const rule of avoid) {
      const term = typeof rule === 'string' ? rule : rule.term;
      if (term && bare(text).includes(term)) {
        warnings.push(`${where}: uses "${term}"` + (rule.use ? ` — the voice profile says to use "${rule.use}"` : ' — the voice profile says to avoid it'));
      }
    }
  };
  const lintCaption = (text, where) => {
    lintWords(text, where);
    const width = T.textWidth(text);
    if (voice.maxWidth && width > voice.maxWidth) {
      warnings.push(`${where}: caption is ${Math.round(width)} wide chars, over the voice profile's limit of ${voice.maxWidth}. Shorten it or split the step.`);
    } else if (width > perLine * 2) {
      warnings.push(`${where}: caption runs past two lines (${Math.round(width)} wide chars, about ${Math.floor(perLine * 2)} fit). Shorten it or split the step.`);
    }
    // Quotes and brackets after the sentence end do not count.
    const tail = bare(text).replace(/["'”’)\]]+$/, '');
    if (endings.length && !endings.some((e) => tail.endsWith(e))) {
      warnings.push(`${where}: caption does not end with ${endings.map((e) => `"${e}"`).join(' or ')} as the voice profile requires — "${bare(text)}"`);
    }
  };

  sb.scenes.forEach((sc, i) => {
    const at = `scene ${i + 1} (${sc.type || '?'})`;
    if (!['title', 'screen', 'outro'].includes(sc.type)) {
      errors.push(`${at}: "type" must be title, screen or outro`);
      return;
    }
    if (sc.type !== 'screen') {
      if (!sc.title) errors.push(`${at}: needs a "title"`);
      lintWords((sc.title || '') + ' ' + (sc.subtitle || ''), at);
      return;
    }
    const img = images[sc.image];
    if (!img) {
      errors.push(`${at}: image not found: ${sc.image}`);
      return;
    }
    if (!sc.caption) warnings.push(`${at}: no caption — viewers will not know what this step is for`);
    else lintCaption(sc.caption, at);

    const L = T.layout(meta, profile, img, sc.coordWidth);
    const inX = (v) => num(v) && v >= 0 && v <= L.coordW;
    const inY = (v) => num(v) && v >= 0 && v <= L.coordH;
    const space = `${Math.round(L.coordW)}x${Math.round(L.coordH)}`;
    const point = (p, w) => {
      if (!Array.isArray(p) || p.length !== 2) errors.push(`${w} must be [x, y]`);
      else if (!inX(p[0]) || !inY(p[1])) errors.push(`${w} [${p}] is outside the screen (${space})`);
    };
    const rect = (r, w) => {
      if (!Array.isArray(r) || r.length !== 4) errors.push(`${w} must be [x, y, width, height]`);
      else if (!inX(r[0]) || !inY(r[1]) || !inX(r[0] + r[2]) || !inY(r[1] + r[3]) || r[2] <= 0 || r[3] <= 0) {
        errors.push(`${w} [${r}] is outside the screen (${space})`);
      }
    };

    (sc.actions || []).forEach((a, j) => {
      const w = `${at}, action ${j + 1} (${a.type})`;
      if (!ACTIONS.includes(a.type)) return errors.push(`${w}: unknown action. Use one of: ${ACTIONS.join(', ')}`);
      if (a.type === 'move') point(a.to, `${w}: "to"`);
      if (a.type === 'click' && a.at) point(a.at, `${w}: "at"`);
      if (a.type === 'highlight') rect(a.rect, `${w}: "rect"`);
      if (a.type === 'zoom') {
        if (a.rect) rect(a.rect, `${w}: "rect"`);
        else if (a.to) point(a.to, `${w}: "to"`);
        else errors.push(`${w}: needs "rect" or "to"`);
      }
      if (a.type === 'type') {
        rect(a.rect, `${w}: "rect"`);
        if (!a.text) errors.push(`${w}: needs "text"`);
      }
      if (a.type === 'caption') {
        if (!a.text) errors.push(`${w}: needs "text"`);
        else lintCaption(a.text, w);
      }
      if (a.type === 'text') {
        const style = a.style || 'bubble';
        if (!a.text) errors.push(`${w}: needs "text"`);
        else lintWords(a.text, w);
        if (!['bubble', 'banner'].includes(style)) errors.push(`${w}: "style" must be bubble or banner`);
        if (style === 'bubble') point(a.at, `${w}: "at"`);
        if (a.place && !['top', 'bottom', 'left', 'right'].includes(a.place)) errors.push(`${w}: "place" must be top, bottom, left or right`);
        if (a.animation && !TEXT_ANIMS.includes(a.animation)) errors.push(`${w}: "animation" must be one of: ${TEXT_ANIMS.join(', ')}`);
        if (a.duration != null && !num(a.duration)) errors.push(`${w}: "duration" must be a number`);
      }
      if (a.type === 'wait' && a.duration != null && !num(a.duration)) errors.push(`${w}: "duration" must be a number`);
    });
  });

  return { errors, warnings };
}

export function compile(sb, profile, images) {
  const dims = Object.fromEntries(Object.entries(images).map(([k, v]) => [k, { width: v.width, height: v.height }]));
  return T.compile(sb, profile, dims);
}

// "<" is escaped so no string in the data can close the <script> tag.
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// One self-contained HTML page: data, styles and scripts all inline.
export function renderHtml(sb, profile, images) {
  const meta = sb.meta || {};
  const parts = {
    LANG: escHtml(meta.lang || 'ko'),
    TITLE: escHtml(meta.title || 'Video manual'),
    CSS: asset('player', 'player.css'),
    STORYBOARD: json(sb),
    PROFILE: json(profile),
    IMAGES: json(images),
    TIMELINE_JS: timelineJs,
    STAGE_JS: asset('player', 'stage.js'),
    PLAYER_JS: asset('player', 'player.js'),
  };
  let html = asset('player', 'template.html');
  for (const [k, v] of Object.entries(parts)) html = html.replace(`{{${k}}}`, () => v);
  return html;
}

export function timingLines(TL) {
  const sec = (n) => n.toFixed(1).padStart(5) + 's';
  const flat = (s) => T.plain(s).replace(/\s+/g, ' ');
  const lines = ['  #  type    start    length  text'];
  for (const sc of TL.scenes) {
    const texts = sc.type === 'screen' ? sc.captions.map((c) => flat(c.text)) : [flat(sc.title)];
    lines.push(`${String(sc.index + 1).padStart(3)}  ${sc.type.padEnd(6)} ${sec(sc.t0)}  ${sec(sc.t1 - sc.t0)}  ${texts[0] || ''}`);
    texts.slice(1).forEach((l) => lines.push(' '.repeat(29) + '↳ ' + l));
  }
  lines.push(`total: ${TL.duration.toFixed(1)}s, ${TL.totalSteps} step(s), ${TL.meta.width}x${TL.meta.height} @ ${TL.meta.fps}fps`);
  return lines;
}

/*
 * Build a storyboard file into HTML. Returns the problems found rather than
 * exiting, so the CLI and the studio can each report them their own way.
 */
export function buildFile(sbPath, { profileFlag, out } = {}) {
  const sb = readJson(sbPath, 'storyboard');
  const sbDir = path.dirname(sbPath);
  const found = findProfile(sbPath, sb, profileFlag);
  const profile = resolveProfile(found.raw, { baseDir: found.source ? path.dirname(found.source) : sbDir });
  const images = loadImages(sb, sbDir);
  const { errors, warnings } = validate(sb, profile, images);
  if (found.missing) warnings.unshift(`no ${PROFILE_FILE} found, using the "${DEFAULT_PRESET}" preset with no voice rules.`);
  const result = { errors, warnings, profile, profileSource: found.source, extendsName: found.raw.extends || DEFAULT_PRESET };
  if (errors.length) return result;
  const html = renderHtml(sb, profile, images);
  const outPath = path.resolve(out || path.join(sbDir, 'out', 'manual.html'));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  return { ...result, outPath, size: html.length, TL: compile(sb, profile, images) };
}
