/**
 * "From Canopy to Coast": a schematic terrain model of eastern North Carolina.
 *
 * West to east: loblolly pine stands of different ages around a rectangular harvest
 * opening, a river winding through marsh, Pamlico Sound, a barrier island, the Atlantic.
 * Two overlay sets share one fixed camera: what is observed (lidar slice, field plots,
 * SWOT swaths, shoreline gauges) and what is estimated from it (gridded biomass,
 * water-level contours). Everything is procedural and seeded, so the rendered stills
 * in public/figure/ match this scene exactly.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type View = 'observations' | 'estimates';

export interface TerrainFigureOptions {
	view?: View;
	pixelRatio?: number;
	shadowMapSize?: number;
	reducedMotion?: boolean;
}

export interface TerrainFigure {
	setView(view: View, animate?: boolean): void;
	orbit(dAzimuth: number, dPolar: number): void;
	resetCamera(): void;
	resize(): void;
	render(): void;
	dispose(): void;
}

export const PAPER = 0xf4eee2;

const C = {
	cut: 0xe6dcc8,
	soil: 0x8b8a63,
	riparian: 0x9a9a66,
	harvest: 0xcfbc93,
	marsh: 0xb1ae72,
	sand: 0xe8dbb8,
	sound: 0x8fa5b3,
	shallow: 0xa7b9c2,
	ocean: 0x6c8596,
	river: 0x384956,
	trunk: 0x7b6652,
	young: 0x7ba566,
	pole: 0x5a8c5c,
	mid: 0x427556,
	mature: 0x2f5d50,
	amber: 0xe3a229,
	pin: 0xfffaf0,
	ink: 0x22302b,
	swot: 0xffffff,
};

// Block footprint: x runs west to east, z north to south, y up.
const W = 16;
const D = 9;
const X0 = -W / 2;
const X1 = W / 2;
const Z0 = -D / 2;
const Z1 = D / 2;
const BASE_Y = -0.55;

const CAMERA = { azimuth: 0.17, polar: 0.95, radius: 23.2, fov: 27, target: new THREE.Vector3(-0.2, -0.3, 0.3) };
const LIMITS = { azimuth: 0.6, polarMin: 0.6, polarMax: 1.25 };

// ---------------------------------------------------------------- helpers
function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const smooth = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function hash(ix: number, iz: number) {
	const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
	return s - Math.floor(s);
}

function noise(x: number, z: number) {
	const ix = Math.floor(x);
	const iz = Math.floor(z);
	const fx = x - ix;
	const fz = z - iz;
	const ux = fx * fx * (3 - 2 * fx);
	const uz = fz * fz * (3 - 2 * fz);
	return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), ux), lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), ux), uz);
}

// ---------------------------------------------------------------- landscape layout
const marshX = (z: number) => -1.72 + 0.26 * Math.sin(z * 0.9 + 0.4) + 0.25 * (noise(z * 1.3, 7.1) - 0.5);
const shoreX = (z: number) => 0.38 + 0.28 * Math.sin(z * 0.7 + 1.3) + 0.3 * (noise(z * 1.1, 3.3) - 0.5);
const islandCenter = (z: number) => 5.95 + 0.3 * Math.sin(z * 0.42 + 0.5) + 0.08 * (noise(z * 1.7, 9.2) - 0.5);
const INLET_Z = -2.95;
const islandHalfWidth = (z: number) => (0.25 + 0.07 * noise(z * 1.4, 1.7)) * smooth(0.16, 0.5, Math.abs(z - INLET_Z));
const islandWest = (z: number) => islandCenter(z) - islandHalfWidth(z);

const RIVER_POINTS: [number, number][] = [
	[-8.4, -1.78], [-6.9, -1.6], [-5.6, -1.84], [-4.3, -1.56], [-3.1, -1.8], [-2.2, -1.42],
	[-1.6, -0.86], [-0.98, -0.3], [-1.36, 0.5], [-0.62, 0.98], [-0.16, 0.24], [0.32, 0.72], [0.8, 0.52], [1.4, 0.56],
];
const riverCurve = new THREE.CatmullRomCurve3(RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)));
const RIVER = riverCurve.getSpacedPoints(320);
const riverHalfWidth = (t: number) => 0.055 + 0.12 * Math.pow(t, 1.6);

/** Distance to the river centreline and the position (0..1) along it. */
function riverAt(x: number, z: number): [number, number] {
	let best = Infinity;
	let bi = 0;
	for (let i = 0; i < RIVER.length; i++) {
		const dx = RIVER[i].x - x;
		const dz = RIVER[i].z - z;
		const d = dx * dx + dz * dz;
		if (d < best) {
			best = d;
			bi = i;
		}
	}
	return [Math.sqrt(best), bi / (RIVER.length - 1)];
}

