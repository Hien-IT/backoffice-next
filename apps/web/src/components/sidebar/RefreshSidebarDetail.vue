<!-- Ported from directus/app/src/views/private/components/refresh-sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice: BoSelect with its label instead of `.type-label` + v-select (recipe Q-9); BoSelect values are strings,
// so the intervals go through String/Number and "do not refresh" is the `none` item value (Reka Select items cannot
// have an empty value).
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { emitter, Events } from '../../events.ts';
import BoSelect from '../BoSelect.vue';
import SidebarDetail from './SidebarDetail.vue';

const model = defineModel<number | null>({ required: true });

const emit = defineEmits<{
	refresh: [];
}>();

const { t } = useI18n();

const active = computed(() => !!model.value && model.value > 0);
const interval = ref<ReturnType<typeof setInterval>>();

const setRefreshInterval = (value: number | null) => {
	clearInterval(interval.value);

	if (!value || value <= 0) return;

	interval.value = setInterval(() => {
		emit('refresh');
	}, value * 1000);
};

const onIdle = () => clearInterval(interval.value);

const onActive = () => {
	if (active.value) emit('refresh');
	setRefreshInterval(model.value);
};

emitter.on(Events.tabIdle, onIdle);
emitter.on(Events.tabActive, onActive);

onUnmounted(() => {
	clearInterval(interval.value);
	emitter.off(Events.tabIdle, onIdle);
	emitter.off(Events.tabActive, onActive);
});

watch(model, (value) => setRefreshInterval(value), { immediate: true });

const items = computed(() => {
	const intervals = [null, 10, 30, 60, 300];

	return intervals.map((seconds) => {
		if (seconds === null) {
			return {
				text: t('no_refresh'),
				value: 'none',
			};
		}

		return seconds >= 60 && seconds % 60 === 0
			? {
					text: t('refresh_interval_minutes', { minutes: seconds / 60 }, seconds / 60),
					value: String(seconds),
				}
			: {
					text: t('refresh_interval_seconds', { seconds }, seconds),
					value: String(seconds),
				};
	});
});
</script>

<template>
	<SidebarDetail id="refresh" :icon="active ? 'sync' : 'sync_disabled'" :title="$t('auto_refresh')" :badge="active">
		<BoSelect
			:model-value="model ? String(model) : 'none'"
			:label="$t('refresh_interval')"
			:items="items"
			@update:model-value="model = $event === 'none' ? null : Number($event)"
		/>
	</SidebarDetail>
</template>
