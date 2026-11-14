# Voice: deciding how the manual is written

The same step — "press the button to create a task" — should read differently in a banking app for people in their sixties, a study app for teenagers, and an admin console for IT staff. Who the product is for decides the wording before any caption is written. This guide turns three facts about the product into a set of writing rules, saved as the `voice` block of `product-profile.json`.

## Contents

- The three facts
- Target age
- B2C or B2B
- Domain
- When the facts pull in different directions
- Writing the voice block
- What the build checks

## The three facts

Establish these first. Infer what you can from the screens and the UI copy, then state your reading to the user and ask them to confirm or correct it — these are product decisions, and a wrong guess here skews every caption.

1. **Target age** — the age band of the people who will watch.
2. **B2C or B2B** — is the viewer using the product for themselves, or as part of their job?
3. **Domain** — finance, healthcare, education, commerce, developer tools, public services, and so on.

Also note the **device** (desktop or mobile), because it decides the verb for the basic action.

The product's existing UI copy is strong evidence for all three. If its buttons say "시작하기" and its empty states say "아직 아무것도 없어요", the product already speaks casual 해요체; the manual should sound like the same product.

## Target age

| Audience | Register (Korean) | Sentences | Vocabulary | Also |
| --- | --- | --- | --- | --- |
| Children (under 13) | 친근한 해요체 ("눌러 봐요") | Very short, one idea | Everyday words only; no loanwords the child would not say | Encourage after each step. Slow pacing. |
| Teens, early 20s | 가벼운 해요체 | Short and brisk | Casual; current slang only if the product itself uses it | Slang dates fast and reads as trying too hard — when unsure, leave it out. |
| 20s–40s | 해요체 | One sentence per step | Common loanwords are fine ("로그인", "탭") | The default register for most products. |
| 40s–50s | 정중한 해요체 ("눌러 주세요") | Complete sentences | Prefer the Korean word where one exists; explain an icon by what it looks like | Do not assume they know conventions like "햄버거 메뉴". |
| 60 and over | 정중한 해요체 or 합쇼체 ("누르십시오" is too stiff; "눌러 주세요" works) | One action per sentence, never two | No jargon, no abbreviations. Describe the target by position and appearance: "화면 오른쪽 위의 파란색 '확인' 버튼" | Reassure where a mistake seems possible: "잘못 눌러도 다시 돌아올 수 있어요." Slow pacing, larger captions. |

In English the same scale runs from playful second person with contractions ("Tap the star — nice!") to plain and complete ("Select **Confirm**, the blue button at the top right of the screen.").

Age also changes the motion, not only the words. Set these in the same profile:

| Audience | Motion adjustments |
| --- | --- |
| Children, 60 and over | `pacing.readingCps` 5–6, `pacing.hold` +0.4, `font.captionSize` 44–48, `cursor.size` +8, larger `click.rippleSize`, lower `cursor.speed` |
| 40s–50s | `pacing.readingCps` 6.5–7.5 |
| Teens, 20s–30s | preset defaults, or slightly faster |

## B2C or B2B

| | B2C — using it for themselves | B2B — using it at work |
| --- | --- | --- |
| The viewer wants | To get something for themselves, with little effort | To finish a task correctly and get back to work |
| Lead with | The benefit or the outcome: "사진을 한 번에 정리해요" | The action: "보고서 범위를 선택하세요" |
| Tone | Warm, encouraging, a little personality | Efficient, exact, neutral. No hype, no exclamation marks |
| Terms | Everyday words; avoid the product's internal names | The exact feature and menu names, and the industry's own terms — professionals search for them |
| Detail | Skip what they do not need to decide | Include what affects the result: permissions, who gets notified, what cannot be undone |
| Register (Korean) | 해요체 | 해요체 for most SaaS; 합쇼체 ("선택합니다") for enterprise, public-sector and regulated settings |

A B2B product used by non-specialists (a shift scheduler for shop staff, say) is B2B in purpose but should be worded like B2C: efficient, but in everyday language.

## Domain