function groundHeight(x: number, z: number) {
	const upland = 0.2 + 0.05 * (noise(x * 0.45, z * 0.45) - 0.5) - 0.006 * (x - X0);
	const marsh = 0.04 + 0.012 * noise(x * 2.3, z * 2.3);
	const mx = marshX(z);
	let h = lerp(upland, marsh, smooth(mx - 0.45, mx + 0.12, x));
	const sx = shoreX(z);
	h = lerp(h, -0.1, smooth(sx - 0.1, sx + 0.22, x));
	const w = islandHalfWidth(z);
	if (w > 0.01) {
		const k = 1 - smooth(w * 0.5, w * 1.3, Math.abs(x - islandCenter(z)));
		h = lerp(h, 0.1 + 0.05 * noise(x * 3.1, z * 3.1), k);
	}
	const [d, t] = riverAt(x, z);
	const rw = riverHalfWidth(t);
	h = lerp(h, Math.min(h, 0.06), 1 - smooth(rw * 1.2, rw * 4.5, d)); // shallow valley
	h = lerp(h, -0.06, 1 - smooth(rw * 0.75, rw * 1.35, d)); // channel
	return h;
}

type Age = 'young' | 'pole' | 'mid' | 'mature' | 'harvest';
interface Stand { x0: number; x1: number; z0: number; z1: number; age: Age; rowsAlongX: boolean }

const COLS: [number, number][] = [[-7.8, -6.7], [-6.58, -5.5], [-5.38, -4.3], [-4.18, -3.1], [-2.98, -1.4]];
const ROWS: [number, number][] = [[-4.32, -2.3], [-1.18, 1.3], [1.62, 4.32]];
const AGES: Age[][] = [
	['mature', 'mid', 'mature', 'pole', 'mid'],
	['mature', 'mid', 'harvest', 'pole', 'mid'],
	['pole', 'young', 'young', 'young', 'pole'],
];
const STANDS: Stand[] = ROWS.flatMap(([z0, z1], r) =>
	COLS.map(([x0, x1], c) => ({ x0, x1, z0, z1, age: AGES[r][c], rowsAlongX: (r + c) % 2 === 0 })),
);
const HARVEST = STANDS.find((s) => s.age === 'harvest')!;

const AGE_SPEC: Record<Exclude<Age, 'harvest'>, { h: [number, number]; r: [number, number]; spacing: number; color: number; crown: 'cone' | 'clump' }> = {
	young: { h: [0.14, 0.19], r: [0.06, 0.078], spacing: 0.14, color: C.young, crown: 'cone' },
	pole: { h: [0.29, 0.37], r: [0.076, 0.098], spacing: 0.18, color: C.pole, crown: 'cone' },
	mid: { h: [0.47, 0.58], r: [0.1, 0.127], spacing: 0.232, color: C.mid, crown: 'clump' },
	mature: { h: [0.68, 0.85], r: [0.127, 0.168], spacing: 0.3, color: C.mature, crown: 'clump' },
};

interface Tree { x: number; z: number; y: number; h: number; r: number; age: Exclude<Age, 'harvest'>; variant: number; rot: number; tint: number }

function plantTrees(): Tree[] {
	const rand = mulberry32(20261126);
	const trees: Tree[] = [];
	for (const s of STANDS) {
		if (s.age === 'harvest') continue;
		const spec = AGE_SPEC[s.age];
		const sp = spec.spacing;
		const [u0, u1, v0, v1] = s.rowsAlongX ? [s.x0, s.x1, s.z0, s.z1] : [s.z0, s.z1, s.x0, s.x1];
		for (let v = v0 + sp * 0.5; v < v1; v += sp * 1.12) {
			for (let u = u0 + sp * 0.5; u < u1; u += sp * 0.92) {
				const ju = u + (rand() - 0.5) * sp * 0.45;
				const jv = v + (rand() - 0.5) * sp * 0.3;
				const x = s.rowsAlongX ? ju : jv;
				const z = s.rowsAlongX ? jv : ju;
				const keep = rand() > 0.06;
				const h = lerp(spec.h[0], spec.h[1], rand());
				const r = lerp(spec.r[0], spec.r[1], rand());
				const variant = Math.floor(rand() * 3);
				const rot = rand() * Math.PI * 2;
				const tint = rand();
				if (!keep) continue;
				if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
				if (x > marshX(z) - 0.14) continue;
				const [d, t] = riverAt(x, z);
				if (d < riverHalfWidth(t) * 4 + 0.08) continue;
				trees.push({ x, z, y: groundHeight(x, z), h, r, age: s.age, variant, rot, tint });
			}
		}
	}
	return trees;
}

