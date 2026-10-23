// Owner 2026-10-23 (D-173): the frames of the loading favicon, drawn here instead of icon glyphs so the limbs move:
// a runner whose legs and arms swing, a cyclist whose wheels turn and whose legs follow the pedals, a swimmer whose
// arms turn over and whose legs kick in moving water. White strokes on a 64 × 64 canvas; the caller paints the circle.

export const SPRITES = ['run', 'bike', 'swim'] as const;
export type Sprite = (typeof SPRITES)[number];

/** Frames of one gait cycle (one stride, one pedal turn, one stroke). */
export const SPRITE_FRAMES = 6;

type Point = [x: number, y: number];

const TAU = Math.PI * 2;
/** The limbs on the far side are dimmed to read as behind the body. */
const FAR = 0.55;

/** End of a segment of `length` from `from` at `angle` from straight down, positive toward the front (+x). */
const limb = ([x, y]: Point, length: number, angle: number): Point => [
	x + length * Math.sin(angle),
	y + length * Math.cos(angle),
];

function line(ctx: CanvasRenderingContext2D, width: number, ...points: Point[]) {
	ctx.lineWidth = width;
	ctx.beginPath();
	points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
	ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, [x, y]: Point, r: number) {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, TAU);
	ctx.fill();
}

/** Knee of a two-segment leg from hip to foot (equal segments), bent toward the front. */
export function knee(hip: Point, foot: Point, segment: number): Point {
	const [dx, dy] = [foot[0] - hip[0], foot[1] - hip[1]];
	const d = Math.min(Math.hypot(dx, dy), segment * 2);
	const h = Math.sqrt(Math.max(segment * segment - (d / 2) * (d / 2), 0));
	const mid: Point = [hip[0] + dx / 2, hip[1] + dy / 2];
	const [px, py] = [-dy / Math.hypot(dx, dy), dx / Math.hypot(dx, dy)];
	const a: Point = [mid[0] + h * px, mid[1] + h * py];
	const b: Point = [mid[0] - h * px, mid[1] - h * py];
	return a[0] >= b[0] ? a : b;
}

function run(ctx: CanvasRenderingContext2D, phase: number) {
	// The body bobs twice a stride, lowest while a foot is under it.
	const bob = 1.5 * Math.cos(2 * phase);
	const hip: Point = [29, 35 + bob];
	const shoulder: Point = [33, 22 + bob];

	// Far side first (k = 1), then the near side over the torso.
	for (const k of [1, 0]) {
		const step = phase + k * Math.PI;
		ctx.globalAlpha = k === 1 ? FAR : 1;

		// The thigh swings ±0.6 rad; the shin folds up behind while the leg swings forward (heel kick) and is
		// nearly straight while the foot is down.
		const thigh = 0.6 * Math.sin(step);
		const kneePoint = limb(hip, 9.5, thigh);
		line(ctx, 5, hip, kneePoint, limb(kneePoint, 9.5, thigh - 0.25 - 1.3 * Math.max(0, Math.cos(step))));

		// The arm swings against the leg of its side, the forearm bent forward.
		const elbow = limb(shoulder, 7, -0.9 * Math.sin(step));
		line(ctx, 4.5, shoulder, elbow, limb(elbow, 6.5, -0.9 * Math.sin(step) + 1.8));

		if (k === 1) {
			ctx.globalAlpha = 1;
			line(ctx, 5.5, shoulder, hip);
			dot(ctx, [37, 13 + bob], 5.5);
		}
	}
}

function bike(ctx: CanvasRenderingContext2D, phase: number, frame: number) {
	const rear: Point = [16, 45];
	const front: Point = [48, 45];
	const crank: Point = [31, 45];
	const seat: Point = [27, 32];
	const bar: Point = [43, 30];
	const hip: Point = [27, 29];
	const shoulder: Point = [38, 20];
	const pedal = (k: number): Point => [
		crank[0] + 5.5 * Math.cos(phase + k * Math.PI),
		crank[1] + 5.5 * Math.sin(phase + k * Math.PI),
	];

	// Wheels: rim and three spokes turning 20° a frame, so six frames turn them by their own symmetry (120°).
	for (const center of [rear, front]) {
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(center[0], center[1], 10.5, 0, TAU);
		ctx.stroke();

		for (let j = 0; j < 3; j++) {
			const angle = (frame * TAU) / 18 + (j * TAU) / 3;
			line(ctx, 2, center, [center[0] + 10.5 * Math.cos(angle), center[1] + 10.5 * Math.sin(angle)]);
		}
	}

	line(ctx, 3, rear, crank, seat, rear);
	line(ctx, 3, seat, bar, front);
	line(ctx, 3, crank, bar);

	ctx.globalAlpha = FAR;
	line(ctx, 4.5, hip, knee(hip, pedal(1), 11.5), pedal(1));
	ctx.globalAlpha = 1;
	line(ctx, 5.5, hip, shoulder);
	line(ctx, 4, shoulder, [44, 27]);
	dot(ctx, [42, 12], 5.5);
	line(ctx, 4.5, hip, knee(hip, pedal(0), 11.5), pedal(0));
}

function swim(ctx: CanvasRenderingContext2D, phase: number) {
	const shoulder: Point = [23, 35];
	const hip: Point = [43, 37];

	// Water: two wave lines moving backward.
	for (const [y, shift] of [
		[44, 0],
		[52, 1.5],
	] as const) {
		const points: Point[] = [];
		for (let x = 2; x <= 62; x += 2) points.push([x, y + 2.2 * Math.sin(x * 0.35 + phase + shift)]);
		line(ctx, 3, ...points);
	}

	// Legs kick up and down against each other.
	ctx.globalAlpha = FAR;
	line(ctx, 4.5, hip, [56, 37 + 4 * Math.sin(phase + Math.PI)]);
	ctx.globalAlpha = 1;
	line(ctx, 4.5, hip, [56, 37 + 4 * Math.sin(phase)]);
	line(ctx, 5.5, shoulder, hip);
	dot(ctx, [15, 33], 5.5);

	// Front crawl: each arm turns over from behind, over the head, forward and down, half a turn after the other.
	for (const k of [1, 0]) {
		const angle = Math.PI - phase - k * Math.PI;
		ctx.globalAlpha = k === 1 ? FAR : 1;
		line(ctx, 4.5, shoulder, [shoulder[0] - 15 * Math.cos(angle), shoulder[1] - 15 * Math.sin(angle)]);
	}
	ctx.globalAlpha = 1;
}

/** Draws frame `frame` (0 to SPRITE_FRAMES - 1) of a sprite in the current stroke and fill style. */
export function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, frame: number) {
	const phase = (frame * TAU) / SPRITE_FRAMES;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	if (sprite === 'run') run(ctx, phase);
	else if (sprite === 'bike') bike(ctx, phase, frame);
	else swim(ctx, phase);
}
