<!-- Ported from directus/app/src/components/v-date-picker/v-date-picker.vue -->
<script setup lang="ts">
import { isDynamicVariable, parseNow } from '@directus/utils';
import {
	CalendarDate,
	CalendarDateTime,
	DateFormatter,
	type DateValue,
	parseAbsoluteToLocal,
	parseDate,
	parseDateTime,
	parseTime,
	Time,
	ZonedDateTime,
} from '@internationalized/date';
import {
	CalendarCell,
	CalendarCellTrigger,
	CalendarGrid,
	CalendarGridBody,
	CalendarGridHead,
	CalendarGridRow,
	CalendarHeadCell,
	CalendarHeader,
	CalendarHeading,
	CalendarNext,
	CalendarPrev,
	CalendarRoot,
	TimeFieldInput,
	TimeFieldRoot,
} from 'reka-ui';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '../stores/user.ts';
import { formatDatePickerModelValue } from '../utils/format-date-picker-model-value.ts';
import BoButton from './BoButton.vue';
import BoIcon from './BoIcon.vue';
import BoInput from './BoInput.vue';
import BoSelect from './BoSelect.vue';

type TimeValue = Time | CalendarDateTime | ZonedDateTime;

interface Props {
	type: 'date' | 'time' | 'dateTime' | 'timestamp';
	modelValue?: string | null | undefined;
	disabled?: boolean;
	includeSeconds?: boolean;
	use24?: boolean;
	/** Backoffice: the time zone the caller edits a timestamp in (datetime `tz`), named in the footer. */
	timezone?: string | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: undefined,
	timezone: undefined,
	disabled: false,
	includeSeconds: false,
	use24: true,
});

const emit = defineEmits<{
	'update:modelValue': [value: string | null];
	close: [];
}>();

const { t } = useI18n();

// Internal state using @internationalized/date types
const calendarValue = ref<DateValue | undefined>();

const userStore = useUserStore();

const isRTL = computed(() => userStore.textDirection === 'rtl');

// Computed props for Reka UI
// We set undefined instead of 12 to avoid the default value of 12:00 PM goes 0:00 PM
// Backoffice: bound as an object, exactOptionalPropertyTypes does not accept an explicit undefined.
const hourCycle = computed(() => (props.use24 ? { hourCycle: 24 as const } : {}));
const granularity = computed(() => (props.includeSeconds ? 'second' : 'minute'));
const showCalendar = computed(() => props.type !== 'time');
const hasTime = computed(() => ['time', 'dateTime', 'timestamp'].includes(props.type));

// Backoffice: DatePicker recipe, timestamps are edited in the browser time zone (or the caller's `timezone`); the
// footer names it.
const timeZone = computed(() => props.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);

/**
 * Default time (12:00) when the picker supports time.
 *
 * Why 12:00:
 * - It’s a neutral default (avoids implicit "start of day" midnight)
 * - Prevents emitting `00:00:00` unless the user explicitly selects it
 */
function getDefaultTimeValue(): Time {
	return new Time(12, 0, 0);
}

/**
 * Internal time value state.
 * Initialized with a default time (12:00) when the picker type supports time.
 */
const internalTimeValue = ref<Time | CalendarDateTime | ZonedDateTime | null | undefined>(
	['time', 'dateTime', 'timestamp'].includes(props.type) ? getDefaultTimeValue() : undefined,
);

/**
 * Computed property that provides proper type compatibility for the TimeFieldRoot component.
 * This works around nominal typing issues with @internationalized/date classes that have private fields.
 */
const timeValue = computed<TimeValue | null | undefined>({
	get() {
		return internalTimeValue.value as TimeValue | null | undefined;
	},
	set(value: TimeValue | null | undefined) {
		internalTimeValue.value = value;
	},
});

const monthFormatter = computed(() => {
	// Use 'long' for “January”, 'short' for “Jan”, 'narrow' for “J”
	// timeZone: 'UTC' ensures the month name matches the UTC date created by `toDate('UTC')` below,
	// preventing off-by-one month labels in negative-UTC-offset timezones.
	return new DateFormatter(userStore.language, { month: 'long', timeZone: 'UTC' });
});

const monthOptions = computed(() => {
	return Array.from({ length: 12 }, (_, index) => {
		const value = index + 1;
		const date = new CalendarDate(new Date().getFullYear(), value, 1);

		return {
			// Backoffice: BoSelect values are strings; handleMonthChange gets the number back.
			value: String(value),
			text: monthFormatter.value.format(date.toDate('UTC')),
		};
	});
});