// ---------------------------------------------------------------- geometry builders
function buildTerrain() {
	const nx = 256;
	const nz = 144;
	const geo = new THREE.PlaneGeometry(W, D, nx, nz);
	geo.rotateX(-Math.PI / 2);
	const pos = geo.attributes.position as THREE.BufferAttribute;
	const colors = new Float32Array(pos.count * 3);
	const col = new THREE.Color();
	const tmp = new THREE.Color();
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const z = pos.getZ(i);
		const h = groundHeight(x, z);
		pos.setY(i, h);
		const mx = marshX(z);
		const n = noise(x * 5, z * 5);
		col.set(C.soil).lerp(tmp.set(C.riparian), 0.35 * n);
		const [d, t] = riverAt(x, z);
		col.lerp(tmp.set(C.riparian), 0.8 * (1 - smooth(0.1, 0.45, d - riverHalfWidth(t))));
		if (x > HARVEST.x0 && x < HARVEST.x1 && z > HARVEST.z0 && z < HARVEST.z1) {
			const edge = Math.min(x - HARVEST.x0, HARVEST.x1 - x, z - HARVEST.z0, HARVEST.z1 - z);
			const rowShade = 0.5 + 0.5 * Math.sin(z * 46);
			col.lerp(tmp.set(C.harvest), smooth(0, 0.05, edge) * (0.86 + 0.14 * rowShade));
		}
		col.lerp(tmp.set(C.marsh), smooth(mx - 0.4, mx + 0.05, x) * (0.85 + 0.15 * n));
		col.lerp(tmp.set(0x8f9460), 0.3 * smooth(mx - 0.1, mx + 0.3, x) * smooth(0.45, 0.8, noise(x * 3.4, z * 6.5)));
		const sx = shoreX(z);
		col.lerp(tmp.set(C.sand), 0.55 * smooth(sx - 0.16, sx - 0.02, x));
		const w = islandHalfWidth(z);
		if (w > 0.01) {
			const off = x - islandCenter(z);
			const k = 1 - smooth(w * 0.6, w * 1.5, Math.abs(off));
			col.lerp(tmp.set(C.sand), k);
			col.lerp(tmp.set(C.marsh), 0.4 * k * smooth(0.02, -w * 0.7, off) * n); // scrub on the sound side
		}
		if (h < -0.01) col.lerp(tmp.set(C.river), 0.5);
		colors[i * 3] = col.r;
		colors[i * 3 + 1] = col.g;
		colors[i * 3 + 2] = col.b;
	}
	geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	geo.computeVertexNormals();
	return geo;
}

function buildWater() {
	const geo = new THREE.PlaneGeometry(W, D, 176, 99);
	geo.rotateX(-Math.PI / 2);
	const pos = geo.attributes.position as THREE.BufferAttribute;
	const colors = new Float32Array(pos.count * 3);
	const col = new THREE.Color();
	const tmp = new THREE.Color();
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const z = pos.getZ(i);
		const sx = shoreX(z);
		const ic = islandCenter(z);
		col.set(C.sound);
		const nearShore = Math.min(x - sx, islandWest(z) - x);
		col.lerp(tmp.set(C.shallow), 0.7 * (1 - smooth(0.05, 0.75, nearShore)));
		col.lerp(tmp.set(C.ocean), smooth(ic - 0.1, ic + 0.45, x));
		const [d, t] = riverAt(x, z);
		const inRiver = 1 - smooth(riverHalfWidth(t) * 1.4, riverHalfWidth(t) * 3.2, d);
		col.lerp(tmp.set(C.river), inRiver * (1 - smooth(sx - 0.2, sx + 0.9, x)));
		colors[i * 3] = col.r;
		colors[i * 3 + 1] = col.g;
		colors[i * 3 + 2] = col.b;
	}
	geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	return geo;
}

/** Vertical sides of the block, so it reads as a physical model with a cut edge. */
function buildSkirt() {
	const verts: number[] = [];
	const top = (x: number, z: number) => Math.max(groundHeight(x, z), 0);
	const edge = (ax: number, az: number, bx: number, bz: number, n: number) => {
		for (let i = 0; i < n; i++) {
			const t0 = i / n;
			const t1 = (i + 1) / n;
			const x0 = lerp(ax, bx, t0);
			const z0 = lerp(az, bz, t0);
			const x1 = lerp(ax, bx, t1);
			const z1 = lerp(az, bz, t1);
			const y0 = top(x0, z0);
			const y1 = top(x1, z1);
			verts.push(x0, y0, z0, x0, BASE_Y, z0, x1, y1, z1, x1, y1, z1, x0, BASE_Y, z0, x1, BASE_Y, z1);
		}
	};
	edge(X0, Z1, X1, Z1, 256);
	edge(X1, Z1, X1, Z0, 144);
	edge(X1, Z0, X0, Z0, 256);
	edge(X0, Z0, X0, Z1, 144);
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
	geo.computeVertexNormals();
	return geo;
}

