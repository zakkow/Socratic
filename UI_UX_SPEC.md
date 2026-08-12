# UI/UX Spec

## Visual direction
Not the generic purple-gradient/soft-rounded "AI app" look. Reference direction: bold, stylistic linework — think of how manga/anime like Gachiakuta or Demon Slayer use strong, deliberate ink lines rather than soft gradients and drop shadows. Translated to a web UI:

**Color palette:**
```css
--color-bg: #F5EFE3;          /* linen — warm, not stark white */
--color-surface: #FFFFFF;
--color-primary: #9CC5A1;      /* pastel sage green */
--color-primary-deep: #6B9A73; /* for hover/active states, not a gradient partner */
--color-ink: #1F2421;          /* near-black, used for borders/outlines/headers — this is the "bold line" */
--color-accent: #C97B4A;       /* muted terracotta — sparing use, primary CTA only */
--color-error: #B5533C;        /* muted, not a harsh alert red */
```

**Concrete style rules:**
- No gradients, anywhere. Flat fills only.
- Cards and buttons get a real border (2px solid `--color-ink`), not a soft box-shadow. Shadows, if used at all, are small and hard-edged, not the diffuse "floating card" blur.
- Corner radii stay small (4–8px) — geometric, not pill-shaped/bubbly. Nothing should look inflated.
- Headers use a sans-serif with actual character (Space Grotesk, Archivo, or Bricolage Grotesque — not Inter/system-ui default). Body text can stay a clean readable sans.
- Icons/illustrations: bold outlined line-art, not filled rounded flat icons.

**Motion:** deliberate and snappy, not a generic fade. The match reveal specifically should feel like a stamp hitting paper — a quick scale + slight settle, not a soft ease-in-out fade. Interactions elsewhere (button presses, toggles) should have a similarly quick, decisive feel — nothing mushy or slow.

## Tone
This is for stressed students, not a corporate dashboard. Warm, calm, encouraging — but "warm" here means the linen/green palette and honest directness, not soft rounded cuteness. Avoid harsh reds/alert styling except for genuine errors (a failed request), never for normal states like "not matched yet."

## Layout — free-roam, not forced tabs
No wizard/forced sequence. This is a browse-and-search space, not a form flow:

- **Home/explore view:** a searchable, filterable board of topics (search bar prominent, filters for subject/course). Each topic shows an anonymized count ("14 people stuck on this right now") — not a public list of named profiles. Identity stays private until an actual match happens; browsing is topic-level, not people-level.
- **"What are you working on" input** is always accessible (persistent, not a gated first step) — a student can submit a struggle, browse topics, search, and request a match in any order.
- **Match reveal** — same centerpiece treatment as before: large, celebratory, partner name + shared topic + generated explanation in a distinct card, stamp-in motion on reveal. Not-matched state stays calm, same visual family, "check back shortly."
- **Scratchpad** opens once matched — both names visible, debounced shared writes, subtle sync indicator.
- **Unmatch / Report / Block** need to be reachable from both the match reveal and the scratchpad at all times — not buried in a settings menu. A small, always-visible menu (e.g., a kebab icon) on any screen showing another user is the right pattern.

## General
- Fully responsive; needs to demo cleanly on a laptop screen during a live presentation — test at a standard 1440px laptop width as the primary target, not mobile-first.
- Consistent spacing/type scale across every view — it should feel like one product, not separately designed pages.
- Every async action (submitting a struggle, searching, requesting a match) needs a visible loading state — no dead buttons with no feedback while a request is in flight.
- Sufficient color contrast on all text (this is both good practice and something a judge or interviewer might actually check).