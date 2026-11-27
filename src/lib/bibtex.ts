import bibRaw from '../data/publications.bib?raw';
import { OWNER_GIVEN, OWNER_SURNAME } from '../consts';

export interface BibAuthor {
	last: string;
	first: string;
	isOwner: boolean;
}

export interface Publication {
	key: string;
	type: string;
	title: string;
	year: number;
	authors: BibAuthor[];
	/** True when the BibTeX author list ends in "and others". */
	etAl: boolean;
	/** True when the site owner is one of the authors hidden behind "and others". */
	ownerListed: boolean;
	journal?: string;
	volume?: string;
	number?: string;
	pages?: string;
	doi?: string;
	url?: string;
	note?: string;
	/** Id of a project page (src/content/projects/<id>.md) this paper relates to. */
	project?: string;
	home: boolean;
}

const letters = (s: string) => s.replace(/[^\p{L}]/gu, '').toLowerCase();

/** A small BibTeX reader: one level of nested braces, quoted or bare values. */
export function parseBibTeX(input: string): Publication[] {
	const withoutComments = input
		.split('\n')
		.filter((line) => !line.trim().startsWith('%'))
		.join('\n');
	const chunks = withoutComments.split(/@(\w+)\s*\{/g).slice(1);
	const out: Publication[] = [];
	for (let i = 0; i < chunks.length; i += 2) {
		const type = chunks[i].trim().toLowerCase();
		const body = chunks[i + 1];
		if (!body) continue;
		const key = (body.match(/^\s*([^,\s]+)\s*,/) ?? [])[1] ?? `entry${i}`;
		const fields: Record<string, string> = {};
		const fieldRe = /(\w+)\s*=\s*(?:\{((?:[^{}]|\{[^{}]*\})*)\}|"((?:[^"\\]|\\.)*)"|(\d+))/g;
		let m: RegExpExecArray | null;
		while ((m = fieldRe.exec(body)) !== null) {
			fields[m[1].toLowerCase()] = (m[2] ?? m[3] ?? m[4] ?? '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
		}
		const names = (fields.author ?? '').split(/\s+and\s+/i).filter(Boolean);
		const etAl = names.length > 0 && names[names.length - 1].toLowerCase() === 'others';
		const authors = (etAl ? names.slice(0, -1) : names).map((name) => {
			const [last, first = ''] = name.includes(',')
				? name.split(',').map((part) => part.trim())
				: [name.trim().split(' ').slice(-1)[0], name.trim().split(' ').slice(0, -1).join(' ')];
			const given = letters(first);
			const isOwner = last === OWNER_SURNAME && (given === letters(OWNER_GIVEN) || given === letters(OWNER_GIVEN)[0]);
			return { last, first, isOwner };
		});
		out.push({
			key,
			type,
			title: fields.title ?? 'Untitled',
			year: Number.parseInt(fields.year ?? '0', 10) || 0,
			authors,
			etAl,
			ownerListed: (fields.ownerlisted ?? '').toLowerCase() === 'true',
			journal: fields.journal,
			volume: fields.volume,
			number: fields.number,
			pages: fields.pages?.replace('--', '–'),
			doi: fields.doi,
			url: fields.url,
			note: fields.note,
			project: fields.project,
			home: (fields.selected ?? '').toLowerCase() === 'home',
		});
	}
	// Newest first; entries keep their file order within a year.
	return out.map((p, index) => ({ p, index })).sort((a, b) => b.p.year - a.p.year || a.index - b.index).map(({ p }) => p);
}

export const publications = parseBibTeX(bibRaw);

/** "41(8), 139" from volume, number and pages, whichever are present. */
export function locator(p: Publication): string {
	const volume = p.volume ? p.volume + (p.number ? `(${p.number})` : '') : '';
	return [volume, p.pages].filter(Boolean).join(', ');
}

export function link(p: Publication): string | undefined {
	return p.doi ? `https://doi.org/${p.doi}` : p.url;
}

/** "Tamlin M." -> "T. M.", "Jean-François" -> "J.-F.", "C." stays "C." */
export function initials(given: string): string {
	return given
		.split(/\s+/)
		.filter(Boolean)
		.map((word) =>
			word
				.split('-')
				.map((part) => (part ? `${part[0].toUpperCase()}.` : ''))
				.join('-'),
		)
		.join(' ');
}

export interface AuthorRun {
	text: string;
	owner: boolean;
}

/**
 * Author list for display, as text runs. Long lists are shortened to the first three
 * authors, the site owner, and "et al."
 */
export function authorRuns(p: Publication, max = 12): AuthorRun[] {
	const name = (a: BibAuthor) => (a.first ? `${a.last}, ${initials(a.first)}` : a.last);
	const runs: AuthorRun[] = [];
	const push = (text: string, owner = false) => runs.push({ text, owner });
	const ownerIndex = p.authors.findIndex((a) => a.isOwner);
	const shorten = p.authors.length > max;
	const shown = shorten ? p.authors.slice(0, 3) : p.authors;
	shown.forEach((a, i) => {
		if (i > 0) push(', ');
		push(name(a), a.isOwner);
	});
	if (shorten && ownerIndex > 2) {
		push(', …, ');
		push(name(p.authors[ownerIndex]), true);
	} else if (ownerIndex === -1 && p.ownerListed) {
		push(', …, ');
		push(`${OWNER_SURNAME}, ${initials(OWNER_GIVEN)}`, true);
	}
	if (shorten || p.etAl) push(', et al.');
	return runs;
}

/** A clean BibTeX entry for the "Cite" box. */
export function toBibTeX(p: Publication): string {
	const authors = p.authors.slice(0, 25).map((a) => (a.first ? `${a.last}, ${a.first}` : a.last));
	if (p.etAl || p.authors.length > 25) authors.push('others');
	const fields: [string, string | undefined][] = [
		['author', authors.join(' and ')],
		['title', p.title],
		['journal', p.journal],
		['year', String(p.year)],
		['volume', p.volume],
		['number', p.number],
		['pages', p.pages?.replace('–', '--')],
		['doi', p.doi],
		['note', p.note],
	];
	const lines = fields.filter(([, value]) => value).map(([name, value]) => `  ${name} = {${value}}`);
	return `@article{${p.key},\n${lines.join(',\n')}\n}`;
}
