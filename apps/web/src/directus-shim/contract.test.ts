// Spec 020 (T103, FR-075, FR-076, data-model §7): every global component, view and directive of the Directus 11.17.4
// app is registered by the shim with the same contract as apps/web/fixtures/directus-components.json (extracted from
// directus/app by scripts/extract-directus-components.mjs): prop names, runtime types, required and defaults; emits;
// slot names (from the shim template; a shim that forwards every slot covers them all) and exposed members.
// IGNORED lists what a shim accepts but may not honour, with the reason.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isEqual } from 'lodash-es';
import { describe, expect, test } from 'vitest';
import { createApp, type Component } from 'vue';
import contract from '../../fixtures/directus-components.json';
import { registerShims, SHIM_COMPONENTS, SHIM_VIEWS } from './register.ts';

type PropContract = { type?: string; required?: boolean; default?: string };
type ComponentContract = {
	file: string;
	props?: Record<string, PropContract>;
	emits?: string[];
	slots?: Record<string, string[]>;
	expose?: string[];
};

/** `Component.prop` → reason: the shim declares the prop but does not compare its default or type. */
export const IGNORED: Record<string, string> = {
	'DrawerItem.overlay': 'Directus forces drawer too (drawer-item.vue); modal and popover are accepted and ignored',
	'DrawerItem.popoverProps': 'popover overlay not offered (see overlay)',
	'VForm.collabContext': 'collaboration is out of scope (D-141)',
};

const app = createApp({});
registerShims(app);
const registered = app._context.components as Record<string, Component>;
const directives = Object.keys(app._context.directives);

const typeName = (type: unknown): string => {
	if (type === null || type === undefined || type === true) return 'null';
	if (Array.isArray(type)) return `[${type.map(typeName).sort().join(', ')}]`;
	return (type as { name: string }).name;
};

const normalizeType = (text: string | undefined) => {
	if (!text) return 'null';
	const list = text
		.replace(/^\[|\]$/g, '')
		.split(',')
		.map((part) => part.trim())
		.sort();
	return list.length > 1 ? `[${list.join(', ')}]` : list[0]!;
};

const typeSet = (type: string) =>
	new Set(
		type
			.replace(/^\[|\]$/g, '')
			.split(', ')
			.filter((t) => t !== 'null'),
	);

/** A shim type accepts what Directus accepts: `null` (any type), or a superset of the Directus types. */
const accepts = (shim: string, directus: string) =>
	shim === 'null' || directus === 'null' || [...typeSet(directus)].every((type) => typeSet(shim).has(type));

/** The value of a default: a literal, or the result of a factory for non-function types; undefined when not evaluable. */
function evaluate(source: unknown, type: string): { ok: boolean; value?: unknown } {
	try {
		const value = typeof source === 'string' ? new Function(`return (${source})`)() : source;
		return { ok: true, value: typeof value === 'function' && type !== 'Function' ? value({}) : value };
	} catch {
		return { ok: false };
	}
}

/** The default of a shim prop is already a value (a factory for objects and arrays). */
function valueOf(value: unknown, type: string): { ok: boolean; value?: unknown } {
	try {
		return {
			ok: true,
			value: typeof value === 'function' && type !== 'Function' ? (value as (p: object) => unknown)({}) : value,
		};
	} catch {
		return { ok: false };
	}
}

function shimProps(component: Component): Record<string, { type: string; required: boolean; default: unknown }> {
	const raw = ((component as { props?: unknown }).props ?? {}) as Record<string, any> | string[];
	if (Array.isArray(raw))
		return Object.fromEntries(raw.map((name) => [name, { type: 'null', required: false, default: undefined }]));

	return Object.fromEntries(
		Object.entries(raw).map(([name, def]) => {
			const options =
				def &&
				typeof def === 'object' &&
				!Array.isArray(def) &&
				('type' in def || 'default' in def || 'required' in def)
					? def
					: { type: def };
			return [name, { type: typeName(options.type), required: !!options.required, default: options.default }];
		}),
	);
}

