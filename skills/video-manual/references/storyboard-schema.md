# Storyboard format

`storyboard.json` is what the renderer reads. It lists scenes in order; each scene's length is worked out automatically from its actions and from how long its caption takes to read, so there are no timestamps to maintain.

## Contents

- Complete example
- meta
- Scenes
- Actions
- Coordinates
- Text on screen
- How timing works
- Patterns

## Complete example

```json
{
  "meta": { "title": "새 작업 만들기", "lang": "ko", "url": "app.example.com/board" },
  "scenes": [
    { "type": "title", "title": "새 작업 만들기", "subtitle": "30초면 충분해요" },
    {
      "type": "screen",
      "image": "screens/01-board.png",
      "coordWidth": 1440,
      "caption": "보드 오른쪽 위의 '+ 새 작업'을 누르세요.",
      "actions": [
        { "type": "highlight", "rect": [1268, 84, 132, 40] },
        { "type": "click", "at": [1334, 104] }
      ]
    },
    {
      "type": "screen",
      "image": "screens/02-new-task.png",
      "coordWidth": 1440,
      "caption": "작업 제목을 입력하세요.",
      "actions": [
        { "type": "zoom", "rect": [460, 200, 520, 460] },
        { "type": "click", "at": [640, 322] },
        { "type": "type", "rect": [492, 300, 456, 44], "text": "온보딩 이메일 초안 작성", "bg": "#ffffff" }
      ]
    },
    { "type": "outro", "title": "작업이 추가됐어요", "subtitle": "카드를 끌어 진행 상태를 바꿔 보세요" }
  ]
}
```

## meta

| Field | Default | Meaning |
| --- | --- | --- |
| `title` | – | Page title of the preview |
| `lang` | `ko` | Language code of the captions |
| `width`, `height` | 1920, 1080 | Video size |
| `fps` | 30 | Frame rate |
| `url` | – | Text shown in the browser frame's address bar. Leave out to hide it. |

`meta.goal` records the task the video teaches; the renderer ignores it.

The product profile is found automatically: `product-profile.json` beside the storyboard, or one folder up. To override, add `"profile"` with a path or a preset name.

## Scenes

**`title`** and **`outro`** — a full-screen card.

| Field | Meaning |
| --- | --- |
| `title` | Required. Main line. |
| `subtitle` | Optional second line. |
| `duration` | Optional fixed length in seconds. Otherwise based on reading time. |

**`screen`** — one step of the manual: a screenshot, a caption, and the actions performed on it.

| Field | Meaning |
| --- | --- |
| `image` | Required. PNG or JPEG path, relative to the storyboard. |
| `caption` | The step's caption. Use `\n` for a deliberate line break and `**…**` for emphasis. |
| `actions` | Actions played in order (below). May be empty for a "look at this" step. |
| `coordWidth` | Width of the coordinate space, if it is not the image's pixel width. See Coordinates. |
| `hold` | Extra seconds to stay on the scene after its actions. |
| `note` | Direction written in the draft (step 3). Ignored by the renderer; keep it so the user can still see what each step was meant to do. |

Steps are numbered automatically from the screen scenes ("2/5").

## Actions

Each action finishes before the next one starts.

| Action | Fields | What it does |
| --- | --- | --- |
| `highlight` | `rect`, `label`?, `hold`? | Draws a ring around an element and dims the rest. Stays until the scene ends or another highlight replaces it. `label` adds a small tag above the ring. |
| `click` | `at`? | Moves the cursor to `at`, then presses with a ripple. Without `at`, clicks where the cursor already is. |
| `move` | `to` | Moves the cursor without clicking. |
| `zoom` | `rect`, `scale`? | Moves the camera in so `rect` fills part of the frame. `scale` overrides the automatic zoom level. Also accepts `to: [x, y]` with `scale`. |
| `zoom-out` | – | Returns the camera to the full screen. |
| `type` | `rect`, `text`, `bg`?, `color`?, `fontSize`?, `padding`? | Types `text` into the field at `rect`, one character at a time. Set `bg` to the field's background colour to cover placeholder text. Stays for the rest of this screenshot. |
| `caption` | `text` | Replaces the caption mid-step, with the text animation. The step number stays the same. Waits until the previous caption has been up long enough to read. |
| `text` | `text`, `at`, `place`?, `style`?, `animation`?, `duration`? | Animated text on the screen itself: a callout pinned to a point, or a centred banner. See Text on screen. |
| `wait` | `duration` | Pauses (default 0.5 s). |

`rect` is `[x, y, width, height]` of the element itself; the ring adds its own padding. Points are `[x, y]`.

## Coordinates

Coordinates are measured from the top-left corner of the screenshot.

By default the unit is the image's own pixels. Set `coordWidth` when your numbers come from a different scale:

