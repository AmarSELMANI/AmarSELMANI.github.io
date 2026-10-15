# amarselmani.github.io

My portfolio: <https://amarselmani.github.io>, in English (root) and French (`/fr/`).

**Design: "Contact Sheet".** A photographer's contact sheet: warm paper, ink-black condensed capitals,
safelight-red grease-pencil circles drawn around key words, projects laid out like prints on a light table
with a loupe. Dark mode is the darkroom under the safelight. Structure inspired by kayleighnoele.com.
Built on Halation, my design system (Thriller genre · intensity 1 · light mode first, tint `selmani`).

## Pages

| Page | Sections |
|---|---|
| `index.html`, `fr/index.html` | Centred statement (one word circled) · light table of four live demos (arrows, drag, swipe, keys, loupe) · numbers · statement · four service cards · "Try to break it" challenges · about · contact form · footer |
| `services.html`, `fr/services.html` | Split hero with a fan of phones · services in tabs (`services.html#mobile` opens that tab) with prices · process as contact-sheet frames · contact form · footer |

The contact form sends nothing itself: it opens WhatsApp or the visitor's e-mail app with the message written.

## Files

| File | What it is |
|---|---|
| `src/content.mjs` | **All words and prices**, English and French. `{c:word}` circles a word, `{u:words}` underlines, `{k:words}` sets red, `{em:words}` the italic voice. |
| `src/build.mjs` | Renders the four pages: `node src/build.mjs` after any content change. |
| `assets/site.css` | Layout. Halation tokens only: no literal colors, fonts or radii. |
| `assets/site.js` | Grease-pencil marks, light table and loupe, counters, challenges, tabs, form, theme and motion toggles. |
| `assets/halation/` | Copied from Halation 1.0.0 (`Documents\Motion design`), including `selmani.css` (the paper tint). Re-copy to update; don't edit here. |
| `assets/vendor/` | GSAP 3.13 + ScrollTrigger. |
| `img/` | Real captures of the demos, the portrait (`portrait-halation.webp`), BN Signature stills in `bn/`, link previews `og.jpg` / `og-fr.jpg`. |
| `demos/` | The live demos. `bn-signature/` is the presentation deck (speaker notes removed). |

## Prices

`src/content.mjs` → `site.prices.eur` (in euros). The dinar list is computed from it at `site.dzdPerEur`
(275 DA per euro), rounded to the nearest 5,000 DA, so change only the euro prices or the rate. `null` shows
"On request" / "Sur demande". Set 2026-10-15 from market research: above Algerian freelancers (Onyxlab 2026
barometer), below French senior freelancers (Malt, TJMètre, Lescreavores). The Services page has a € / DA
toggle; visitors in the Africa/Algiers time zone see dinars first, and a choice is remembered
(`localStorage["pf-cur"]`). Then `node src/build.mjs`.

## Local preview

```bash
python -m http.server 8000
```

Open <http://localhost:8000> (add `?h-debug` for an fps / tier overlay).

## Live demos

All static, with no backend and no API keys. Sources live in each project's repository.

The demo pages share the portfolio's design: `naftal-b2b/index.html` and `marine-bot/index.html` load
Halation, `assets/site.css`, `assets/site.js` and `demos/demo.css` (their own components in `marine-bot/app.css`).
Both have a French edition, `fr.html`, next to `index.html` (the French portfolio links to it; `src/build.mjs`
rewrites the links). The B2B pages set `localStorage["naftal.lang"]` so the app and console open in the page's
language. The Marine Bot's `app.js` reads the page's `lang`: on `fr.html` it labels everything in French and
translates the engine's English limit and flag sentences for display (the `engine/` files stay verbatim, so a
new sentence in the engine shows in English until a rule is added to `FR_RULES` in `app.js`).
After changing demo pages or assets, bump `V` in `src/build.mjs` and the `?v=` on the demo pages.
Every page joins the same page transition (cross-document view transitions in `assets/site.css`; `a[data-cut]`
plays Halation's shutter in other browsers). The Naftal AI demo is the app's own build: only its banner and the
transition were edited in `demos/naftal/index.html`. **Port that `<style>` block and banner to the
`portfolio-demo` branch's `frontend/index.html` before rebuilding the demo, or a rebuild will undo them.**

| Demo | Path | How to rebuild |
|---|---|---|
| Naftal B2B | `demos/naftal-b2b/` | In `naftal-b2b`, branch `portfolio-demo`: `node demo/build.mjs <this repo>/demos/naftal-b2b`. |
| Naftal AI platform | `demos/naftal/` | In `naftal-ai-platform`, branch `portfolio-demo`: `VITE_DEMO=1 npx vite build` in `frontend/`, then replace this folder with `dist/`. |
| Algerian Coast Marine Bot | `demos/marine-bot/` | Copy the bot's `src/` modules into `demos/marine-bot/engine/`. |
| BN Signature | `demos/bn-signature/` | In `Documents\bn hotel`: `node scripts/bundle.mjs --owner`, copy `build/owner.html` here as `index.html`. |
