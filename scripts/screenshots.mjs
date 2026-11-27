/**
 * Load the built site in headless Chrome at desktop and phone sizes.
 *
 *   npm run build && npm run screenshots
 *   BASE_PATH=/some-repo npm run build && BASE_PATH=/some-repo npm run screenshots
 *   SITE_URL=https://chaoecohydrors.github.io/ npm run screenshots     # the published site
 *
 * Serves dist/ under the base path, visits every page, fails on any failed request or
 * console error, exercises the homepage figure (switch, 3D, no-WebGL fallback, reduced
 * motion), and writes screenshots to .screenshots/.
 */
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { serve } from './lib/serve.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const out = fileURLToPath(new URL('../.screenshots/', import.meta.url));
const live = process.env.SITE_URL ? new URL(process.env.SITE_URL) : null;
const base = (live ? live.pathname : process.env.BASE_PATH || '/').replace(/\/?$/, '/');
const tag = live ? 'live' : base === '/' ? 'root' : base.replace(/\//g, '');
const pages = ['', 'research/', 'research/forest-biomass-change/', 'research/pamlico-sound-water-levels/', 'publications/', 'talks/', 'teaching/', 'cv/'];
const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

await mkdir(out, { recursive: true });
const server = live ? { origin: live.origin, close: async () => {} } : await serve(dist, base);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const failures = [];
const check = (ok, message) => {
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
	if (!ok) failures.push(message);
};
const watch = (page, label) => {
	page.on('requestfailed', (request) => failures.push(`${label}: request failed ${request.url()}`));
	page.on('response', (response) => {
		if (response.status() >= 400) failures.push(`${label}: HTTP ${response.status()} ${response.url()}`);
	});
	page.on('pageerror', (error) => failures.push(`${label}: page error ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error') failures.push(`${label}: console error ${message.text()}`);
	});
};

try {
	for (const [name, viewport] of Object.entries(sizes)) {
		const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: name === 'phone', hasTouch: name === 'phone' });
		const page = await context.newPage();
		watch(page, name);
		for (const path of pages) {
			await page.goto(server.origin + base + path, { waitUntil: 'networkidle' });
			await page.evaluate(() => document.fonts.ready);
			const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
			check(overflow <= 0, `${name} /${path} has no horizontal overflow (${overflow}px)`);
			await page.screenshot({ path: `${out}${tag}-${name}-${path.replace(/\//g, '_') || 'home'}.png`, fullPage: true });
		}
		await context.close();
	}

	// Homepage figure: switch, then 3D, at desktop size.
	{
		const context = await browser.newContext({ viewport: sizes.desktop });
		const page = await context.newPage();
		watch(page, 'figure');
		await page.goto(server.origin + base, { waitUntil: 'networkidle' });
		const figure = page.locator('#terrain-figure');
		const opacity = (selector) => page.locator(selector).evaluate((el) => getComputedStyle(el).opacity);
		check((await opacity('.terrain__still--obs')) === '1', 'observations still is shown first');
		await page.getByRole('radio', { name: 'Estimates' }).check();
		await page.waitForTimeout(600);
		check((await opacity('.terrain__still--est')) === '1' && (await opacity('.terrain__still--obs')) === '0', 'switch swaps to the estimates still');
		check(await page.locator('.terrain__text--est').isVisible(), 'caption follows the switch');
		await figure.screenshot({ path: `${out}${tag}-figure-estimates-still.png` });

		// Keyboard: arrow keys move between the two radio buttons.
		await page.getByRole('radio', { name: 'Estimates' }).focus();
		await page.keyboard.press('ArrowLeft');
		check(await page.getByRole('radio', { name: 'Observations' }).isChecked(), 'arrow key moves the switch back to observations');

		await page.getByRole('button', { name: 'View in 3D' }).click();
		await page.waitForSelector('#terrain-figure[data-mode="3d"]', { timeout: 60_000 });
		check(await page.locator('.terrain__canvas').isVisible(), '3D canvas is shown after "View in 3D"');
		await page.waitForTimeout(500);
		await figure.screenshot({ path: `${out}${tag}-figure-3d-observations.png` });
		await page.getByRole('radio', { name: 'Estimates' }).check();
		await page.waitForTimeout(1200);
		await figure.screenshot({ path: `${out}${tag}-figure-3d-estimates.png` });
		await page.locator('.terrain__canvas').focus();
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('Home');
		check(await page.getByRole('button', { name: 'Reset view' }).isVisible(), 'reset button is available in 3D');
		await context.close();
	}

	// No WebGL: the 3D button stays hidden and the switch still swaps the stills.
	{
		const context = await browser.newContext({ viewport: sizes.desktop });
		await context.addInitScript(() => {
			const original = HTMLCanvasElement.prototype.getContext;
			HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
				return String(type).startsWith('webgl') ? null : original.call(this, type, ...rest);
			};
		});
		const page = await context.newPage();
		watch(page, 'no-webgl');
		await page.goto(server.origin + base, { waitUntil: 'networkidle' });
		check(!(await page.getByRole('button', { name: 'View in 3D' }).isVisible()), 'without WebGL the 3D button is not offered');
		await page.getByRole('radio', { name: 'Estimates' }).check();
		await page.waitForTimeout(600);
		check((await page.locator('.terrain__still--est').evaluate((el) => getComputedStyle(el).opacity)) === '1', 'without WebGL the switch still swaps stills');
		await context.close();
	}

	// No JavaScript: the switch is CSS-only.
	{
		const context = await browser.newContext({ viewport: sizes.desktop, javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto(server.origin + base, { waitUntil: 'load' });
		await page.getByRole('radio', { name: 'Estimates' }).check();
		await page.waitForTimeout(600);
		check((await page.locator('.terrain__still--est').evaluate((el) => getComputedStyle(el).opacity)) === '1', 'without JavaScript the switch still swaps stills');
		check(await page.getByRole('link', { name: 'Research', exact: true }).first().isVisible(), 'without JavaScript the navigation is present');
		await context.close();
	}

	// Reduced motion: stills swap without a transition.
	{
		const context = await browser.newContext({ viewport: sizes.desktop, reducedMotion: 'reduce' });
		const page = await context.newPage();
		await page.goto(server.origin + base, { waitUntil: 'networkidle' });
		const duration = await page.locator('.terrain__still--obs').evaluate((el) => getComputedStyle(el).transitionDuration);
		check(/^0s(, 0s)*$/.test(duration), `reduced motion removes the still transition (${duration})`);
		await context.close();
	}
} finally {
	await browser.close();
	await server.close();
}

if (failures.length) {
	console.error('\n' + [...new Set(failures)].join('\n'));
	process.exit(1);
}
console.log(`\nall browser checks passed for base ${base}; screenshots in .screenshots/`);
