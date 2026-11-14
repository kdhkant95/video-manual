/*
 * Timeline compiler for video manuals.
 *
 * Pure logic, no DOM: turns a storyboard + motion profile + image sizes into a
 * list of timed tracks. It runs in two places — in the browser (player.js draws
 * from it) and in Node (build.mjs prints the scene timings) — so it must stay
 * free of browser and Node APIs.
 *
 * Everything on screen is a pure function of time `t` (seconds). That is what
 * makes frame-accurate MP4 capture possible: the renderer seeks to t = n / fps
 * and takes a screenshot, with no dependence on wall-clock time.
 */
(function (root) {
  'use strict';

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;

  const EASINGS = {
    linear: (t) => t,
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeOutQuint: (t) => 1 - Math.pow(1 - t, 5),
    easeInOutQuint: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
    easeOutExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    // The next two overshoot past 1 before settling: use for playful motion.
    easeOutBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
    spring: (t) => (t >= 1 ? 1 : 1 - Math.exp(-6.5 * t) * Math.cos(10 * t)),
  };

  const ease = (name, t) => (EASINGS[name] || EASINGS.easeOutCubic)(clamp(t, 0, 1));
  const prog = (t, t0, d) => (d <= 0 ? (t >= t0 ? 1 : 0) : clamp((t - t0) / d, 0, 1));

  // --- Text helpers -------------------------------------------------------

  const WIDE = /[ᄀ-ᇿ⺀-鿿가-힯＀-￯]/;

  // Width of a string in "wide character" units: a CJK glyph counts 1, a Latin
  // letter about half. Used for reading time and for line-length warnings.
  // Captions may mark emphasis with **double asterisks**; they are not shown.
  const plain = (text) => (text || '').replace(/\*\*/g, '');

  function textWidth(text) {
    let n = 0;
    for (const ch of plain(text)) n += WIDE.test(ch) ? 1 : /\s/.test(ch) ? 0.25 : 0.55;
    return n;
  }

  const readTime = (text, P) => textWidth(text) / P.pacing.readingCps;

  function countUnits(text, unit) {
    const s = plain(text).trim();
    if (!s) return 0;
    if (unit === 'line') return s.split('\n').length;
    if (unit === 'char') return Array.from(s.replace(/\s+/g, '')).length;
    return s.split(/\s+/).length;
  }

  // Long captions would take forever to finish animating at a fixed stagger, so
  // the spread between first and last unit is capped.
  function staggerFor(n, cfg) {
    const maxSpread = cfg.maxSpread == null ? 1.2 : cfg.maxSpread;
    return n <= 1 ? 0 : Math.min(cfg.stagger, maxSpread / (n - 1));
  }

  const textTotal = (text, cfg) => {
    const n = countUnits(text, cfg.unit);
    return n ? (n - 1) * staggerFor(n, cfg) + cfg.duration : 0;
  };

  // A text action may ask for its own animation; fill in settings that suit it
  // when the profile's are tuned for a different one.
  function textConfig(P, a) {
    if (!a.animation || a.animation === P.text.animation) return P.text;
    const cfg = Object.assign({}, P.text, { animation: a.animation });
    if (a.animation === 'typewriter') return Object.assign(cfg, { unit: 'char', stagger: 0.03, duration: 0.05, easing: 'linear', maxSpread: 1 });
    if (P.text.animation === 'typewriter') Object.assign(cfg, { unit: 'word', stagger: 0.05, duration: 0.5, easing: 'easeOutCubic', maxSpread: 1.2 });
    if (a.animation === 'pop') cfg.easing = 'easeOutBack';
    return cfg;
  }

  // --- Layout and camera --------------------------------------------------

  // Where the screenshot frame sits on the stage. `coordWidth` lets authors
  // write coordinates in a logical space (e.g. 1440 for a 2880px @2x export).
  function layout(meta, P, img, coordWidth) {
    const W = meta.width;
    const H = meta.height;
    const pad = P.canvas.padding;
    const zone = P.caption.zone;
    const mode = P.frame.chrome === 'auto' ? (img.width >= img.height ? 'browser' : 'phone') : P.frame.chrome;
    const chromeH = mode === 'browser' ? P.frame.chromeHeight : 0;
    const bezel = mode === 'phone' ? 14 : 0;
    const top = Math.round(pad * 0.75);
    const availW = W - pad * 2 - bezel * 2;
    const availH = H - top - zone - chromeH - bezel * 2;
    const fit = Math.min(availW / img.width, availH / img.height);
    const vw = img.width * fit;
    const vh = img.height * fit;
    const fw = vw + bezel * 2;
    const fh = vh + chromeH + bezel * 2;
    const fx = (W - fw) / 2;
    const fy = top + (H - top - zone - fh) / 2;
    const coordW = coordWidth || img.width;
    const coordH = (coordW * img.height) / img.width;
    return {
      mode,
      chromeH,
      bezel,
      frame: { x: fx, y: fy, w: fw, h: fh },
      view: { x: fx + bezel, y: fy + bezel + chromeH, w: vw, h: vh },
      coordW,
      coordH,
      fit: vw / coordW,
    };
  }

  const sameLayout = (a, b) =>
    !!a && !!b && ['x', 'y', 'w', 'h'].every((k) => Math.abs(a.view[k] - b.view[k]) < 0.5) && a.coordW === b.coordW;

  const validCam = (c) => {
    const s = Math.max(1, c.s);
    const half = 1 / (2 * s);
    return { s, cx: clamp(c.cx, half, 1 - half), cy: clamp(c.cy, half, 1 - half) };
  };

  function camForRect(L, rect, P, scale) {
    const [x, y, w, h] = rect;
    const auto = Math.min(P.zoom.maxScale, P.zoom.fill * Math.min(L.coordW / w, L.coordH / h));
    return validCam({ s: scale || auto, cx: (x + w / 2) / L.coordW, cy: (y + h / 2) / L.coordH });
  }

  // Content (u, v in 0..1 of the screenshot) -> stage pixels, under a camera.
  function stagePos(L, cam, u, v) {
    const S = L.fit * cam.s;
    const tx = L.view.w / 2 - cam.cx * L.coordW * S;
    const ty = L.view.h / 2 - cam.cy * L.coordH * S;
    return { x: L.view.x + tx + u * L.coordW * S, y: L.view.y + ty + v * L.coordH * S, S, tx, ty };
  }

  function uvAt(L, cam, x, y) {
    const p = stagePos(L, cam, 0, 0);
    return { u: (x - p.x) / (L.coordW * p.S), v: (y - p.y) / (L.coordH * p.S) };
  }

  function evalCam(shot, t) {
    let c = shot.camStart;
    for (const seg of shot.cam) {
      if (t < seg.t0) break;
      const k = ease(seg.ease, prog(t, seg.t0, seg.d));
      c = { s: lerp(seg.from.s, seg.to.s, k), cx: lerp(seg.from.cx, seg.to.cx, k), cy: lerp(seg.from.cy, seg.to.cy, k) };
    }
    return validCam(c);
  }

  function evalCursor(TL, t) {
    let pos = null;
    for (const seg of TL.cursorSegs) {
      if (t < seg.t0) break;
      const k = ease(seg.ease, prog(t, seg.t0, seg.d));
      const du = seg.to.u - seg.from.u;
      const dv = seg.to.v - seg.from.v;
      const bow = Math.sin(Math.PI * clamp(k, 0, 1)) * seg.arc;
      pos = { u: seg.from.u + du * k - dv * bow, v: seg.from.v + dv * k + du * bow };
    }
    return pos;
  }

  // --- Compile ------------------------------------------------------------

  const pad2 = (n) => String(n).padStart(2, '0');

  function compile(sb, P, images) {
    const meta = Object.assign({ width: 1920, height: 1080, fps: 30, lang: 'ko' }, sb.meta || {});
    const trD = P.transition.type === 'cut' ? 0 : P.transition.duration;
    const TL = {
      meta,
      trD,
      shots: [],
      scenes: [],
      cursorSegs: [],
      clicks: [],
      stills: [],
      cursorShowT: null,
      totalSteps: sb.scenes.filter((s) => s.type === 'screen').length,
      duration: 0,
    };

    let t = 0;
    let step = 0;
    let shot = null;
    let lastScreen = null;
    let cursor = null;

    sb.scenes.forEach((src, i) => {
      const isScreen = src.type === 'screen';
      const cw = isScreen ? src.coordWidth || null : null;
      const fresh = !isScreen || !shot || shot.kind !== 'screen' || shot.image !== src.image || shot.coordWidthRaw !== cw;

      if (fresh) {
        const prev = shot;
        shot = {
          index: TL.shots.length,
          kind: isScreen ? 'screen' : 'card',
          image: src.image || null,
          coordWidthRaw: cw,
          t0: t,
          t1: t,
          cam: [],
          camStart: { s: 1, cx: 0.5, cy: 0.5 },
          highlights: [],
          typed: [],
          texts: [],
          keepPrev: false,
        };
        if (isScreen) {
          shot.layout = layout(meta, P, images[src.image], cw);
          const continues = prev && prev.kind === 'screen' && sameLayout(prev.layout, shot.layout);
          // Same-size screens share one camera, so a zoom survives the screen
          // change instead of snapping back to full view.
          if (continues) {
            shot.camStart = prev.camNow;
            shot.keepPrev = true;
          } else if (cursor && lastScreen) {
            // Different geometry: keep the cursor at the same stage position.
            const p = stagePos(lastScreen.layout, lastScreen.camNow, cursor.u, cursor.v);
            cursor = uvAt(shot.layout, shot.camStart, p.x, p.y);
            TL.cursorSegs.push({ t0: t, d: 0, from: cursor, to: cursor, ease: 'linear', arc: 0 });
          }
          lastScreen = shot;
        }
        shot.camNow = shot.camStart;
        TL.shots.push(shot);
      }

      const enter = fresh && shot.index > 0 ? trD : 0;
      const sc = {
        index: i,
        type: src.type,
        shot: shot.index,
        t0: t,
        t1: t,
        textT0: t + enter * 0.5 + 0.1,
        caption: src.caption || '',
        title: src.title || '',
        subtitle: src.subtitle || '',
        step: null,
        captions: [],
      };

      if (isScreen) {
        sc.step = ++step;
        const L = shot.layout;
        const uv = (pt) => ({ u: pt[0] / L.coordW, v: pt[1] / L.coordH });
        const sceneHl = [];
        const sceneTexts = [];
        let cur = t + enter + P.pacing.beat;
        let readEnd = 0;

        // The caption can change mid-scene. Each one must stay up long enough
        // to be read before the next replaces it.
        let cap = null;
        const capReady = () => (cap ? cap.t0 + textTotal(cap.text, P.text) + readTime(cap.text, P) : 0);
        const say = (text, at) => {
          if (cap) cap.t1 = at;
          cap = { t0: at, t1: null, text };
          sc.captions.push(cap);
        };
        if (sc.caption) say(sc.caption, sc.textT0);

        const moveTo = (pt) => {
          const to = uv(pt);
          if (!cursor) {
            // First appearance: come in from just below-right of the target.
            cursor = { u: clamp(to.u + 0.16, 0.05, 0.95), v: clamp(to.v + 0.2, 0.05, 0.95) };
            TL.cursorShowT = cur - 0.2;
          }
          const a = stagePos(L, shot.camNow, cursor.u, cursor.v);
          const b = stagePos(L, shot.camNow, to.u, to.v);
          const dist = Math.hypot(b.x - a.x, b.y - a.y);
          const d = dist < 4 ? 0 : clamp(dist / P.cursor.speed, P.cursor.minDuration, P.cursor.maxDuration);
          TL.cursorSegs.push({ t0: cur, d, from: cursor, to, ease: P.cursor.easing, arc: P.cursor.arc });
          cursor = to;
          cur += d;
        };

        const endHighlights = (at) => sceneHl.forEach((h) => { if (h.t1 == null) h.t1 = at; });

        for (const a of src.actions || []) {
          switch (a.type) {
            case 'move':
              moveTo(a.to);
              break;
            case 'click':
              if (a.at) moveTo(a.at);
              if (cursor) {
                TL.clicks.push({ t: cur + 0.1, u: cursor.u, v: cursor.v, shot: shot.index });
                TL.stills.push({ t: cur + 0.25, label: `scene${pad2(i + 1)}-click` });
              }
              cur += P.click.duration;
              break;
            case 'highlight': {
              endHighlights(cur + 0.25); // one highlight at a time
              const h = { t0: cur, t1: null, rect: a.rect, label: a.label || '' };
              shot.highlights.push(h);
              sceneHl.push(h);
              cur += P.highlight.duration + (a.hold || 0);
              break;
            }
            case 'zoom':
            case 'zoom-out': {
              const to =
                a.type === 'zoom-out'
                  ? { s: 1, cx: 0.5, cy: 0.5 }
                  : a.rect
                    ? camForRect(L, a.rect, P, a.scale)
                    : validCam({ s: a.scale || P.zoom.maxScale, cx: a.to[0] / L.coordW, cy: a.to[1] / L.coordH });
              shot.cam.push({ t0: cur, d: P.zoom.duration, from: shot.camNow, to, ease: P.zoom.easing });
              shot.camNow = to;
              cur += P.zoom.duration;
              break;
            }
            case 'type': {
              const d = Array.from(a.text).length / P.pacing.typeCps;
              shot.typed.push({ t0: cur, d, rect: a.rect, text: a.text, fontSize: a.fontSize, color: a.color, bg: a.bg, padding: a.padding });
              cur += d + 0.3;
              break;
            }
            case 'caption':
              cur = Math.max(cur, capReady());
              say(a.text, cur);
              TL.stills.push({ t: cur + textTotal(a.text, P.text) + 0.1, label: `scene${pad2(i + 1)}-caption` });
              cur += Math.min(textTotal(a.text, P.text), 0.6);
              break;
            case 'text': {
              const cfg = textConfig(P, a);
              const tt = textTotal(a.text, cfg);
              const rt = readTime(a.text, P);
              const b = {
                t0: cur,
                t1: a.duration ? cur + a.duration : null,
                text: a.text,
                style: a.style || 'bubble',
                place: a.place || null,
                uv: a.at ? uv(a.at) : null,
                cfg,
              };
              shot.texts.push(b);
              sceneTexts.push(b);
              readEnd = Math.max(readEnd, cur + tt + rt);
              TL.stills.push({ t: cur + tt + 0.15, label: `scene${pad2(i + 1)}-text` });
              cur += a.duration || tt + Math.min(rt * 0.5, 1);
              break;
            }
            case 'wait':
              cur += a.duration == null ? 0.5 : a.duration;
              break;
          }
        }

        const settled = cur + 0.3;
        cur += P.pacing.hold + (src.hold || 0);
        sc.t1 = Math.max(cur, capReady() + 0.3, readEnd + 0.2, t + P.pacing.minScene);
        if (cap) cap.t1 = sc.t1;
        sceneTexts.forEach((b) => { if (b.t1 == null) b.t1 = sc.t1; });
        endHighlights(sc.t1);
        TL.stills.push({ t: Math.min(settled, sc.t1 - 0.25), label: `scene${pad2(i + 1)}-settled` });
      } else {
        const auto = enter + 0.8 + readTime(sc.title, P) * 1.3 + readTime(sc.subtitle, P) + 0.8;
        sc.t1 = t + (src.duration || Math.max(P.pacing.minScene, auto));
        TL.stills.push({ t: sc.t1 - 0.4, label: `scene${pad2(i + 1)}-card` });
      }

      TL.scenes.push(sc);
      t = sc.t1;
      shot.t1 = t;
    });

    TL.stills.sort((a, b) => a.t - b.t);
    TL.duration = t;
    return TL;
  }

  root.VMTimeline = {
    EASINGS,
    ease,
    prog,
    clamp,
    lerp,
    plain,
    textWidth,
    readTime,
    countUnits,
    staggerFor,
    layout,
    sameLayout,
    stagePos,
    uvAt,
    evalCam,
    evalCursor,
    compile,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