watch(
	() => props.modelValue,
	(newValue) => {
		if (!newValue) {
			calendarValue.value = undefined;

			// Reset time to a sensible default when the picker supports time.
			internalTimeValue.value = hasTime.value ? getDefaultTimeValue() : undefined;

			return;
		}

		// Resolve $NOW variables to a selection.
		// Other dynamic variable paths (e.g. $CURRENT_USER.date_created) can't be displayed in the picker, so leave it in the default empty state.
		if (isDynamicVariable(newValue)) {
			if (newValue.startsWith('$NOW')) {
				const dt = parseNow(newValue);

				if (props.type !== 'time') {
					calendarValue.value = new CalendarDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
				}

				if (hasTime.value) {
					internalTimeValue.value = new Time(dt.getHours(), dt.getMinutes(), dt.getSeconds());
				}
			}

			return;
		}

		// Parse based on type
		switch (props.type) {
			case 'date':
				calendarValue.value = parseDate(newValue);
				break;
			case 'time':
				internalTimeValue.value = parseTime(newValue);
				break;

			case 'dateTime': {
				// Matches legacy Flatpickr format: "yyyy-MM-dd'T'HH:mm:ss"
				const dt = parseDateTime(newValue);
				calendarValue.value = new CalendarDate(dt.year, dt.month, dt.day);
				internalTimeValue.value = new Time(dt.hour, dt.minute, dt.second);
				break;
			}

			case 'timestamp': {
				// Matches legacy Flatpickr format: Date.toISOString() (absolute timestamp)
				const dt = parseAbsoluteToLocal(newValue);
				calendarValue.value = new CalendarDate(dt.year, dt.month, dt.day);
				internalTimeValue.value = new Time(dt.hour, dt.minute, dt.second);
				break;
			}
		}
	},
	{ immediate: true },
);

// Data binding to the model value and emitting the value to the parent component

function emitValue(): void {
	const value = formatDatePickerModelValue(props.type, {
		calendarValue: calendarValue.value,
		timeValue: internalTimeValue.value,
		includeSeconds: props.includeSeconds,
	});

	emit('update:modelValue', value);
}

function handleDateChange(value: DateValue | undefined) {
	calendarValue.value = value;
	emitValue();

	if (props.type === 'date') {
		emit('close');
	}
}

/**
 * Handle time field changes and emit the updated value.
 * Reka UI's TimeFieldRoot emits TimeValue which is Time | CalendarDateTime | ZonedDateTime.
 *
 * @param value - The new time value from the TimeFieldRoot component
 */
function handleTimeChange(value: TimeValue | undefined) {
	internalTimeValue.value = value ?? null;
	emitValue();
}

function setCalendarMonth(month: number): void {
	const now = new Date();
	const base = calendarValue.value ?? new CalendarDate(now.getFullYear(), now.getMonth() + 1, 1);
	const year = base.year;
	const day = Math.min(base.day, new Date(year, month, 0).getDate());

	// Note: This changes the selected date (not just the view month).
	// If later we decide to decouple “view month” from “selected date”, we can introduce separate state.
	calendarValue.value = new CalendarDate(year, month, day);
	emitValue();
}

function setCalendarYear(year: number): void {
	const now = new Date();
	const base = calendarValue.value ?? new CalendarDate(now.getFullYear(), now.getMonth() + 1, 1);
	const month = base.month;
	const day = Math.min(base.day, new Date(year, month, 0).getDate());

	// Note: This changes the selected date (not just the view year).
	calendarValue.value = new CalendarDate(year, month, day);
	emitValue();
}

function handleMonthChange(value: number | string | null): void {
	// Backoffice: BoSelect emits the string value.
	const numValue = value === null ? null : Number(value);
	if (numValue === null || numValue < 1 || numValue > 12) return;
	setCalendarMonth(numValue);
}

function handleYearChange(value: number | string | undefined): void {
	const numValue = typeof value === 'string' ? Number.parseInt(value, 10) : value;
	if (numValue === undefined || !Number.isFinite(numValue) || numValue < 1) return;
	setCalendarYear(numValue);
}

/**
 * Sets the picker to the current date and time.
 * If the picker supports time, also sets the current time value.
 */
function setToNow() {
	const now = new Date();
	calendarValue.value = new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());

	// If the picker supports time, also set the current time
	if (hasTime.value) {
		internalTimeValue.value = new Time(now.getHours(), now.getMinutes(), now.getSeconds());
	}

	emitValue();
	emit('close');
}

