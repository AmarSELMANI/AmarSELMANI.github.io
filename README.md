# amarselmani.github.io

My portfolio. Plain HTML, CSS and a little vanilla JavaScript — no framework and
no build step, so GitHub Pages serves the repository root directly.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole page. Edit project copy here. |
| `styles.css` | Design tokens on `:root`, light and dark palettes. |
| `main.js` | Theme toggle (persisted in `localStorage`) and the footer year. |
| `favicon.svg` | Monogram icon. |
| `.nojekyll` | Tells GitHub Pages to skip Jekyll processing. |

## Local preview

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Deploying

Pushing to `main` publishes automatically once GitHub Pages is enabled
(Settings → Pages → Source: `main`, folder `/`). It goes live at
<https://amarselmani.github.io>.

## Editing a project

Each project is one `<article class="project">` block in `index.html`. To add
one, copy an existing block and change the heading, tagline, bullet points,
`<li>` stack tags and links.

A project with no live demo yet carries a `badge-wip` span. When the demo goes
up, replace that span with a link:

```html
<a class="btn btn-small" href="https://example.com" target="_blank" rel="noopener noreferrer">Live demo &#8599;</a>
```

## Before going public

Two placeholders in `index.html` need real values:

- `REPLACE_WITH_YOUR_EMAIL` — the address you want publicly visible.
- `REPLACE_WITH_YOUR_LINKEDIN` — your profile URL, or delete that `<a>` block.

## Live demos

Each demo is a static page under `demos/`, served from the same GitHub Pages
site. No backend and no API keys.

| Demo | What runs | Path |
|---|---|---|
| Car diagnosis | `engine.js`, a direct port of `inference_engine.py`, over the same `rules.json` and `questions.json` the desktop app reads. Verified against the Python original across all 2,612 answer paths — identical diagnosis and identical rule-firing order on every one. | `demos/car-diagnosis/` |
| Marine bot | The bot's own `src/` modules, copied verbatim into `demos/marine-bot/engine/`, fetching a live forecast from Open-Meteo in the browser. Deterministic assessment only — no LLM, so no key is needed. | `demos/marine-bot/` |

Both demos copy data or code from their source repositories rather than
importing across repos. If the knowledge base or the engine changes upstream,
re-copy the files listed above.

### Naftal demo

`demos/naftal/` is a production build of the platform's real React frontend with
`VITE_DEMO=1`. In that mode:

- `src/lib/api.ts` answers every request from `src/lib/demo-api.ts` in the
  browser instead of calling the FastAPI backend;
- `src/lib/assistant.ts` streams a pre-written answer through the same SSE
  callback sequence the real endpoint uses;
- the router switches to `HashRouter`, because GitHub Pages has no SPA rewrite
  and a refresh on `/admin` would otherwise 404.

All data is synthetic and lives in `src/lib/demo-data.ts`. Scope filtering is
computed from that centre table, so signing in as a different demo account
genuinely changes the aggregates. The sources for this build are kept in the
platform repository, not here — this folder holds only the compiled output.

To rebuild it: `VITE_DEMO=1 npm run build` in the platform's `frontend/`, then
copy `dist/` over `demos/naftal/`.
