# Motion profiles

The motion half of `product-profile.json` is the set of rules for how a product's video manuals move: how text arrives, how the cursor travels, what a click looks like, how attention is directed, and how fast everything goes. It is decided once per product, after the audience and voice (see [voice-guide.md](voice-guide.md)), so every manual for that product feels like part of the same family.

## Contents

- Choosing a preset
- Adjusting for the audience
- Writing the motion tokens
- Token reference
- Tuning from feedback

## Choosing a preset

Motion carries personality the same way a typeface does. A banking dashboard whose captions bounce feels untrustworthy; a children's app whose captions fade in slowly feels cold. Match the motion to how the product already presents itself.

Read the product before asking the user anything. The screens tell you most of it:

| Signal in the screens | Points toward |
| --- | --- |
| Dense tables, forms, muted palette, formal UI copy | `calm-professional` |
| Rounded shapes, illustrations, emoji, casual copy, bright colours | `friendly-playful` |
| Code, terminals, monospace type, dark theme, technical terms | `sharp-technical` |
| Lots of whitespace, large type, restrained palette, editorial imagery | `premium-minimal` |

Then weigh the audience and setting. People following along at work want calm and exact motion. People discovering a product for fun tolerate, and enjoy, more energy. Viewers who are older or new to software need slower pacing whatever the brand.

| Preset | Feels like | Text | Cursor and click | Screen changes | Typical products |
| --- | --- | --- | --- | --- | --- |
| `calm-professional` | steady, precise | words fade up | smooth, modest ripple | crossfade | B2B SaaS, finance, healthcare, admin tools |
| `friendly-playful` | warm, bouncy | words pop with overshoot | overshoots slightly, big ripple, pulsing highlight | slide | consumer apps, education, community |
| `sharp-technical` | fast, exact | monospace typewriter | quick, straight, small ripple | hard cut | developer tools, data, infrastructure |
| `premium-minimal` | slow, quiet | words resolve from blur | dot cursor, gliding | long crossfade | design tools, brand-led products |

The preset files are in `assets/profiles/`. Read the one you pick to see its full values.

When a product sits between two presets, start from the one that matches its *audience* and borrow a single trait from the other — for example `calm-professional` with the `pop` text animation for a friendly HR tool. Mixing more than that tends to produce motion with no clear character.

## Adjusting for the audience

The preset sets the character; the audience recorded in the profile sets how demanding the video may be to watch. Apply these on top of whichever preset you chose.

| Audience | Adjust |
| --- | --- |
| Children, or 60 and over | `pacing.readingCps` 5–6, `pacing.hold` +0.4, `font.captionSize` 44–48, `cursor.size` +8, larger `click.rippleSize`, lower `cursor.speed`, `zoom.maxScale` up so small targets become large |
| 40s–50s | `pacing.readingCps` 6.5–7.5 |
| First-time or non-technical users of any age | lower `pacing.readingCps` by 1; keep `highlight.dim` on so the target is unmistakable |
| Experts watching at work (B2B, developer tools) | raise `pacing.readingCps`; shorter `pacing.beat` and `pacing.hold` — they resent waiting |
| Finance, healthcare, public services | no overshoot easings and no `pulse`, whatever the brand — motion that bounces undermines trust where stakes are high |

## Writing the motion tokens

Motion tokens sit at the top level of `product-profile.json`, beside the `product` and `voice` blocks. List only what differs from the preset; everything else is inherited through `extends`.

```json
{
  "extends": "calm-professional",
  "product": { "name": "Moa", "domain": "collaboration", "model": "B2B", "audience": { "age": "20s–40s, at work" } },
  "voice": { "summary": "…" },
  "rationale": "Used at work by non-technical teams. Calm base, product violet as the accent, slightly slower reading pace for first-time users.",
  "colors": { "accent": "#6c5ce7" },
  "pacing": { "readingCps": 7.5 }
}
```

Always set these:

- **`extends`** — the preset.
- **`colors.accent`** — the product's own primary colour, taken from its buttons or logo. It colours the highlight ring, click ripple, step badge and progress bar, so it is what ties the video to the brand.
- **`rationale`** — one or two sentences on why this profile suits the product. The user reads this at the approval checkpoint, and a future session reads it to understand the intent.

Change other tokens only for a reason you can state.

### Background and logo

In the Studio the user picks these; working in conversation, you set them.

