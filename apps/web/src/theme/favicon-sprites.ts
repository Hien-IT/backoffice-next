// Owner 2026-10-23 (D-173): the frames of the loading favicon, drawn here instead of icon glyphs so the limbs move:
// a runner whose legs and arms swing, a cyclist whose wheels turn and whose legs follow the pedals, a swimmer whose
// arms turn over and whose legs kick in moving water, all heading right. Between two sports the figure goes from one
// pose to the next (owner: "chạy bộ xong rồi leo lên xe đạp"): the bike rolls in and the runner hops on the saddle,
// the cyclist dives off as the water rises and the bike falls behind, the swimmer climbs out as the water sinks.
// White strokes on a 64 × 64 canvas; the caller paints the circle.

export const SPRITES = ['run', 'bike', 'swim'] as const;
export type Sprite = (typeof SPRITES)[number];

/** Frames of one gait cycle (one stride, one pedal turn, one stroke). */
export const SPRITE_FRAMES = 6;
/** Gait cycles of each sport before the change to the next one. */
export const SPRITE_CYCLES = 2;
/** Frames of the change from one sport to the next. */
export const TRANSITION_FRAMES = 6;

type Point = [x: number, y: number];

interface Side {
	knee: Point;
	foot: Point;
	elbow: Point;
	hand: Point;
}

interface Pose {
	head: Point;
	shoulder: Point;
	hip: Point;
	near: Side;
	far: Side;
}

export interface Scene {
	pose: Pose;
	/** The bike, shifted by `x`, its wheels and cranks at `phase`. */
	bike?: { x: number; phase: number };
	/** The water, lowered by `dy`, its waves at `phase`. */
	water?: { dy: number; phase: number };
}

const TAU = Math.PI * 2;
/** The limbs on the far side are dimmed to read as behind the body. */
const FAR = 0.55;
/** Wheel radius: the rims keep a margin inside the favicon circle. */
const WHEEL = 9;
const REAR: Point = [18, 44];
const FRONT: Point = [46, 44];
const CRANK: Point = [32, 44];
const SEAT: Point = [28, 32];
const BAR: Point = [42, 30];

/** End of a segment of `length` from `from` at `angle` from straight down, positive toward the front (+x). */
const limb = ([x, y]: Point, length: number, angle: number): Point => [
	x + length * Math.sin(angle),
	y + length * Math.cos(angle),
];

const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const clamp = (t: number) => Math.min(Math.max(t, 0), 1);
const ease = (t: number) => t * t * (3 - 2 * t);

/** Knee of a two-segment leg from hip to foot (equal segments), bent toward the front. */
export function knee(hip: Point, foot: Point, segment: number): Point {
	const [dx, dy] = [foot[0] - hip[0], foot[1] - hip[1]];
	const d = Math.min(Math.hypot(dx, dy), segment * 2);
	const h = Math.sqrt(Math.max(segment * segment - (d / 2) * (d / 2), 0));
	const center = mid(hip, foot);
	const [px, py] = [-dy / Math.hypot(dx, dy), dx / Math.hypot(dx, dy)];
	const a: Point = [center[0] + h * px, center[1] + h * py];
	const b: Point = [center[0] - h * px, center[1] - h * py];
	return a[0] >= b[0] ? a : b;
}

function runPose(phase: number): Pose {
	// The body bobs twice a stride, lowest while a foot is under it.
	const bob = 1.5 * Math.cos(2 * phase);
	const hip: Point = [29, 35 + bob];
	const shoulder: Point = [33, 22 + bob];

	const side = (k: number): Side => {
		const step = phase + k * Math.PI;
		// The thigh swings ±0.6 rad; the shin folds up behind while the leg swings forward (heel kick) and is nearly
		// straight while the foot is down. The arm swings against the leg of its side, the forearm bent forward.
		const thigh = 0.6 * Math.sin(step);
		const kneePoint = limb(hip, 9.5, thigh);
		const elbow = limb(shoulder, 7, -0.9 * Math.sin(step));
		return {
			knee: kneePoint,
			foot: limb(kneePoint, 9.5, thigh - 0.25 - 1.3 * Math.max(0, Math.cos(step))),
			elbow,
			hand: limb(elbow, 6.5, -0.9 * Math.sin(step) + 1.8),
		};
	};

	return { head: [37, 13 + bob], shoulder, hip, near: side(0), far: side(1) };
}

