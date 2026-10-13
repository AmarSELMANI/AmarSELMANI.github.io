# amarselmani.github.io

My portfolio: <https://amarselmani.github.io>

Plain HTML, CSS and a little JavaScript, built from the "Home — Dark" design
mockup (the version with the portrait and the live background). There is no
build step; GitHub Pages serves the repository root from `main`.

## Files

| File | What it is |
|---|---|
| `index.html` | The design's markup, unchanged except for content: my copy, the portrait, the card screenshots, and the About and Contact sections (built only from parts the design already has). |
| `styles.css` | The design's CSS, verbatim, plus additions at the end, each explained in a comment: three small fixes; CARD ASSEMBLY, the project cards putting themselves together as they scroll in; and PERFORMANCE, which keeps the page smooth on phones. |
| `main.js` | The theme switch with its circular reveal, the hero parallax (portrait, glow, background, text), and the scroll reveals — ported from the design's component logic — plus pausing the hero's motion off screen and the phone version of the headline shimmer. |
| `favicon.svg` | The design's ring mark. |
| `img/` | The portrait (`portrait.webp`, 4:5); screenshots inside the card mockups, taken from the live demos (the AI platform's at phone, tablet and desktop size, picked by screen width); the social preview (`og.jpg`); and `grain.webp`, the design's film-grain filter rendered once into a tile. |
| `demos/` | The live demos the cards open. |

## Local preview

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Editing

Card copy lives in `index.html`; search for the project's name. The design
gives each small card one line of description, and the large card up to three,
so keep to those lengths and the layout stays exactly as designed.

To change the photo, replace `img/portrait.webp` with another 4:5 image
(960 × 1200 is sharp on high-density screens) and update the `width` and
`height` on its `<img>`.

The card parts that assemble carry `asm-*` classes: `asm-text`, `asm-chip`,
`asm-arrow`, and, inside the mockups, `asm-rise` (from below), `asm-left` and
`asm-right` (from either side). Give a new card's parts the same classes and
it assembles the same way.

## Live demos

All static, with no backend and no API keys. The sources live in each project's
repository; this repository holds only the built output.

| Demo | Path | How to rebuild |
|---|---|---|
| Naftal B2B — the mobile app and the agent console, answered by an in-browser port of the API | `demos/naftal-b2b/` | In `naftal-b2b`, branch `portfolio-demo`: `node demo/build.mjs <this repo>/demos/naftal-b2b`. It replaces `app/`, `console/` and `media/` and leaves the landing page (`index.html`) alone. |
| Naftal AI platform — the real frontend on synthetic data | `demos/naftal/` | In `naftal-ai-platform`, branch `portfolio-demo` (the demo layer on top of the app; merge the app's latest commits into it first): `VITE_DEMO=1 npx vite build` in `frontend/`, then replace this folder with `dist/`. |
| Algerian Coast Marine Bot — the bot's own engine on a live forecast | `demos/marine-bot/` | Copy the bot's `src/` modules into `demos/marine-bot/engine/`. |
