/** A tiny static file server that mounts a directory under a base path (like GitHub Pages does). */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.json': 'application/json',
	'.xml': 'application/xml',
	'.txt': 'text/plain; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.pdf': 'application/pdf',
};

/**
 * @param {string} dir directory to serve
 * @param {string} base mount point, e.g. "/" or "/my-repo/"
 * @returns {Promise<{ origin: string, close: () => Promise<void> }>}
 */
export function serve(dir, base = '/') {
	const prefix = base.replace(/\/+$/, '');
	const server = createServer((req, res) => {
		const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
		const notFound = () => {
			const page = join(dir, '404.html');
			res.writeHead(404, { 'content-type': TYPES['.html'] });
			existsSync(page) ? createReadStream(page).pipe(res) : res.end('Not found');
		};
		if (prefix && path !== prefix && !path.startsWith(prefix + '/')) return notFound();
		let file = join(dir, normalize(path.slice(prefix.length) || '/'));
		if (!file.startsWith(dir)) return notFound();
		if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
		if (!existsSync(file)) return notFound();
		res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
		createReadStream(file).pipe(res);
	});
	return new Promise((resolve) => {
		server.listen(0, '127.0.0.1', () => {
			const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
			resolve({ origin: `http://127.0.0.1:${port}`, close: () => new Promise((done) => server.close(() => done())) });
		});
	});
}
