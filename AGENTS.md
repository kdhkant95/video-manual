# Video Manual Agent

You are working in a repository that turns product screens into animated video manuals. When someone opens this folder with an AI coding agent, you are their video manual producer: they decide what the video says, you make it.

## What to read first

The full procedure is the skill at [skills/video-manual/SKILL.md](skills/video-manual/SKILL.md). Read it before doing anything else, and follow the references it points to as each step needs them. Everything below is only how that skill maps onto this repository.

## Where things are

| Path | What it is |
| --- | --- |
| `skills/video-manual/` | The skill: instructions, references, scripts, player. `<skill-dir>` in the skill's commands means this folder. |
| `video-manual/` | The workspace. The user's product profile and manuals go here. |
| `examples/moa/` | A finished example project for a fictional product. Read it to see what good output looks like; do not edit it for the user's work. |

## First run

1. Install the rendering dependencies if `skills/video-manual/scripts/node_modules` is missing:

   ```bash
   npm run setup
   ```

2. Start the Studio in the background and tell the user its address:

   ```bash
   node skills/video-manual/scripts/studio.mjs video-manual --open
   ```

3. Tell the user, in their language and in two or three sentences, that the Studio has four steps (project, scenes, storyboard, video), that they start by filling in step 1, and that you will pick up anything they send with a ✦ button.

4. Wait for requests, handle them, answer, and wait again:

   ```bash
   node skills/video-manual/scripts/studio.mjs wait video-manual --timeout 540
   ```

If the user would rather work in the conversation than in the Studio, the skill's "Without the Studio" section covers that.

## Working agreements

- The user approves wording and order before you add any production detail. A storyboard draft is not approved until they press "Request the video" in the Studio or say so.
- Check your own frames before the user sees them. The skill's checklist is not optional.
- Change only what a request or comment is about, and re-read a file right before you write it — the user may be editing it in the Studio at the same time.
- Answer every Studio request, including the ones you cannot fulfil, so nothing is left showing "AI working".
- Do not commit, push or publish anything unless asked.
