<!-- Ported from directus/app/src/components/v-icon/v-icon.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): wraps BoIcon (Material Symbols, the Directus custom SVG and social icons,
// `filled`, `data-icon`); the size comes from `--v-icon-size` (Directus sizes) and the color from `--v-icon-color`
// like Directus. Deviation: a clickable icon without aria-label is named after the icon (Directus has no name).
import { computed } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import { useUserStore } from '../../stores/user.ts';

const props = withDefaults(
	defineProps<{
		name: string;
		filled?: boolean;
		sup?: boolean;
		left?: boolean;
		right?: boolean;
		disabled?: boolean;
		clickable?: boolean;
		color?: string | undefined;
		xSmall?: boolean;
		small?: boolean;
		large?: boolean;
		xLarge?: boolean;
	}>(),
	{
		filled: false,
		sup: false,
		left: false,
		right: false,
		disabled: false,
		clickable: false,
		color: undefined,
	},
);

const emit = defineEmits(['click']);

const userStore = useUserStore();

// directus/app/src/constants/text-direction.ts
const RTL_REVERSE_ICONS = [
	'arrow_back',
	'arrow_back_ios',
	'arrow_forward',
	'arrow_forward_ios',
	'arrow_left',
	'arrow_right',
	'assignment',
	'assignment_return',
	'backspace',
	'battery_unknown',
	'call_made',
	'call_merge',
	'call_missed',
	'call_missed_outgoing',
	'call_received',
	'call_split',
	'chevron_left',
	'chevron_right',
	'chrome_reader_mode',
	'device_unknown',
	'dvr',
	'event_note',
	'featured_play_list',
	'featured_video',
	'first_page',
	'flight_land',
	'flight_takeoff',
	'format_indent_decrease',
	'format_indent_increase',
	'format_list_bulleted',
	'forward',
	'functions',
	'input',
	'keyboard_tab',
	'label',
	'label_important',
	'label_outline',
	'last_page',
	'launch',
	'left_panel_close',
	'left_panel_open',
	'list',
	'live_help',
	'mobile_screen_share',
	'multiline_chart',
	'navigate_before',
	'navigate_next',
	'next_week',
	'note',
	'open_in_new',
	'playlist_add',
	'queue_music',
	'redo',
	'reply',
	'reply_all',
	'right_panel_close',
	'right_panel_open',
	'screen_share',
	'send',
	'short_text',
	'show_chart',
	'sort',
	'star_half',
	'subject',
	'trending_flat',
	'toc',
	'trending_down',
	'trending_up',
	'undo',
	'view_list',
	'view_quilt',
	'wrap_text',
];

// Directus .sup, .x-small, .small, .large, .x-large; unset, an inherited --v-icon-size or 1.375rem applies.
const size = computed(() => {
	if (props.sup) return '0.4375rem';
	if (props.xSmall) return '0.6875rem';
	if (props.small) return '1rem';
	if (props.large) return '2rem';
	if (props.xLarge) return '2.6875rem';
	return undefined;
});

const mirrored = computed(() => userStore.textDirection === 'rtl' && RTL_REVERSE_ICONS.includes(props.name));

function emitClick(event: MouseEvent) {
	if (props.disabled) return;
	emit('click', event);
}
</script>

<template>
	<component
		:is="clickable ? 'button' : 'span'"
		:type="clickable ? 'button' : undefined"
		class="relative inline-flex size-[var(--v-icon-size,1.375rem)] min-w-[var(--v-icon-size,1.375rem)] shrink-0 items-center justify-center text-(color:--v-icon-color)"
		:class="[
			sup ? 'align-[0.3125rem]' : 'align-middle',
			{
				'cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:outline-brand-400':
					clickable,
				'me-1.75': left && !small,
				'me-1': left && small,
				'ms-1.25': right && !small,
				'ms-1': right && small,
			},
		]"
		:disabled="clickable ? disabled : undefined"
		:aria-label="clickable ? ($attrs['aria-label'] ?? name.replace(/_/g, ' ')) : undefined"
		:style="{ '--v-icon-color': color, '--v-icon-size': size }"
		@click="emitClick"
	>
		<BoIcon
			v-if="name"
			:name
			:filled
			:class="{ '-scale-x-100': mirrored }"
			:style="{ fontSize: 'var(--v-icon-size, 1.375rem)' }"
		/>
	</component>
</template>