function shimEmits(component: Component): string[] {
	const emits = (component as { emits?: unknown }).emits;
	if (!emits) return [];
	return (Array.isArray(emits) ? emits : Object.keys(emits as object)).sort();
}

/** Slot names and expose of a shim read from its SFC source; null for a component the shim does not own. */
function shimSource(name: string, kind: 'components' | 'views'): string | null {
	try {
		return readFileSync(join(import.meta.dirname, kind, `${name}.vue`), 'utf8');
	} catch {
		return null;
	}
}

function slotsOf(source: string) {
	const forwardsAll = /v-for="\(\w*,\s*(\w+)\)\s+in\s+\$slots"/.test(source);
	const names = new Set<string>();

	for (const match of source.matchAll(/<slot\b([^>]*?)\/?>/g)) {
		const named = /(?:^|\s)name="([^"]+)"/.exec(match[1]!);
		names.add(named ? named[1]! : 'default');
	}

	return { forwardsAll, names };
}

function exposeOf(source: string): string[] {
	const match = /defineExpose\(\{([^)]*)\}\)/s.exec(source);
	if (!match) return [];
	return match[1]!
		.split(',')
		.map((part) => part.split(':')[0]!.trim())
		.filter(Boolean)
		.sort();
}

function check(name: string, expected: ComponentContract, kind: 'components' | 'views') {
	const component = registered[name];
	expect(component, `${name} is registered`).toBeTruthy();

	const props = shimProps(component!);
	const problems: string[] = [];

	for (const [prop, want] of Object.entries(expected.props ?? {})) {
		const got = props[prop];
		const key = `${name}.${prop}`;

		if (!got) {
			problems.push(`missing prop ${prop}`);
			continue;
		}

		if (IGNORED[key]) continue;

		if (!accepts(got.type, normalizeType(want.type))) {
			problems.push(`prop ${prop}: type ${got.type}, Directus ${normalizeType(want.type)}`);
		}

		if (!!want.required !== got.required) problems.push(`prop ${prop}: required ${got.required}`);

		const directusDefault = evaluate(want.default, normalizeType(want.type));
		const shimDefault = valueOf(got.default, got.type);

		if (directusDefault.ok && shimDefault.ok && !isEqual(directusDefault.value, shimDefault.value)) {
			problems.push(`prop ${prop}: default ${JSON.stringify(shimDefault.value)}, Directus ${want.default}`);
		}
	}

	const emits = shimEmits(component!);
	const missingEmits = (expected.emits ?? []).filter((emit) => !emits.includes(emit));
	if (missingEmits.length) problems.push(`missing emits ${missingEmits.join(', ')}`);

	const source = shimSource(name, kind);

	if (source) {
		const { forwardsAll, names } = slotsOf(source);
		const missingSlots = Object.keys(expected.slots ?? {}).filter((slot) => !forwardsAll && !names.has(slot));
		if (missingSlots.length) problems.push(`missing slots ${missingSlots.join(', ')}`);

		const expose = exposeOf(source);
		const missingExpose = (expected.expose ?? []).filter((member) => !expose.includes(member));
		if (missingExpose.length) problems.push(`missing expose ${missingExpose.join(', ')}`);
	}

	expect(problems, name).toEqual([]);
}

describe('components', () => {
	for (const [name, expected] of Object.entries(contract.components as Record<string, ComponentContract>)) {
		test(name, () => check(name, expected, 'components'));
	}
});

describe('views', () => {
	for (const [name, expected] of Object.entries(contract.views as Record<string, ComponentContract>)) {
		test(name, () => check(name, expected, 'views'));
	}
});

test('directives', () => {
	expect(directives.sort()).toEqual(Object.keys(contract.directives).sort());
});

test('no component outside the Directus list', () => {
	const allowed = new Set([...Object.keys(contract.components), ...Object.keys(contract.views)]);
	expect(Object.keys({ ...SHIM_COMPONENTS, ...SHIM_VIEWS }).filter((name) => !allowed.has(name))).toEqual([]);
});