```json
"canvas": { "template": "glow", "tone": "dark", "colors": ["#17143a", "#2a2360"] },
"brand": { "logo": "brand/logo.png", "logoPlacement": "cards" }
```

- `canvas.template`: `plain`, `gradient`, `glow` (soft accent-coloured light in two corners), `grid`, `dots`, `spotlight`. `canvas.colors` are the two background colours. Without a template, the preset's own `canvas.background` (any CSS background) is used.
- Pick colours that contrast with the product's screens: a dark canvas behind a dark-themed app hides the frame edge. With a light canvas, also set `colors.text`, `colors.muted`, `colors.captionBg` and `colors.captionText` to dark-on-light values.
- `brand.logo` is a path relative to the profile. `logoPlacement`: `cards` (title and outro), `corner` (bottom-left over screens) or `both`.

## Token reference

Durations are seconds, sizes are pixels on a 1920×1080 stage.

**`text`** — how captions and titles arrive
- `animation`: `fade`, `fade-up`, `slide-in`, `pop`, `blur-in`, `typewriter`
- `unit`: `line`, `word` or `char` — what animates as one piece. `word` suits Korean and English; `char` is for `typewriter`.
- `stagger`: delay between consecutive units. `duration`: how long one unit takes. `easing`: see below.

**`cursor`** — `style` (`arrow` for desktop, `dot` for touch or a minimal look), `size`, `speed` (stage px per second), `minDuration`/`maxDuration` (limits on one move), `easing`, `arc` (how much the path curves; 0 is straight).

**`click`** — `duration` (time one click occupies), `press` (cursor scale at the bottom of the press), `rippleSize`, `rippleDuration`.

**`highlight`** — `duration`, `easing`, `width` (ring thickness), `radius`, `padding` (gap between element and ring), `dim` (how dark the rest of the screen goes, 0–1; 0 turns the spotlight off), `glow` (0–1), `pulse` (true makes the ring breathe).

**`zoom`** — `maxScale`, `fill` (how much of the frame the target should occupy, 0–1), `duration`, `easing`.

**`transition`** — `type` (`crossfade`, `slide`, `cut`), `duration`, `easing`. Applies between different screens and to title cards.

**`pacing`**
- `readingCps`: reading speed in Korean (wide) characters per second; a Latin letter counts as about half. Each scene stays up at least long enough to read its caption at this speed. Lower means slower.
- `beat`: pause before the first action of a step. `hold`: pause after the last. `minScene`: shortest a step may be. `typeCps`: typing speed.

**`caption`** — `style` (`bar` or `plain`), `maxWidth`, `zone` (height reserved at the bottom), `showStep` (the "2/5" badge).

**`canvas`** — `background` (any CSS background), `padding`. **`frame`** — `chrome` (`auto`, `browser`, `phone`, `none`), `radius`, `shadow`. **`font`** — `family`, sizes and weights. **`colors`** — `accent`, `text`, `muted`, `captionBg`, `captionText`. **`progress`** — show the bar along the bottom edge.

**Easings**: `linear`, `easeOutCubic`, `easeInOutCubic`, `easeOutQuint`, `easeInOutQuint`, `easeOutExpo`, and two that overshoot — `easeOutBack` and `spring`. Overshoot reads as playful; keep it off cameras and anything in a serious product.

## Tuning from feedback

Users describe feel, not tokens. Change the profile, not individual scenes, so the fix applies to every future manual too.

| The user says | Change |
| --- | --- |
| "Too fast, I can't read it" | lower `pacing.readingCps` by 1–2; raise `pacing.hold` |
| "It drags" | raise `pacing.readingCps`; lower `pacing.beat` and `pacing.hold`; raise `cursor.speed` |
| "Too bouncy / childish" | text `easing` → `easeOutCubic`, `animation` → `fade-up`; cursor `easing` → `easeInOutCubic`; `highlight.pulse` → false |
| "Too stiff / boring" | text `animation` → `pop` with `easeOutBack`; raise `click.rippleSize`; `transition.type` → `slide` |
| "I lose track of the cursor" | raise `cursor.size` and `click.rippleSize`; lower `cursor.speed` |
| "The zoom makes me dizzy" | lower `zoom.maxScale`; raise `zoom.duration`; or remove zooms from the storyboard |
| "The dimming is too heavy" | lower `highlight.dim` |
| "It doesn't look like our brand" | set `colors.accent`, `canvas.background` and `font.family` from the brand guide |
