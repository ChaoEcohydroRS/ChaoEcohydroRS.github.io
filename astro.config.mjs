// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// The site is a GitHub Pages user site, served from the domain root.
// BASE_PATH lets the same build be tested under a repository subpath, e.g.
//   BASE_PATH=/some-repo npm run build
const base = process.env.BASE_PATH || '/';

/** Dev-only page used by `npm run stills` to render the homepage figure to images. */
const stillHarness = {
	name: 'still-harness',
	hooks: {
		/** @param {{ command: string, injectRoute: (route: { pattern: string, entrypoint: URL }) => void }} options */
		'astro:config:setup': ({ command, injectRoute }) => {
			if (command === 'dev') {
				injectRoute({ pattern: '/__still', entrypoint: new URL('./tools/still.astro', import.meta.url) });
			}
		},
	},
};

export default defineConfig({
	site: 'https://chaoecohydrors.github.io',
	base,
	trailingSlash: 'always',
	integrations: [sitemap(), stillHarness],
	devToolbar: { enabled: false },
	build: {
		inlineStylesheets: 'auto',
	},
});
