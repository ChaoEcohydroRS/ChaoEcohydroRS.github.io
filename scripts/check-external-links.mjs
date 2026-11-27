/**
 * Check the external links in the built site.
 *
 *   npm run build && npm run check:links
 *
 * DOIs are checked against the doi.org handle registry, which answers reliably.
 * Other links are fetched once. Sites that refuse automated requests (HTTP 403 or 429)
 * are listed as "check by hand" and do not fail the run; a 404 or a network error does.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const links = new Set();
const walk = (dir) => {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) walk(path);
		else if (name.endsWith('.html')) {
			for (const m of readFileSync(path, 'utf8').matchAll(/\shref="(https?:\/\/[^"]+)"/g)) {
				const href = m[1].replace(/&amp;/g, '&');
				if (!href.startsWith('https://chaoecohydrors.github.io')) links.add(href);
			}
		}
	}
};
walk(dist);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const broken = [];
const manual = [];

for (const href of [...links].sort()) {
	const doi = href.match(/^https:\/\/doi\.org\/(.+)$/)?.[1];
	try {
		if (doi) {
			const response = await fetch(`https://doi.org/api/handles/${doi}`, { signal: AbortSignal.timeout(20_000) });
			const body = response.ok ? await response.json() : {};
			if (body.responseCode === 1) console.log(`ok     ${href}`);
			else broken.push(`${href} (DOI not registered, HTTP ${response.status})`);
		} else {
			const response = await fetch(href, {
				redirect: 'follow',
				signal: AbortSignal.timeout(20_000),
				headers: { 'user-agent': 'Mozilla/5.0 (link check)' },
			});
			if (response.ok) console.log(`ok     ${href}`);
			else if ([401, 403, 429].includes(response.status)) manual.push(`${href} (HTTP ${response.status})`);
			else broken.push(`${href} (HTTP ${response.status})`);
		}
	} catch (error) {
		broken.push(`${href} (${error.name}: ${error.message})`);
	}
	await sleep(700);
}

if (manual.length) console.log('\ncheck by hand (the site refuses automated requests):\n  ' + manual.join('\n  '));
if (broken.length) {
	console.error('\nbroken:\n  ' + broken.join('\n  '));
	process.exit(1);
}
console.log(`\n${links.size} external links checked, none broken`);
