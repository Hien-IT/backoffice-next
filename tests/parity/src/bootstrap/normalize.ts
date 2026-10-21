// Spec 021 FR-107: the only rules applied before comparing CLI output, logs and database rows of Directus 11.17.4 and
// Backoffice. Adding a rule means changing the spec first.
import { comparable } from '../system/helpers.js';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ARGON2 = /\$argon2[a-z]*\$[^\s"']+/g;
const ISO_TIME = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g;

/** Numbers each distinct uuid by first appearance (`<uuid:1>`, `<uuid:2>`...), shared by every value of one run. */
export class UuidMap {
	private readonly ids = new Map<string, string>();

	replace(text: string): string {
		return text.replace(UUID, (uuid) => {
			const key = uuid.toLowerCase();
			if (!this.ids.has(key)) this.ids.set(key, `<uuid:${this.ids.size + 1}>`);
			return this.ids.get(key)!;
		});
	}
}

export interface TextOptions {
	/** The program versions of the run (`--version` output): each becomes `<version>`. */
	versions?: string[];
	/** Absolute temporary directories of the test: each becomes `<dir>`. */
	dirs?: string[];
	uuids?: UuidMap;
}

/** Branding (D-147), versions, uuids, argon2 hashes, times and temporary directories of a text. */
export function normalizeText(text: string, options: TextOptions = {}): string {
	let out = text;

	for (const dir of options.dirs ?? []) out = out.split(dir).join('<dir>');
	for (const version of options.versions ?? []) if (version) out = out.split(version).join('<version>');

	out = out
		.replace(/npx directus start|node cli\.js start/g, '<start>')
		.replace(/\b(?:directus|backoffice)(?= \[command\]| bootstrap"| [a-z:]+ \[options\])/g, '<app>')
		.replace(/\bDirectus\b|\bBackoffice\b/g, '<app>')
		.replace(ARGON2, '<argon2>')
		.replace(ISO_TIME, '<time>')
		// The bundler of the Directus image renames variables (`up$1 is not a function`).
		.replace(/\b([A-Za-z_][\w]*)\$\d+(?= is not (?:a function|defined))/g, '$1');

	return options.uuids ? options.uuids.replace(out) : out;
}

export interface LogLine {
	level: number;
	msg: string;
}

/** The (`level`, `msg`) pairs of pino raw output (LOG_STYLE=raw), in order; lines that are not pino JSON are dropped. */
export function pinoLines(output: string): LogLine[] {
	const lines: LogLine[] = [];

	for (const line of output.split('\n')) {
		const start = line.indexOf('{');
		if (start === -1) continue;

		try {
			const entry = JSON.parse(line.slice(start)) as { level?: unknown; msg?: unknown };
			if (typeof entry.level === 'number' && typeof entry.msg === 'string') {
				lines.push({ level: entry.level, msg: entry.msg });
			}
		} catch {
			// not a pino line (pm2 banner, stack trace...)
		}
	}

	return lines;
}

/** pinoLines with each message normalized (FR-006: only `level` and `msg` are compared). */
export function normalizeLogs(output: string, options: TextOptions = {}): LogLine[] {
	return pinoLines(output).map(({ level, msg }) => ({ level, msg: normalizeText(msg, options) }));
}

/**
 * Comparable rows of every table of a dump: `comparable()` of src/system/helpers.ts (time columns, argon2, tokens),
 * then uuids, hashes and times inside strings (JSON columns such as revisions). Rows are sorted on their content with
 * the uuids blanked, so two databases that differ only by generated uuids sort the same; the uuids are then numbered in
 * that order across tables, which keeps the references between tables comparable.
 */
export function normalizeRows(rows: Record<string, Record<string, unknown>[]>): Record<string, unknown[]> {
	const uuids = new UuidMap();
	const out: Record<string, unknown[]> = {};

	const scrub = (value: unknown, map: (text: string) => string): unknown => {
		if (typeof value === 'string') return map(value.replace(ARGON2, '<argon2>').replace(ISO_TIME, '<time>'));
		if (Array.isArray(value)) return value.map((v) => scrub(v, map));
		if (value && typeof value === 'object') {
			return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrub(v, map)]));
		}
		return value;
	};

	for (const table of Object.keys(rows).sort()) {
		const sorted = rows[table]!.map((row) => comparable(row))
			.map((row) => ({ row, key: JSON.stringify(scrub(row, (t) => t.replace(UUID, '<uuid>'))) }))
			.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

		out[table] = sorted.map(({ row }) => scrub(row, (t) => uuids.replace(t)));
	}

	return out;
}
