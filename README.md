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