function bikePose(phase: number): Pose {
	const hip: Point = [28, 29];
	const shoulder: Point = [38, 20];
	const grip: Point = [43, 28];

	// The feet stay on the pedals; the knees follow.
	const side = (k: number): Side => {
		const pedal: Point = [
			CRANK[0] + 5.5 * Math.cos(phase + k * Math.PI),
			CRANK[1] + 5.5 * Math.sin(phase + k * Math.PI),
		];
		return { knee: knee(hip, pedal, 11.5), foot: pedal, elbow: mid(shoulder, grip), hand: grip };
	};

	return { head: [42, 12], shoulder, hip, near: side(0), far: side(1) };
}

function swimPose(phase: number): Pose {
	const shoulder: Point = [41, 35];
	const hip: Point = [21, 37];

	// Legs kick up and down against each other; front crawl: each arm turns over from behind, over the head, forward
	// and down, half a turn after the other.
	const side = (k: number): Side => {
		const foot: Point = [8, 37 + 4 * Math.sin(phase + k * Math.PI)];
		const angle = Math.PI - phase - k * Math.PI;
		const hand: Point = [shoulder[0] + 15 * Math.cos(angle), shoulder[1] - 15 * Math.sin(angle)];
		return { knee: mid(hip, foot), foot, elbow: mid(shoulder, hand), hand };
	};

	return { head: [49, 33], shoulder, hip, near: side(0), far: side(1) };
}

/** Pose between `a` and `b` at `t`, the whole body raised by `lift` (a hop, a dive, a step out). */
function between(a: Pose, b: Pose, t: number, lift: number): Pose {
	const point = (p: Point, q: Point): Point => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t - lift];
	const side = (p: Side, q: Side): Side => ({
		knee: point(p.knee, q.knee),
		foot: point(p.foot, q.foot),
		elbow: point(p.elbow, q.elbow),
		hand: point(p.hand, q.hand),
	});
	return {
		head: point(a.head, b.head),
		shoulder: point(a.shoulder, b.shoulder),
		hip: point(a.hip, b.hip),
		near: side(a.near, b.near),
		far: side(a.far, b.far),
	};
}

/** Frame `frame` of a sport's gait cycle. */
export function gaitScene(sprite: Sprite, frame: number): Scene {
	const phase = (frame * TAU) / SPRITE_FRAMES;
	if (sprite === 'run') return { pose: runPose(phase) };
	if (sprite === 'bike') return { pose: bikePose(phase), bike: { x: 0, phase } };
	return { pose: swimPose(phase), water: { dy: 0, phase } };
}

/** Frame `frame` (0 to TRANSITION_FRAMES - 1) of the change from `from` to the next sport. */
export function transitionScene(from: Sprite, frame: number): Scene {
	const t = (frame + 1) / (TRANSITION_FRAMES + 1);
	// The leaving sport keeps its rhythm while the change starts.
	const phase = (frame * TAU) / SPRITE_FRAMES;

	if (from === 'run') {
		// The bike rolls in from the right; the runner hops on the saddle.
		const u = ease(clamp((t - 0.3) / 0.7));
		return {
			pose: between(runPose(phase), bikePose(0), u, 7 * Math.sin(Math.PI * u)),
			bike: { x: 36 * (1 - ease(clamp(t / 0.6))), phase: (t - 1) * TAU },
		};
	}

	if (from === 'bike') {
		// The cyclist dives off forward; the bike falls behind and the water rises.
		const u = ease(t);
		return {
			pose: between(bikePose(phase), swimPose(0), u, 9 * Math.sin(Math.PI * u)),
			bike: { x: -44 * ease(clamp((t - 0.2) / 0.8)), phase },
			water: { dy: 22 * (1 - u), phase },
		};
	}

	// The swimmer climbs out as the water sinks and starts to run.
	const u = ease(clamp((t - 0.2) / 0.8));
	return {
		pose: between(swimPose(phase), runPose(0), u, 5 * Math.sin(Math.PI * u)),
		water: { dy: 22 * ease(t), phase },
	};
}

