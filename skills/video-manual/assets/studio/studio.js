/*
 * Video Manual Studio — the four-step workspace served by studio.mjs.
 *
 *   1. Project     product facts, brand, motion preset, background, logo
 *   2. Scenes      attach screenshots, or ask the AI to import a Figma link
 *   3. Storyboard  key screens and the text for each
 *   4. Video       watch, edit text and order, comment on frames for the AI
 *
 * Everything is saved to files in the project folder as you go. Buttons marked
 * "AI" queue a request there; an agent picks it up, does the work, and the
 * page refreshes when the files change.
 */
(function () {
  'use strict';

  const T = window.VMTimeline;
  const Stage = window.VMStage;
  const KO = /^ko/i.test(navigator.language || 'ko');

  const STR = KO
    ? {
        steps: ['프로젝트', '씬', '스토리보드', '영상'],
        newManual: '+ 새 매뉴얼',
        newManualPh: '매뉴얼 이름 (예: 새 작업 만들기)',
        create: '만들기',
        sure: '정말 삭제?',
        usedIn: (n) => `스토리보드 ${n}개 단계에서 사용 중`,
        ai: 'AI',
        aiIdle: 'AI 요청 없음',
        aiOpen: (n) => `AI 요청 ${n}건 진행 중`,
        reqTitle: 'AI 요청',
        reqHint: '요청은 프로젝트 폴더에 쌓이고 AI 에이전트가 가져가 처리합니다. 오래 "대기"에 머물면 에이전트에게 "스튜디오 요청 처리해 줘"라고 말하세요.',
        reqNone: '아직 요청이 없습니다.',
        cancel: '취소',
        status: { pending: '대기', working: 'AI 작업 중', done: '완료', open: '작성됨', sent: '전송됨', resolved: '반영됨' },
        types: { profile: '문체 규칙 만들기', scenes: 'Figma 화면 가져오기', draft: '스토리보드 초안 쓰기', produce: '영상 만들기', revise: '코멘트 반영' },
        saved: '저장됨',
        next: '다음 단계 →',
        // step 1
        s1Title: '프로덕트 프로젝트',
        s1Lead: '제품당 한 번만 정합니다. 이 제품의 모든 영상 매뉴얼이 같은 기준을 씁니다.',
        product: '제품',
        name: '제품 이름',
        desc: '한 줄 설명',
        domain: '도메인',
        domains: ['생산성·협업', '금융·결제', '헬스케어', '교육', '커머스·배달·여행', '개발자 도구·데이터', '공공 서비스', '게임·엔터테인먼트·소셜', '기타'],
        model: '사업 모델',
        age: '대상 연령',
        ages: ['전 연령', '어린이 (13세 미만)', '10대–20대 초반', '20–40대', '40–50대', '60대 이상'],
        device: '기기',
        devices: ['데스크톱', '모바일'],
        brand: '브랜드',
        accent: '강조색',
        logo: '로고 (선택)',
        logoAdd: '로고 올리기',
        logoRemove: '삭제',
        logoWhere: '로고 위치',
        logoPlaces: { cards: '타이틀·아웃트로', corner: '화면 왼쪽 아래', both: '둘 다' },
        guide: '브랜드 가이드',
        guideHint: '톤앤매너, 금지 표현, 용어 규칙 등을 붙여 넣으세요. AI가 문체 규칙을 만들 때 읽습니다.',
        motion: '모션 프리셋',
        presets: {
          'calm-professional': ['차분·정확', 'B2B, 금융, 헬스케어, 관리자 도구'],
          'friendly-playful': ['따뜻·발랄', '소비자 앱, 교육, 커뮤니티'],
          'sharp-technical': ['빠름·간결', '개발자 도구, 데이터, 인프라'],
          'premium-minimal': ['느림·여백', '디자인 도구, 브랜드 중심 제품'],
        },
        background: '배경 템플릿',
        templates: { preset: '프리셋 기본', plain: '단색', gradient: '그라데이션', glow: '글로우', grid: '격자', dots: '도트', spotlight: '스포트라이트' },
        tone: '톤',
        tones: { dark: '어둡게', light: '밝게' },
        bgColors: '배경색',
        voice: '문체 규칙',
        voiceNone: '아직 문체 규칙이 없습니다. 위 정보를 채운 뒤 AI에게 요청하면, 대상 연령·도메인·사업 모델과 브랜드 가이드에 맞춰 말투·끝맺음·금지어·용어를 정해 줍니다.',
        voiceAsk: 'AI에게 문체 규칙 요청',
        voiceRegister: '말투',
        voiceEndings: '끝맺음',
        voiceMax: '자막 최대 길이',
        voiceAvoid: '쓰지 않는 말',
        previewNote: '실제 프로파일로 그린 미리보기입니다. 값을 바꾸면 바로 반영됩니다.',
        sampleTitle: '제품 이름',
        sampleSub: '영상 매뉴얼',
        sampleCaption: '자막은 **이렇게** 표시됩니다.',
        // step 2
        s2Title: '씬 만들기',
        s2Lead: '영상에 나올 화면을 모읍니다. 클릭으로 화면이 바뀌는 지점마다 한 장씩 필요합니다.',
        needManual: '먼저 매뉴얼을 만드세요.',
        drop: '이미지를 여기에 끌어다 놓거나 눌러서 선택하세요 (PNG, JPEG)',
        uploading: '올리는 중…',
        del: '삭제',
        figma: 'Figma에서 가져오기',
        figmaUrl: 'Figma 링크',
        figmaNote: '메모 (선택) — 어떤 프레임을 쓸지 등',
        figmaAsk: 'AI에게 가져오기 요청',
        figmaHint: 'AI 에이전트가 Figma에 연결되어 있어야 합니다. 프레임을 이미지로 내보내 이 목록에 추가합니다.',
        // step 3
        s3Title: '스토리보드 초안',
        s3Lead: '키 화면을 순서대로 놓고, 각 화면에서 보여 줄 설명글을 씁니다. 여기서 문구와 순서를 확정하면 AI가 커서·하이라이트·확대를 입힙니다.',
        videoTitle: '영상 제목',
        goal: '이 영상으로 설명할 것',
        goalPh: '예: 보드에 새 작업을 만들고 담당자를 지정하는 방법',
        draftAsk: 'AI에게 초안 요청',
        fromScreens: '화면 전체로 빈 초안 만들기',
        addStep: '+ 화면 단계',
        addTitle: '+ 타이틀',
        addOutro: '+ 아웃트로',
        screen: '화면',
        caption: '설명글 (자막)',
        note: '연출 메모 — 어디를 누르는지, 무엇을 강조할지',
        title: '제목',
        subtitle: '부제',
        kinds: { title: '타이틀', outro: '아웃트로' },
        tooLong: '두 줄을 넘습니다',
        checks: '확인할 점',
        produce: '이대로 영상 만들기 요청 →',
        produceHint: 'AI가 각 단계에 클릭 위치·하이라이트·확대를 넣고, 프레임을 뽑아 위치를 검수합니다.',
        noScreens: '씬 단계에서 화면을 먼저 추가하세요.',
        // step 4
        s4Empty: '아직 스토리보드가 없습니다. 3단계에서 초안을 만드세요.',
        s4Errors: '스토리보드에 고칠 점이 있어 영상을 그릴 수 없습니다.',
        tabText: '문구·순서',
        tabComments: '코멘트',
        textHint: '고치면 영상에 바로 반영되고 저장됩니다. **단어**처럼 감싸면 강조됩니다.',
        fields: { caption: '자막', title: '제목', subtitle: '부제', mid: '중간 자막', text: '화면 텍스트', type: '입력되는 글자', label: '하이라이트 라벨' },
        cmtHint: '영상을 멈추고 그 프레임에 코멘트를 남기세요. 위치를 찍으면 AI가 정확히 어디를 말하는지 압니다.',
        cmtPh: '이 프레임에서 고칠 점을 적으세요',
        cmtAt: (t, n) => `${t} · 장면 ${n}`,
        pin: '📍 위치 찍기',
        pinOn: '영상에서 위치를 누르세요',
        pinSet: '📍 위치 지정됨 ✕',
        cmtAdd: '코멘트 추가',
        cmtSend: (n) => `AI에게 수정 요청 (${n})`,
        cmtNone: '아직 코멘트가 없습니다.',
        aiReply: 'AI',
        busy: 'AI가 이 매뉴얼을 작업 중입니다. 지금 고치면 AI의 변경과 겹칠 수 있습니다.',
        exportMp4: 'MP4 내보내기',
        rendering: (p) => `렌더링 중 ${p}%`,
        renderDone: '렌더링 완료',
        download: 'MP4 열기',
      }
    : {
        steps: ['Project', 'Scenes', 'Storyboard', 'Video'],
        newManual: '+ New manual',
        newManualPh: 'Manual name (e.g. Create a task)',
        create: 'Create',
        sure: 'Really delete?',
        usedIn: (n) => `Used by ${n} storyboard step${n > 1 ? 's' : ''}`,
        ai: 'AI',
        aiIdle: 'No AI requests',
        aiOpen: (n) => `${n} AI request${n > 1 ? 's' : ''} in progress`,
        reqTitle: 'AI requests',
        reqHint: 'Requests are queued in the project folder and picked up by your AI agent. If one stays "waiting", tell the agent to "handle the studio requests".',
        reqNone: 'No requests yet.',
        cancel: 'Cancel',
        status: { pending: 'waiting', working: 'AI working', done: 'done', open: 'draft', sent: 'sent', resolved: 'applied' },
        types: { profile: 'Write voice rules', scenes: 'Import Figma screens', draft: 'Draft the storyboard', produce: 'Produce the video', revise: 'Apply comments' },
        saved: 'Saved',
        next: 'Next step →',
        s1Title: 'Product project',
        s1Lead: 'Set once per product. Every video manual for this product shares it.',
        product: 'Product',
        name: 'Product name',
        desc: 'One-line description',
        domain: 'Domain',
        domains: ['Productivity & collaboration', 'Finance & payments', 'Healthcare', 'Education', 'Commerce, delivery & travel', 'Developer tools & data', 'Public services', 'Games, entertainment & social', 'Other'],
        model: 'Business model',
        age: 'Target age',
        ages: ['All ages', 'Children (under 13)', 'Teens to early 20s', '20s–40s', '40s–50s', '60 and over'],
        device: 'Device',
        devices: ['Desktop', 'Mobile'],
        brand: 'Brand',
        accent: 'Accent colour',
        logo: 'Logo (optional)',
        logoAdd: 'Upload logo',
        logoRemove: 'Remove',
        logoWhere: 'Logo placement',
        logoPlaces: { cards: 'Title & outro', corner: 'Bottom-left corner', both: 'Both' },
        guide: 'Brand guide',
        guideHint: 'Paste tone of voice, banned phrases, terminology rules. The AI reads this when writing the voice rules.',
        motion: 'Motion preset',
        presets: {
          'calm-professional': ['Calm & precise', 'B2B, finance, healthcare, admin tools'],
          'friendly-playful': ['Warm & bouncy', 'Consumer apps, education, community'],
          'sharp-technical': ['Fast & exact', 'Developer tools, data, infrastructure'],
          'premium-minimal': ['Slow & spacious', 'Design tools, brand-led products'],
        },
        background: 'Background template',
        templates: { preset: 'Preset default', plain: 'Plain', gradient: 'Gradient', glow: 'Glow', grid: 'Grid', dots: 'Dots', spotlight: 'Spotlight' },
        tone: 'Tone',
        tones: { dark: 'Dark', light: 'Light' },
        bgColors: 'Colours',
        voice: 'Voice rules',
        voiceNone: 'No voice rules yet. Fill in the facts above, then ask the AI: it sets the register, endings, banned words and terms from the target age, domain, business model and brand guide.',
        voiceAsk: 'Ask AI for voice rules',
        voiceRegister: 'Register',
        voiceEndings: 'Endings',
        voiceMax: 'Longest caption',
        voiceAvoid: 'Avoid',
        previewNote: 'A live preview drawn with the actual profile.',
        sampleTitle: 'Product name',
        sampleSub: 'Video manual',
        sampleCaption: 'Captions look **like this**.',
        s2Title: 'Scenes',
        s2Lead: 'Collect the screens the video will show: one image for every point where a click changes the screen.',
        needManual: 'Create a manual first.',
        drop: 'Drop images here, or click to choose (PNG, JPEG)',
        uploading: 'Uploading…',
        del: 'Delete',
        figma: 'Import from Figma',
        figmaUrl: 'Figma link',
        figmaNote: 'Note (optional) — which frames to use',
        figmaAsk: 'Ask AI to import',
        figmaHint: 'Your AI agent needs a Figma connection. It exports the frames as images and adds them to this list.',
        s3Title: 'Storyboard draft',
        s3Lead: 'Put the key screens in order and write the text for each. Once the wording and order are settled, the AI adds the cursor, highlights and zooms.',
        videoTitle: 'Video title',
        goal: 'What this video explains',
        goalPh: 'e.g. How to create a task on the board and assign it',
        draftAsk: 'Ask AI for a draft',
        fromScreens: 'Start a blank draft from all screens',
        addStep: '+ Screen step',
        addTitle: '+ Title',
        addOutro: '+ Outro',
        screen: 'Screen',
        caption: 'Text (caption)',
        note: 'Direction note — what is clicked, what to emphasise',
        title: 'Title',
        subtitle: 'Subtitle',
        kinds: { title: 'Title', outro: 'Outro' },
        tooLong: 'Runs past two lines',
        checks: 'To check',
        produce: 'Request the video from this →',
        produceHint: 'The AI adds click positions, highlights and zooms to each step, then checks frames to verify them.',
        noScreens: 'Add screens in the Scenes step first.',
        s4Empty: 'No storyboard yet. Draft one in step 3.',
        s4Errors: 'The storyboard has problems, so the video cannot be drawn.',
        tabText: 'Text & order',
        tabComments: 'Comments',
        textHint: 'Edits show in the video at once and are saved. Wrap words in **asterisks** to emphasise them.',
        fields: { caption: 'Caption', title: 'Title', subtitle: 'Subtitle', mid: 'Mid-step caption', text: 'On-screen text', type: 'Typed text', label: 'Highlight label' },
        cmtHint: 'Pause the video and comment on that frame. Pin a position so the AI knows exactly what you mean.',
        cmtPh: 'What should change in this frame?',
        cmtAt: (t, n) => `${t} · scene ${n}`,
        pin: '📍 Pin a position',
        pinOn: 'Click a position in the video',
        pinSet: '📍 Position pinned ✕',
        cmtAdd: 'Add comment',
        cmtSend: (n) => `Ask AI to revise (${n})`,
        cmtNone: 'No comments yet.',
        aiReply: 'AI',
        busy: 'The AI is working on this manual. Edits made now may collide with its changes.',
        exportMp4: 'Export MP4',
        rendering: (p) => `Rendering ${p}%`,
        renderDone: 'Render complete',
        download: 'Open MP4',
      };

  // --- Helpers ------------------------------------------------------------

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  const enc = encodeURIComponent;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const merge = (base, over) => {
    const out = { ...base };
    for (const k of Object.keys(over || {})) out[k] = isObj(base[k]) && isObj(over[k]) ? merge(base[k], over[k]) : over[k];
    return out;
  };
  const debounce = (fn, ms) => {
    let id;
    return (...a) => {
      clearTimeout(id);
      id = setTimeout(() => fn(...a), ms);
    };
  };
  // A debounced save that can be flushed. Anything that reloads the page's
  // state, leaves the step or hands work to the AI flushes these first, so a
  // late save can never overwrite what came after it.
  const waiting = new Set();
  const saver = (fn, ms) => {
    let id = 0;
    let args = [];
    const run = () => {
      id = 0;
      waiting.delete(d);
      return fn(...args);
    };
    const d = (...a) => {
      args = a;
      clearTimeout(id);
      id = setTimeout(run, ms);
      waiting.add(d);
    };
    d.flush = () => {
      if (!id) return;
      clearTimeout(id);
      return run();
    };
    return d;
  };
  const flushSaves = () => Promise.all([...waiting].map((d) => d.flush()));
  const fmt = (s) => Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0');

  // Blend two #rrggbb colours: k = 0 gives a, k = 1 gives b.
  function mix(a, b, k) {
    const p = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
    const [ca, cb] = [p(a), p(b)];
    return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * k).toString(16).padStart(2, '0')).join('');
  }

  // A button that asks for a second click before doing something destructive.
  // Native confirm() and prompt() are not used anywhere: embedded browsers
  // suppress them, which turns the button into one that silently does nothing.
  function confirmButton(label, action, title) {
    let armed = false;
    let timer = 0;
    const b = h('button', {
      type: 'button',
      class: 'btn sm ghost',
      text: label,
      title: title || '',
      onclick: async () => {
        if (!armed) {
          armed = true;
          b.textContent = STR.sure;
          b.classList.add('danger');
          timer = setTimeout(() => {
            armed = false;
            b.textContent = label;
            b.classList.remove('danger');
          }, 3500);
          return;
        }
        clearTimeout(timer);
        b.disabled = true;
        await action();
      },
    });
    return b;
  }

  function toast(msg) {
    const el = h('div', { class: 'toast', text: msg });
    document.getElementById('app').append(el);
    setTimeout(() => el.remove(), 4000);
  }

  async function api(method, url, body, raw) {
    const res = await fetch(url, {
      method,
      headers: { 'x-video-manual': '1', ...(raw ? {} : { 'Content-Type': 'application/json' }) },
      body: raw ? body : body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(data.error || res.statusText);
      throw new Error(data.error || res.statusText);
    }
    return data;
  }

  // --- State --------------------------------------------------------------

  const app = document.getElementById('app');
  let S = null;
  let known = '';
  let step = Number(sessionStorage.vmStep) || 1;
  let manual = sessionStorage.vmManual || '';
  let player = null; // the live stage of the current step, if any
  let softRefresh = null; // a step may handle a background refresh itself
  let popOpen = false;

  const q = () => (manual ? '?manual=' + enc(manual) : '');
  const openRequests = () => S.requests.filter((r) => r.status !== 'done');
  const images = () =>
    Object.fromEntries(
      (S.screens || []).map((s) => ['screens/' + s.name, { width: s.width, height: s.height, src: `/files/${enc(manual)}/screens/${enc(s.name)}?v=${enc(s.v)}` }]),
    );

  async function load(render = true) {
    if (render) await flushSaves();
    const old = S;
    S = await (await fetch('/api/state' + q())).json();
    known = S.version;
    manual = S.manual || '';
    sessionStorage.vmManual = manual;
    if (!render) return renderTop();
    if (old && softRefresh && softRefresh(old)) return renderTop();
    renderAll();
  }

  // Save, then refresh derived state (lint, resolved profile) without
  // rebuilding the form the user is typing in.
  async function save(method, url, body, raw) {
    const r = await api(method, url, body, raw);
    await load(false);
    return r;
  }

  async function request(type, payload) {
    await flushSaves();
    await api('POST', '/api/requests', { type, manual: manual || null, payload: payload || {} });
    await load();
  }

  setInterval(async () => {
    try {
      const v = await (await fetch('/api/version' + q())).json();
      if (v.version === known) return;
      // Do not pull the form out from under someone who is typing.
      const a = document.activeElement;
      if (a && /^(TEXTAREA|INPUT)$/.test(a.tagName) && step !== 4) return;
      await load();
    } catch {
      /* server restarting */
    }
  }, 1500);

  // --- Stage player -------------------------------------------------------

  function makePlayer(fitEl, profile, imgs) {
    const stageEl = h('div', { class: 'stage' });
    fitEl.append(stageEl);
    const stage = Stage.create(stageEl, profile, imgs);
    let M = null;
    let now = 0;
    let playing = false;
    let last = 0;
    let dead = false;
    const P = { loop: false, onTime: () => {}, stageEl };
    P.fit = () => {
      if (!M) return;
      const k = Math.min(fitEl.clientWidth / M.TL.meta.width, fitEl.clientHeight / M.TL.meta.height);
      stageEl.style.transform = `translate(-50%, -50%) scale(${k})`;
    };
    P.seek = (t) => {
      now = Math.max(0, Math.min(t, M.TL.duration));
      M.render(now);
      P.onTime();
    };
    function tick(ts) {
      if (!playing || dead) return;
      let t = now + (ts - last) / 1000;
      last = ts;
      if (t >= M.TL.duration) {
        if (P.loop) t = 0;
        else playing = false;
      }
      P.seek(t);
      if (playing) requestAnimationFrame(tick);
    }
    P.play = () => {
      if (now >= M.TL.duration) now = 0;
      playing = true;
      last = performance.now();
      requestAnimationFrame(tick);
      P.onTime();
    };
    P.pause = () => {
      playing = false;
      P.onTime();
    };
    P.toggle = () => (playing ? P.pause() : P.play());
    P.mount = (sb) => {
      M = stage.mount(sb);
      P.fit();
      P.seek(now);
    };
    P.destroy = () => {
      dead = true;
      window.removeEventListener('resize', P.fit);
    };
    Object.defineProperties(P, { now: { get: () => now }, playing: { get: () => playing }, TL: { get: () => M.TL } });
    window.addEventListener('resize', P.fit);
    return P;
  }

  // --- Shell --------------------------------------------------------------

  function renderTop() {
    const old = app.querySelector('.top');
    const open = openRequests();
    const top = h(
      'div',
      { class: 'top' },
      h('h1', { text: 'Video Manual Studio' }),
      h(
        'select',
        {
          title: S.project,
          onchange: (e) => {
            manual = e.target.value;
            load();
          },
        },
        S.manuals.length ? S.manuals.map((m) => h('option', { value: m, text: m, selected: m === manual })) : h('option', { text: '—' }),
      ),
      h('button', { class: 'btn sm ghost', text: STR.newManual, onclick: newManual }),
      h(
        'div',
        { class: 'steps' },
        STR.steps.map((name, i) =>
          h('button', { class: step === i + 1 ? 'on' : '', onclick: () => go(i + 1) }, h('b', { text: String(i + 1) }), name),
        ),
      ),
      h('button', {
        class: 'pill' + (open.length ? ' busy' : ''),
        text: open.length ? STR.aiOpen(open.length) : STR.aiIdle,
        onclick: () => {
          popOpen = !popOpen;
          renderTop();
        },
      }),
    );
    if (old) old.replaceWith(top);
    else app.prepend(top);
    app.querySelector('.pop:not(.left)')?.remove();
    if (popOpen) app.append(requestsPop());
    // The name box is left alone while open, so typing survives a refresh.
    const naming = app.querySelector('.pop.left');
    if (newOpen && !naming) app.append(newManualPop());
    if (!newOpen && naming) naming.remove();
  }

  function requestCard(r) {
    return h(
      'div',
      { class: 'req' },
      h('span', { class: 'st ' + r.status, text: STR.status[r.status] }),
      h('b', { text: STR.types[r.type] || r.type }),
      r.manual ? h('span', { class: 'hint', text: '  ' + r.manual }) : null,
      r.reply ? h('p', { text: r.reply }) : null,
      r.status === 'pending'
        ? h('div', { style: 'margin-top:6px' }, h('button', { class: 'btn sm ghost', text: STR.cancel, onclick: async () => { await api('DELETE', '/api/requests?id=' + enc(r.id)); load(); } }))
        : null,
    );
  }

  function requestsPop() {
    const list = S.requests.slice().reverse();
    return h('div', { class: 'pop' }, h('h3', { text: STR.reqTitle }), h('div', { class: 'hint', text: STR.reqHint }), list.length ? list.map(requestCard) : h('p', { class: 'hint', text: STR.reqNone }));
  }

  let newOpen = false;
  function newManual() {
    newOpen = !newOpen;
    popOpen = false;
    renderTop();
  }
  async function createManual(name) {
    if (!name.trim()) return;
    newOpen = false;
    await flushSaves();
    const r = await api('POST', '/api/manuals', { name: name.trim() });
    manual = r.manual;
    step = Math.max(step, 2);
    sessionStorage.vmStep = step;
    await load();
  }
  function newManualPop() {
    const input = h('input', {
      type: 'text',
      placeholder: STR.newManualPh,
      onkeydown: (e) => {
        if (e.key === 'Enter' && !e.isComposing) createManual(input.value);
        if (e.key === 'Escape') newManual();
      },
    });
    setTimeout(() => input.focus());
    return h('div', { class: 'pop left' }, h('div', { class: 'row' }, input, h('button', { type: 'button', class: 'btn primary', text: STR.create, onclick: () => createManual(input.value) })));
  }

  async function go(n) {
    await flushSaves();
    step = n;
    sessionStorage.vmStep = n;
    renderAll();
  }

  function renderAll() {
    if (player) player.destroy();
    player = null;
    softRefresh = null;
    app.querySelector('.panel')?.remove();
    renderTop();
    const panel = h('div', { class: 'panel' });
    app.append(panel);
    [stepProject, stepScenes, stepStoryboard, stepVideo][step - 1](panel);
  }

  const field = (label, control, hint) => h('label', { class: 'f' }, h('span', { text: label }), control, hint ? h('div', { class: 'hint', text: hint }) : null);
  const text = (value, oninput, ph) => h('input', { type: 'text', value: value || '', placeholder: ph || '', oninput: (e) => oninput(e.target.value) });
  const area = (value, oninput, ph, rows) => h('textarea', { value: value || '', placeholder: ph || '', rows: rows || 2, oninput: (e) => oninput(e.target.value) });
  // Shows what is actually stored: an unset value appears as "—", and a value
  // written by hand or by the agent that is not in the list is kept as its own option.
  const select = (value, options, onchange) =>
    h(
      'select',
      { class: 'in', onchange: (e) => onchange(e.target.value) },
      value ? null : h('option', { value: '', text: '—', selected: true }),
      (value && !options.includes(value) ? [value, ...options] : options).map((o) => h('option', { value: o, text: o, selected: o === value })),
    );
  const seg = (value, options, onpick) =>
    h('div', { class: 'seg' }, Object.entries(options).map(([k, label]) => h('button', { type: 'button', class: k === value ? 'on' : '', text: label, onclick: () => onpick(k) })));
  const requestsOf = (...types) => S.requests.filter((r) => types.includes(r.type) && (!r.manual || r.manual === manual)).slice(-3).reverse().map(requestCard);
  const busyNote = () => (openRequests().some((r) => r.manual === manual && r.status === 'working') ? h('div', { class: 'note warn', style: 'margin-bottom:12px', text: STR.busy }) : null);

  // --- Step 1: project ----------------------------------------------------

  const TONES = {
    dark: { text: '#f8fafc', muted: '#9aa3b5', captionText: '#f8fafc' },
    light: { text: '#1a1d29', muted: '#6b7285', captionText: '#1a1d29' },
  };
  const toneColors = (accent, tone) =>
    tone === 'light' ? [mix('#ffffff', accent, 0.06), mix('#f1f3f8', accent, 0.16)] : [mix('#0b0d14', accent, 0.16), mix('#151927', accent, 0.34)];

  function stepProject(panel) {
    const raw = clone(S.rawProfile || { extends: 'calm-professional' });
    raw.product = raw.product || {};
    raw.product.audience = raw.product.audience || {};
    raw.colors = raw.colors || {};
    const saveProfile = saver(() => save('PUT', '/api/profile', raw), 500);
    const saveGuide = saver((v) => save('PUT', '/api/brand-guide', { text: v }), 600);

    const fitEl = h('div', { class: 'fit' });
    const resolved = () => {
      const p = merge(S.presets[raw.extends || 'calm-professional'], raw);
      if (S.profile.brand && S.profile.brand.logoSrc && p.brand && p.brand.logo) p.brand.logoSrc = S.profile.brand.logoSrc;
      return p;
    };
    function preview() {
      if (player) player.destroy();
      fitEl.textContent = '';
      const imgs = images();
      const first = Object.keys(imgs)[0];
      const sb = {
        meta: { lang: KO ? 'ko' : 'en' },
        scenes: [{ type: 'title', title: raw.product.name || STR.sampleTitle, subtitle: raw.product.description || STR.sampleSub, duration: 3.4 }],
      };
      if (first) sb.scenes.push({ type: 'screen', image: first, caption: STR.sampleCaption, hold: 1 });
      player = makePlayer(fitEl, resolved(), imgs);
      player.loop = true;
      player.mount(sb);
      player.play();
    }
    const change = (redraw) => {
      saveProfile();
      preview();
      if (redraw) form.replaceWith((form = buildForm()));
    };

    function setBackground(template, tone) {
      raw.canvas = raw.canvas || {};
      if (template === 'preset') {
        delete raw.canvas.template;
        delete raw.canvas.colors;
        delete raw.canvas.tone;
        ['text', 'muted', 'captionBg', 'captionText'].forEach((k) => delete raw.colors[k]);
        if (!Object.keys(raw.canvas).length) delete raw.canvas;
        return;
      }
      const accent = raw.colors.accent || resolved().colors.accent;
      const colors = toneColors(accent, tone);
      Object.assign(raw.canvas, { template, tone, colors });
      Object.assign(raw.colors, TONES[tone], { captionBg: tone === 'light' ? 'rgba(255, 255, 255, 0.96)' : mix('#0b0d14', accent, 0.1) + 'ee' });
    }

    function buildForm() {
      const p = raw.product;
      const cv = raw.canvas || {};
      const tpl = cv.template || 'preset';
      const tone = cv.tone || 'dark';
      const accent = raw.colors.accent || resolved().colors.accent;
      const v = raw.voice;
      const swatch = (name) => {
        const fake = { canvas: name === 'preset' ? S.presets[raw.extends || 'calm-professional'].canvas : { template: name, colors: cv.colors || toneColors(accent, tone) }, colors: { accent } };
        return h(
          'button',
          { type: 'button', class: 'swatch' + (tpl === name ? ' on' : ''), onclick: () => { setBackground(name, tone); change(true); } },
          h('i', { style: 'background:' + Stage.canvasBackground(fake) }),
          h('span', { text: STR.templates[name] }),
        );
      };
      return h(
        'div',
        { class: 'col form' },
        h('h2', { text: STR.s1Title }),
        h('p', { class: 'lead', text: STR.s1Lead }),

        h('h3', { text: STR.product }),
        field(STR.name, text(p.name, (x) => { p.name = x; change(); })),
        field(STR.desc, text(p.description, (x) => { p.description = x; change(); })),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'grow' }, field(STR.domain, select(p.domain, STR.domains, (x) => { p.domain = x; saveProfile(); }))),
          h('div', { class: 'grow' }, field(STR.age, select(p.audience.age, STR.ages, (x) => { p.audience.age = x; saveProfile(); }))),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'grow' }, field(STR.model, seg(p.model, { B2C: 'B2C', B2B: 'B2B' }, (x) => { p.model = x; change(true); }))),
          h('div', { class: 'grow' }, field(STR.device, seg(p.audience.device, Object.fromEntries(STR.devices.map((d) => [d, d])), (x) => { p.audience.device = x; change(true); }))),
        ),

        h('h3', { text: STR.brand }),
        h(
          'div',
          { class: 'row' },
          field(STR.accent, h('input', { type: 'color', value: accent, oninput: (e) => { raw.colors.accent = e.target.value; if (tpl !== 'preset') setBackground(tpl, tone); saveProfile(); preview(); }, onchange: () => change(true) })),
          h(
            'div',
            { class: 'grow' },
            field(
              STR.logo,
              h(
                'div',
                { class: 'row' },
                h('div', { class: 'logo-box' }, S.profile.brand && S.profile.brand.logoSrc ? h('img', { src: S.profile.brand.logoSrc, alt: '' }) : h('span', { class: 'hint', text: '—' })),
                h('button', { type: 'button', class: 'btn sm', text: STR.logoAdd, onclick: () => pickFiles('image/png,image/jpeg,image/svg+xml,image/webp', false, async ([f]) => { await flushSaves(); await api('POST', '/api/logo?name=' + enc(f.name), f, true); load(); }) }),
                S.logo ? h('button', { type: 'button', class: 'btn sm ghost', text: STR.logoRemove, onclick: async () => { await flushSaves(); await api('DELETE', '/api/logo'); load(); } }) : null,
              ),
            ),
          ),
        ),
        S.logo ? field(STR.logoWhere, seg((raw.brand && raw.brand.logoPlacement) || 'cards', STR.logoPlaces, (x) => { raw.brand = { ...(raw.brand || {}), logoPlacement: x }; change(true); })) : null,
        field(STR.guide, area(S.brandGuide, saveGuide, '', 4), STR.guideHint),

        h('h3', { text: STR.motion }),
        h(
          'div',
          { class: 'cards' },
          Object.keys(S.presets).map((name) =>
            h(
              'button',
              { type: 'button', class: 'pick' + ((raw.extends || 'calm-professional') === name ? ' on' : ''), onclick: () => { raw.extends = name; change(true); } },
              h('b', { text: (STR.presets[name] || [name])[0] }),
              h('span', { text: (STR.presets[name] || ['', S.presets[name].summary])[1] }),
            ),
          ),
        ),

        h('h3', { text: STR.background }),
        h('div', { class: 'swatches' }, ['preset', ...Stage.templates].map(swatch)),
        tpl === 'preset'
          ? null
          : h(
              'div',
              { class: 'row', style: 'margin-top:12px' },
              field(STR.tone, seg(tone, STR.tones, (x) => { setBackground(tpl, x); change(true); })),
              field(
                STR.bgColors,
                h(
                  'div',
                  { class: 'row' },
                  [0, 1].map((i) => h('input', { type: 'color', value: (cv.colors || toneColors(accent, tone))[i], oninput: (e) => { raw.canvas.colors[i] = e.target.value; saveProfile(); preview(); }, onchange: () => change(true) })),
                ),
              ),
            ),

        h('h3', { text: STR.voice }),
        v
          ? h(
              'div',
              { class: 'note' },
              v.summary ? h('div', {}, h('b', { text: v.summary })) : null,
              h(
                'ul',
                {},
                v.register ? h('li', { text: `${STR.voiceRegister}: ${v.register}` }) : null,
                v.endings ? h('li', { text: `${STR.voiceEndings}: ${v.endings.join('  ')}` }) : null,
                v.maxWidth ? h('li', { text: `${STR.voiceMax}: ${v.maxWidth}` }) : null,
                v.avoid && v.avoid.length ? h('li', { text: `${STR.voiceAvoid}: ` + v.avoid.map((a) => (a.term || a) + (a.use ? ` → ${a.use}` : '')).join(', ') }) : null,
              ),
            )
          : h('div', { class: 'note', text: STR.voiceNone }),
        h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { type: 'button', class: 'btn ai', text: '✦ ' + STR.voiceAsk, onclick: () => request('profile') }), h('span', { class: 'grow' }), h('button', { type: 'button', class: 'btn primary', text: STR.next, onclick: () => go(2) })),
        requestsOf('profile'),
      );
    }

    let form = buildForm();
    panel.append(form, h('div', { class: 'preview' }, fitEl, h('div', { class: 'cap', text: STR.previewNote })));
    preview();
  }

  function pickFiles(accept, multiple, done) {
    const input = h('input', { type: 'file', accept, multiple, onchange: () => input.files.length && done(Array.from(input.files)) });
    input.click();
  }

  // --- Step 2: scenes -----------------------------------------------------

  function stepScenes(panel) {
    const col = h('div', { class: 'col' });
    const wrap = h('div', { class: 'wrap' }, h('h2', { text: STR.s2Title }), h('p', { class: 'lead', text: STR.s2Lead }));
    col.append(wrap);
    panel.append(col);
    if (!manual) {
      wrap.append(h('div', { class: 'note' }, STR.needManual + ' ', h('button', { class: 'btn sm primary', text: STR.newManual, onclick: newManual })));
      return;
    }

    async function upload(files) {
      drop.textContent = STR.uploading;
      for (const f of files) {
        if (!/^image\/(png|jpeg)$/.test(f.type)) continue;
        await api('POST', `/api/screens${q()}&name=${enc(f.name)}`, f, true).catch(() => {});
      }
      load();
    }
    const drop = h('div', {
      class: 'drop',
      text: STR.drop,
      onclick: () => pickFiles('image/png,image/jpeg', true, upload),
      ondragover: (e) => { e.preventDefault(); drop.classList.add('over'); },
      ondragleave: () => drop.classList.remove('over'),
      ondrop: (e) => { e.preventDefault(); drop.classList.remove('over'); upload(Array.from(e.dataTransfer.files)); },
    });

    const figma = { figmaUrl: '', note: '' };
    wrap.append(
      drop,
      h(
        'div',
        { class: 'thumbs' },
        S.screens.map((s) => {
          const used = ((S.storyboard && S.storyboard.scenes) || []).filter((sc) => sc.image === 'screens/' + s.name).length;
          return h(
            'div',
            { class: 'thumb' },
            h('img', { src: images()['screens/' + s.name].src, alt: s.name, loading: 'lazy' }),
            h(
              'div',
              {},
              h('span', { text: s.name, title: s.name }),
              h('em', { text: `${s.width}×${s.height}` }),
              confirmButton(STR.del, async () => { await api('DELETE', `/api/screens${q()}&name=${enc(s.name)}`); load(); }),
            ),
            used ? h('div', { class: 'used', text: STR.usedIn(used) }) : null,
          );
        }),
      ),
      h('h3', { text: STR.figma }),
      field(STR.figmaUrl, h('input', { type: 'url', placeholder: 'https://www.figma.com/design/…', oninput: (e) => (figma.figmaUrl = e.target.value.trim()) })),
      field(STR.figmaNote, area('', (x) => (figma.note = x))),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn ai', text: '✦ ' + STR.figmaAsk, onclick: () => (/^https:\/\/([\w-]+\.)?figma\.com\//.test(figma.figmaUrl) ? request('scenes', figma) : toast(STR.figmaUrl + ' ?')) }),
        h('span', { class: 'hint grow', text: STR.figmaHint }),
        h('button', { class: 'btn primary', text: STR.next, onclick: () => go(3) }),
      ),
      requestsOf('scenes'),
    );
  }

  // --- Step 3: storyboard draft -------------------------------------------

  function stepStoryboard(panel) {
    const col = h('div', { class: 'col' });
    const wrap = h('div', { class: 'wrap' }, h('h2', { text: STR.s3Title }), h('p', { class: 'lead', text: STR.s3Lead }));
    col.append(wrap);
    panel.append(col);
    if (!manual) return void wrap.append(h('div', { class: 'note' }, STR.needManual + ' ', h('button', { class: 'btn sm primary', text: STR.newManual, onclick: newManual })));

    const sb = S.storyboard;
    sb.meta = sb.meta || {};
    const imgs = images();
    const names = Object.keys(imgs);
    const maxWidth = (S.profile.voice && S.profile.voice.maxWidth) || Math.floor((S.profile.caption.maxWidth / (S.profile.font.captionSize * 0.95)) * 2);
    const checks = h('div');
    const drawChecks = () => {
      const items = [...S.lint.errors, ...S.lint.warnings];
      checks.replaceChildren(items.length ? h('div', { class: 'note warn' }, h('b', { text: `${STR.checks} (${items.length})` }), h('ul', {}, items.map((x) => h('li', { text: x })))) : '');
    };
    const persist = saver(async () => { await save('PUT', '/api/storyboard' + q(), sb); drawChecks(); }, 500);
    const list = h('div');
    const structural = () => { persist(); drawList(); };

    function row(sc, i, stepNo) {
      const isScreen = sc.type === 'screen';
      const warn = h('em', { class: 'over2' });
      const check = (v) => (warn.textContent = T.textWidth(v) > maxWidth ? ' · ' + STR.tooLong : '');
      if (isScreen) check(sc.caption || '');
      return h(
        'div',
        { class: 'scene' },
        h(
          'div',
          { class: 'shot' },
          isScreen
            ? [
                imgs[sc.image] ? h('img', { src: imgs[sc.image].src, alt: '' }) : h('div', { class: 'cardtag', text: '?' }),
                h('select', { class: 'in', onchange: (e) => { sc.image = e.target.value; structural(); } }, names.map((n) => h('option', { value: n, text: n.slice(8), selected: n === sc.image }))),
              ]
            : h('div', { class: 'cardtag', text: STR.kinds[sc.type] }),
        ),
        h(
          'div',
          { class: 'grow' },
          h('span', { class: 'badge', text: isScreen ? `${stepNo}` : STR.kinds[sc.type] }),
          isScreen
            ? [
                h('label', { class: 'f' }, h('span', {}, STR.caption, warn), area(sc.caption, (v) => { sc.caption = v; check(v); persist(); })),
                field(STR.note, text(sc.note, (v) => { sc.note = v; persist(); })),
              ]
            : [field(STR.title, text(sc.title, (v) => { sc.title = v; persist(); })), field(STR.subtitle, text(sc.subtitle, (v) => { sc.subtitle = v; persist(); }))],
        ),
        h(
          'div',
          { class: 'tools' },
          h('button', { class: 'btn sm', text: '↑', disabled: i === 0, onclick: () => { [sb.scenes[i - 1], sb.scenes[i]] = [sb.scenes[i], sb.scenes[i - 1]]; structural(); } }),
          h('button', { class: 'btn sm', text: '↓', disabled: i === sb.scenes.length - 1, onclick: () => { [sb.scenes[i + 1], sb.scenes[i]] = [sb.scenes[i], sb.scenes[i + 1]]; structural(); } }),
          h('button', { class: 'btn sm ghost', text: '✕', title: STR.del, onclick: () => { sb.scenes.splice(i, 1); structural(); } }),
        ),
      );
    }
    const produceBtn = h('button', { class: 'btn ai', text: '✦ ' + STR.produce, onclick: async () => { await request('produce'); go(4); } });
    function drawList() {
      let n = 0;
      list.replaceChildren(...sb.scenes.map((sc, i) => row(sc, i, sc.type === 'screen' ? ++n : 0)));
      produceBtn.disabled = !n;
    }
    const nextScreen = () => names.find((n) => !sb.scenes.some((s) => s.image === n)) || names[names.length - 1];
    const insertBeforeOutro = (sc) => {
      const i = sb.scenes.findIndex((s) => s.type === 'outro');
      sb.scenes.splice(i < 0 ? sb.scenes.length : i, 0, sc);
    };

    wrap.append(
      busyNote(),
      h(
        'div',
        { class: 'row' },
        h('div', { class: 'grow' }, field(STR.videoTitle, text(sb.meta.title, (v) => { sb.meta.title = v; persist(); }))),
        h('div', { class: 'grow', style: 'flex:2' }, field(STR.goal, text(sb.meta.goal, (v) => { sb.meta.goal = v; persist(); }, STR.goalPh))),
      ),
      h(
        'div',
        { class: 'row wrapline', style: 'margin-bottom:14px' },
        h('button', { class: 'btn ai', text: '✦ ' + STR.draftAsk, disabled: !names.length, onclick: () => request('draft', { goal: sb.meta.goal || '' }) }),
        h('button', { class: 'btn ghost', text: STR.fromScreens, disabled: !names.length, onclick: () => { names.filter((n) => !sb.scenes.some((s) => s.image === n)).forEach((n) => insertBeforeOutro({ type: 'screen', image: n, caption: '', note: '', actions: [] })); structural(); } }),
        names.length ? null : h('span', { class: 'hint', text: STR.noScreens }),
      ),
      requestsOf('draft'),
      list,
      h(
        'div',
        { class: 'row wrapline', style: 'margin:12px 0 18px' },
        h('button', { class: 'btn', text: STR.addStep, disabled: !names.length, onclick: () => { insertBeforeOutro({ type: 'screen', image: nextScreen(), caption: '', note: '', actions: [] }); structural(); } }),
        h('button', { class: 'btn', text: STR.addTitle, onclick: () => { sb.scenes.unshift({ type: 'title', title: sb.meta.title || '', subtitle: '' }); structural(); } }),
        h('button', { class: 'btn', text: STR.addOutro, onclick: () => { sb.scenes.push({ type: 'outro', title: '', subtitle: '' }); structural(); } }),
      ),
      checks,
      h(
        'div',
        { class: 'row', style: 'margin-top:16px' },
        h('span', { class: 'hint grow', text: STR.produceHint }),
        produceBtn,
      ),
      requestsOf('produce'),
    );
    drawList();
    drawChecks();
  }

  // --- Step 4: video ------------------------------------------------------

  let tab = 'text';

  function stepVideo(panel) {
    const sb = S.storyboard;
    if (!manual || !sb || !sb.scenes.length) return void panel.append(h('div', { class: 'empty', text: STR.s4Empty }));
    if (S.lint.errors.length) {
      return void panel.append(h('div', { class: 'col' }, h('div', { class: 'wrap' }, h('div', { class: 'note warn' }, h('b', { text: STR.s4Errors }), h('ul', {}, S.lint.errors.map((e) => h('li', { text: e })))))));
    }

    const fitEl = h('div', { class: 'fit' });
    const playBtn = h('button', { class: 'btn', onclick: () => player.toggle() });
    const seekBar = h('input', { type: 'range', min: 0, max: 1000, value: 0, oninput: () => { const to = (seekBar.value / 1000) * player.TL.duration; player.pause(); player.seek(to); } });
    const clock = h('span', { class: 'clock' });
    const side = h('div', { class: 'col narrow' });
    const pinEl = h('div', { class: 'pin', style: 'display:none' });
    fitEl.append(pinEl);

    player = makePlayer(fitEl, S.profile, images());
    let cards = [];
    let draftPin = null; // position being attached to a new comment
    let shownPin = null; // position of the comment being looked at
    let pinning = false;
    let composerAt = null;

    function placePin() {
      const pin = draftPin || shownPin;
      pinEl.style.display = pin ? '' : 'none';
      if (!pin) return;
      const r = player.stageEl.getBoundingClientRect();
      const f = fitEl.getBoundingClientRect();
      pinEl.style.left = r.left - f.left + (pin.x / player.TL.meta.width) * r.width + 'px';
      pinEl.style.top = r.top - f.top + (pin.y / player.TL.meta.height) * r.height + 'px';
    }
    player.onTime = () => {
      seekBar.value = Math.round((player.now / player.TL.duration) * 1000);
      clock.textContent = fmt(player.now) + ' / ' + fmt(player.TL.duration);
      playBtn.textContent = player.playing ? '❚❚' : '▶';
      const idx = player.TL.scenes.findIndex((s) => player.now >= s.t0 && player.now < s.t1);
      cards.forEach((c, i) => c.classList.toggle('on', i === idx));
      if (composerAt) composerAt.textContent = STR.cmtAt(fmt(player.now), frame().scene);
      if (player.playing && shownPin) { shownPin = null; placePin(); }
    };
    const sceneStart = (i) => { const s = player.TL.scenes[i]; return s ? Math.min(s.t0 + 1.2, s.t1 - 0.05) : 0; };

    // What the reviewer is looking at right now, in terms the agent can act on.
    function frame(pin) {
      const TL = player.TL;
      const now = player.now;
      const sc = TL.scenes.find((s) => now >= s.t0 && now < s.t1) || TL.scenes[TL.scenes.length - 1];
      const shot = TL.shots[sc.shot];
      const cap = (sc.captions || []).filter((c) => now >= c.t0).pop();
      const info = { t: Math.round(now * 100) / 100, scene: sc.index + 1, step: sc.step, caption: T.plain(cap ? cap.text : sc.title || '') };
      if (pin) {
        info.pin = { x: Math.round(pin.x), y: Math.round(pin.y) };
        if (shot.kind === 'screen') {
          const uv = T.uvAt(shot.layout, T.evalCam(shot, now), pin.x, pin.y);
          if (uv.u >= 0 && uv.u <= 1 && uv.v >= 0 && uv.v <= 1) info.screen = { image: shot.image, x: Math.round(uv.u * shot.layout.coordW), y: Math.round(uv.v * shot.layout.coordH) };
        }
      }
      return info;
    }

    fitEl.addEventListener('click', (e) => {
      if (!pinning) return;
      const r = player.stageEl.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * player.TL.meta.width;
      const y = ((e.clientY - r.top) / r.height) * player.TL.meta.height;
      if (x < 0 || y < 0 || x > player.TL.meta.width || y > player.TL.meta.height) return;
      draftPin = { x, y };
      pinning = false;
      fitEl.classList.remove('pinning');
      placePin();
      drawSide();
    });

    const persist = saver(() => save('PUT', '/api/storyboard' + q(), sb), 400);
    const remount = (seekScene) => {
      player.mount(sb);
      if (seekScene != null) { player.pause(); player.seek(sceneStart(seekScene)); }
    };
    const live = debounce((i) => remount(i), 200);

    function textTab() {
      cards = [];
      let n = 0;
      const total = sb.scenes.filter((s) => s.type === 'screen').length;
      const fieldRow = (label, obj, key, i) => {
        const ta = area(obj[key], (v) => { obj[key] = v; persist(); live(i); grow(); }, '', 1);
        const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
        requestAnimationFrame(grow);
        return field(label, ta);
      };
      return [
        h('p', { class: 'hint', text: STR.textHint }),
        sb.scenes.map((sc, i) => {
          const move = (d) => { const j = i + d; [sb.scenes[i], sb.scenes[j]] = [sb.scenes[j], sb.scenes[i]]; persist(); remount(j); drawSide(); };
          const card = h(
            'div',
            { class: 'edcard' },
            h(
              'div',
              { class: 'head', onclick: () => { player.pause(); player.seek(sceneStart(i)); } },
              h('span', { class: 'badge', text: sc.type === 'screen' ? `${++n}/${total}` : STR.kinds[sc.type] }),
              h('span', { text: sc.image ? sc.image.split('/').pop() : '' }),
              h('button', { class: 'btn sm', text: '↑', disabled: i === 0, onclick: (e) => { e.stopPropagation(); move(-1); } }),
              h('button', { class: 'btn sm', text: '↓', disabled: i === sb.scenes.length - 1, onclick: (e) => { e.stopPropagation(); move(1); } }),
            ),
            sc.type === 'screen'
              ? [
                  fieldRow(STR.fields.caption, sc, 'caption', i),
                  (sc.actions || []).map((a) =>
                    a.type === 'caption' ? fieldRow(STR.fields.mid, a, 'text', i) : a.type === 'text' ? fieldRow(STR.fields.text, a, 'text', i) : a.type === 'type' ? fieldRow(STR.fields.type, a, 'text', i) : a.type === 'highlight' && a.label ? fieldRow(STR.fields.label, a, 'label', i) : null,
                  ),
                ]
              : [fieldRow(STR.fields.title, sc, 'title', i), fieldRow(STR.fields.subtitle, sc, 'subtitle', i)],
          );
          cards.push(card);
          return card;
        }),
      ];
    }

    const saveComments = () => save('PUT', '/api/comments' + q(), S.comments);

    function commentsTab() {
      cards = [];
      const open = S.comments.filter((c) => c.status === 'open');
      const input = area('', () => {}, STR.cmtPh, 3);
      composerAt = h('div', { class: 'at', text: STR.cmtAt(fmt(player.now), frame().scene) });
      const pinBtn = h('button', {
        class: 'btn sm' + (pinning ? ' primary' : ''),
        text: draftPin ? STR.pinSet : pinning ? STR.pinOn : STR.pin,
        onclick: () => {
          if (draftPin) draftPin = null;
          else { pinning = !pinning; if (pinning) player.pause(); }
          fitEl.classList.toggle('pinning', pinning);
          placePin();
          drawSide();
        },
      });
      const add = async () => {
        const body = input.value.trim();
        if (!body) return input.focus();
        player.pause();
        S.comments.push({ id: 'c' + Math.random().toString(36).slice(2, 8), ...frame(draftPin), text: body, status: 'open', createdAt: new Date().toISOString() });
        draftPin = null;
        placePin();
        await saveComments();
        drawSide();
      };
      return {
        body: [
          h('p', { class: 'hint', text: STR.cmtHint }),
          S.comments.length
            ? S.comments.map((c) =>
                h(
                  'div',
                  { class: 'cmt' },
                  h(
                    'div',
                    { class: 'head' },
                    h('button', { class: 'time', text: STR.cmtAt(fmt(c.t), c.scene), onclick: () => { player.pause(); shownPin = c.pin || null; player.seek(c.t); placePin(); } }),
                    c.pin ? h('span', { class: 'hint', text: '📍' }) : null,
                    h('span', { class: 'st ' + c.status, text: STR.status[c.status] }),
                    c.status === 'open' ? h('button', { class: 'btn sm ghost', text: '✕', title: STR.del, onclick: async () => { S.comments.splice(S.comments.indexOf(c), 1); await saveComments(); drawSide(); } }) : null,
                  ),
                  h('p', { text: c.text }),
                  c.reply ? h('div', { class: 'reply', text: `${STR.aiReply}: ${c.reply}` }) : null,
                ),
              )
            : h('p', { class: 'hint', text: STR.cmtNone }),
        ],
        foot: h(
          'div',
          { class: 'composer' },
          composerAt,
          input,
          h('div', { class: 'row', style: 'margin-top:8px' }, pinBtn, h('span', { class: 'grow' }), h('button', { class: 'btn', text: STR.cmtAdd, onclick: add })),
          h('button', { class: 'btn ai', style: 'width:100%;margin-top:8px', text: '✦ ' + STR.cmtSend(open.length), disabled: !open.length, onclick: () => request('revise') }),
        ),
      };
    }

    function renderBox() {
      const job = S.render;
      return h(
        'div',
        { class: 'sidefoot' },
        job && job.status === 'running'
          ? [h('div', { class: 'hint', text: STR.rendering(job.progress) }), h('div', { class: 'bar' }, h('i', { style: `width:${job.progress}%` }))]
          : [
              job && job.status === 'error' ? h('div', { class: 'note warn', style: 'margin-bottom:8px', text: job.error }) : null,
              h(
                'div',
                { class: 'row' },
                h('button', { class: 'btn primary', text: STR.exportMp4, onclick: async () => { await flushSaves(); await api('POST', '/api/render' + q()); load(); } }),
                S.video ? h('a', { class: 'btn ghost', style: 'display:inline-flex;align-items:center;text-decoration:none', href: S.video, target: '_blank', text: (job && job.status === 'done' ? STR.renderDone + ' · ' : '') + STR.download }) : null,
              ),
            ],
      );
    }

    function drawSide() {
      composerAt = null;
      const c = tab === 'comments' ? commentsTab() : { body: textTab(), foot: null };
      const parts = [
        h(
          'div',
          { class: 'tabs' },
          h('button', { class: tab === 'text' ? 'on' : '', text: STR.tabText, onclick: () => { tab = 'text'; drawSide(); } }),
          h('button', { class: tab === 'comments' ? 'on' : '', text: `${STR.tabComments} (${S.comments.length})`, onclick: () => { tab = 'comments'; drawSide(); } }),
        ),
        h('div', { class: 'side' }, busyNote(), requestsOf('produce', 'revise').slice(0, 1), c.body),
        c.foot,
        renderBox(),
      ];
      side.replaceChildren(...parts.filter(Boolean));
      player.onTime();
    }

    panel.append(h('div', { class: 'preview' }, fitEl, h('div', { class: 'ctl' }, playBtn, seekBar, clock)), side);
    window.addEventListener('resize', placePin);
    player.mount(sb);
    player.seek(Math.min(1.5, player.TL.duration)); // open on a frame with something to see
    drawSide();

    // A background change that left the picture alone (a new comment reply,
    // render progress) only needs the side panel redrawn.
    softRefresh = (old) => {
      if (step !== 4 || JSON.stringify(old.profile) !== JSON.stringify(S.profile)) return false;
      const typing = document.activeElement && document.activeElement.tagName === 'TEXTAREA';
      if (JSON.stringify(old.storyboard) !== JSON.stringify(S.storyboard)) {
        if (typing) return true; // our own edit, already on screen
        const at = player.now;
        Object.assign(sb, S.storyboard);
        S.storyboard = sb;
        player.mount(sb);
        player.seek(at);
      } else {
        S.storyboard = sb;
      }
      if (!typing) drawSide();
      return true;
    };
  }

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || step !== 4 || !player || /^(TEXTAREA|INPUT|BUTTON|SELECT)$/.test(e.target.tagName)) return;
    e.preventDefault();
    player.toggle();
  });

  load().catch((e) => (app.textContent = String(e)));
})();