/** A crown in unit space: radius 1 in x/z, y from 0 (ground) to 1 (tree top). */
function buildCrown(kind: 'cone' | 'clump', seed: number) {
	const rand = mulberry32(seed);
	const blob = (cx: number, cy: number, cz: number, rx: number, ry: number, taper: number) => {
		const g = new THREE.IcosahedronGeometry(1, 1);
		const p = g.attributes.position as THREE.BufferAttribute;
		for (let i = 0; i < p.count; i++) {
			const x = p.getX(i);
			const y = p.getY(i);
			const z = p.getZ(i);
			const wob = 1 + 0.34 * (noise(x * 2.3 + seed, y * 2.3 + z * 1.9) - 0.5);
			const narrow = 1 - taper * (y * 0.5 + 0.5);
			p.setXYZ(i, cx + x * rx * wob * narrow, cy + y * ry * wob, cz + z * rx * wob * narrow);
		}
		return g;
	};
	const parts =
		kind === 'cone'
			? [blob(0, 0.56, 0, 1, 0.44, 0.62), blob((rand() - 0.5) * 0.3, 0.34, (rand() - 0.5) * 0.3, 0.92, 0.2, 0.2)]
			: [
					blob(0, 0.74, 0, 1, 0.25, 0.3),
					blob(0.42 * (rand() - 0.5) * 2, 0.62 + 0.06 * rand(), 0.42 * (rand() - 0.5) * 2, 0.7, 0.16, 0.1),
					blob(0.36 * (rand() - 0.5) * 2, 0.86 + 0.04 * rand(), 0.36 * (rand() - 0.5) * 2, 0.6, 0.15, 0.4),
				];
	const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
	merged.computeVertexNormals();
	return merged;
}

