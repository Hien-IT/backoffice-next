<!-- Ported from directus/app/src/displays/formatted-value/formatted-value.vue -->
<script setup lang="ts">
import formatTitle from '@directus/format-title';
import dompurify from 'dompurify';
import { isNil } from 'lodash-es';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../components/BoIcon.vue';
import ValueNull from '../../components/render/ValueNull.vue';
import { decode } from './decode.ts';

const props = withDefaults(
	defineProps<{
		type: string;
		value?: string | number | (string | number)[];
		format?: boolean;
		font?: 'sans-serif' | 'serif' | 'monospace';
		bold?: boolean;
		italic?: boolean;
		prefix?: string;
		suffix?: string;
		color?: string;
		background?: string;
		icon?: string;
		border?: boolean;
		masked?: boolean;
		translate?: boolean;
		conditionalFormatting?: {
			operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'starts_with' | 'ends_with';
			value: string;
			color: string;
			background: string;
			text: string;
			icon: string;
		}[];
	}>(),
	{
		font: 'sans-serif',
		conditionalFormatting: () => [],
	},
);

const { t, n, locale } = useI18n();

const matchedConditions = computed(() =>
	(props.conditionalFormatting || []).filter(({ operator, value }) => {
		if (['string', 'text'].includes(props.type)) {
			const left = String(props.value);
			const right = String(value);
			return matchString(left, right, operator);
		} else if (props.type === 'float' || props.type === 'decimal') {
			const left = parseFloat(String(props.value));
			const right = parseFloat(String(value));
			return matchNumber(left, right, operator);
		} else if (props.type === 'bigInteger') {
			try {
				return matchNumber(BigInt(String(props.value)), BigInt(String(value)), operator);
			} catch {
				return false;
			}
		} else {
			const left = parseInt(String(props.value));
			const right = parseInt(String(value));
			return matchNumber(left, right, operator);
		}
	}),
);

const computedFormat = computed(() => {
	const { color, background, icon } = props;

	return matchedConditions.value.reduce(
		({ color, background, icon, text }, format) => ({
			color: format.color || color,
			background: format.background || background,
			icon: format.icon || icon,
			text: format.text || text,
		}),
		{
			color,
			background,
			icon,
			text: '',
		},
	);
});

const computedStyle = computed(() => {
	return {
		color: computedFormat.value.color,
		borderStyle: 'solid',
		borderWidth: props.border ? '2px' : 0,
		borderColor: computedFormat.value.color,
		backgroundColor: computedFormat.value.background ?? 'transparent',
	};
});

const displayValue = computed(() => {
	if (props.masked) return '**********';

	if (computedFormat.value.text) {
		const { text } = computedFormat.value;
		return text.startsWith('$t:') ? t(text.slice(3)) : text;
	}

	if (isNil(props.value) || props.value === '') return null;

	let value = Array.isArray(props.value)
		? props.value.map((v) => (isNil(v) || v === '' ? '--' : v)).join(', ')
		: String(props.value);

	if (props.translate && value.startsWith('$t:')) {
		value = t(value.slice(3));
	}

	// Strip out all HTML tags
	value = dompurify.sanitize(value, { ALLOWED_TAGS: [] });

	// Decode any HTML encoded characters (like &copy;)
	value = decode(value);

	if (props.format) {
		if (props.type === 'bigInteger') {
			try {
				value = new Intl.NumberFormat(locale.value).format(BigInt(value));
			} catch {
				// leave as-is if not a valid big integer string
			}
		} else if (props.type === 'float' || props.type === 'decimal') {
			value = n(parseFloat(value));
		} else if (['string', 'text'].includes(props.type)) {
			value = formatTitle(value);
		} else {
			value = n(parseInt(value));
		}
	}

	const prefix = props.prefix ?? '';
	const suffix = props.suffix ?? '';

	return `${prefix}${value}${suffix}`;
});

function matchString(left: string, right: string, operator: string) {
	switch (operator) {
		case 'eq':
			return left === right;
		case 'neq':
			return left !== right;
		case 'contains':
			return left.includes(right);
		case 'starts_with':
			return left.startsWith(right);
		case 'ends_with':
			return left.endsWith(right);
	}

	return;
}

// Backoffice: the two overload signatures (number, bigint) are dropped for eslint no-redeclare; same body.
function matchNumber(left: number | bigint, right: number | bigint, operator: string) {
	switch (operator) {
		case 'eq':
			return left === right;
		case 'neq':
			return left !== right;
		case 'gt':
			return left > right;
		case 'gte':
			return left >= right;
		case 'lt':
			return left < right;
		case 'lte':
			return left <= right;
	}

	return;
}

// Backoffice: the Directus scoped styles as theme classes; the font families of `--theme--fonts--*`.
const FONTS = { 'sans-serif': 'font-outfit', serif: 'font-[serif]', monospace: 'font-[monospace]' };
</script>

<template>
	<ValueNull v-if="displayValue === null || displayValue === undefined" />

	<div
		v-else
		class="display-formatted inline overflow-hidden text-ellipsis"
		:class="[
			FONTS[font],
			{
				'font-bold text-gray-800 dark:text-white/90': bold,
				italic,
				'rounded-full px-2.25 text-[0.8125rem]': computedFormat.background || border,
				'leading-[1.9231]': computedFormat.background && !border,
				'leading-[1.7692]': border,
			},
		]"
		:style="computedStyle"
	>
		<BoIcon
			v-if="computedFormat.icon"
			:name="computedFormat.icon"
			size="sm"
			class="me-1 shrink-0 align-[-0.1875rem]"
			:style="{ color: computedFormat.color }"
		/>

		<span class="value">
			{{ displayValue }}
		</span>
	</div>
</template>
