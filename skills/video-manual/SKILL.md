---
name: video-manual
description: Creates animated video manuals (how-to, tutorial, onboarding and feature walkthrough videos) for a software product from screenshots, a Figma link, or a live URL. Works in four steps — product project (brand, UX-writing voice and motion set from the target age, domain and B2C/B2B model, background template, logo), scenes, storyboard draft, video — through a local Studio web app where the user edits text and order and comments on individual frames for the AI to revise, or entirely in conversation. Renders an MP4. Use whenever the user wants a video manual, product tutorial, usage guide video, feature demo, onboarding clip or animated user guide, or says things like "영상 매뉴얼", "사용법 영상", "튜토리얼 영상", "기능 소개 영상", "가이드 영상", "스튜디오 요청 처리해 줘" — including when they only share screens or a Figma link and ask how to explain a feature to their users.
---

# Video Manual

Turn product screens into a short captioned walkthrough video: an animated cursor clicks through the screens, highlights and zooms direct attention, and animated text explains each step.

The work has four steps. The user decides; you do the production.

| Step | The user | You |
| --- | --- | --- |
| 1. Product project | states who the product is for, sets brand colour, background template, logo, brand guide | derive the voice rules and tune the motion |
| 2. Scenes | attaches screenshots or a Figma link | import Figma frames |
| 3. Storyboard draft | settles the key screens, their order and the text | draft it for them to edit |
| 4. Video | watches, edits text and order, comments on frames | add the actions, check every frame, revise from comments, render |

Wording and order are what users care about most, so they are settled in step 3 before any production work, and stay editable in step 4 until the MP4 is rendered.

Talk with the user in their language. Write captions in the language of the product's UI unless told otherwise.

## Two ways to work

**With the Studio (default).** A local web app shows the four steps. The user works there; buttons marked ✦ queue requests that you pick up, fulfil and answer. Read [references/studio.md](references/studio.md) before starting it — it is the protocol for that loop.

**In conversation only.** When the user would rather not open a browser, or you cannot run a local server, do the same four steps by asking and showing in the conversation. See "Without the Studio" below.

Either way the files are identical, so a project can move between the two.

## Project layout

Everything lives under `video-manual/` in the user's project, so one profile serves every manual made for the product:

```
video-manual/
├── product-profile.json     # one per product: audience, voice, motion, background
├── brand/                   # guide.md (pasted brand guide), logo
├── requests.json            # requests queued from the Studio
└── <manual-slug>/           # one folder per video, e.g. create-task/
    ├── screens/             # 01-board.png, 02-new-task.png, ...
    ├── storyboard.json      # draft first, then the full storyboard
    ├── comments.json        # frame comments from the Studio
    └── out/                 # manual.html, manual.mp4, stills/, frames/
```

## Setup

The scripts live in this skill's `scripts/` folder. Rendering needs its dependencies once:

```bash
cd <skill-dir>/scripts && npm install
```

Then start the Studio in the background and give the user its address:

```bash
node <skill-dir>/scripts/studio.mjs video-manual --open
```

Tell them in a sentence what happens next: they fill in step 1, and you will pick up whatever they send with a ✦ button. Then wait for requests as [references/studio.md](references/studio.md) describes.

## Step 1 — Product project

If `video-manual/product-profile.json` already has a `voice` block, the product is set up: use it as is. Consistency across a product's videos matters more than tuning each one.

Otherwise the user fills in the form (name, domain, B2C/B2B, target age, device, accent colour, background template, optional logo and brand guide) and sends a `profile` request. Then:

1. Read the `product` block and `brand/guide.md`.
2. Write the `voice` block — the register, sentence endings, longest caption, words to avoid, product terms. Read [references/voice-guide.md](references/voice-guide.md). The user's brand guide overrides its general advice.
3. Tune the motion for the same audience. Read [references/motion-profiles.md](references/motion-profiles.md). The user picked the preset and background; you adjust pacing, sizes and easing where their audience calls for it.
4. Add a `rationale` of one or two sentences.

These three facts — target age, domain, B2C or B2B — decide every caption. If the form leaves one blank or the screens contradict it, ask before writing the voice rules.

## Step 2 — Scenes

One image per distinct screen state, in `screens/`, numbered in order of appearance. A state that changes visibly (a modal opens, a dropdown expands, a form is filled in) needs its own image: the video shows the result of a click by cutting to the next screenshot.

The user usually uploads these in the Studio. On a `scenes` request with a Figma link, export each frame as a PNG and record its logical width for `coordWidth`; read the layer metadata too — exact element bounds are far more reliable than estimating from pixels.

If a state the walkthrough needs is missing, say which one and ask for it rather than skipping the step. A jump the viewer cannot follow defeats the purpose of a manual.

## Step 3 — Storyboard draft

On a `draft` request, read every screen and the profile, then write the draft into `storyboard.json`: the scenes in order, each with its `caption` and a `note` describing what happens on it. No actions yet. Read [references/manual-script.md](references/manual-script.md) for how to scope the video and write the text, and write every line in the profile's voice.