| Domain | The viewer's concern | So write |
| --- | --- | --- |
| Finance, payments, insurance | "Will I lose money? Is this safe?" | Precisely and calmly. State exactly what will happen and when ("'이체'를 누르면 바로 송금돼요"). Say whether a step can be undone. Never joke about money. No vague words like "곧", "아마". |
| Healthcare, wellness | "Am I doing this right? Is something wrong with me?" | Plainly and without alarm. No medical claims or promises. Neutral about the body and results. |
| Education | "Can I do this?" | Encouragingly. Name progress ("이제 첫 강의를 들을 준비가 됐어요"). |
| Commerce, delivery, travel | "How fast can I get it?" | Briskly, benefit first. Be exact about price, dates and what happens at payment. |
| Productivity, collaboration | "How do I get this done?" | Like a helpful colleague: short, concrete, no selling. |
| Developer tools, data, infrastructure | "What exactly does this do?" | Tersely and literally. Exact identifiers, flags and names as they appear. No hand-holding, no adjectives. 명사형 or 합쇼체 ("토큰을 복사합니다") is normal. |
| Public services, government | "Am I filling this in correctly?" | In plain public language: 합쇼체 or polite 해요체, no loanwords where a Korean word exists, every term a first-time visitor would understand. |
| Games, entertainment, social | "Is this fun?" | With energy and the product's own character. Short. |

## When the facts pull in different directions

They often do: a finance app for people in their twenties, a developer tool with a playful brand. Use this order:

1. **Domain sets the floor for precision and seriousness.** Money, health and legal steps are stated exactly, whatever the brand. A playful finance app can be warm in its title card and still say precisely what a button does.
2. **Age sets the ceiling for difficulty.** Never write above what the least experienced viewer can follow, however professional the product.
3. **B2C/B2B and brand set the tone within those limits.**

## Writing the voice block

Record the facts and the rules they lead to. The rules are what matter later: a future session, or a reviewer, should be able to check a caption against them.

```json
{
  "product": {
    "name": "모아",
    "domain": "협업·업무 관리",
    "model": "B2B",
    "audience": { "age": "20–40대 직장인", "proficiency": "업무용 도구에 익숙하지만 모아는 처음", "device": "데스크톱" }
  },
  "voice": {
    "summary": "동료가 옆에서 알려 주듯 짧고 정확한 해요체. 버튼 이름은 화면 그대로 쓰고, 기능 자랑 없이 할 일만 말한다.",
    "register": "해요체",
    "endings": ["요.", "요!"],
    "maxWidth": 40,
    "avoid": [
      { "term": "클릭", "use": "누르다" },
      { "term": "생성", "use": "만들다" }
    ],
    "terms": { "작업": "카드 하나를 가리키는 말. '태스크'로 바꿔 쓰지 않는다" },
    "emoji": false
  }
}
```

| Field | What to put |
| --- | --- |
| `summary` | Two sentences a writer could follow: who is speaking to whom, and how. Shown to the user at the approval checkpoint. |
| `register` | The speech level or style: "해요체", "합쇼체", "friendly second person". |
| `endings` | Sentence endings every caption must finish with. Derive from the register: 해요체 → `["요.", "요!"]`; 합쇼체 → `["다.", "오."]`. Leave out for languages where it does not apply. |
| `maxWidth` | Longest caption, in Korean-character widths (a Latin letter counts as about half). 40 suits most audiences; 28–32 for children and viewers over 60. |
| `avoid` | Words not to use and what to use instead. Include the basic action verb you did *not* choose ("클릭" vs "누르다" vs "탭"), stiff or bureaucratic words, and jargon the audience would not know. |
| `terms` | The product's own nouns and how to use them, so "작업" does not become "태스크" halfway through. |
| `emoji` | Whether captions may use emoji. False unless the product's own UI does. |

**Choosing the action verb.** Pick one and put the others in `avoid`. Use the verb the product's own help text uses if it has one. Otherwise: "누르다" works on every device and for every age; "클릭하다" is fine for desktop tools aimed at working-age users; "탭하다" only for mobile products with a young audience.

## What the build checks

`build.mjs` checks every caption against `endings`, `maxWidth` and `avoid`, and every title and on-screen text against `avoid`. It prints a warning for each breach, naming the scene. Treat these as errors to fix, not noise: they are the profile catching a caption that drifted off voice.

The checks are mechanical. Whether a caption is clear, kind and right for the audience is still yours to judge — reread every caption as the viewer described in the profile before showing the script to the user.
