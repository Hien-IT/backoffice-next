<!-- Ported from directus/app/src/interfaces/datetime/datetime.vue; Ported from directus/app/src/components/use-datetime.vue (formatting) -->
<script setup lang="ts">
// Backoffice: DatePicker recipe (component-specs Tier 3): a trigger button showing the formatted value opens BoDatePicker
// in a Reka popover (Directus v-menu + v-list-item); the formatting of directus/app/src/components/use-datetime.vue is
// inlined below. The trigger is named by the field label and the value (FORM_FIELD_A11Y, FR-094).
import { isValid, parseISO } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { computed, inject, onMounted, onUnmounted, ref, useId, watch } from 'vue';
import BoDatePicker from '../../components/BoDatePicker.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoTooltip from '../../components/BoTooltip.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { formatDate, type FormatDateOptions } from '../../utils/format-date.ts';
import { parseDate } from '../../utils/parse-date.ts';

interface Props extends Omit<FormatDateOptions, 'tz'> {
	value: string | null;
	disabled?: boolean;
	nonEditable?: boolean;
	tz?: string | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	use24: true,
	format: 'long',
	relative: false,
	strict: false,
	round: 'round',
	suffix: true,
	tz: undefined,
});

defineOptions({ name: 'InterfaceDatetime' });

const emit = defineEmits<{
	(e: 'input', value: string | null): void;
}>();

const a11y = inject(FORM_FIELD_A11Y, null);
const valueId = useId();

const menuActive = ref(false);

const isValidValue = computed(() => (props.value ? isValid(parseDate(props.value, props.type)) : false));

function unsetValue(e: Event) {
	e.preventDefault();
	e.stopPropagation();
	emit('input', null);
}

function closeDatePicker() {
	menuActive.value = false;
}

// Computed property for date-picker value with timezone conversion
const tzValue = computed({
	get() {
		if (props.type === 'timestamp' && props.tz && props.value) {
			const date = parseISO(props.value);
			if (!isValid(date)) return null;
			return toZonedTime(date, props.tz).toISOString();
		}

		return props.value;
	},
	set(value: string | null) {
		if (!value) {
			emit('input', null);
			return;
		}

		const date = parseISO(value);

		if (isValid(date) && props.type === 'timestamp' && props.tz) {
			emit('input', fromZonedTime(date, props.tz).toISOString());
			return;
		}

		emit('input', value);
	},
});

// use-datetime.vue: formatted value, refreshed every minute when relative.
const displayValue = ref<string | null>(null);

watch(
	() => props.value,
	(newValue) => {
		displayValue.value = isValidValue.value ? formatDate(newValue!, props as FormatDateOptions) : null;
	},
	{ immediate: true },
);

let refreshInterval: number | null = null;

onMounted(() => {
	if (!props.relative) return;

	refreshInterval = window.setInterval(() => {
		if (isValidValue.value) displayValue.value = formatDate(props.value!, props as FormatDateOptions);
	}, 60_000);
});

onUnmounted(() => {
	if (refreshInterval) clearInterval(refreshInterval);
});

// component-specs FIELD / FIELD_DISABLED / FOCUS / ICON_BTN, POPOVER.
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const FIELD = `flex h-11 w-full items-center gap-2 rounded-lg border bg-transparent px-4 pe-20 text-start text-sm text-gray-800 shadow-theme-xs focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03] ${FOCUS}`;
const FIELD_VALID =
	'border-gray-300 focus:border-brand-500 focus:ring-brand-500/10 data-[state=open]:border-brand-500 data-[state=open]:ring-3 data-[state=open]:ring-brand-500/10 dark:border-gray-700 dark:focus:border-brand-400 dark:data-[state=open]:border-brand-400';
const FIELD_INVALID =
	'border-error-600 focus:border-error-600 focus:ring-error-500/10 dark:border-error-400 dark:focus:border-error-400';
const ICON_BTN = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 ${FOCUS}`;
</script>

<template>
	<PopoverRoot v-model:open="menuActive">
		<div class="interface-datetime relative">
			<!-- as-child: the button keeps the form input id so the field label points at it. -->
			<PopoverTrigger as-child>
				<button
					:id="a11y?.inputId"
					type="button"
					class="datetime-trigger"
					:class="[FIELD, a11y?.invalid ? FIELD_INVALID : FIELD_VALID]"
					:disabled="disabled"
					:aria-labelledby="a11y ? `${a11y.labelId} ${valueId}` : undefined"
					:aria-describedby="a11y?.describedBy"
					:aria-invalid="a11y?.invalid ? 'true' : undefined"
				>
					<span :id="valueId" class="min-w-0 truncate">{{ displayValue }}</span>
				</button>
			</PopoverTrigger>

			<div v-if="!nonEditable" class="item-actions absolute end-1.5 top-1/2 flex -translate-y-1/2 items-center">
				<BoTooltip v-if="tz" :text="tz">
					<span class="timezone-icon inline-flex h-8 w-8 items-center justify-center text-gray-500 dark:text-gray-400">
						<BoIcon name="schedule" size="sm" :label="tz" />
					</span>
				</BoTooltip>
				<button
					v-if="value"
					type="button"
					class="clear-icon"
					:class="ICON_BTN"
					:disabled="disabled"
					:aria-label="$t('clear_value')"
					@click="unsetValue($event)"
				>
					<BoIcon name="close" size="sm" />
				</button>
				<span
					v-else
					class="today-icon pointer-events-none inline-flex h-8 w-8 items-center justify-center"
					:class="disabled ? 'text-gray-300 dark:text-white/15' : 'text-gray-500 dark:text-gray-400'"
				>
					<BoIcon name="today" size="sm" />
				</span>
			</div>
		</div>

		<PopoverPortal>
			<PopoverContent
				:side-offset="4"
				align="start"
				:collision-padding="8"
				class="z-99999 max-h-(--reka-popover-content-available-height) w-auto overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark"
			>
				<BoDatePicker
					:type="type"
					:disabled="!!disabled"
					:include-seconds="!!includeSeconds"
					:use24="use24"
					:timezone="type === 'timestamp' ? tz : undefined"
					:model-value="tzValue"
					@update:model-value="tzValue = $event"
					@close="closeDatePicker"
				/>
			</PopoverContent>
		</PopoverPortal>
	</PopoverRoot>
</template>