// component-specs ICON_BTN and DatePicker recipe.
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ICON_BTN = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 ${FOCUS}`;
const CELL = `flex h-9 w-9 items-center justify-center rounded-lg text-theme-sm text-gray-700 outline-hidden hover:bg-gray-100 ${FOCUS} data-[today]:font-semibold data-[today]:text-brand-600 data-[today]:underline data-[today]:underline-offset-4 data-[selected]:bg-brand-500 data-[selected]:text-white data-[outside-view]:text-gray-500 data-[unavailable]:line-through data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 dark:text-gray-300 dark:hover:bg-white/5 dark:data-[today]:text-brand-400 dark:data-[selected]:text-white dark:data-[outside-view]:text-gray-400 dark:data-[disabled]:text-white/15`;
</script>

<template>
	<div class="bo-date-picker w-auto">
		<!-- Backoffice: initial-focus puts the focus on the selected day (else today) when the picker opens, as the APG
		date picker dialog; the popover focused the "Previous" button before (T094). -->
		<CalendarRoot
			v-slot="{ weekDays, grid, date }"
			:model-value="calendarValue"
			:disabled="disabled"
			:locale="userStore.language"
			fixed-weeks
			initial-focus
			weekday-format="short"
			:dir="isRTL ? 'rtl' : 'ltr'"
			@update:model-value="handleDateChange"
		>
			<CalendarHeader v-if="showCalendar" class="mb-2 flex items-center justify-between gap-2">
				<CalendarPrev :class="ICON_BTN" :aria-label="t('previous')">
					<BoIcon name="chevron_left" size="sm" />
				</CalendarPrev>
				<CalendarHeading class="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-white/90">
					<!-- The visible month and year are the controls; their labels are for screen readers. -->
					<BoSelect
						:model-value="date?.month === undefined ? null : String(date.month)"
						:items="monthOptions"
						:label="t('month')"
						:disabled="disabled"
						class="w-36 [&>label]:sr-only"
						@update:model-value="handleMonthChange"
					/>
					<div class="w-24">
						<BoInput
							type="number"
							:model-value="date?.year"
							:aria-label="t('year')"
							:disabled="disabled"
							inputmode="numeric"
							@update:model-value="handleYearChange"
						/>
					</div>
				</CalendarHeading>
				<CalendarNext :class="ICON_BTN" :aria-label="t('next')">
					<BoIcon name="chevron_right" size="sm" />
				</CalendarNext>
			</CalendarHeader>
			<div class="flex flex-col">
				<template v-if="showCalendar">
					<CalendarGrid v-for="month in grid" :key="month.value.toString()" class="w-full border-collapse select-none">
						<CalendarGridHead>
							<CalendarGridRow class="grid grid-cols-7">
								<CalendarHeadCell
									v-for="day in weekDays"
									:key="day"
									class="h-8 w-9 text-theme-xs font-medium text-gray-500 dark:text-gray-400"
								>
									{{ day }}
								</CalendarHeadCell>
							</CalendarGridRow>
						</CalendarGridHead>
						<CalendarGridBody>
							<CalendarGridRow
								v-for="(weekDates, index) in month.rows"
								:key="`weekDate-${index}`"
								class="grid grid-cols-7"
							>
								<CalendarCell v-for="weekDate in weekDates" :key="weekDate.toString()" :date="weekDate">
									<CalendarCellTrigger :day="weekDate" :month="month.value" :class="CELL" />
								</CalendarCell>
							</CalendarGridRow>
						</CalendarGridBody>
					</CalendarGrid>
				</template>
				<div v-if="hasTime" class="time-picker">
					<TimeFieldRoot
						v-slot="{ segments }"
						:model-value="timeValue ?? null"
						:granularity
						v-bind="hourCycle"
						:locale="userStore.language"
						:disabled="disabled"
						:dir="isRTL ? 'rtl' : 'ltr'"
						class="mt-3 flex h-11 items-center gap-0.5 rounded-lg border border-gray-500 px-4 text-sm text-gray-800 shadow-theme-xs focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-500 dark:bg-gray-900 dark:text-white/90 dark:focus-within:border-brand-400"
						@update:model-value="handleTimeChange"
					>
						<template v-for="item in segments" :key="item.part">
							<TimeFieldInput v-if="item.part === 'literal'" :part="item.part" class="text-gray-500 dark:text-gray-400">
								{{ item.value }}
							</TimeFieldInput>
							<TimeFieldInput
								v-else
								:part="item.part"
								class="rounded px-0.5 tabular-nums outline-hidden focus:bg-brand-50 focus:text-brand-600 data-[placeholder]:text-gray-500 dark:focus:bg-brand-500/15 dark:focus:text-brand-400 dark:data-[placeholder]:text-gray-400"
							>
								{{ item.value }}
							</TimeFieldInput>
						</template>
					</TimeFieldRoot>
				</div>
				<div class="mt-3 flex items-center justify-between gap-2">
					<BoButton variant="secondary" class="calendar-today-button" :disabled @click="setToNow">
						{{ t('set_to_now') }}
					</BoButton>
					<span v-if="type === 'timestamp'" class="time-zone text-theme-xs text-gray-500 dark:text-gray-400">
						{{ timeZone }}
					</span>
				</div>
			</div>
		</CalendarRoot>
	</div>
</template>
