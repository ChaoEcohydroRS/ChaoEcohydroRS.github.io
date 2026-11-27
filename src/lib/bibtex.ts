import bibRaw from '../data/publications.bib?raw';
import { OWNER_GIVEN_INITIAL, OWNER_SURNAME } from '../consts';

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
	journal?: string;
	volume?: string;
	number?: string;
	pages?: string;
	doi?: string;
	url?: string;
	note?: string;
	home: boolean;
}

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
			const isOwner = last === OWNER_SURNAME && first.replace(/[^A-Za-z]/g, '').startsWith(OWNER_GIVEN_INITIAL) && first.replace(/[^A-Za-z]/g, '').length === 1;
			return { last, first, isOwner };
		});
		out.push({
			key,
			type,
			title: fields.title ?? 'Untitled',
			year: Number.parseInt(fields.year ?? '0', 10) || 0,
			authors,
			etAl,
			journal: fields.journal,
			volume: fields.volume,
			number: fields.number,
			pages: fields.pages?.replace('--', '–'),
			doi: fields.doi,
			url: fields.url,
			note: fields.note,
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
