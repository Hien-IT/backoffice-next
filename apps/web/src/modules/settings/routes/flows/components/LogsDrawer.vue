<!-- Ported from directus/app/src/modules/settings/routes/flows/components/logs-drawer.vue -->
<script setup lang="ts">
// Backoffice (spec 017 FR-052, recipe Q-32): BoDrawer (not persistent), an ordered list of steps with a status dot
// (default and resolve brand, reject orange), BoDetail sections with the JSON in <pre> (Vue prints objects as JSON with
// two spaces, as DR); every value is plain text; redacted values show as stored.
import type { FlowRaw } from '@directus/types';
import { computed, toRefs, unref } from 'vue';
import BoDetail from '../../../../../components/BoDetail.vue';
import BoDrawer from '../../../../../components/drawers/BoDrawer.vue';
import { getOperation } from '../../../../../operations/index.ts';
import type { RevisionWithTime } from '../../../../../types/revisions.ts';
import { translate } from '../../../../../utils/translate-object-values.ts';
import { getTriggers } from '../triggers.ts';

const props = defineProps<{
	flow: FlowRaw;
	revision: (RevisionWithTime & { data?: Record<string, any> | null }) | null;
}>();

const { flow, revision } = toRefs(props);

const emit = defineEmits<{ close: [] }>();

const { triggers } = getTriggers();

const usedTrigger = computed(() => {
	return triggers.find((trigger) => trigger.id === unref(flow).trigger);
});

const triggerData = computed(() => {
	if (!unref(revision)?.data) return { trigger: null, accountability: null, options: null };

	const { data } = unref(revision)?.data as any;

	return {
		trigger: data?.$trigger,
		accountability: data?.$accountability,
		options: flow.value.options,
	};
});

const steps = computed(() => {
	if (!revision.value || !(unref(revision)?.data as any)?.steps) return [];
	const { steps } = revision.value.data as any;

	return steps.map(
		({
			operation,
			status,
			key,
			options,
		}: {
			operation: string;
			status: 'reject' | 'resolve' | 'unknown';
			key: string;
			options: Record<string, any>;
		}) => {
			const operationConfiguration = props.flow.operations.find((operationConfig) => operationConfig.id === operation);

			const operationType = getOperation(operationConfiguration?.type);
			return {
				id: operation,
				name: operationConfiguration?.name ?? key,
				data: (unref(revision)?.data as any)?.data?.[key] ?? null,
				options: options ?? null,
				operationType: operationType ? translate(operationType.name) : (operationConfiguration?.type ?? '--'),
				key,
				status,
			};
		},
	);
});

const DOT = {
	resolve: 'bg-brand-500',
	reject: 'bg-orange-500',
};

const PRE =
	'm-0 overflow-x-auto rounded-lg bg-gray-50 p-3 font-mono text-theme-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300';
</script>

<template>
	<BoDrawer
		:model-value="!!revision"
		:title="revision ? revision.timestampFormatted : $t('logs')"
		icon="fact_check"
		@cancel="emit('close')"
		@update:model-value="!$event && emit('close')"
	>
		<ol class="m-0 flex list-none flex-col gap-6 p-6" data-flow-log-steps>
			<li class="relative border-s border-gray-200 ps-6 dark:border-gray-800">
				<span class="absolute -start-1.5 top-1.5 size-3 rounded-full bg-brand-500" aria-hidden="true" />
				<p class="m-0 text-theme-sm font-medium text-gray-800 dark:text-white/90">
					{{ $t('trigger') }}
					<span class="font-normal text-gray-500 dark:text-gray-400">&nbsp;{{ usedTrigger?.name }}</span>
				</p>

				<div class="mt-2 flex flex-col gap-2">
					<BoDetail v-if="triggerData.options" :title="$t('options')">
						<pre :class="PRE">{{ triggerData.options }}</pre>
					</BoDetail>

					<BoDetail v-if="triggerData.trigger" :title="$t('payload')">
						<pre :class="PRE">{{ triggerData.trigger }}</pre>
					</BoDetail>

					<BoDetail v-if="triggerData.accountability" :title="$t('accountability')">
						<pre :class="PRE">{{ triggerData.accountability }}</pre>
					</BoDetail>
				</div>
			</li>

			<li
				v-for="step of steps"
				:key="step.id"
				class="relative border-s border-gray-200 ps-6 dark:border-gray-800"
				:data-step="step.key"
				:data-status="step.status"
			>
				<span
					class="absolute -start-1.5 top-1.5 size-3 rounded-full"
					:class="DOT[step.status as 'resolve' | 'reject'] ?? 'bg-brand-500'"
					aria-hidden="true"
				/>
				<p class="m-0 text-theme-sm font-medium text-gray-800 dark:text-white/90" :title="step.key">
					{{ step.name }}
					<span class="font-normal text-gray-500 dark:text-gray-400">&nbsp;{{ step.operationType }}</span>
					<span class="sr-only">({{ step.status }})</span>
				</p>

				<div class="mt-2 flex flex-col gap-2">
					<BoDetail v-if="step.options" :title="$t('options')">
						<pre :class="PRE">{{ step.options }}</pre>
					</BoDetail>

					<BoDetail v-if="step.data !== null" :title="$t('payload')">
						<pre :class="PRE">{{ step.data }}</pre>
					</BoDetail>
				</div>
			</li>
		</ol>
	</BoDrawer>
</template>
