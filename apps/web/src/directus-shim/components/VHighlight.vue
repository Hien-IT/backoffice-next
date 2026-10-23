<!-- Ported from directus/app/src/components/v-highlight.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): new, the DR logic; diacritics removed per character with
// String.normalize instead of the `diacritics` package (as NotificationItem.vue), so the indices stay those of `text`;
// the mark uses the search highlight colors of NotificationItem.
import { toArray } from '@directus/utils';
import { computed } from 'vue';

type HighlightPart = {
	text: string;
	highlighted: boolean;
};

const props = withDefaults(
	defineProps<{
		query?: string | string[] | null;
		text?: string;
	}>(),
	{
		query: null,
		text: '',
	},
);

const removeDiacritics = (text: string) =>
	text
		.split('')
		.map((char) => char.normalize('NFD').replace(/\p{M}/gu, '')[0] ?? char)
		.join('');

const parts = computed<HighlightPart[]>(() => {
	const normalizedText = removeDiacritics(props.text).toLowerCase();

	const queries = toArray(props.query);

	const matches: [number, number][] = [];

	for (const query of queries) {
		if (!query) continue;

		const normalizedQuery = removeDiacritics(query).toLowerCase();

		let index = normalizedText.indexOf(normalizedQuery);

		while (index > -1) {
			matches.push([index, index + normalizedQuery.length]);
			index = normalizedText.indexOf(normalizedQuery, index + 1);
		}
	}

	if (matches.length === 0) return [{ highlighted: false, text: props.text }];

	matches.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

	const mergedMatches: [number, number][] = [];
	let [curStart, curEnd] = matches.shift()!;

	for (const [start, end] of matches) {
		if (start >= curEnd) {
			mergedMatches.push([curStart, curEnd]);
			curStart = start;
			curEnd = end;
		} else if (end > curEnd) {
			curEnd = end;
		}
	}

	mergedMatches.push([curStart, curEnd]);

	let lastEnd = 0;

	const parts: HighlightPart[] = [];

	for (const [start, end] of mergedMatches) {
		if (lastEnd !== start) parts.push({ highlighted: false, text: props.text.slice(lastEnd, start) });
		parts.push({ highlighted: true, text: props.text.slice(start, end) });
		lastEnd = end;
	}

	if (lastEnd !== normalizedText.length) parts.push({ highlighted: false, text: props.text.slice(lastEnd) });

	return parts;
});
</script>

<template>
	<span class="v-highlight">
		<template v-for="(part, index) in parts" :key="index">
			<mark v-if="part.highlighted" class="rounded-xs bg-warning-50 text-inherit dark:bg-warning-500/15">
				{{ part.text }}
			</mark>
			<template v-else>{{ part.text }}</template>
		</template>
	</span>
</template>
