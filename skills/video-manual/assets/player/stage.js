/*
 * Stage renderer for video manuals.
 *
 * `VMStage.create(stageEl, profile, images).mount(storyboard)` builds the
 * picture and returns a `render(t)` that sets every style from the compiled
 * timeline. No CSS animations or timers drive the picture, so seeking to any
 * time gives exactly the same frame every time — which is what makes
 * frame-accurate capture, live editing and the studio preview possible.
 */
(function (root) {
  'use strict';

  const T = root.VMTimeline;
  const { ease, prog, clamp } = T;
  const DIM = '8, 12, 24';

  const $ = (tag, cls, parent) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (parent) parent.appendChild(el);
    return el;
  };

  function readableOn(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#ffffff';
    const n = parseInt(m[1], 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.62 ? '#0b0d12' : '#ffffff';
  }

  // Background templates. Each takes the canvas colours [from, to], the accent,
  // and a faint ink colour that suits the tone, and returns a CSS background.
  const base = (c) => `linear-gradient(135deg, ${c[0]} 0%, ${c[1]} 100%)`;
  const TEMPLATES = {
    plain: (c) => c[0],
    gradient: (c) => base(c),
    glow: (c, a) =>
      `radial-gradient(circle at 16% 10%, color-mix(in srgb, ${a} 40%, transparent) 0, transparent 46%), ` +
      `radial-gradient(circle at 88% 92%, color-mix(in srgb, ${a} 28%, transparent) 0, transparent 52%), ${base(c)}`,
    grid: (c, a, ink) =>
      `linear-gradient(${ink} 1px, transparent 1px) 0 0 / 64px 64px, ` +
      `linear-gradient(90deg, ${ink} 1px, transparent 1px) 0 0 / 64px 64px, ${base(c)}`,
    dots: (c, a, ink) => `radial-gradient(${ink} 2px, transparent 2.6px) 0 0 / 40px 40px, ${base(c)}`,
    spotlight: (c) => `radial-gradient(ellipse at 50% 36%, ${c[1]} 0, ${c[0]} 74%)`,
  };

  // `canvas.template` + `canvas.colors` pick a template; without them the
  // profile's raw `canvas.background` is used as is.
  function canvasBackground(P) {
    const cv = P.canvas || {};
    const make = TEMPLATES[cv.template];
    if (!make || !Array.isArray(cv.colors) || cv.colors.length < 2) return cv.background;
    const light = readableOn(cv.colors[0]) !== '#ffffff';
    return make(cv.colors, P.colors.accent, light ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.07)');
  }

  // --- Animated text ------------------------------------------------------

  // Splits text into animatable units. Words stay unbroken (inline-block +
  // nowrap) so Korean wraps between words rather than mid-word. Text between
  // **double asterisks** is emphasised.
  function buildText(el, text, unit) {
    const units = [];
    let em = false;
    text.trim().split('\n').forEach((line, li) => {
      if (li) $('br', '', el);
      // Characters tagged with whether they are emphasised, grouped into words.
      const words = [[]];
      const chars = Array.from(line);
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === '*' && chars[i + 1] === '*') {
          em = !em;
          i++;
        } else if (/\s/.test(chars[i])) {
          if (words[words.length - 1].length) words.push([]);
        } else {
          words[words.length - 1].push({ ch: chars[i], em });
        }
      }
      const host = unit === 'line' ? $('span', 'vm-u', el) : el;
      if (unit === 'line') units.push(host);
      words.filter((w) => w.length).forEach((word, wi) => {
        if (wi) host.appendChild(document.createTextNode(' '));
        const w = $('span', 'vm-w', host);
        if (unit === 'word') {
          w.classList.add('vm-u');
          units.push(w);
        }
        // Runs of the same emphasis share one span, unless each character animates.
        let run = null;
        word.forEach(({ ch, em: isEm }) => {
          if (unit === 'char') {
            const c = $('span', isEm ? 'vm-u vm-em' : 'vm-u', w);
            c.textContent = ch;
            units.push(c);
          } else {
            if (!run || run.em !== isEm) {
              run = { em: isEm, el: $('span', isEm ? 'vm-em' : '', w) };
            }
            run.el.textContent += ch;
          }
        });
      });
    });
    return units;
  }

  function applyText(units, lt, cfg) {
    const st = T.staggerFor(units.length, cfg);
    for (let i = 0; i < units.length; i++) {
      const s = units[i].style;
      const t0 = i * st;
      if (cfg.animation === 'typewriter') {
        s.opacity = lt >= t0 ? 1 : 0;
        continue;
      }
      const k = ease(cfg.easing, prog(lt, t0, cfg.duration));
      s.opacity = prog(lt, t0, cfg.duration * 0.6);
      s.filter = '';
      switch (cfg.animation) {
        case 'fade-up':
          s.transform = `translateY(${(1 - k) * 0.55}em)`;
          break;
        case 'slide-in':
          s.transform = `translateX(${(k - 1) * 0.7}em)`;
          break;
        case 'pop':
          s.transform = `scale(${0.4 + 0.6 * k})`;
          break;
        case 'blur-in':
          s.transform = `translateY(${(1 - k) * 0.2}em)`;
          s.filter = `blur(${Math.max(0, 1 - k) * 0.3}em)`;
          break;
        default: // 'fade'
          s.transform = '';
      }
    }
  }

  // --- Stage ---------------------------------------------------------------

  function create(stage, P, IMGS) {
    stage.style.background = canvasBackground(P);
    stage.style.fontFamily = P.font.family;
    const vars = {
      '--font': P.font.family,
      '--accent': P.colors.accent,
      '--accent-text': P.colors.accentText || readableOn(P.colors.accent),
      '--text': P.colors.text,
      '--muted': P.colors.muted,
      '--cap-bg': P.colors.captionBg,
      '--cap-text': P.colors.captionText,
      '--cap-size': P.font.captionSize + 'px',
      '--cap-weight': P.font.captionWeight,
      '--cap-max': P.caption.maxWidth + 'px',
      '--title-size': P.font.titleSize + 'px',
      '--title-weight': P.font.titleWeight,
      '--sub-size': P.font.subtitleSize + 'px',
      '--frame-radius': P.frame.radius + 'px',
      '--frame-shadow': P.frame.shadow,
      '--chrome-bg': P.frame.chromeColor || '#eef0f4',
      '--chrome-fg': readableOn(P.frame.chromeColor || '#eef0f4'),
    };
    for (const k in vars) stage.style.setProperty(k, vars[k]);

    // Optional brand logo: on the title and outro cards, in the corner over
    // screens, or both.
    const brand = P.brand || {};
    const logoSrc = brand.logoSrc || '';
    const logoOn = brand.logoPlacement || 'cards';

    function mount(sb) {
      stage.textContent = '';
      const TL = T.compile(sb, P, IMGS);
      const W = TL.meta.width;
      const H = TL.meta.height;
      stage.style.width = W + 'px';
      stage.style.height = H + 'px';
      const scenesOf = (shot) => TL.scenes.filter((sc) => sc.shot === shot.index);

      TL.shots.forEach((shot) => {
        const layer = $('div', 'vm-shot', stage);
        shot.el = layer;

        if (shot.kind === 'card') {
          const sc = scenesOf(shot)[0];
          const card = $('div', 'vm-card vm-' + sc.type, layer);
          shot.card = { scene: sc, titleUnits: [], subUnits: [] };
          if (logoSrc && logoOn !== 'corner') {
            shot.card.logo = $('img', 'vm-logo', card);
            shot.card.logo.src = logoSrc;
          }
          if (sc.title) shot.card.titleUnits = buildText($('h1', '', card), sc.title, P.text.unit);
          shot.card.rule = $('div', 'vm-rule', card);
          if (sc.subtitle) shot.card.subUnits = buildText($('p', '', card), sc.subtitle, P.text.unit);
          return;
        }

        const L = shot.layout;
        const frame = $('div', 'vm-frame is-' + L.mode, layer);
        Object.assign(frame.style, { left: L.frame.x + 'px', top: L.frame.y + 'px', width: L.frame.w + 'px', height: L.frame.h + 'px' });
        if (L.mode === 'browser') {
          const bar = $('div', 'vm-chrome', frame);
          bar.style.height = L.chromeH + 'px';
          $('i', '', bar);
          $('i', '', bar);
          $('i', '', bar);
          if (TL.meta.url) $('span', '', bar).textContent = TL.meta.url;
        }
        const view = $('div', 'vm-view', frame);
        Object.assign(view.style, { left: L.bezel + 'px', top: L.bezel + L.chromeH + 'px', width: L.view.w + 'px', height: L.view.h + 'px' });
        const content = $('div', 'vm-content', view);
        Object.assign(content.style, { width: L.coordW + 'px', height: L.coordH + 'px' });
        $('img', '', content).src = IMGS[shot.image].src;
        shot.content = content;

        shot.typed.forEach((ty) => {
          const [x, y, w, h] = ty.rect;
          const el = $('div', 'vm-typed', content);
          Object.assign(el.style, {
            left: x + 'px',
            top: y + 'px',
            width: w + 'px',
            height: h + 'px',
            fontSize: (ty.fontSize || h * 0.42) + 'px',
            color: ty.color || '#111827',
            background: ty.bg || 'transparent',
            paddingLeft: (ty.padding == null ? h * 0.3 : ty.padding) + 'px',
          });
          ty.textEl = $('span', '', el);
          ty.caret = $('span', 'vm-caret', el);
          ty.el = el;
          ty.chars = Array.from(ty.text);
        });

        shot.highlights.forEach((h) => {
          h.el = $('div', 'vm-hl', content);
          if (h.label) {
            h.labelEl = $('div', 'vm-hl-label', h.el);
            h.labelEl.textContent = h.label;
          }
        });
      });

      // Overlays, in stacking order: callouts, ripples, cursor, captions.
      TL.shots.forEach((shot) => {
        shot.texts.forEach((b) => {
          b.el = $('div', 'vm-pop is-' + b.style, stage);
          b.units = buildText($('div', 'vm-pop-body', b.el), b.text, b.cfg.unit);
          if (b.style === 'bubble') b.tail = $('i', 'vm-pop-tail', b.el);
        });
      });

      const ripples = TL.clicks.map(() => $('div', 'vm-ripple', stage));

      const cursor = $('div', 'vm-cursor is-' + P.cursor.style, stage);
      const CS = P.cursor.size;
      cursor.style.width = cursor.style.height = CS + 'px';
      // Hotspot: the arrow's tip, or the dot's centre.
      const hot = P.cursor.style === 'dot' ? { x: CS / 2, y: CS / 2 } : { x: (CS * 4) / 24, y: (CS * 2) / 24 };
      cursor.style.transformOrigin = `${hot.x}px ${hot.y}px`;
      cursor.innerHTML =
        P.cursor.style === 'dot'
          ? ''
          : '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M4 2v18l4.6-4.3 3.1 6.9 2.8-1.3-3.1-6.7h6.3z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';

      const capzone = $('div', 'vm-capzone', stage);
      capzone.style.height = P.caption.zone + 'px';
      const captions = [];
      TL.scenes.forEach((sc) => {
        sc.captions.forEach((cap) => {
          cap.el = $('div', 'vm-caption is-' + P.caption.style, capzone);
          if (P.caption.showStep) $('div', 'vm-step', cap.el).textContent = sc.step + '/' + TL.totalSteps;
          cap.units = buildText($('div', 'vm-captext', cap.el), cap.text, P.text.unit);
          captions.push(cap);
        });
      });
      const lastCap = captions[captions.length - 1];

      let cornerLogo = null;
      if (logoSrc && (logoOn === 'corner' || logoOn === 'both')) {
        cornerLogo = $('img', 'vm-logo-corner', capzone);
        cornerLogo.src = logoSrc;
        cornerLogo.style.left = P.canvas.padding + 'px';
      }

      const progress = P.progress ? $('div', 'vm-progress', stage) : null;

      function renderShot(shot, k, t) {
        const next = TL.shots[k + 1];
        const visible = t >= shot.t0 && (!next || t < next.t0 + TL.trD);
        shot.el.style.display = visible ? '' : 'none';
        if (!visible) return;

        const kin = k === 0 ? 1 : ease(P.transition.easing, prog(t, shot.t0, TL.trD));
        const kout = next ? ease(P.transition.easing, prog(t, next.t0, TL.trD)) : 0;
        // When the next screen has the same frame, this one stays solid underneath
        // so the frame does not flicker through to the background.
        const stays = next && next.keepPrev;
        shot.el.style.opacity = kin * (stays ? 1 : 1 - kout);
        let tf = '';
        if (P.transition.type === 'slide') tf = `translateX(${(1 - kin) * 90 - (stays ? 0 : kout * 90)}px)`;
        else if (P.transition.type === 'crossfade' && !shot.keepPrev) tf = `scale(${0.985 + 0.015 * kin})`;
        shot.el.style.transform = tf;

        if (shot.kind === 'card') {
          const lt = t - shot.card.scene.textT0;
          applyText(shot.card.titleUnits, lt, P.text);
          applyText(shot.card.subUnits, lt - 0.35, P.text);
          const r = ease('easeOutCubic', prog(lt, 0.15, 0.6));
          shot.card.rule.style.transform = `scaleX(${r})`;
          shot.card.rule.style.opacity = r;
          if (shot.card.logo) {
            const lg = ease('easeOutCubic', prog(lt, -0.1, 0.6));
            shot.card.logo.style.opacity = lg;
            shot.card.logo.style.transform = `translateY(${(1 - lg) * 12}px)`;
          }
          return;
        }

        const L = shot.layout;
        const cam = T.evalCam(shot, t);
        const p = T.stagePos(L, cam, 0, 0);
        const S = p.S;
        shot.content.style.transform = `translate(${p.tx}px, ${p.ty}px) scale(${S})`;

        for (const h of shot.highlights) {
          const on = t >= h.t0 && t <= h.t1;
          h.el.style.display = on ? '' : 'none';
          if (!on) continue;
          const hin = ease(P.highlight.easing, prog(t, h.t0, P.highlight.duration));
          const a = clamp(prog(t, h.t0, P.highlight.duration * 0.6), 0, 1) * (1 - prog(t, h.t1 - 0.25, 0.25));
          const pulse = P.highlight.pulse ? 1 + 0.5 * Math.max(0, Math.sin((t - h.t0 - P.highlight.duration) * 5)) : 1;
          // Starts loose and tightens onto the target; all sizes are divided by S
          // so the ring keeps its stage thickness while the camera zooms.
          const grow = (P.highlight.padding * pulse + (1 - hin) * 18) / S;
          const bw = P.highlight.width / S;
          const [x, y, w, hh] = h.rect;
          Object.assign(h.el.style, {
            left: x - grow - bw + 'px',
            top: y - grow - bw + 'px',
            width: w + (grow + bw) * 2 + 'px',
            height: hh + (grow + bw) * 2 + 'px',
            borderWidth: bw + 'px',
            borderRadius: (P.highlight.radius + P.highlight.padding) / S + 'px',
            opacity: a,
            boxShadow:
              `0 0 0 9999px rgba(${DIM}, ${P.highlight.dim})` +
              (P.highlight.glow ? `, 0 0 ${28 / S}px color-mix(in srgb, var(--accent) ${P.highlight.glow * 100}%, transparent)` : ''),
          });
          if (h.labelEl) {
            const below = (y - grow) * S < 70;
            Object.assign(h.labelEl.style, {
              transform: `scale(${1 / S})`,
              transformOrigin: below ? '0 0' : '0 100%',
              top: below ? `calc(100% + ${12 / S}px)` : 'auto',
              bottom: below ? 'auto' : `calc(100% + ${12 / S}px)`,
            });
          }
        }

        for (const ty of shot.typed) {
          const on = t >= ty.t0;
          ty.el.style.display = on ? '' : 'none';
          if (!on) continue;
          const n = Math.floor(prog(t, ty.t0, ty.d) * ty.chars.length + 1e-6);
          ty.textEl.textContent = ty.chars.slice(0, n).join('');
          const since = t - (ty.t0 + ty.d);
          ty.caret.style.opacity = since < 0 ? 1 : since < 1.2 && Math.floor(since * 2.5) % 2 === 0 ? 1 : 0;
        }
      }

      // Callouts live in stage space so they keep their size while the camera
      // zooms, but stay pinned to a point on the screenshot.
      function renderTexts(shot, t) {
        if (shot.kind !== 'screen') return;
        const L = shot.layout;
        for (const b of shot.texts) {
          const on = t >= b.t0 && t < b.t1;
          b.el.style.display = on ? '' : 'none';
          if (!on) continue;
          const kin = ease(P.text.easing, prog(t, b.t0, 0.35));
          const a = prog(t, b.t0, 0.2) * (1 - prog(t, b.t1 - 0.2, 0.2));
          b.el.style.opacity = a;
          applyText(b.units, t - b.t0 - 0.1, b.cfg);
          const sc = 0.86 + 0.14 * kin;
          if (b.style === 'banner' || !b.uv) {
            const cx = L.view.x + L.view.w / 2;
            const cy = L.view.y + L.view.h / 2;
            b.el.style.transformOrigin = '50% 50%';
            b.el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(${sc})`;
            continue;
          }
          const sp = T.stagePos(L, T.evalCam(shot, t), b.uv.u, b.uv.v);
          const w = b.el.offsetWidth;
          const h = b.el.offsetHeight;
          const gap = 26;
          const place = b.place || (sp.y - L.view.y < h + gap + 30 ? 'bottom' : 'top');
          let x;
          let y;
          if (place === 'top' || place === 'bottom') {
            x = clamp(sp.x - w / 2, 24, W - w - 24);
            y = place === 'top' ? sp.y - gap - h : sp.y + gap;
            const tx = clamp(sp.x - x, 22, w - 22);
            Object.assign(b.tail.style, { left: tx + 'px', top: place === 'top' ? '100%' : '0' });
            b.el.style.transformOrigin = `${tx}px ${place === 'top' ? h : 0}px`;
          } else {
            y = clamp(sp.y - h / 2, 24, H - h - 24);
            x = place === 'left' ? sp.x - gap - w : sp.x + gap;
            const ty = clamp(sp.y - y, 18, h - 18);
            Object.assign(b.tail.style, { top: ty + 'px', left: place === 'left' ? '100%' : '0' });
            b.el.style.transformOrigin = `${place === 'left' ? w : 0}px ${ty}px`;
          }
          b.el.style.transform = `translate(${x}px, ${y}px) scale(${sc})`;
        }
      }

      function renderOverlays(t) {
        // The shot that owns the cursor right now.
        let k = 0;
        while (k + 1 < TL.shots.length && t >= TL.shots[k + 1].t0) k++;
        const curShot = TL.shots[k];
        let host = curShot;
        let fade = 1;
        if (curShot.kind === 'card') {
          // Fade the cursor out over the screen it was last on.
          host = null;
          for (let j = k - 1; j >= 0; j--) if (TL.shots[j].kind === 'screen') { host = TL.shots[j]; break; }
          fade = 1 - prog(t, curShot.t0, TL.trD * 0.5 || 0.001);
        } else if (k > 0 && TL.shots[k - 1].kind === 'card') {
          fade = prog(t, curShot.t0 + TL.trD * 0.5, TL.trD * 0.5 || 0.001);
        }

        // The corner logo shows over screens only, fading with the cursor.
        if (cornerLogo) cornerLogo.style.opacity = curShot.kind === 'card' && k === 0 ? 0 : fade;

        const pos = TL.cursorShowT == null ? null : T.evalCursor(TL, t);
        const show = pos && host && fade > 0 && t >= TL.cursorShowT;
        cursor.style.display = show ? '' : 'none';
        if (show) {
          const sp = T.stagePos(host.layout, T.evalCam(host, t), pos.u, pos.v);
          let press = 1;
          for (const c of TL.clicks) {
            const ck = (t - c.t) / 0.3;
            if (ck > 0 && ck < 1) press = 1 - (1 - P.click.press) * Math.sin(Math.PI * ck);
          }
          cursor.style.opacity = fade * prog(t, TL.cursorShowT, 0.25);
          cursor.style.transform = `translate(${sp.x - hot.x}px, ${sp.y - hot.y}px) scale(${press})`;
        }

        TL.clicks.forEach((c, i) => {
          const r = ripples[i];
          const rk = prog(t, c.t, P.click.rippleDuration);
          const on = t >= c.t && rk < 1;
          r.style.display = on ? '' : 'none';
          if (!on) return;
          const shot = TL.shots[c.shot];
          const sp = T.stagePos(shot.layout, T.evalCam(shot, t), c.u, c.v);
          const size = P.click.rippleSize * ease('easeOutCubic', rk);
          Object.assign(r.style, {
            left: sp.x - size / 2 + 'px',
            top: sp.y - size / 2 + 'px',
            width: size + 'px',
            height: size + 'px',
            opacity: (1 - rk) * 0.9,
          });
        });

        for (const cap of captions) {
          const on = t >= cap.t0 && t < cap.t1;
          cap.el.style.display = on ? '' : 'none';
          if (!on) continue;
          const lt = t - cap.t0;
          const kin = ease('easeOutCubic', prog(lt, 0, 0.3));
          const out = cap === lastCap ? 0 : prog(t, cap.t1 - 0.2, 0.2);
          cap.el.style.opacity = kin * (1 - out);
          cap.el.style.transform = `translate(-50%, -50%) translateY(${(1 - kin) * 14}px)`;
          applyText(cap.units, lt - 0.08, P.text);
        }

        if (progress) progress.style.width = (t / TL.duration) * 100 + '%';
      }

      return {
        TL,
        render(t) {
          TL.shots.forEach((shot, k) => renderShot(shot, k, t));
          TL.shots.forEach((shot) => renderTexts(shot, t));
          renderOverlays(t);
        },
      };
    }

    return { mount };
  }

  root.VMStage = { create, readableOn, canvasBackground, templates: Object.keys(TEMPLATES) };
})(window);
