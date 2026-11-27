/**
 * Progressive enhancement for the homepage figure.
 *
 * Base behaviour (no script): two stills and a CSS-only switch.
 * With script: the switch also sets data-view (for browsers without :has()), and a
 * "View in 3D" button loads Three.js and the scene on demand. If WebGL is missing or
 * the load fails, the stills stay and the switch keeps working.
 */
import type { TerrainFigure, View } from './scene';

const root = document.getElementById('terrain-figure');

if (root) {
	const radios = Array.from(root.querySelectorAll<HTMLInputElement>('input[name="terrain-view"]'));
	const canvas = root.querySelector<HTMLCanvasElement>('.terrain__canvas')!;
	const load = root.querySelector<HTMLButtonElement>('[data-terrain-3d]')!;
	const reset = root.querySelector<HTMLButtonElement>('[data-terrain-reset]')!;
	const status = root.querySelector<HTMLElement>('.terrain__status')!;
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	let figure: TerrainFigure | null = null;

	const view = (): View => (radios.find((r) => r.checked)?.value === 'estimates' ? 'estimates' : 'observations');
	const sync = () => {
		root.dataset.view = view();
		figure?.setView(view(), !reduced.matches);
	};
	radios.forEach((radio) => radio.addEventListener('change', sync));
	sync();

	const hasWebGL = () => {
		try {
			const probe = document.createElement('canvas');
			return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
		} catch {
			return false;
		}
	};

	const fallback = (message: string) => {
		canvas.hidden = true;
		load.hidden = true;
		reset.hidden = true;
		delete root.dataset.mode;
		status.textContent = message;
	};

	const start = async () => {
		if (figure) return;
		if (!hasWebGL()) {
			fallback('3D is not available in this browser. The switch still changes the image.');
			return;
		}
		load.disabled = true;
		load.textContent = 'Loading 3D…';
		try {
			const { createTerrainFigure } = await import('./scene');
			canvas.hidden = false;
			figure = createTerrainFigure(canvas, { view: view(), reducedMotion: reduced.matches });
			root.dataset.mode = '3d';
			load.hidden = true;
			reset.hidden = false;
			status.textContent = '3D model loaded. Drag, or focus the model and use the arrow keys, to rotate it.';
			new ResizeObserver(() => figure?.resize()).observe(canvas);
		} catch (error) {
			console.error(error);
			figure = null;
			fallback('The 3D model could not be loaded. The switch still changes the image.');
		}
	};

	if (hasWebGL()) {
		load.hidden = false;
		load.addEventListener('click', start);
	}
	reset.addEventListener('click', () => {
		figure?.resetCamera();
		canvas.focus({ preventScroll: true });
	});

	// Drag to rotate. Vertical swipes still scroll the page on touch screens (touch-action: pan-y).
	let dragging: { x: number; y: number } | null = null;
	canvas.addEventListener('pointerdown', (event) => {
		dragging = { x: event.clientX, y: event.clientY };
		canvas.setPointerCapture(event.pointerId);
	});
	canvas.addEventListener('pointermove', (event) => {
		if (!dragging || !figure) return;
		figure.orbit(-(event.clientX - dragging.x) * 0.005, event.pointerType === 'touch' ? 0 : -(event.clientY - dragging.y) * 0.004);
		dragging = { x: event.clientX, y: event.clientY };
	});
	const stop = () => {
		dragging = null;
	};
	canvas.addEventListener('pointerup', stop);
	canvas.addEventListener('pointercancel', stop);

	canvas.addEventListener('keydown', (event) => {
		if (!figure) return;
		const step = event.shiftKey ? 0.12 : 0.05;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step * 0.7],
			ArrowDown: [0, step * 0.7],
		};
		if (event.key in moves) {
			figure.orbit(...moves[event.key]);
			event.preventDefault();
		} else if (event.key === 'Home') {
			figure.resetCamera();
			event.preventDefault();
		}
	});
}
