<!-- Ported from directus/app/src/views/private/components/comparison/comparison-header.vue -->
<script setup lang="ts">
// Backoffice: no `collab` mode (D-68); the revision picker is a BoMenu, the notice icon a focusable button with a
// tooltip, the skeletons the form skeleton (layout-patterns §8).
import type { User } from '@directus/types';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { localizedFormat } from '../../utils/localized-format.ts';
import { userName } from '../../utils/user-name.ts';
import BoIcon from '../BoIcon.vue';
import BoMenu from '../BoMenu.vue';
import BoTooltip from '../BoTooltip.vue';

interface Props {
	title: string;
	subtitle?: string | undefined;
	mode: 'version' | 'revision';
	dateUpdated: Date | string | null;
	userUpdated: User | null;
	userLoading: boolean;
	showDeltaDropdown?: boolean;
	comparisonData?: any;
	loading?: boolean;
	tooltipMessage?: string | undefined;
}

const { t } = useI18n();

const props = defineProps<Props>();

const emit = defineEmits<{
	(e: 'delta-change', value: string | number): void;
}>();

const userUpdatedName = computed(() => {
	if (!props.userUpdated?.first_name && !props.userUpdated?.last_name && !props.userUpdated?.email) {
		return t('unknown_user');
	}

	return userName(props.userUpdated as any);
});

const formatDateTime = (date: Date) => {
	const dateStr = localizedFormat(date, String(t('date-fns_date_short_no_year')));
	const timeStr = localizedFormat(date, String(t('date-fns_time')));
	return `${dateStr} ${timeStr}`;
};

const formattedDateUpdated = computed(() => {
	if (!props.dateUpdated) return null;
	if (typeof props.dateUpdated === 'string') return props.dateUpdated;
	return formatDateTime(props.dateUpdated);
});

const deltaOptions = computed<{ text: string; value: string | number }[]>(() => {
	if (!props.showDeltaDropdown || !props.comparisonData?.selectableDeltas) return [];

	const deltas = props.comparisonData.selectableDeltas;

	return deltas.map((delta: any) => {
		if (delta.activity?.timestamp) {
			const formattedDate = formatDateTime(new Date(delta.activity.timestamp));
			let user = t('private_user');

			if (typeof delta.activity.user === 'object' && delta.activity.user) {
				user = userName(delta.activity.user);
			}

			return {
				text: `${formattedDate} - ${user}`,
				value: delta.id,
			};
		}

		return {
			text: delta.name || delta.key || `Item ${delta.id}`,
			value: delta.id,
		};
	});
});

const selectedDeltaId = computed(() => {
	if (!props.showDeltaDropdown || !props.comparisonData) return null;
	return props.comparisonData.initialSelectedDeltaId || null;
});

const selectedOption = computed(() => {
	if (!selectedDeltaId.value) return null;
	return deltaOptions.value.find((option) => option.value === selectedDeltaId.value);
});

const selectOptionTime = computed(() => getDeltaOptionTime(selectedOption.value));
const selectOptionUser = computed(() => getDeltaOptionUser(selectedOption.value));

// Backoffice: each option reads "<time> · edited by <user>" in the BoMenu (DR: two lines in a v-list-item).
const menuItems = computed(() =>
	deltaOptions.value.map((option) => ({
		text: `${getDeltaOptionTime(option)} · ${t('edited_by')} ${getDeltaOptionUser(option)}`,
		icon: selectedDeltaId.value === option.value ? 'check' : undefined,
		onSelect: () => emit('delta-change', option.value),
	})),
);

function getDeltaOptionTime(deltaOption: { text: string } | null | undefined) {
	if (!deltaOption) return null;
	return deltaOption.text.split(' - ')[0] || null;
}

function getDeltaOptionUser(deltaOption: { text: string } | null | undefined) {
	if (!deltaOption) return null;
	return deltaOption.text.split(' - ')[1] || null;
}

const SKELETON = 'h-9 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-gray-800';
</script>

<template>
	<div class="flex flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
		<div class="flex min-w-0 items-center gap-2">
			<div v-if="loading" :class="[SKELETON, 'w-28']" />
			<template v-else>
				<h3 class="truncate text-lg font-semibold text-gray-800 dark:text-white/90" :title="title">{{ title }}</h3>
				<BoTooltip v-if="tooltipMessage" :text="tooltipMessage" side="bottom">
					<button
						type="button"
						:aria-label="tooltipMessage"
						class="inline-flex rounded-lg text-gray-500 hover:text-warning-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-warning-500 dark:focus-visible:outline-brand-400"
					>
						<BoIcon name="error" size="sm" />
					</button>
				</BoTooltip>
			</template>
		</div>

		<p v-if="subtitle" class="text-theme-sm font-medium text-gray-500 dark:text-gray-400">{{ subtitle }}</p>

		<div class="shrink-0">
			<div v-if="loading" :class="[SKELETON, 'w-44']" />
			<BoMenu v-else-if="showDeltaDropdown" :items="menuItems" align="end">
				<template #trigger>
					<button
						type="button"
						data-delta-select
						class="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-start hover:border-gray-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:hover:border-gray-600 dark:focus-visible:outline-brand-400"
					>
						<span>
							<span class="block text-theme-sm font-semibold text-gray-800 dark:text-white/90">
								{{ selectOptionTime }}
							</span>
							<span class="block text-theme-xs text-gray-500 dark:text-gray-400">
								{{ $t('edited_by') }} {{ selectOptionUser }}
							</span>
						</span>
						<BoIcon name="expand_more" class="text-gray-500 dark:text-gray-400" />
					</button>
				</template>
			</BoMenu>
			<div v-else class="lg:text-end">
				<p v-if="formattedDateUpdated" class="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
					{{ formattedDateUpdated }}
				</p>
				<p v-if="userUpdatedName" class="text-theme-xs text-gray-500 dark:text-gray-400">
					{{ $t('edited_by') }} {{ userUpdatedName }}
				</p>
				<p v-else-if="userLoading" class="text-theme-xs text-gray-500 dark:text-gray-400">{{ $t('loading') }}</p>
				<p v-else class="text-theme-xs text-gray-500 dark:text-gray-400">
					{{ $t('edited_by') }} {{ $t('unknown_user') }}
				</p>
			</div>
		</div>
	</div>
</template>