/**
 * The whole loop: each sport's gait cycles, then its change to the next sport (the swimmer goes back to running).
 * `stop` marks the frames where the animation may end: the start of a gait cycle, never inside a change.
 */
export function timeline(): { scene: Scene; stop: boolean }[] {
	return SPRITES.flatMap((sprite) => [
		...Array.from({ length: SPRITE_FRAMES * SPRITE_CYCLES }, (_, i) => ({
			scene: gaitScene(sprite, i % SPRITE_FRAMES),
			stop: i % SPRITE_FRAMES === 0,
		})),
		...Array.from({ length: TRANSITION_FRAMES }, (_, i) => ({ scene: transitionScene(sprite, i), stop: false })),
	]);
}

function line(ctx: CanvasRenderingContext2D, width: number, ...points: Point[]) {
	ctx.lineWidth = width;
	ctx.beginPath();
	points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
	ctx.stroke();
}

function drawWater(ctx: CanvasRenderingContext2D, { dy, phase }: NonNullable<Scene['water']>) {
	// Two wave lines flowing past the swimmer, toward its feet.
	for (const [y, shift] of [
		[44, 0],
		[52, 1.5],
	] as const) {
		const points: Point[] = [];
		for (let x = 2; x <= 62; x += 2) points.push([x, y + dy + 2.2 * Math.sin((64 - x) * 0.35 - phase + shift)]);
		line(ctx, 3, ...points);
	}
}

function drawBike(ctx: CanvasRenderingContext2D, { x, phase }: NonNullable<Scene['bike']>) {
	const at = ([px, py]: Point): Point => [px + x, py];

	// Wheels: rim and three spokes turning a third of the crank, so a pedal turn turns them by their symmetry (120°).
	for (const center of [at(REAR), at(FRONT)]) {
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(center[0], center[1], WHEEL, 0, TAU);
		ctx.stroke();

		for (let j = 0; j < 3; j++) {
			const angle = phase / 3 + (j * TAU) / 3;
			line(ctx, 2, center, [center[0] + WHEEL * Math.cos(angle), center[1] + WHEEL * Math.sin(angle)]);
		}
	}

	line(ctx, 3, at(REAR), at(CRANK), at(SEAT), at(REAR));
	line(ctx, 3, at(SEAT), at(BAR), at(FRONT));
	line(ctx, 3, at(CRANK), at(BAR));
}

/** Draws a scene in the current stroke and fill style. */
export function drawScene(ctx: CanvasRenderingContext2D, { pose, bike, water }: Scene) {
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	if (water) drawWater(ctx, water);
	if (bike) drawBike(ctx, bike);

	ctx.globalAlpha = FAR;
	line(ctx, 5, pose.hip, pose.far.knee, pose.far.foot);
	line(ctx, 4.5, pose.shoulder, pose.far.elbow, pose.far.hand);
	ctx.globalAlpha = 1;

	line(ctx, 5.5, pose.shoulder, pose.hip);
	ctx.beginPath();
	ctx.arc(pose.head[0], pose.head[1], 5.5, 0, TAU);
	ctx.fill();
	line(ctx, 5, pose.hip, pose.near.knee, pose.near.foot);
	line(ctx, 4.5, pose.shoulder, pose.near.elbow, pose.near.hand);
}
