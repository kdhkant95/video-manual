# Writing the storyboard draft

The draft is what the user settles before any production work: which screens appear, in what order, and what the viewer reads on each. It has to make sense to someone who will never look at coordinates — a product manager or support lead should be able to scan it and say "step 3 is wrong" or "we call that button something else".

## Format

The draft is `storyboard.json` with only the parts a person decides. Each screen scene has its `caption` and a `note`; there are no actions yet.

```json
{
  "meta": { "title": "새 작업 만들기", "lang": "ko", "goal": "보드에 새 작업을 만들고 담당자를 지정하는 방법" },
  "scenes": [
    { "type": "title", "title": "새 작업 만들기", "subtitle": "보드에 할 일을 추가하고 담당자를 지정해요" },
    {
      "type": "screen",
      "image": "screens/01-board.png",
      "caption": "보드 오른쪽 위의 **'+ 새 작업'**을 누르세요.",
      "note": "오른쪽 위 '+ 새 작업' 버튼을 강조한 뒤 클릭",
      "actions": []
    },
    {
      "type": "screen",
      "image": "screens/02-new-task.png",
      "caption": "작업 **제목**을 입력하세요.",
      "note": "입력 창으로 확대, 제목 칸을 누르고 '온보딩 이메일 초안 작성' 입력. 이어서 담당자 칸 클릭 — 자막을 \"이어서 **'담당자'** 칸을 눌러 목록을 여세요.\"로 교체",
      "actions": []
    },
    { "type": "outro", "title": "작업이 추가됐어요", "subtitle": "카드를 끌어서 진행 상태를 바꿔 보세요" }
  ]
}
```

- **`caption`** is the text the viewer reads. It is the part the user approves word for word.
- **`note`** is the direction, written for a person: what is highlighted, where the click lands, whether the camera zooms in, what is typed, any second caption or callout and its wording. In step 4 you turn each note into actions. The user reads and edits notes too, so write them in their language.
- **`meta.goal`** is the one task the video teaches.

In the Studio the user sees this as a list of key screens with a text box and a note box each. Working in conversation instead, show it as a table — step, screen, what happens (the note), caption — with the estimated length, and list anything you had to guess (a missing screen, an unclear label, an assumed order) as open questions to raise first.

Until the user approves, the draft is cheap to change. Do not add actions to it early: a draft with coordinates in it looks finished and discourages the very edits this step exists for.

## Scope

One video teaches one task. If the screens cover several tasks ("create a project" and "invite a member"), propose separate videos — a viewer looking for one answer should not have to sit through another.

Aim for 3–8 steps and 20–60 seconds. Past that, viewers stop following along and start scrubbing. If a task honestly needs more, split it at a natural milestone.

Estimate length as about 4–5 seconds per step plus 5 seconds for the title and outro cards. `build.mjs` prints the exact figure.

## Steps

Each step is one screen state, one user action and one caption. A viewer can hold one instruction at a time; a step with two clicks hides the second.

Start from the state the viewer is actually in — usually the screen they see right after signing in — and include the step that gets them to the feature. Manuals often fail by opening on a screen the viewer does not know how to reach.

End on the result, not on the last click. The final step should show what success looks like (the new item in the list, the confirmation message), so the viewer can tell their own attempt worked.

In the `note`, describe the direction as you would to an editor: which element is highlighted, where the click lands, whether the camera zooms in. Use a zoom when the target is small relative to the screen or when the viewer needs to read something; leave it out when the element is already obvious, because every camera move costs attention.

## Captions

The caption is the manual. Many people watch with the sound off and many more only glance at the screen, so each caption must make sense without the others.

The profile's `voice` block decides how captions are worded — the register, the sentence endings, the words to avoid, the product's own terms. Read it before writing a line, and follow it over the general advice below wherever the two differ. `build.mjs` checks the mechanical rules later; whether a line is clear and right for the audience is yours to judge, so reread each caption as the viewer the profile describes.

- **Say what to do, then where.** "Click **New task** at the top right of the board." The action comes first because that is what the viewer is waiting for.
- **Use the UI's exact words** for buttons, menus and fields, in quotes. If the button says "만들기", the caption says '만들기', not "생성 버튼". Viewers match the caption to the screen by the label.
- **One sentence, two lines at most** — the profile's `voice.maxWidth`, typically about 40 Korean characters or 80 Latin characters. If it will not fit, the step is doing too much.
- **One register for the whole video**, the one in the profile. A manual that says "누르세요" in step 1 and "클릭합니다" in step 4 reads as written by two people.
- **Emphasise the one thing to find.** Wrap the button or field name in `**…**`; it appears in the accent colour.
- **Result steps describe the outcome**: "The new task appears in the 'To do' column."
- **Skip filler**: no "Now", "Next", "Simply", "먼저", "이제" at the start of every line. The step badge already shows the order.

**Example**

Screen: a board with a "+ 새 작업" button at the top right.

Weak: "이제 화면 우측 상단에 위치한 작업 생성 버튼을 클릭하여 새로운 작업을 생성하는 화면으로 이동합니다."
Better: "보드 오른쪽 위의 '+ 새 작업'을 누르세요."

The weak version renames the button, runs to three lines, and explains what will happen instead of what to do.

## On-screen text

Besides the caption, a step can show a short callout pinned to something on the screen, or a centred banner. Plan them in the scene's `note`, with their exact wording, so the user approves that too.

Use a callout for what the caption has no room for but the viewer benefits from knowing at that exact spot: a consequence ("지정하면 알림이 가요"), a reassurance ("나중에 바꿀 수 있어요"), or a name for what just appeared ("방금 만든 작업"). Use a banner for a single moment of emphasis, usually success.

Keep them to a few words and to one or two per video. They follow the same voice rules as captions. If a callout repeats the caption, delete it.

## Title and outro cards

- **Title**: the task, phrased as what the viewer gets — "새 작업 만들기", not "작업 관리 기능 소개". Subtitle: product name, or one line on when you would do this.
- **Outro**: confirm the outcome in a few words and, if there is an obvious next step, name it. Keep it short; nobody reads a paragraph on a closing card.
