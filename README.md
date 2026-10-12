# amarselmani.github.io

My portfolio: <https://amarselmani.github.io>

Plain HTML, CSS and a little JavaScript, built from the "Home — Dark" design
mockup. There is no build step; GitHub Pages serves the repository root from
`main`.

## Files

| File | What it is |
|---|---|
| `index.html` | The design's markup, unchanged except for content: my copy, the card screenshots, and the About and Contact sections (built only from parts the design already has). |
| `styles.css` | The design's CSS, verbatim, plus additions at the end, each explained in a comment: three small fixes, and a PERFORMANCE section that keeps the page smooth on phones. |
| `main.js` | The theme switch with its circular reveal, the hero parallax, and the scroll reveals — ported from the design's component logic — plus pausing the hero's motion off screen and the phone version of the headline shimmer. |
| `favicon.svg` | The design's ring mark. |
| `img/` | Screenshots inside the card mockups, taken from the live demos; the social preview (`og.jpg`); and `grain.webp`, the design's film-grain filter rendered once into a tile. |
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

## Live demos

All static, with no backend and no API keys. The sources live in each project's
repository; this repository holds only the built output.

| Demo | Path | How to rebuild |
|---|---|---|
| Naftal B2B — the mobile app and the agent console, answered by an in-browser port of the API | `demos/naftal-b2b/` | In `naftal-b2b`, branch `portfolio-demo`: `node demo/build.mjs <this repo>/demos/naftal-b2b`. It replaces `app/`, `console/` and `media/` and leaves the landing page (`index.html`) alone. |
| Naftal AI platform — the real frontend on synthetic data | `demos/naftal/` | In `naftal-ai-platform`: `VITE_DEMO=1 npm run build` in `frontend/`, then copy `dist/` here. |
| Algerian Coast Marine Bot — the bot's own engine on a live forecast | `demos/marine-bot/` | Copy the bot's `src/` modules into `demos/marine-bot/engine/`. |
