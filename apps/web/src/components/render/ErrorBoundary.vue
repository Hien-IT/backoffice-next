<!-- Ported from directus/app/src/components/v-error-boundary.vue -->
<script setup lang="ts">
// Backoffice: the source name falls back to the component name of the instance (get-vue-component-name inlined).
import { kebabCase } from 'lodash-es';
import { computed, onErrorCaptured, ref } from 'vue';

interface Props {
	/** Unique name to identify component wrapped by this error boundary */
	name?: string | undefined;
	/** Stops propagating the error to the parent */
	stopPropagation?: boolean | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	name: undefined,
	stopPropagation: true,
});

const error = ref<Error | null>(null);

const hasError = computed(() => !!error.value);

onErrorCaptured((err, vm, info) => {
	error.value = err as Error;
	const source = props.name ? kebabCase(props.name) : (vm?.$options.name ?? vm?.$options.__name ?? 'unknown');
	// eslint-disable-next-line no-console
	console.warn(`[${source}-error] ${info}`);
	// eslint-disable-next-line no-console
	console.warn(err);
	if (props.stopPropagation) return false;

	return;
});
</script>

<template>
	<template v-if="hasError">
		<template v-if="$slots['fallback']">
			<slot name="fallback" v-bind="{ error }" />
		</template>
	</template>
	<slot v-else></slot>
</template>
