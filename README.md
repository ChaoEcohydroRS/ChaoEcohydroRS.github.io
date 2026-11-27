# Chao Wang: personal academic website

Source for `https://chaoecohydrors.github.io/`. Built with [Astro](https://astro.build), TypeScript, and
[Three.js](https://threejs.org), starting from the MIT-licensed
[Astro Scholar](https://github.com/shravanngoswamii/astro-scholar) template.

The homepage centerpiece, "From Canopy to Coast", is a schematic 3D terrain model of eastern North
Carolina with one switch between **Observations** and **Estimates**. It is generated procedurally in
`src/scripts/terrain/scene.ts`; nothing in it is measured data.

## Local preview

Requires Node 22 or newer.

```sh
npm install
npm run dev        # http://localhost:4321 with live reload
npm run build      # production build in dist/
npm run preview    # serve the production build
```

## Where to edit

| What | File |
|---|---|
| Name, role, opening sentence, navigation, email, profile links | `src/consts.ts` |
| The two project pages | `src/content/projects/*.md` (front matter holds contribution, baseline, test, uncertainties, links) |
| Teaching and mentoring page | `src/content/pages/teaching.md` |
| Future research (homepage and Research page) | `src/content/pages/future.md` |
| Publications | `src/data/publications.bib` (add `selected = {home}` to show an entry on the homepage) |
| CV page: appointments, education, funding, datasets, talks, service | `src/data/cv.json` |
| "Published work" blocks on the Research page | `src/data/research-lines.json` |
| Colors, fonts, layout | `src/styles/global.css` |
| The 3D figure | `src/scripts/terrain/scene.ts`, `src/components/TerrainFigure.astro` |

To add a figure to a project page, put the image next to the Markdown file and add to its front matter:

```yaml
figure:
  src: ./my-figure.png
  alt: What the figure shows.
  caption: One-sentence caption.
```

To add the downloadable CV, save the PDF as `public/files/Chao-Wang-CV.pdf`. The "CV (PDF)" button on the
homepage and the download button on the CV page appear automatically once the file exists.

## The homepage figure

- The page first shows a still image of the Observations view. The switch swaps between two stills with
  CSS only, so it works without JavaScript and without WebGL.
- "View in 3D" loads Three.js and the scene on demand. Drag to rotate, or focus the model and use the
  arrow keys; Home or "Reset view" restores the camera. The switch never moves the camera.
- Reduced-motion settings turn off the cross-fade and the overlay animation.

The stills in `public/figure/` are rendered from the same scene. After editing `scene.ts`, regenerate them
(needs Google Chrome installed locally):

```sh
npm run stills
```

Blender was not available when the site was built, so the geometry is procedural and there is no GLB file.

## Checks

```sh
npm run check                 # TypeScript and Astro diagnostics
npm run build && npm run check:site      # every internal link, asset and anchor in dist/
npm run check:links           # external links and DOIs
npm run screenshots           # desktop and phone layouts, figure switch, 3D, fallbacks (needs Chrome)
```

To test the site as it would run under a repository subpath:

```sh
BASE_PATH=/some-repo npm run build
BASE_PATH=/some-repo npm run check:site
BASE_PATH=/some-repo npm run screenshots
```

Run a plain `npm run build` afterwards so `dist/` is the root build again.

## Deployment

`.github/workflows/deploy.yml` builds the site, runs the internal link check, and publishes with GitHub's
Pages actions on every push to `main`. It can also be started by hand:

```sh
gh workflow run deploy.yml
```

Repository settings this relies on: Settings > Pages > Source is "GitHub Actions", and Actions are enabled.

To check the published site in a browser run:

```sh
SITE_URL=https://chaoecohydrors.github.io/ npm run screenshots
```

## To do

Nothing on the site links to these yet, so there are no broken links.

- **CV as PDF**, saved to `public/files/Chao-Wang-CV.pdf`.
- **One figure for each project page.** Figures from the 2026 *Landscape Ecology* paper are published
  under CC BY-NC-ND, so they can be reused unmodified with attribution.
- **A portrait photo**, if you want one beside your name.
- **Results for the two current projects** when they can be made public. Both pages are marked "In
  progress" and state no results.
- **A complete BibTeX file**, if you want every paper listed. The site shows 12 selected entries and links
  to Google Scholar for the rest.

## License

Code derived from the Astro Scholar template is under the MIT license in `LICENSE`. The text, the
publication data, and the homepage figure are © Chao Wang.