/** Line segments where field == level, inside the mask (marching squares). */
function contourSegments(field: (x: number, z: number) => number, inside: (x: number, z: number) => boolean, level: number, step: number) {
	const out: number[] = [];
	const cross = (ax: number, az: number, av: number, bx: number, bz: number, bv: number): [number, number] => {
		const t = (level - av) / (bv - av);
		return [lerp(ax, bx, t), lerp(az, bz, t)];
	};
	for (let z = Z0; z < Z1; z += step) {
		for (let x = X0; x < X1; x += step) {
			const xs = [x, x + step, x + step, x];
			const zs = [z, z, z + step, z + step];
			if (!xs.every((cx, i) => inside(cx, zs[i]))) continue;
			const v = xs.map((cx, i) => field(cx, zs[i]));
			const pts: [number, number][] = [];
			for (let e = 0; e < 4; e++) {
				const f = (e + 1) % 4;
				if (v[e] < level !== v[f] < level) pts.push(cross(xs[e], zs[e], v[e], xs[f], zs[f], v[f]));
			}
			if (pts.length >= 2) out.push(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
			if (pts.length === 4) out.push(pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
		}
	}
	return out;
}

/** Flat ribbons along [x0,z0,x1,z1,...] segments, at height y. */
function ribbonGeometry(segments: number[], width: number, y: number) {
	const verts: number[] = [];
	for (let i = 0; i < segments.length; i += 4) {
		let ax = segments[i];
		let az = segments[i + 1];
		let bx = segments[i + 2];
		let bz = segments[i + 3];
		const dx = bx - ax;
		const dz = bz - az;
		const len = Math.hypot(dx, dz) || 1;
		const ux = dx / len;
		const uz = dz / len;
		ax -= ux * width * 0.5;
		az -= uz * width * 0.5;
		bx += ux * width * 0.5;
		bz += uz * width * 0.5;
		const px = -uz * width * 0.5;
		const pz = ux * width * 0.5;
		verts.push(ax + px, y, az + pz, bx + px, y, bz + pz, ax - px, y, az - pz, bx + px, y, bz + pz, bx - px, y, bz - pz, ax - px, y, az - pz);
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
	return geo;
}

// ---------------------------------------------------------------- the figure
export function createTerrainFigure(canvas: HTMLCanvasElement, options: TerrainFigureOptions = {}): TerrainFigure {
	const reducedMotion = options.reducedMotion ?? false;
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
	renderer.setClearColor(PAPER, 1);
	renderer.shadowMap.enabled = true;

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(PAPER);
	const camera = new THREE.PerspectiveCamera(CAMERA.fov, 16 / 9, 0.5, 120);

	// Low afternoon sun from the west-northwest: it rims the crowns and throws long shadows east.
	const sun = new THREE.DirectionalLight(0xffdfb0, 3.1);
	sun.position.set(-13, 7.2, -7);
	sun.castShadow = true;
	const shadowSize = options.shadowMapSize ?? 2048;
	sun.shadow.mapSize.set(shadowSize, shadowSize);
	const sc = sun.shadow.camera;
	sc.left = -13;
	sc.right = 13;
	sc.top = 9;
	sc.bottom = -9;
	sc.near = 1;
	sc.far = 45;
	sun.shadow.bias = -0.0006;
	sun.shadow.normalBias = 0.02;
	scene.add(sun, sun.target);
	scene.add(new THREE.HemisphereLight(0xe6eef2, 0xc9b99a, 1.6));
	const fill = new THREE.DirectionalLight(0xf3f0ea, 0.75); // soft fill from the viewer's side
	fill.position.set(6, 9, 14);
	scene.add(fill);

	const disposables: { dispose(): void }[] = [];
	const keep = <T extends { dispose(): void }>(x: T) => {
		disposables.push(x);
		return x;
	};
	const matte = (params: THREE.MeshLambertMaterialParameters) => keep(new THREE.MeshLambertMaterial(params));

	// --- table, block, land, water
	const table = new THREE.Mesh(keep(new THREE.PlaneGeometry(90, 90)), keep(new THREE.ShadowMaterial({ opacity: 0.13 })));
	table.rotation.x = -Math.PI / 2;
	table.position.y = BASE_Y;
	table.receiveShadow = true;
	scene.add(table);

	const terrain = new THREE.Mesh(keep(buildTerrain()), matte({ vertexColors: true }));
	terrain.receiveShadow = true;
	terrain.castShadow = true;
	scene.add(terrain);

	const water = new THREE.Mesh(keep(buildWater()), matte({ vertexColors: true }));
	water.receiveShadow = true;
	scene.add(water);

	const skirt = new THREE.Mesh(keep(buildSkirt()), matte({ color: C.cut, side: THREE.DoubleSide }));
	skirt.castShadow = true;
	scene.add(skirt);

	// --- trees
	const trees = plantTrees();
	const m4 = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const up = new THREE.Vector3(0, 1, 0);
	const tint = new THREE.Color();
	const dark = new THREE.Color(0x1f3f37);
	const light = new THREE.Color(0xa9c27c);

	const trunkGeo = keep(new THREE.CylinderGeometry(0.55, 1, 1, 5, 1, true).translate(0, 0.5, 0));
	const trunks = new THREE.InstancedMesh(trunkGeo, matte({ color: C.trunk, flatShading: true }), trees.length);
	trunks.castShadow = true;
	trees.forEach((t, i) => {
		const rt = 0.011 + t.h * 0.022;
		m4.compose(new THREE.Vector3(t.x, t.y, t.z), q.identity(), new THREE.Vector3(rt, t.h * 0.82, rt));
		trunks.setMatrixAt(i, m4);
	});
	scene.add(trunks);

	(['cone', 'clump'] as const).forEach((kind) => {
		for (let variant = 0; variant < 3; variant++) {
			const group = trees.filter((t) => AGE_SPEC[t.age].crown === kind && t.variant === variant);
			if (!group.length) continue;
			const geo = keep(buildCrown(kind, 11 + variant * 17 + (kind === 'cone' ? 0 : 100)));
			const mesh = new THREE.InstancedMesh(geo, matte({ flatShading: true }), group.length);
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			group.forEach((t, i) => {
				q.setFromAxisAngle(up, t.rot);
				m4.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.r, t.h, t.r));
				mesh.setMatrixAt(i, m4);
				tint.set(AGE_SPEC[t.age].color).lerp(t.tint < 0.5 ? dark : light, Math.abs(t.tint - 0.5) * 0.36);
				mesh.setColorAt(i, tint);
			});
			scene.add(mesh);
		}
	});

	// A few stumps and slash piles in the harvest opening.
	{
		const rand = mulberry32(77);
		const n = 70;
		const stumps = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.7, 1, 1, 5).translate(0, 0.5, 0)), matte({ color: 0x9b8566, flatShading: true }), n);
		for (let i = 0; i < n; i++) {
			const x = lerp(HARVEST.x0 + 0.08, HARVEST.x1 - 0.08, rand());
			const z = lerp(HARVEST.z0 + 0.08, HARVEST.z1 - 0.08, rand());
			const s = 0.012 + rand() * 0.012;
			m4.compose(new THREE.Vector3(x, groundHeight(x, z), z), q.identity(), new THREE.Vector3(s, 0.012 + rand() * 0.02, s));
			stumps.setMatrixAt(i, m4);
		}
		stumps.castShadow = true;
		scene.add(stumps);
	}

	// --- overlays. Each material fades between its "observations" and "estimates" opacity.
	const fades: { material: THREE.Material; obs: number; est: number; object: THREE.Object3D }[] = [];
	const overlay = <T extends THREE.Object3D & { material: THREE.Material }>(object: T, obs: number, est: number, order = 2) => {
		object.material.transparent = true;
		object.material.depthWrite = false;
		object.renderOrder = order;
		fades.push({ material: object.material, obs, est, object });
		keep(object.material);
		scene.add(object);
		return object;
	};
	const basic = (color: number, extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

	// Lidar: one vertical slice of returns along the front face of the middle row of stands.
	const LIDAR_Z = ROWS[1][1] + 0.03;
	const lidarX0 = -7.78;
	const lidarX1 = marshX(LIDAR_Z) - 0.16;
	let lidarPoints: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
	{
		const rand = mulberry32(4242);
		const pts: number[] = [];
		for (let x = lidarX0; x < lidarX1; x += 0.016) {
			if (rand() < 0.75) pts.push(x, groundHeight(x, LIDAR_Z) + 0.006 + rand() * 0.012, LIDAR_Z);
		}
		for (const t of trees) {
			if (Math.abs(t.z - LIDAR_Z) > 0.3 || t.x < lidarX0 || t.x > lidarX1) continue;
			const spec = AGE_SPEC[t.age];
			const base = spec.crown === 'cone' ? 0.18 : 0.5;
			const n = Math.round(50 + t.h * 230);
			for (let i = 0; i < n; i++) {
				const v = Math.pow(rand(), 0.55); // more returns from the upper crown
				const y = t.y + t.h * (base + (1 - base) * v);
				const spread = t.r * (spec.crown === 'cone' ? 1.05 - 0.85 * v : 1 - 0.55 * Math.abs(v - 0.45));
				pts.push(t.x + (rand() - 0.5) * 2 * spread, y, LIDAR_Z);
			}
		}
		const geo = keep(new THREE.BufferGeometry());
		geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
		lidarPoints = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xc9790c, size: 3, sizeAttenuation: false, depthTest: false }));
		overlay(lidarPoints, 1, 0.24, 6);

		const curtain = new THREE.Mesh(keep(new THREE.PlaneGeometry(lidarX1 - lidarX0, 1.12)), basic(0xffd98a, { side: THREE.DoubleSide }));
		curtain.position.set((lidarX0 + lidarX1) / 2, 0.66, LIDAR_Z);
		overlay(curtain, 0.42, 0.1, 3);
		const frameGeo = keep(new THREE.EdgesGeometry(curtain.geometry));
		const frameLine = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: C.amber }));
		frameLine.position.copy(curtain.position);
		overlay(frameLine, 0.95, 0.3, 4);

		const track = new THREE.Mesh(keep(ribbonGeometry([lidarX0, LIDAR_Z, lidarX1, LIDAR_Z], 0.035, 0.235)), basic(C.amber));
		overlay(track, 0.95, 0.3, 4);
	}

	// Field plots: a ring on the ground and a pin that clears the canopy.
	{
		const plots: [number, number, number][] = [[-7.25, -3.3, 1.02], [-4.85, -3.25, 1.02], [-6.05, 0.1, 0.76], [-3.65, 0.3, 0.55], [-2.45, -0.25, 0.76], [-6.0, 2.95, 0.38], [-7.25, 2.5, 0.55]];
		const pinMat = basic(C.pin);
		const stemMat = basic(C.ink);
		const ringMat = basic(C.pin, { side: THREE.DoubleSide });
		const heads = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(0.062, 16, 12)), pinMat, plots.length);
		const stems = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.008, 0.008, 1, 6).translate(0, 0.5, 0)), stemMat, plots.length);
		const rings = new THREE.InstancedMesh(keep(new THREE.RingGeometry(0.15, 0.19, 36).rotateX(-Math.PI / 2)), ringMat, plots.length);
		plots.forEach(([x, z, height], i) => {
			const y = groundHeight(x, z);
			heads.setMatrixAt(i, m4.makeTranslation(x, y + height + 0.05, z));
			m4.compose(new THREE.Vector3(x, y, z), q.identity(), new THREE.Vector3(1, height + 0.05, 1));
			stems.setMatrixAt(i, m4);
			rings.setMatrixAt(i, m4.makeTranslation(x, y + 0.014, z));
		});
		overlay(rings, 0.95, 0.35, 3);
		overlay(stems, 0.9, 0.35, 5);
		overlay(heads, 1, 0.45, 5);
	}

	// SWOT: two swaths either side of the nadir gap, clipped to open water.
	{
		const theta = 0.27;
		const gap = 0.66;
		const width = 1.5;
		const centre = (z: number) => 3.05 - z * Math.tan(theta);
		const cosT = Math.cos(theta);
		const verts: number[] = [];
		const edges: number[] = [];
		const step = 0.09;
		for (const side of [-1, 1]) {
			let prev: [number, number, number] | null = null;
			for (let z = Z0; z <= Z1 + 1e-6; z += step) {
				const zc = Math.min(z, Z1);
				const inner = centre(zc) + (side * gap) / 2 / cosT;
				const outer = centre(zc) + (side * (gap / 2 + width)) / cosT;
				const lo = Math.max(Math.min(inner, outer), shoreX(zc) + 0.1);
				const hi = Math.min(Math.max(inner, outer), islandWest(zc) - 0.07);
				const cur: [number, number, number] | null = hi - lo > 0.05 ? [lo, hi, zc] : null;
				if (prev && cur) {
					verts.push(prev[0], 0.012, prev[2], cur[0], 0.012, cur[2], prev[1], 0.012, prev[2], prev[1], 0.012, prev[2], cur[0], 0.012, cur[2], cur[1], 0.012, cur[2]);
					edges.push(prev[0], prev[2], cur[0], cur[2], prev[1], prev[2], cur[1], cur[2]);
				}
				prev = cur;
			}
		}
		const geo = keep(new THREE.BufferGeometry());
		geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
		overlay(new THREE.Mesh(geo, basic(C.swot)), 0.36, 0.1, 2);
		overlay(new THREE.Mesh(keep(ribbonGeometry(edges, 0.022, 0.014)), basic(0x35546a)), 0.6, 0.18, 3);
	}

	// Shoreline gauges.
	{
		const sites: [number, number][] = [
			[shoreX(-3.1) + 0.05, -3.1], [shoreX(2.9) + 0.05, 2.9], [shoreX(-0.7) + 0.05, -0.7],
			[islandWest(-0.9) - 0.03, -0.9], [islandWest(3.1) - 0.03, 3.1],
		];
		const heads = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(0.06, 14, 10)), basic(C.ink), sites.length);
		const posts = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.011, 0.011, 0.2, 6).translate(0, 0.1, 0)), basic(C.ink), sites.length);
		sites.forEach(([x, z], i) => {
			heads.setMatrixAt(i, m4.makeTranslation(x, 0.24, z));
			posts.setMatrixAt(i, m4.makeTranslation(x, 0, z));
		});
		overlay(posts, 1, 0.4, 5);
		overlay(heads, 1, 0.45, 5);
	}

	// Estimates: gridded biomass, one tile per cell at canopy height.
	{
		const cell = 0.3;
		const ramp = [0xf2e7c3, 0xdccd83, 0xa3b877, 0x5f977f, 0x2e7078, 0x1e4b63].map((c) => new THREE.Color(c));
		const cells: { x: number; z: number; top: number; b: number }[] = [];
		for (let z = Z0 + 0.03; z + cell <= Z1 - 0.02; z += cell) {
			for (let x = X0 + 0.05; x + cell <= -1.2; x += cell) {
				const cx = x + cell / 2;
				const cz = z + cell / 2;
				if (cx > marshX(cz) - 0.12) continue;
				const [d, t] = riverAt(cx, cz);
				if (d < riverHalfWidth(t) * 2 + 0.16) continue;
				let b = 0;
				let top = groundHeight(cx, cz) + 0.02;
				for (const tr of trees) {
					const dist = Math.hypot(tr.x - cx, tr.z - cz);
					if (dist < 0.48) b += Math.pow(tr.h, 2.2) * (1 - dist / 0.48);
					if (tr.x < x || tr.x >= x + cell || tr.z < z || tr.z >= z + cell) continue;
					top = Math.max(top, groundHeight(cx, cz) + AGE_SPEC[tr.age].h[1]);
				}
				cells.push({ x: cx, z: cz, top, b });
			}
		}
		const bMax = [...cells].sort((a, b) => a.b - b.b)[Math.floor(cells.length * 0.97)].b;
		const tiles = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(cell * 0.93, 0.022, cell * 0.93)), new THREE.MeshLambertMaterial(), cells.length);
		cells.forEach((c, i) => {
			tiles.setMatrixAt(i, m4.makeTranslation(c.x, c.top + 0.05, c.z));
			const v = Math.min(0.999, c.b / bMax) * (ramp.length - 1);
			tint.copy(ramp[Math.floor(v)]).lerp(ramp[Math.floor(v) + 1], v - Math.floor(v));
			tiles.setColorAt(i, tint);
		});
		overlay(tiles, 0, 0.95, 4);
	}

	// Estimates: water-level contours over a bounded part of the sound.
	{
		const zA = -3.75;
		const zB = 3.75;
		const left = (z: number) => Math.max(shoreX(z) + 0.42, 0.95);
		const right = (z: number) => islandWest(z) - 0.38;
		const inside = (x: number, z: number) => z > zA && z < zB && x > left(z) && x < right(z);
		const wind = 0.6; // setup rises toward the north-east
		const field = (x: number, z: number) => (x - 3.1) * Math.cos(wind) - z * Math.sin(wind) + 0.42 * Math.sin(0.8 * x + 0.5 * z);
		const fmin = -4.3;
		const fmax = 4.3;
		const lowC = new THREE.Color(0xeef3f4);
		const highC = new THREE.Color(0x2a5f77);

		// Tinted surface between the two shores.
		const fillVerts: number[] = [];
		const fillCols: number[] = [];
		const push = (x: number, z: number) => {
			fillVerts.push(x, 0.008, z);
			tint.copy(lowC).lerp(highC, Math.min(1, Math.max(0, (field(x, z) - fmin) / (fmax - fmin))));
			fillCols.push(tint.r, tint.g, tint.b);
		};
		const nRows = 72;
		const nCols = 30;
		for (let r = 0; r < nRows; r++) {
			const z0 = lerp(zA, zB, r / nRows);
			const z1 = lerp(zA, zB, (r + 1) / nRows);
			for (let c = 0; c < nCols; c++) {
				const a0 = c / nCols;
				const a1 = (c + 1) / nCols;
				const x00 = lerp(left(z0), right(z0), a0);
				const x10 = lerp(left(z0), right(z0), a1);
				const x01 = lerp(left(z1), right(z1), a0);
				const x11 = lerp(left(z1), right(z1), a1);
				push(x00, z0);
				push(x01, z1);
				push(x10, z0);
				push(x10, z0);
				push(x01, z1);
				push(x11, z1);
			}
		}
		const fillGeo = keep(new THREE.BufferGeometry());
		fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(fillVerts, 3));
		fillGeo.setAttribute('color', new THREE.Float32BufferAttribute(fillCols, 3));
		overlay(new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ vertexColors: true })), 0, 0.6, 2);

		// Dashed outline of the bounded area.
		const outline: [number, number][] = [];
		const n = 90;
		for (let i = 0; i <= n; i++) outline.push([left(lerp(zA, zB, i / n)), lerp(zA, zB, i / n)]);
		for (let i = n; i >= 0; i--) outline.push([right(lerp(zA, zB, i / n)), lerp(zA, zB, i / n)]);
		outline.push(outline[0]);
		const dashes: number[] = [];
		let run = 0;
		for (let i = 0; i < outline.length - 1; i++) {
			const [ax, az] = outline[i];
			const [bx, bz] = outline[i + 1];
			const len = Math.hypot(bx - ax, bz - az);
			const pieces = Math.max(1, Math.ceil(len / 0.04));
			for (let k = 0; k < pieces; k++) {
				if (run % 0.3 < 0.18) {
					dashes.push(lerp(ax, bx, k / pieces), lerp(az, bz, k / pieces), lerp(ax, bx, (k + 1) / pieces), lerp(az, bz, (k + 1) / pieces));
				}
				run += len / pieces;
			}
		}
		overlay(new THREE.Mesh(keep(ribbonGeometry(dashes, 0.03, 0.017)), basic(0x1f3d4f)), 0, 0.85, 4);

		// Contours of the estimated surface, light to dark with rising water level.
		const levels = 10;
		for (let i = 1; i < levels; i++) {
			const level = lerp(fmin, fmax, i / levels);
			const segs = contourSegments(field, inside, level, 0.07);
			if (!segs.length) continue;
			tint.set(0xffffff).lerp(new THREE.Color(0x163447), i / levels);
			const line = new THREE.Mesh(keep(ribbonGeometry(segs, 0.046, 0.019)), new THREE.MeshBasicMaterial({ color: tint.clone() }));
			overlay(line, 0, 0.95, 5);
		}
	}

	// ---------------------------------------------------------------- view state
	let mix = options.view === 'estimates' ? 1 : 0; // 0 = observations, 1 = estimates
	let target = mix;
	let frame = 0;
	let azimuth = CAMERA.azimuth;
	let polar = CAMERA.polar;

	const applyMix = () => {
		for (const f of fades) {
			const o = lerp(f.obs, f.est, mix);
			f.material.opacity = o;
			f.object.visible = o > 0.004;
		}
	};
	const placeCamera = () => {
		const s = Math.sin(polar);
		camera.position.set(
			CAMERA.target.x + CAMERA.radius * s * Math.sin(azimuth),
			CAMERA.target.y + CAMERA.radius * Math.cos(polar),
			CAMERA.target.z + CAMERA.radius * s * Math.cos(azimuth),
		);
		camera.lookAt(CAMERA.target);
	};
	const render = () => renderer.render(scene, camera);
	const tick = () => {
		const delta = target - mix;
		if (Math.abs(delta) < 0.02) {
			mix = target;
			frame = 0;
		} else {
			mix += delta * 0.2;
			frame = requestAnimationFrame(tick);
		}
		applyMix();
		render();
	};
	const resize = () => {
		const w = canvas.clientWidth || canvas.width;
		const h = canvas.clientHeight || canvas.height;
		const ratio = options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2);
		renderer.setPixelRatio(ratio);
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		// Keep the whole block in frame when the canvas is narrower than 16:9.
		camera.fov = CAMERA.fov * Math.max(1, 16 / 9 / camera.aspect);
		camera.updateProjectionMatrix();
		lidarPoints.material.size = Math.max(1.1, (h * ratio) / 640);
		render();
	};

	applyMix();
	placeCamera();
	resize();

	return {
		setView(view, animate = true) {
			target = view === 'estimates' ? 1 : 0;
			cancelAnimationFrame(frame);
			if (animate && !reducedMotion) {
				frame = requestAnimationFrame(tick);
			} else {
				mix = target;
				applyMix();
				render();
			}
		},
		orbit(dAzimuth, dPolar) {
			azimuth = Math.min(CAMERA.azimuth + LIMITS.azimuth, Math.max(CAMERA.azimuth - LIMITS.azimuth, azimuth + dAzimuth));
			polar = Math.min(LIMITS.polarMax, Math.max(LIMITS.polarMin, polar + dPolar));
			placeCamera();
			render();
		},
		resetCamera() {
			azimuth = CAMERA.azimuth;
			polar = CAMERA.polar;
			placeCamera();
			render();
		},
		resize,
		render,
		dispose() {
			cancelAnimationFrame(frame);
			disposables.forEach((d) => d.dispose());
			scene.traverse((o) => {
				if (o instanceof THREE.InstancedMesh) o.dispose();
			});
			renderer.dispose();
		},
	};
}
