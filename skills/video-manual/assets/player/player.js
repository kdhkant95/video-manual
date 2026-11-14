/*
 * Standalone preview page for a built video manual: playback controls and a
 * review panel around the stage renderer (stage.js).
 */
(function () {
  'use strict';

  const SB0 = window.__STORYBOARD__;
  const P = window.__PROFILE__;
  const IMGS = window.__IMAGES__;
  const T = window.VMTimeline;
  const { clamp } = T;
  const meta0 = Object.assign({ width: 1920, height: 1080, lang: 'ko' }, SB0.meta || {});
  const W = meta0.width;
  const H = meta0.height;
  const capture = /[?&]capture\b/.test(location.search);

  const $ = (tag, cls, parent) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (parent) parent.appendChild(el);
    return el;
  };

  const stage = document.getElementById('stage');
  if (capture) document.body.classList.add('capture');
  const mount = window.VMStage.create(stage, P, IMGS).mount;

  // --- Playback -----------------------------------------------------------

  let M = mount(SB0);
  let now = 0;
  function render(t) {
    now = clamp(t, 0, M.TL.duration);
    M.render(now);
  }

  const fitEl = document.getElementById('fit');
  function fit() {
    if (capture) return;
    const k = Math.min(fitEl.clientWidth / W, fitEl.clientHeight / H);
    stage.style.transform = `translate(-50%, -50%) scale(${k})`;
  }
  window.addEventListener('resize', fit);

  const btn = document.getElementById('play');
  const bar = document.getElementById('seek');
  const clock = document.getElementById('clock');
  const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  let playing = false;
  let lastTs = 0;
  let onTick = () => {};

  function syncUi() {
    bar.value = Math.round((now / M.TL.duration) * 1000);
    clock.textContent = fmt(now) + ' / ' + fmt(M.TL.duration);
    btn.textContent = playing ? '❚❚' : '▶';
    onTick();
  }
  function tick(ts) {
    if (!playing) return;
    render(now + (ts - lastTs) / 1000);
    lastTs = ts;
    if (now >= M.TL.duration) playing = false;
    syncUi();
    if (playing) requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    playing = on;
    if (on) {
      if (now >= M.TL.duration) render(0);
      lastTs = performance.now();
      requestAnimationFrame(tick);
    }
    syncUi();
  }
  function seekTo(t) {
    playing = false;
    render(t);
    syncUi();
  }
  btn.addEventListener('click', () => setPlaying(!playing));
  bar.addEventListener('input', () => seekTo((bar.value / 1000) * M.TL.duration));
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || /^(TEXTAREA|INPUT|BUTTON)$/.test(e.target.tagName)) return;
    e.preventDefault();
    setPlaying(!playing);
  });

  // Used by render.mjs to drive frame capture.
  window.__vm = {
    width: W,
    height: H,
    fps: M.TL.meta.fps,
    duration: M.TL.duration,
    stills: M.TL.stills,
    seek: render,
  };

  // --- Review panel -------------------------------------------------------
  //
  // Lets the reviewer reword any text and reorder scenes, see the change in the
  // video at once, and export the edited storyboard to hand back.

  const KO = /^ko/.test(meta0.lang);
  const L10N = KO
    ? {
        toggle: '✎ 문구·순서 수정',
        heading: '검수',
        hint: '문구를 고치거나 순서를 바꾸면 영상에 바로 반영됩니다. **단어**처럼 감싸면 강조됩니다. 끝나면 수정본을 내려받거나 복사해서 Claude에게 전달하세요.',
        save: '수정본 내려받기',
        copy: '복사',
        copied: '복사됨',
        reset: '되돌리기',
        dirty: '수정됨',
        clean: '변경 없음',
        up: '위로',
        down: '아래로',
        long: '두 줄을 넘습니다',
        kinds: { title: '타이틀', outro: '아웃트로' },
        fields: { caption: '자막', title: '제목', subtitle: '부제', mid: '중간 자막', text: '화면 텍스트', type: '입력되는 글자', label: '하이라이트 라벨' },
      }
    : {
        toggle: '✎ Edit text & order',
        heading: 'Review',
        hint: 'Reword any text or reorder the scenes and the video updates at once. Wrap words in **asterisks** to emphasise them. When you are done, download or copy the edited storyboard and hand it to Claude.',
        save: 'Download edits',
        copy: 'Copy',
        copied: 'Copied',
        reset: 'Reset',
        dirty: 'Edited',
        clean: 'No changes',
        up: 'Move up',
        down: 'Move down',
        long: 'Runs past two lines',
        kinds: { title: 'Title', outro: 'Outro' },
        fields: { caption: 'Caption', title: 'Title', subtitle: 'Subtitle', mid: 'Mid-step caption', text: 'On-screen text', type: 'Typed text', label: 'Highlight label' },
      };

  function setupEditor() {
    const original = JSON.stringify(SB0);
    let draft = JSON.parse(original);
    const maxWidth = (P.voice && P.voice.maxWidth) || Math.floor((P.caption.maxWidth / (P.font.captionSize * 0.95)) * 2);

    const controls = document.getElementById('controls');
    const toggle = $('button', 'vm-edit-toggle', controls);
    toggle.type = 'button';
    toggle.textContent = L10N.toggle;

    const panel = $('aside', '', document.body);
    panel.id = 'editor';
    const head = $('header', '', panel);
    $('h2', '', head).textContent = L10N.heading;
    $('p', '', head).textContent = L10N.hint;
    const list = $('div', 'vm-ed-list', panel);
    const foot = $('footer', '', panel);
    const status = $('span', 'vm-ed-status', foot);
    const mkBtn = (label, cls) => {
      const b = $('button', cls || '', foot);
      b.type = 'button';
      b.textContent = label;
      return b;
    };
    const resetBtn = mkBtn(L10N.reset);
    const copyBtn = mkBtn(L10N.copy);
    const saveBtn = mkBtn(L10N.save, 'primary');

    const exported = () => JSON.stringify(draft, null, 2) + '\n';
    const isDirty = () => JSON.stringify(draft) !== original;
    let cards = [];

    function remount(seekScene) {
      M = mount(draft);
      window.__vm.duration = M.TL.duration;
      window.__vm.stills = M.TL.stills;
      const sc = seekScene == null ? null : M.TL.scenes[seekScene];
      seekTo(sc ? Math.min(sc.t0 + 1.2, sc.t1 - 0.05) : Math.min(now, M.TL.duration));
      status.textContent = isDirty() ? '● ' + L10N.dirty : L10N.clean;
      status.classList.toggle('dirty', isDirty());
    }

    let timer = 0;
    function field(card, label, obj, key, i, checkLength) {
      const row = $('label', 'vm-ed-field', card);
      const cap = $('span', '', row);
      cap.textContent = label;
      const warn = $('em', '', cap);
      const ta = $('textarea', '', row);
      ta.value = obj[key] || '';
      ta.rows = 1;
      const size = () => {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 2 + 'px';
        warn.textContent = checkLength && T.textWidth(ta.value) > maxWidth ? ' · ' + L10N.long : '';
      };
      ta.addEventListener('input', () => {
        obj[key] = ta.value;
        size();
        clearTimeout(timer);
        timer = setTimeout(() => remount(i), 200);
      });
      ta.addEventListener('focus', () => {
        const sc = M.TL.scenes[i];
        if (sc && (now < sc.t0 || now >= sc.t1)) seekTo(Math.min(sc.t0 + 1.2, sc.t1 - 0.05));
      });
      requestAnimationFrame(size);
    }

    function move(i, d) {
      const j = i + d;
      if (j < 0 || j >= draft.scenes.length) return;
      const s = draft.scenes;
      [s[i], s[j]] = [s[j], s[i]];
      rebuild();
      remount(j);
      cards[j].scrollIntoView({ block: 'nearest' });
    }

    function rebuild() {
      list.textContent = '';
      cards = [];
      let step = 0;
      const total = draft.scenes.filter((s) => s.type === 'screen').length;
      draft.scenes.forEach((sc, i) => {
        const card = $('section', 'vm-ed-card', list);
        cards.push(card);
        const top = $('div', 'vm-ed-top', card);
        const badge = $('b', '', top);
        badge.textContent = sc.type === 'screen' ? ++step + '/' + total : L10N.kinds[sc.type] || sc.type;
        const name = $('span', '', top);
        name.textContent = sc.image ? sc.image.split('/').pop() : '';
        const arrow = (label, glyph, d) => {
          const b = $('button', '', top);
          b.type = 'button';
          b.title = label;
          b.setAttribute('aria-label', label);
          b.textContent = glyph;
          b.disabled = i + d < 0 || i + d >= draft.scenes.length;
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            move(i, d);
          });
        };
        arrow(L10N.up, '↑', -1);
        arrow(L10N.down, '↓', 1);
        top.addEventListener('click', () => {
          const s = M.TL.scenes[i];
          seekTo(Math.min(s.t0 + 1.2, s.t1 - 0.05));
        });

        if (sc.type === 'screen') {
          field(card, L10N.fields.caption, sc, 'caption', i, true);
          (sc.actions || []).forEach((a) => {
            if (a.type === 'caption') field(card, L10N.fields.mid, a, 'text', i, true);
            else if (a.type === 'text') field(card, L10N.fields.text, a, 'text', i, false);
            else if (a.type === 'type') field(card, L10N.fields.type, a, 'text', i, false);
            else if (a.type === 'highlight' && a.label) field(card, L10N.fields.label, a, 'label', i, false);
          });
        } else {
          field(card, L10N.fields.title, sc, 'title', i, false);
          field(card, L10N.fields.subtitle, sc, 'subtitle', i, false);
        }
      });
    }

    onTick = () => {
      const idx = M.TL.scenes.findIndex((s) => now >= s.t0 && now < s.t1);
      cards.forEach((c, i) => c.classList.toggle('on', i === idx));
    };

    toggle.addEventListener('click', () => {
      document.body.classList.toggle('editing');
      fit();
      rebuild();
      onTick();
    });
    resetBtn.addEventListener('click', () => {
      draft = JSON.parse(original);
      rebuild();
      remount();
    });
    saveBtn.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([exported()], { type: 'application/json' }));
      a.download = 'storyboard.edited.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(exported());
      } catch {
        const ta = $('textarea', '', document.body);
        ta.value = exported();
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      copyBtn.textContent = L10N.copied;
      setTimeout(() => (copyBtn.textContent = L10N.copy), 1500);
    });

    status.textContent = L10N.clean;
    // For automated checks of the review panel.
    window.__vmEditor = { draft: () => draft, exported };
    if (window.innerWidth >= 1200) toggle.click();
  }

  if (!capture) setupEditor();
  fit();
  render(0);
  syncUi();
  if (!capture) setPlaying(true);
})();
