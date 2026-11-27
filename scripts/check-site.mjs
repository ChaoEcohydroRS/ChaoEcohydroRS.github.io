/**
 * Check every internal link and asset in the built site.
 *
 *   npm run build && npm run check:site                      # site at the domain root
 *   BASE_PATH=/some-repo npm run build && BASE_PATH=/some-repo npm run check:site
 *
 * For each HTML file in dist/ it resolves href, src and srcset values against the base
 * path, and fails if a target file or an in-page anchor is missing, or if an internal
 * URL does not carry the base path.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');

const htmlFiles = [];
const walk = (dir) => {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) walk(path);
		else if (name.endsWith('.html')) htmlFiles.push(path);
	}
};
walk(dist);

const idsCache = new Map();
const idsOf = (file) => {
	if (!idsCache.has(file)) {
		idsCache.set(file, new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
	}
	return idsCache.get(file);
};

/** Map a site URL path to the file that a static host would serve. */
const fileFor = (urlPath) => {
	const rel = decodeURIComponent(urlPath.slice(base.length));
	const direct = join(dist, rel);
	if (rel === '' || rel.endsWith('/')) return join(direct, 'index.html');
	if (existsSync(direct) && statSync(direct).isDirectory()) return join(direct, 'index.html');
	return direct;
};

const problems = [];
let checked = 0;
const external = new Set();

for (const file of htmlFiles) {
	const html = readFileSync(file, 'utf8');
	const page = '/' + file.slice(dist.length).replace(/index\.html$/, '');
	const pageUrl = new URL(base + page.slice(1), 'http://site.test');
	const refs = [];
	for (const m of html.matchAll(/\s(?:href|src|poster)="([^"]*)"/g)) refs.push(m[1]);
	for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) {
		for (const part of m[1].split(',')) refs.push(part.trim().split(/\s+/)[0]);
	}
	for (const raw of refs) {
		const ref = raw.replace(/&amp;/g, '&');
		if (!ref || /^(mailto:|tel:|data:)/.test(ref)) continue;
		if (/^https?:\/\//.test(ref)) {
			if (!ref.startsWith('https://chaoecohydrors.github.io')) external.add(ref);
			continue;
		}
		checked++;
		const target = new URL(ref, pageUrl);
		if (!target.pathname.startsWith(base)) {
			problems.push(`${page}: "${raw}" is outside the base path ${base}`);
			continue;
		}
		const targetFile = fileFor(target.pathname);
		if (!existsSync(targetFile)) {
			problems.push(`${page}: "${raw}" -> missing ${targetFile.slice(dist.length)}`);
			continue;
		}
		if (target.hash && targetFile.endsWith('.html') && !idsOf(targetFile).has(decodeURIComponent(target.hash.slice(1)))) {
			problems.push(`${page}: "${raw}" -> no element with id "${target.hash.slice(1)}"`);
		}
	}
}

console.log(`base ${base}: ${htmlFiles.length} pages, ${checked} internal references, ${external.size} distinct external links`);
if (problems.length) {
	console.error(problems.join('\n'));
	process.exit(1);
}
console.log('all internal links and assets resolve');
