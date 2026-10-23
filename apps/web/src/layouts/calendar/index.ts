// Ported from directus/app/src/layouts/calendar/index.ts
// Backoffice: no `useAiToolsStore().onSystemToolResult` refresh (D-70, no AI tools); `useSync` of @directus/composables
// is a local writable computed (same get/emit); the component, its slots and FullCalendar load lazily (the layout
// registry imports every index.ts eagerly, SC-012), so `createCalendar` awaits the FullCalendar modules before
// `new Calendar` and the plugins come from that import; `calendar` is a shallowRef (no deep proxy of the Calendar
// instance); `api.patch` is `sdk.request(requestEndpoint(..., PATCH))`; the event lookup compares the keys as strings
// (DR `==` against the string event id); `dragRevertDuration` is 0 under `prefers-reduced-motion` (FR-110c: the
// global `transition-duration: 0s` of styles/base.css would otherwise keep the reverting drag mirror waiting for a
// `transitionend` that never fires).
import type { Field, Item } from '@directus/types';
import { getEndpoint, getFieldsFromTemplate, mergeFilters } from '@directus/utils';
import type {
	Calendar,
	CssDimValue,
	EventInput,
	CalendarOptions as FullCalendarOptions,
	PluginDef,
} from '@fullcalendar/core';
import type { EventImpl } from '@fullcalendar/core/internal';
import { format, formatISO, isValid, parse } from 'date-fns';
import { useMediaQuery } from '@vueuse/core';
import { computed, defineAsyncComponent, ref, shallowRef, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import { useCollection } from '../../composables/use-collection.ts';
import { useItems } from '../../composables/use-items.ts';
import { useLayoutClickHandler } from '../../composables/use-layout-click-handler.ts';
import { useServerStore } from '../../stores/server.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import { formatItemsCountRelative } from '../../utils/format-items-count.ts';
import { getFullcalendarLocale } from '../../utils/get-fullcalendar-locale.ts';
import { renderDisplayStringTemplate } from '../../utils/render-string-template.ts';
import { saveAsCSV } from '../../utils/save-as-csv.ts';
import { syncRefProperty } from '../../utils/sync-ref-property.ts';
import { unexpectedError } from '../../utils/unexpected-error.ts';
import { defineLayout, type LayoutContext, type LayoutProps } from '../types.ts';
import type { LayoutOptions } from './types.ts';

let fullCalendar: Promise<[typeof import('@fullcalendar/core'), PluginDef[]]> | undefined;

/** FullCalendar and the four plugins of DR, imported once on the first calendar. */
function loadFullCalendar() {
	fullCalendar ??= Promise.all([
		import('@fullcalendar/core'),
		import('@fullcalendar/daygrid'),
		import('@fullcalendar/timegrid'),
		import('@fullcalendar/list'),
		import('@fullcalendar/interaction'),
	]).then(([core, ...plugins]) => [core, plugins.map((plugin) => plugin.default)]);

	return fullCalendar;
}

function useSync<K extends 'selection' | 'layoutOptions'>(
	props: LayoutProps<LayoutOptions>,
	key: K,
	emit: LayoutContext['emit'],
) {
	return computed<LayoutProps<LayoutOptions>[K]>({
		get: () => props[key],
		set: (value) => emit(`update:${key}`, value),
	});
}

export default defineLayout<LayoutOptions>({
	id: 'calendar',
	name: '$t:layouts.calendar.calendar',
	icon: 'event',
	component: defineAsyncComponent(() => import('./Calendar.vue')),
	slots: {
		options: defineAsyncComponent(() => import('./CalendarOptions.vue')),
		sidebar: () => undefined,
		actions: defineAsyncComponent(() => import('./CalendarActions.vue')),
	},
	setup(props, { emit }) {
		const { info } = useServerStore();

		const { t, n, locale } = useI18n();

		const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

		const calendar = shallowRef<Calendar>();
		const plugins = shallowRef<PluginDef[]>([]);

		const selection = useSync(props, 'selection', emit);
		const layoutOptions = useSync(props, 'layoutOptions', emit);

		const { collection, search, filterSystem, selectMode, showSelect } = toRefs(props);

		const { primaryKeyField, fields: fieldsInCollection } = useCollection(collection);

		const { onClick } = useLayoutClickHandler({ props, selection, primaryKeyField });

		const dateFields = computed(() =>
			fieldsInCollection.value.filter((field: Field) => {
				return ['timestamp', 'dateTime', 'date'].includes(field.type);
			}),
		);

		const calendarFilter = computed(() => {
			if (!calendar.value || !startDateField.value) {
				return null;
			}

			// Subscribe to 'view' updates to get latest start/end dates
			void viewInfo.value;

			const start = formatISO(calendar.value.view.activeStart);
			const end = formatISO(calendar.value.view.activeEnd);
			const startsHere = { [startDateField.value]: { _between: [start, end] } };

			if (!endDateField.value) {
				return startsHere;
			}

			const endsHere = { [endDateField.value]: { _between: [start, end] } };
			const startsBefore = { [startDateField.value]: { _lte: start } };
			const endsAfter = { [endDateField.value]: { _gte: end } };
			const overlapsHere = { _and: [startsBefore, endsAfter] };
			return { _or: [startsHere, endsHere, overlapsHere] };
		});

		const filterWithCalendarView = computed(() => mergeFilters(props.filter, calendarFilter.value));

		const template = syncRefProperty(layoutOptions, 'template', undefined);
		const viewInfo = syncRefProperty(layoutOptions, 'viewInfo', undefined);

		const startDateField = syncRefProperty(layoutOptions, 'startDateField', undefined);

		const startDateFieldInfo = computed(() => {
			return fieldsInCollection.value.find((field: Field) => field.field === startDateField.value);
		});

		const endDateField = syncRefProperty(layoutOptions, 'endDateField', undefined);

		const endDateFieldInfo = computed(() => {
			return fieldsInCollection.value.find((field: Field) => field.field === endDateField.value);
		});

		const firstDay = syncRefProperty(layoutOptions, 'firstDay', undefined);

		const queryFields = computed(() => {
			if (!primaryKeyField.value) return [];

			const fields = [primaryKeyField.value.field];
			if (template.value) fields.push(...getFieldsFromTemplate(template.value));
			if (startDateField.value) fields.push(startDateField.value);
			if (endDateField.value) fields.push(endDateField.value);

			return [...fields, ...adjustFieldsForDisplays(fields, collection.value!)];
		});

		const limit = computed(() => (info.queryLimit?.max && info.queryLimit.max !== -1 ? info.queryLimit.max : 1000));

		const {
			items,
			loading,
			error,
			totalPages,
			itemCount,
			totalCount,
			changeManualSort,
			getItems,
			getItemCount,
			getTotalCount,
		} = useItems(collection, {
			sort: computed(() => [primaryKeyField.value?.field || '']),
			page: ref(1),
			limit,
			fields: queryFields,
			filter: filterWithCalendarView,
			search: search,
			filterSystem,
		});

		const events = computed<EventInput[]>(
			() => items.value.map((item: Item) => parseEvent(item)).filter((e): e is EventInput => e !== null) || [],
		);

		const fullFullCalendarOptions = computed<FullCalendarOptions>(() => {
			const displayEventTime = startDateFieldInfo.value?.type !== 'date';

			const options: FullCalendarOptions = {
				editable: true,
				eventStartEditable: true,
				eventResizableFromStart: true,
				eventDurationEditable: true,
				dayMaxEventRows: true,
				height: (props.layoutProps['height'] ?? '100%') as CssDimValue,
				firstDay: firstDay.value ?? 0,
				nextDayThreshold: '01:00:00',
				dragRevertDuration: reducedMotion.value ? 0 : 500,
				plugins: plugins.value,
				initialView: viewInfo.value?.type ?? 'dayGridMonth',
				headerToolbar: {
					left: 'prevYear,prev,next,nextYear today',
					center: 'title',
					right: 'dayGridMonth,dayGridWeek,dayGridDay,listWeek',
				},
				views: {
					dayGridMonth: {
						displayEventTime,
						eventTimeFormat: {
							hour: 'numeric',
							minute: '2-digit',
							meridiem: 'narrow',
						},
					},
					week: { displayEventTime },
					day: { displayEventTime },
				},
				events: events.value,
				initialDate: viewInfo.value?.startDateStr ?? formatISO(new Date()),
				eventClick(info) {
					if (!collection.value) return;

					const item = items.value.find((item) => String(item[primaryKeyField.value!.field]) === info.event.id);

					if (item) {
						onClick({ item, event: info.jsEvent });
						updateCalendar();
					}
				},
				async eventChange(info) {
					if (!collection.value || !startDateField.value || !startDateFieldInfo.value) return;

					const itemChanges: Partial<Item> = {
						[startDateField.value]: adjustDateTimeType(info.event.startStr, startDateFieldInfo.value.type),
					};

					if (endDateField.value && endDateFieldInfo.value && info.event.endStr) {
						const endDateStr = info.event.allDay ? adjustDateType(info.event) : info.event.endStr;
						itemChanges[endDateField.value] = adjustDateTimeType(endDateStr, endDateFieldInfo.value.type);
					}

					const endpoint = getEndpoint(collection.value);

					try {
						await sdk.request(requestEndpoint(`${endpoint}/${info.event.id}`, { method: 'PATCH', body: itemChanges }));
					} catch (error) {
						unexpectedError(error);
						info.revert();
					}
				},
			};

			if (startDateFieldInfo.value?.type === 'dateTime' || startDateFieldInfo.value?.type === 'timestamp') {
				options.headerToolbar = {
					...options.headerToolbar,
					right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
				};
			}

			return options;
		});

		watch(fullFullCalendarOptions, () => updateCalendar(), { deep: true, immediate: true });

		watch(
			[calendar, locale],
			async () => {
				if (calendar.value) {
					const calendarLocale = await getFullcalendarLocale(locale.value);

					if (calendarLocale) {
						calendar.value.setOption('locale', calendarLocale);
					}
				}
			},
			{ immediate: true },
		);

		const showingCount = computed(() => {
			if (totalCount.value === null || itemCount.value === null) return;

			// Return total count if no start date field is selected
			if (!startDateField.value) return t('item_count', { count: n(totalCount.value) }, totalCount.value);

			return formatItemsCountRelative({
				totalItems: totalCount.value,
				currentItems: itemCount.value,
				isFiltered: !!props.filterUser,
				i18n: { t, n },
			});
		});

		const isFiltered = computed(() => !!props.filterUser || !!props.search);

		const resize = () => calendar.value?.updateSize();

		return {
			items,
			loading,
			error,
			selectMode,
			showSelect,
			totalPages,
			itemCount,
			totalCount,
			isFiltered,
			limit,
			changeManualSort,
			getItems,
			filterWithCalendarView,
			template,
			dateFields,
			startDateField,
			endDateField,
			firstDay,
			showingCount,
			createCalendar,
			destroyCalendar,
			resetPresetAndRefresh,
			refresh,
			download,
			resize,
		};

		async function resetPresetAndRefresh() {
			await props?.resetPreset?.();
			refresh();
		}

		function refresh() {
			getItems();
			getTotalCount();
			getItemCount();
		}

		function download() {
			if (!collection.value) return;

			saveAsCSV(collection.value, queryFields.value, items.value);
		}

		function updateCalendar() {
			if (!calendar.value) return;

			calendar.value.pauseRendering();
			calendar.value.resetOptions(fullFullCalendarOptions.value);
			calendar.value.resumeRendering();
			calendar.value.render();
		}

		async function createCalendar(calendarElement: HTMLElement) {
			const [{ Calendar }, loadedPlugins] = await loadFullCalendar();

			// Backoffice: the layout may be gone (or switched) while FullCalendar loads.
			if (!calendarElement.isConnected) return;

			plugins.value = loadedPlugins;
			calendar.value = new Calendar(calendarElement, fullFullCalendarOptions.value);
			calendar.value.render();

			calendar.value.on('datesSet', (args) => {
				viewInfo.value = {
					type: args.view.type,
					startDateStr: formatISO(args.view.currentStart),
				};
			});
		}

		function destroyCalendar() {
			calendar.value?.destroy();
		}

		function parseEvent(item: Item): EventInput | null {
			if (!startDateField.value || !primaryKeyField.value) return null;

			let endDate: string | undefined = undefined;

			// If the end date is a date-field (so no time), we can safely assume the item is meant to
			// last all day
			const allDay = endDateFieldInfo.value && endDateFieldInfo.value.type === 'date';

			if (endDateField.value && item[endDateField.value]) {
				const date = parse(item[endDateField.value], 'yyyy-MM-dd', new Date());

				if (allDay && isValid(date)) {
					// FullCalendar uses exclusive end moments, so we'll have to increment the end date by 1 to get the
					// expected result in the calendar
					date.setDate(date.getDate() + 1);
					endDate = format(date, 'yyyy-MM-dd');
				} else {
					endDate = item[endDateField.value];
				}
			}

			const primaryKey = item[primaryKeyField.value.field];

			return {
				id: primaryKey,
				title:
					renderDisplayStringTemplate(
						collection.value!,
						template.value || `{{ ${primaryKeyField.value.field} }}`,
						item,
					) || item[primaryKeyField.value.field],
				start: item[startDateField.value],
				end: endDate,
				allDay,
				className: selection.value.includes(primaryKey) ? 'selected' : undefined,
			} as EventInput;
		}

		function adjustDateTimeType(dateString: string, type: string) {
			if (type === 'dateTime') {
				return dateString.substring(0, 19);
			}

			return dateString;
		}

		function adjustDateType(event: EventImpl) {
			if (!event.end) return event.endStr;
			// because we add a day for the "Date" type rendering we need to
			// remove that extra day here before saving the updated value
			const date = event.end;
			date.setDate(date.getDate() - 1);
			return format(date, 'yyyy-MM-dd');
		}
	},
});
