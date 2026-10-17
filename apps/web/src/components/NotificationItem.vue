<!-- Ported from directus/app/src/views/private/components/notifications-drawer.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-071, FR-072, FR-074, recipe Q-39): one row of the notifications list (the VListItem of
// notifications-drawer.vue:356-394; Directus notification-item.vue is the snackbar, not ported, FR-080). Differences:
// the subject and time toggle the message, the checkbox does not (Directus lets the checkbox click bubble to the
// header and toggle it too); expand is a button with `aria-expanded`; the search highlight is v-highlight folded in
// (diacritics removed per character with String.normalize instead of the `diacritics` package); the relative time is
// computed when the row renders (UseDatetime refreshes it every minute; the drawer is not refreshed while open, FR-071).
import { computed, useId } from 'vue';
import { formatDate } from '../utils/format-date.ts';
import { md } from '../utils/markdown.ts';
import BoCheckbox from './BoCheckbox.vue';
import BoIcon from './BoIcon.vue';

export interface LocalNotification {
	id: string | number;
	subject: string;
	message: string | null;
	collection: string | null;
	item: string | null;
	timestamp: string;
	/** Target of the open button (FR-072), none when undefined */
	to?: string | undefined;
}

const props = defineProps<{
	notification: LocalNotification;
	selected: boolean;
	open: boolean;
	search?: string | null | undefined;
	dense?: boolean | undefined;
}>();

defineEmits<{ select: []; toggle: []; navigate: [to: string] }>();

const messageId = useId();

// One output character per input code unit, so the indices of the normalized text are those of the subject.
const normalize = (text: string) =>
	text
		.split('')
		.map((char) => char.normalize('NFD').replace(/\p{M}/gu, '')[0] ?? char)
		.join('')
		.toLowerCase();

// v-highlight: every occurrence of the query, overlapping matches merged.
const parts = computed(() => {
	const text = props.notification.subject ?? '';
	const query = props.search ? normalize(props.search) : '';
	if (!query) return [{ text, highlighted: false }];

	const haystack = normalize(text);
	const result: { text: string; highlighted: boolean }[] = [];
	let last = 0;
	let index = haystack.indexOf(query);

	while (index > -1) {
		const start = Math.max(index, last);
		if (start > last) result.push({ text: text.slice(last, start), highlighted: false });
		if (index + query.length > start) result.push({ text: text.slice(start, index + query.length), highlighted: true });
		last = Math.max(last, index + query.length);
		index = haystack.indexOf(query, index + 1);
	}

	if (last < text.length) result.push({ text: text.slice(last), highlighted: false });
	return result;
});

const datetime = computed(() =>
	formatDate(props.notification.timestamp, {
		type: 'timestamp',
		format: 'long',
		relative: true,
		strict: false,
		round: 'round',
		suffix: true,
	}),
);

// The message is sanitized by md() (marked + DOMPurify, FR-074).
const html = computed(() => (props.notification.message ? md(props.notification.message) : ''));

const ICON_BTN =
	'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<li class="border-b border-gray-100 dark:border-gray-800" :class="dense ? 'py-2' : 'py-3'" data-notification>
		<div class="flex items-center gap-3">
			<BoCheckbox
				:model-value="selected"
				:aria-label="$t('select_item_key', { item: notification.subject })"
				@update:model-value="$emit('select')"
			/>
			<div
				class="flex min-w-0 flex-1 items-center gap-3"
				:class="{ 'cursor-pointer': notification.message }"
				@click="notification.message && $emit('toggle')"
			>
				<span class="min-w-0 flex-1 truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
					<template v-for="(part, index) in parts" :key="index">
						<mark v-if="part.highlighted" class="bg-warning-50 text-inherit dark:bg-warning-500/15">
							{{ part.text }}
						</mark>
						<template v-else>{{ part.text }}</template>
					</template>
				</span>
				<time :datetime="notification.timestamp" class="shrink-0 text-theme-xs text-gray-500 dark:text-gray-400">
					{{ datetime }}
				</time>
			</div>
			<button
				v-if="notification.to"
				type="button"
				:class="ICON_BTN"
				:aria-label="$t('goto_collection_content')"
				:title="$t('goto_collection_content')"
				@click="$emit('navigate', notification.to)"
			>
				<BoIcon name="open_in_new" size="sm" />
			</button>
			<button
				v-if="notification.message"
				type="button"
				:class="ICON_BTN"
				:aria-label="open ? $t('collapse') : $t('expand')"
				:aria-expanded="open"
				:aria-controls="messageId"
				@click="$emit('toggle')"
			>
				<BoIcon :name="open ? 'expand_less' : 'expand_more'" size="sm" />
			</button>
		</div>
		<!-- sanitized by md() (DOMPurify, FR-074) -->
		<!-- eslint-disable vue/no-v-html -->
		<div
			v-if="open && notification.message"
			:id="messageId"
			class="mt-2 ps-8 text-theme-sm wrap-break-word text-gray-700 dark:text-gray-300 [&_a]:text-brand-500 [&_a]:underline [&_a:hover]:text-brand-600 dark:[&_a]:text-brand-400 [&_p:not(:last-child)]:mb-2"
			v-html="html"
		/>
		<!-- eslint-enable vue/no-v-html -->
	</li>
</template>
