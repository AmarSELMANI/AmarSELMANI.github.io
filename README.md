# amarselmani.github.io

My portfolio: <https://amarselmani.github.io>, in English (root) and French (`/fr/`).

**Design: "Clean Sheet"** (since 2026-10-17), the simpler edition of "Contact Sheet". Warm paper and ink, one
readable typeface (Plus Jakarta Sans) with a few accent words in Instrument Serif italic, red pencil circles
drawn around key words, projects laid out like prints on a light table. Dark mode is the darkroom
under the safelight. Built on Halation, my design system (Thriller genre · intensity 1 · light mode first,
tint `selmani`): its colours and motion, with the fonts overridden in `assets/site.css`.

The home page stays short and in plain words, for business clients: who I am, what I build, the work, prices,
contact. Add to it only what a client needs to decide.

### The previous design, "Contact Sheet"

Condensed serif capitals and more sections (a statement, "Try to break it" challenges, a contact-sheet footer).
Kept three ways:

- **To look at:** `archive/contact-sheet/`, a frozen copy of the four pages (`noindex`), online at
  <https://amarselmani.github.io/archive/contact-sheet/> once pushed.
- **In git:** the tag `design-contact-sheet` and the branch `design/contact-sheet` (commit `8da12bc`).
- **To go back:** check out from the tag the files this redesign changed, then rebuild:
  `git checkout design-contact-sheet -- src assets/site.css assets/site.js demos/demo.css demos/marine-bot/app.css demos/naftal-b2b/index.html demos/naftal-b2b/fr.html demos/marine-bot/index.html demos/marine-bot/fr.html`
  and `node src/build.mjs`. If a demo page changed since, restore only its font `<link>` and `?v=` instead.

## Pages

| Page | Sections |
|---|---|
| `index.html`, `fr/index.html` | Centred sentence (one word circled) · light table of five projects, Triple A first (arrows, drag, swipe, keys), sized so its title, print and caption fit one screen; each print opens the project's description page · three numbers · four service cards as tilted prints, each with an animated ink-and-pencil drawing of its promise (built in `src/build.mjs`, animated in `assets/site.css`) · about · contact form · footer. Buttons don't follow the pointer: ink rises in them and the arrow steps forward. |
| `services.html`, `fr/services.html` | Split hero with a fan of phones · services in tabs (`services.html#mobile` opens that tab) with prices · four steps · contact form · footer |
| `work/<slug>/`, `fr/work/<slug>/` | One description page per project before its demo (Triple A, Naftal AI, Marine Bot, BN Signature; the B2B demo is its own description page): the pitch and the way in · the capture on the light table · three numbers · what it does, as four pinned prints · more screens · try it yourself / my part and stack · the demo again or the next project · contact · footer. Words in `src/content.mjs` → `T[lang].pages`, extra captures in `shots`. Triple A links out to its live site, which can't be embedded (`X-Frame-Options: SAMEORIGIN`). |

The contact form sends nothing itself: it opens WhatsApp or the visitor's e-mail app with the message written.

## Files

| File | What it is |
|---|---|
| `src/content.mjs` | **All words and prices**, English and French. `{c:word}` circles a word, `{u:words}` underlines, `{k:words}` sets red, `{em:words}` the italic voice, `{code:x}` sets x as code. |
| `src/build.mjs` | Renders every page (home, services and the description pages, in both languages): `node src/build.mjs` after any content change. |
| `src/og.html` | The link preview (`img/og.jpg`, `img/og-fr.jpg`, 1200 × 630) in the site's design. Serve the repo, open `src/og.html` (or `?fr`) in a 1200 × 630 window, save a JPEG screenshot over the image, then bump `V` so WhatsApp, LinkedIn and Facebook fetch the new one (`og:image` carries `?v=`). |
| `assets/site.css` | Layout and type. Halation tokens only: no literal colors or radii; the fonts are set once as tokens at the top. The demo pages load the same fonts: keep their `<link>` in step with `FONTS` in `src/build.mjs`. |
| `assets/site.js` | Red pencil marks, light table, service drawings, counters, tabs, form, theme and motion toggles. |
| `assets/halation/` | Copied from Halation 1.0.0 (`Documents\Motion design`), including `selmani.css` (the paper tint). Re-copy to update; don't edit here. |
| `assets/vendor/` | GSAP 3.13 + ScrollTrigger. |
| `img/` | Real captures of the demos (October 2026: `triple-a*.webp`, `naftal-ai-v2*.webp` and `naftal-ai-assistant.webp`, `marine-v2.webp`, `marine-phone-v2.webp`, `marine-ratings.webp`, `marine-message.webp`; the older captures stay for the archived design), the portrait (`portrait-halation.webp`), BN Signature stills in `bn/`, link previews `og.jpg` / `og-fr.jpg`. Desktop captures are 1600 × 1000, phone captures 780 × 1410 (390 wide at 2×), without the browser's scrollbar. |
| `demos/` | The live demos. `bn-signature/` is the presentation deck (speaker notes removed). |
| `demos/cut.css` | The portfolio's page cut for the demos that keep their own styles (Naftal AI, Marine Bot): the cross-document opt-in, the same wipe as `assets/site.css`, and the safety net. |
| `archive/contact-sheet/` | The previous design, frozen (see above). Not generated: `src/build.mjs` leaves it alone. |

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
Every page joins the same page transition. A cross-document view transition plays only when both pages opt in,
and the arriving page's rules animate it, so every page carries the cut: the portfolio's pages through
`assets/site.css`, the Naftal AI and Marine Bot demos through `demos/cut.css` plus the safety-net script in their
`<head>`. `a[data-cut]` plays Halation's shutter in browsers without view transitions. The Naftal AI demo is the
app's own build: only its banner and the two cut lines (the `cut.css` link and the script) were edited in
`demos/naftal/index.html`. **Port those lines and the banner to the branch's `frontend/index.html` before
rebuilding the demo, or a rebuild will undo them** (the October 2026 rebuild from `halation-redesign` did).

| Demo | Path | How to rebuild |
|---|---|---|
| Naftal B2B | `demos/naftal-b2b/` | In `naftal-b2b`, branch `portfolio-demo`: `node demo/build.mjs <this repo>/demos/naftal-b2b`. |
| Naftal AI platform | `demos/naftal/` | In `naftal-ai-platform`, branch `halation-redesign` (the current design): `VITE_DEMO=1 npx vite build` in `frontend/`, then replace this folder with `dist/` and put back the cut lines (see above). |
| Algerian Coast Marine Bot | `demos/marine-bot/` | Copy the bot's `src/` modules into `demos/marine-bot/engine/`. |
| BN Signature | `demos/bn-signature/` | In `Documents\bn hotel`: `node scripts/bundle.mjs --owner`, copy `build/owner.html` here as `index.html`. |
