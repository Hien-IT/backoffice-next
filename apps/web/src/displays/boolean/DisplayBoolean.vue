<!-- Ported from directus/app/src/displays/boolean/boolean.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import ValueNull from '../../components/render/ValueNull.vue';

const props = withDefaults(
	defineProps<{
		value?: boolean | null;
		labelOn?: string | null;
		labelOff?: string | null;
		iconOn?: string | null;
		iconOff?: string | null;
		colorOn?: string;
		colorOff?: string;
	}>(),
	{
		value: null,
		labelOn: null,
		labelOff: null,
		iconOn: 'check',
		iconOff: 'close',
		// Backoffice: theme tokens stand in for `--theme--primary` and `--theme--foreground-subdued`.
		colorOn: 'var(--color-brand-500)',
		colorOff: 'var(--color-gray-500)',
	},
);

const styles = computed(() => {
	const style: Record<string, any> = {};

	if (props.colorOn !== null && props.colorOff !== null) {
		// Backoffice: BoIcon takes the text color, so `--v-icon-color` is not needed.
		style['color'] = props.value ? props.colorOn : props.colorOff;
	}

	return style;
});
</script>

<template>
	<div class="boolean inline-flex items-center" :style="styles">
		<ValueNull v-if="value === null" />
		<template v-else>
			<BoIcon v-if="iconOn !== null && iconOff !== null" :name="value ? iconOn : iconOff" class="me-1" />
			<span v-if="labelOn !== null && labelOff !== null">{{ value ? labelOn : labelOff }}</span>
		</template>
	</div>
</template>