The user edits the draft in the Studio and presses "Request the video" when the wording and order are right. That `produce` request is the approval. Do not add actions before it arrives.

## Step 4 — Video

### Produce

Read [references/storyboard-schema.md](references/storyboard-schema.md) and turn the approved draft into the full storyboard: follow each scene's `note`, add the actions, set `coordWidth`. Captions stay exactly as approved.

Coordinates are the part most likely to be wrong. Use exact bounds when you have them (Figma metadata, DOM rects). When you only have the image, look closely and estimate; the check below exists to catch what you get wrong.

### Check before the user sees it

Build, then render stills — one frame at every click, text and caption change, and at the end of every scene:

```bash
node <skill-dir>/scripts/build.mjs video-manual/<slug>/storyboard.json
node <skill-dir>/scripts/render.mjs video-manual/<slug>/out/manual.html --stills video-manual/<slug>/out/stills
```

`build.mjs` validates the storyboard, checks every caption against the profile's voice rules, and prints the timing of each scene. Fix the errors. For voice warnings on text the user wrote, keep their wording and mention the warning in your reply.

Read the stills and check each one:

- Is the cursor tip on the element the caption names?
- Does the highlight ring enclose the whole element and nothing else?
- After a zoom, is the target fully in view and readable?
- Does typed text sit inside its field and cover the placeholder?
- Is each caption fully visible, on at most two lines?
- Does each callout point at the right element without covering it or the cursor?

Correct the storyboard, rebuild and re-render until every frame passes, then answer the request. A cursor that clicks beside the button makes the whole manual look wrong, so the user should never be the one to find it.

### Review loop

In step 4 of the Studio the user can:

- edit any caption, title or on-screen text and reorder scenes — saved straight to `storyboard.json`, no request involved;
- pause on a frame, pin a position and write a comment, then send the comments as a `revise` request.

Handle `revise` as [references/studio.md](references/studio.md) describes: render the commented frame to see what they saw, change what the comment is about and nothing else, confirm on a fresh frame that it is fixed, and reply to each comment. After they reorder scenes, check that each click still leads to the screen that follows it; a broken chain is something to tell them about, not silently repair.

This loop repeats until they are satisfied.

### Render

The user exports the MP4 from the Studio with one button. To render it yourself:

```bash
node <skill-dir>/scripts/render.mjs video-manual/<slug>/out/manual.html --out video-manual/<slug>/out/manual.mp4
```

Rendering takes roughly as long as the video itself, sometimes two or three times that on a slower machine; run it in the background for manuals over a minute. Report the output path, length and file size.

## Without the Studio

Do the same four steps in the conversation:

1. **Project** — infer target age, domain and B2C/B2B from the screens and UI copy, state your reading and ask the user to confirm it in one question. Then write the whole profile yourself, including preset, accent and background.
2. **Scenes** — copy the images the user gives you into `screens/`, or capture them yourself if you have a browser or Figma tool.
3. **Draft** — write the draft storyboard, show it as a table (step, screen, what happens, caption, on-screen text) with the estimated length, and wait for approval. If they said up front to go straight through, proceed and say where the draft is.
4. **Video** — produce and check as above, then tell them where `out/manual.html` is. That standalone page plays the video and has its own panel for editing text and order; "Download edits" gives a `storyboard.edited.json` they can hand back. When they do, list what changed so they can confirm you read it as they meant it, save it as `storyboard.json`, rebuild and re-check the stills. Then render.

## Later changes

- **Wording or order**: the user edits in the Studio, or tells you.
- **Voice** ("too stiff", "our users are older than that"): change the `voice` block of the profile, then rewrite the captions to match.
- **Feel** ("too slow", "too bouncy"): change motion tokens in the profile, not individual scenes — see the tuning table in [references/motion-profiles.md](references/motion-profiles.md).
- **One step looks wrong**: fix that scene's actions and re-check its stills.

Rebuild and re-check stills after any change before rendering again.

## Limits

Say so plainly when a request runs into one of these:

- Screens are static images. Scrolling, hover states and in-app animation are not reproduced; show them as separate screenshots.
- No voice-over or music. Captions and on-screen text carry the explanation.
- The Studio edits text and scene order. What a step clicks or highlights changes through a comment to you.
- Output is 16:9 by default. Set `meta.width` and `meta.height` in the storyboard for other shapes.

## Troubleshooting

- **`playwright-core is not installed`**: run `npm install` in the scripts folder.
- **`no browser found`**: install Google Chrome, or run `npx playwright install chromium` in the scripts folder.
- **`ffmpeg not found`**: install ffmpeg or set `FFMPEG_PATH`. `npm install` normally provides one through `ffmpeg-static`.
- **A request stays "waiting" in the Studio**: nobody is running `studio.mjs wait`. Run it, or `studio.mjs pending`.
- **Step 4 shows errors instead of the video**: a scene points at a missing image or has a coordinate outside its screen. `build.mjs` names the scene.
- **A font looks wrong**: the video uses fonts installed on the machine. Set `font.family` in the profile to one that is installed.
