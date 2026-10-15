<!-- Ported from directus/app/src/layouts/calendar/calendar.vue -->
<script setup lang="ts">
// Backoffice: BoNotice (Alert warning, recipe Q-4) instead of v-notice; the `.fc` look comes from ./calendar.css
// (FullCalendar variables on the theme tokens, light/dark, reduced motion: FR-110c) instead of the global
// styles/lib/_fullcalendar.scss; FullCalendar itself is imported by `createCalendar` (index.ts), not here. Keyboard path
// of the event drag (D-69, contracts/layouts.md §5): the dates are edited in the item form, no extra UI here. The
// toolbar icons FullCalendar renders as unnamed `<span role="img">` get `aria-hidden` (the button `title` names the
// button; axe role-img-alt, FR-123).
import type { ShowSelect } from '@directus/types';
import { useMutationObserver, useResizeObserver } from '@vueuse/core';
import { debounce } from 'lodash-es';
import { computed, onMounted, onUnmounted, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import BoNotice from '../../components/BoNotice.vue';
import './calendar.css';

defineOptions({
	name: 'LayoutCalendar',
	inheritAttrs: false,
});

interface Props {
	createCalendar: (calendarElement: HTMLElement) => void | Promise<void>;
	destroyCalendar: () => void;
	itemCount?: number | null | undefined;
	totalCount: number | null;
	isFiltered: boolean;
	limit: number;
	resetPresetAndRefresh: () => Promise<void>;
	error?: any;
	selectMode: boolean;
	showSelect?: ShowSelect | undefined;
	resize: () => void;
}

const props = withDefaults(defineProps<Props>(), {
	itemCount: undefined,
	error: undefined,
	showSelect: 'none',
});

defineEmits(['update:selection']);

const { n } = useI18n();

const calendarElement = useTemplateRef('calendar-element');

onMounted(() => {
	if (calendarElement.value) void props.createCalendar(calendarElement.value);
});

onUnmounted(() => {
	props.destroyCalendar();
});

useResizeObserver(
	calendarElement,
	debounce(() => props.resize(), 50),
);

useMutationObserver(
	calendarElement,
	() => {
		for (const icon of calendarElement.value?.querySelectorAll('.fc-icon[role="img"]:not([aria-hidden])') ?? []) {
			icon.setAttribute('aria-hidden', 'true');
		}
	},
	{ childList: true, subtree: true },
);

const atLimit = computed(() => {
	const count = (props.isFiltered ? props.itemCount : props.totalCount) ?? 0;
	return count > props.limit;
});
</script>

<template>
	<div
		class="bo-calendar flex h-full min-h-0 flex-col gap-5"
		:class="{ 'select-mode': selectMode, 'select-one': showSelect === 'one' }"
	>
		<BoNotice v-if="atLimit" type="warning">
			{{ $t('dataset_too_large_currently_showing_n_items', { n: n(props.limit) }) }}
		</BoNotice>
		<div v-if="!error" ref="calendar-element" class="min-h-0 flex-1" />
		<slot v-else name="error" :error="error" :reset="resetPresetAndRefresh" />
	</div>
</template>