- **Figma**: a 1440-wide frame exported at 2x is a 2880px image. Set `"coordWidth": 1440` and use the layer bounds from Figma's metadata directly.
- **Browser**: for a retina screenshot of a 1440px-wide viewport, set `"coordWidth": 1440` and use DOM rects (`getBoundingClientRect`) directly.

When estimating from the image alone: note the image's pixel size (`build.mjs` reports out-of-range values against it), locate the element's edges as fractions of the width and height, and multiply out. Click at the centre of the element. Then verify with stills — estimates are routinely off by enough to miss a small button.

`build.mjs` rejects any coordinate outside the screen, which catches most scale mix-ups (pixel values used with a logical `coordWidth`, or the reverse).

## Text on screen

Three kinds of animated text can appear during a step, in between the clicks. Each uses the profile's text animation unless told otherwise.

**The caption** (`caption` on the scene, and `caption` actions) is the instruction. A `caption` action changes it part-way through a step:

```json
"caption": "작업 **제목**을 입력하세요.",
"actions": [
  { "type": "click", "at": [880, 321] },
  { "type": "type", "rect": [494, 300, 452, 42], "text": "온보딩 이메일 초안 작성", "bg": "#ffffff" },
  { "type": "caption", "text": "이어서 **'담당자'** 칸을 눌러 목록을 여세요." },
  { "type": "click", "at": [720, 410] }
]
```

Use a `caption` action when several quick actions on one screenshot belong to the same step. Start a new scene instead when the viewer would count it as the next step — the step badge advances only with a new scene.

**A callout** (`text` action, the default `bubble` style) is a short remark pinned to something on the screen — a tip, a reassurance, a name for the thing just created. It keeps its size while the camera zooms and follows the point it is pinned to.

```json
{ "type": "text", "text": "지정하면 알림이 가요", "at": [860, 519], "place": "top" }
```

| Field | Meaning |
| --- | --- |
| `at` | The point the callout's tail touches. Pick the edge of the element, not its centre, so the bubble does not cover it. |
| `place` | Which side of the point the bubble sits: `top` (default), `bottom`, `left`, `right`. |
| `animation` | Overrides the profile's text animation for this one text: `fade`, `fade-up`, `slide-in`, `pop`, `blur-in`, `typewriter`. |
| `duration` | Seconds to stay. Without it, the callout stays until the scene ends. |

**A banner** (`text` action with `"style": "banner"`) is a few large words centred over the screen — a moment of emphasis such as "완료!". It needs no `at`. Give it a `duration` unless it should stay to the end of the scene.

```json
{ "type": "text", "text": "**완료!**", "style": "banner", "animation": "pop", "duration": 1.6 }
```

**Emphasis.** In any caption, title or on-screen text, wrap words in `**double asterisks**` to pick them out in the accent colour. Emphasise the one thing the viewer must find — usually the name of the button — not whole sentences.

Keep callouts and banners rare: one or two per video. The caption already tells the viewer what to do; a second moving text competes with it. Every text is checked against the profile's voice rules like a caption is.

## How timing works

A screen scene lasts as long as the longest of:

- its actions, plus the profile's opening `beat` and closing `hold`;
- the time to read its captions and on-screen texts at the profile's `readingCps`;
- the profile's `minScene`.

So a long caption automatically stays up longer, and a scene with many actions is never cut short. To slow one scene down, add `hold` or a `wait` action. To change the pace of the whole video, change `pacing` in the product profile instead.

## Patterns

**A click that changes the screen.** End the scene with the click; make the next scene use the screenshot of the result. The screen change follows the click naturally.

```json
{ "type": "screen", "image": "screens/01-board.png", "caption": "…", "actions": [{ "type": "click", "at": [1334, 104] }] },
{ "type": "screen", "image": "screens/02-modal.png", "caption": "…", "actions": [] }
```

**Several steps on one screenshot.** Consecutive scenes with the same `image` play as one continuous shot: the caption and step number change, while the cursor, typed text and zoom carry over.

**Zoom carries across screens.** When consecutive screenshots are the same size, the camera stays where it is through the change — zoom into a dialog once and it stays framed while the dialog's contents change. Add `zoom-out` in the step that needs the whole screen again (typically the result step). A screenshot of a different size resets the camera.

**Highlight, then click.** Ring the target first so the viewer finds it before the cursor arrives:

```json
{ "type": "highlight", "rect": [1268, 84, 132, 40] },
{ "type": "click", "at": [1334, 104] }
```

Use it for the first click of the video and whenever the target is small or easy to miss. On every single step it becomes noise.

**Typing over a placeholder.** The screenshot of an empty field usually shows placeholder text. Give `type` the field's inner rectangle and its background colour so the typed text covers it; the following screenshot should show the field already filled in. Click toward the empty right-hand end of the field first: the cursor stays where it clicked, and at the left it would sit on top of the text being typed.

**Showing a result.** Final step: no click, just a highlight on the thing that changed, and a caption describing the outcome.
