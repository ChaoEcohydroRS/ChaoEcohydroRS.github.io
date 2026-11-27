/**
 * Render the homepage figure to still images, one per view.
 *
 *   npm run stills
 *
 * Starts the Astro dev server, opens the dev-only /__still harness in the locally
 * installed Google Chrome (headless), captures the WebGL canvas, and writes
 * public/figure/{observations,estimates}-{1600,800}.webp. Re-run after editing
 * src/scripts/terrain/scene.ts so the stills keep matching the 3D model.
 */
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dev } from 'astro';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = fileURLToPath(new URL('../public/figure/', import.meta.url));
const keepPng = process.argv.includes('--png');

const server = await dev({ root, logLevel: 'warn', server: { port: 4399 } });
const origin = `http://localhost:${server.address.port}`;
const browser = await chromium.launch({
	channel: 'chrome',
	headless: true,
	args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=default'],
});

try {
	await mkdir(outDir, { recursive: true });
	const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
	page.on('pageerror', (error) => console.error('page error:', error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') console.error('console error:', message.text());
	});
	for (const view of ['observations', 'estimates']) {
		await page.goto(`${origin}/__still/?view=${view}`, { waitUntil: 'networkidle' });
		await page.waitForFunction('window.__stillReady === true', undefined, { timeout: 60_000 });
		const png = await page.locator('canvas#still-canvas').screenshot({ type: 'png' });
		if (keepPng) await sharp(png).toFile(`${outDir}${view}.png`);
		await sharp(png).webp({ quality: 86 }).toFile(`${outDir}${view}-1600.webp`);
		await sharp(png).resize({ width: 800 }).webp({ quality: 84 }).toFile(`${outDir}${view}-800.webp`);
		console.log(`rendered ${view}`);
	}
} finally {
	await browser.close();
	await server.stop();
}
