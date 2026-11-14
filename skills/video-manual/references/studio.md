# Working with the Studio

The Studio is a local web app where the user does their half of the work: fills in the product facts, attaches screens, writes or approves the text, watches the video and comments on frames. You do yours through the same project files. This document is the protocol between the two.

## Contents

- Starting it
- The request loop
- Handling each request type
- Frame comments
- Files and who owns them
- Rules that keep the two sides from colliding

## Starting it

```bash
node <skill-dir>/scripts/studio.mjs video-manual --open
```

Run it in the background; it keeps serving until stopped. It prints the address (http://localhost:4173, or the next free port). Give the user that address. It listens on this machine only and needs no install beyond Node.

`video-manual` is the project root; pass a different folder to work on another product.

## The request loop

Buttons marked ✦ in the Studio do not do the work — they queue a request for you in `requests.json`. Pick requests up with:

```bash
node <skill-dir>/scripts/studio.mjs wait video-manual --timeout 540
```

This blocks until the user sends something, then prints the requests as JSON and marks them as being worked on (the Studio shows "AI working"). If nothing arrives before the timeout it prints `{"status":"idle"}`.

Work through what it returns, answer each request, and wait again:

```bash
node <skill-dir>/scripts/studio.mjs done video-manual <request-id> --reply "<one or two sentences on what you did>"
```

The reply appears in the Studio next to the request, in the user's language. Keep waiting while the user is working in the Studio; stop when they say they are finished or after they export the MP4. If your environment cannot keep a command blocked, the user can instead tell you in the conversation that they sent something, and you run `studio.mjs pending video-manual` to see what is open.

Each request in the output carries the paths you need:

```json
{
  "id": "r3fa9c1",
  "type": "revise",
  "manual": "create-task",
  "payload": { "commentIds": ["c8k2ja"] },
  "paths": {
    "project": "video-manual",
    "profile": "video-manual/product-profile.json",
    "brandGuide": "video-manual/brand/guide.md",
    "manual": "video-manual/create-task",
    "storyboard": "video-manual/create-task/storyboard.json",
    "screens": "video-manual/create-task/screens"
  },
  "comments": [ … ]
}
```

## Handling each request type

| Type | The user pressed | What to do |
| --- | --- | --- |
| `profile` | "Ask AI for voice rules" (step 1) | Read the profile's `product` block and `brand/guide.md` if present. Write the `voice` block following [voice-guide.md](voice-guide.md); the brand guide overrides the general advice wherever they differ. Adjust motion tokens for the audience per [motion-profiles.md](motion-profiles.md). Add a `rationale`. Leave `product`, `colors`, `canvas` and `brand` as the user set them. |
| `scenes` | "Ask AI to import" with a Figma link (step 2) | `payload.figmaUrl` and `payload.note`. Export each frame as a PNG into the manual's `screens/` folder, numbered in flow order (`01-board.png`). Note each frame's logical width — you will need it for `coordWidth`. If you have no Figma access, say so in the reply and ask for exported images. |
| `draft` | "Ask AI for a draft" (step 3) | Read every screen and the profile. Write the draft storyboard — see [manual-script.md](manual-script.md). The draft has scenes with `caption` and `note` only; no actions yet. Use `payload.goal` (also in `meta.goal`) as the task the video teaches. |
| `produce` | "Request the video from this" (step 3) | The user has approved the wording and order. Turn the draft into the full storyboard — see [storyboard-schema.md](storyboard-schema.md): follow each scene's `note`, add the actions, set `coordWidth`. Keep every caption exactly as written. Then build, render stills and check them as SKILL.md describes before answering. |
| `revise` | "Ask AI to revise" with frame comments (step 4) | See below. |

A request you cannot fulfil still gets a `done` with a reply that says why and what you need — never leave one hanging in "AI working".

## Frame comments

A `revise` request includes the comments the user wrote on frames:

```json
{
  "id": "c8k2ja",
  "t": 18.92,
  "scene": 4,
  "step": 3,
  "caption": "목록에서 담당자를 고르세요.",
  "pin": { "x": 997, "y": 604 },
  "screen": { "image": "screens/03-assignee-open.png", "x": 747, "y": 479 },
  "text": "말풍선이 목록을 가려요. 오른쪽으로 옮겨 주세요."
}
```

- `t` is the time in the video; `scene` is the 1-based index into `storyboard.scenes`; `step` is the number on the step badge.
- `caption` is the caption that was showing, so you can tell which part of a multi-caption step they mean.
- `pin` is where they clicked, in stage pixels. `screen` is the same point in the screenshot's own coordinates — the units the storyboard uses. When a comment says "the click should be here", `screen.x, screen.y` is the answer, ready to paste into an action.

Before changing anything, look at what they were looking at:

```bash
node <skill-dir>/scripts/build.mjs <manual>/storyboard.json
node <skill-dir>/scripts/render.mjs <manual>/out/manual.html --at 18.92 --mark 997,604 --out <manual>/out/frames/c8k2ja.jpg
```

Read that image: the red ring is the pin. Comments are short and written while looking at a picture ("이거 가려요", "too fast here"); the frame is what makes them unambiguous.

Then make the change where it belongs:

- about one moment → that scene's actions or text in `storyboard.json`;
- about wording throughout ("너무 딱딱해요") → the `voice` block of the profile, then the captions;
- about the feel throughout ("전체적으로 느려요") → motion tokens in the profile.

Rebuild, re-render the frame at the same time, and confirm the comment is actually resolved before answering. Answer each comment individually so the user sees a reply under each one:

```bash
node <skill-dir>/scripts/studio.mjs done video-manual <request-id> --reply "코멘트 2건을 반영했습니다." \
  --comment c8k2ja:"말풍선을 항목 오른쪽으로 옮겼습니다." \
  --comment c91xbd:"3단계의 대기 시간을 0.5초 줄였습니다."
```

If you disagree with a comment or cannot do it (it asks for a screen that does not exist, or breaks a voice rule in their own profile), say so in that comment's reply instead of doing something else quietly.

## Files and who owns them

```
video-manual/
├── product-profile.json   # form writes extends, product, colors, canvas, brand.logoPlacement
│                          # you write voice, rationale, and motion tuning (pacing, font, …)
├── brand/
│   ├── guide.md           # the user's pasted brand guide — read it, do not edit it
│   └── logo.png           # uploaded logo
├── requests.json          # the queue. Change it only through `wait` and `done`
└── <manual>/
    ├── screens/           # uploaded or imported images
    ├── storyboard.json    # shared: the user edits text and order, you edit everything
    ├── comments.json      # frame comments. Answer through `done --comment`
    └── out/               # manual.html, manual.mp4, stills/, frames/
```

The Studio reloads when these files change, so the user sees your work without doing anything.

## Rules that keep the two sides from colliding

- **Change only what the request is about.** The user may be editing other parts of the same file. For a `revise`, touch the scenes the comments concern; do not reformat or "tidy" the rest.
- **Read the file again right before you write it.** The user can save edits while you think. Apply your change to the current contents, not to a copy you read earlier.
- **Keep the user's wording.** Text they typed in the Studio is approved text. If it breaks a voice rule, tell them in your reply and offer the fix; do not rewrite it unasked.
- **Do not start work nobody requested.** A draft appearing in step 3 is not a request to produce the video. Wait for `produce`.
