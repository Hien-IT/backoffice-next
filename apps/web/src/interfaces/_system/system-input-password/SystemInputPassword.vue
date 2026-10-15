<!-- Ported from directus/app/src/interfaces/_system/system-input-password/input-password.vue -->
<script setup lang="ts">
// Backoffice: VInput is ../../input/InputField.vue (port of v-input.vue, ids from FormField); the eye icon is a named
// button with a tooltip instead of a clickable icon.
import { ref } from 'vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoTooltip from '../../../components/BoTooltip.vue';
import InputField from '../../input/InputField.vue';

defineOptions({ inheritAttrs: false });

withDefaults(
	defineProps<{
		value?: string | null;
		autofocus?: boolean;
		autocomplete?: string | null;
		placeholder?: string;
		disabled?: boolean;
	}>(),
	{
		value: null,
		autofocus: false,
		autocomplete: 'new-password',
		disabled: false,
	},
);

const emit = defineEmits<{
	input: [value: string | null];
}>();

const hidden = ref<boolean>(true);

function toggleHidePassword() {
	hidden.value = !hidden.value;
}

const ICON_BTN =
	'inline-flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<InputField
		:model-value="value"
		:type="hidden ? 'password' : 'text'"
		:autocomplete="autocomplete ?? undefined"
		:autofocus="autofocus"
		:placeholder="placeholder ?? $t('password')"
		:disabled="disabled"
		@update:model-value="emit('input', $event)"
	>
		<template #append>
			<BoTooltip :text="hidden ? $t('show_password') : $t('hide_password')">
				<button
					type="button"
					:class="ICON_BTN"
					:aria-label="hidden ? $t('show_password') : $t('hide_password')"
					@click="toggleHidePassword"
				>
					<BoIcon :name="hidden ? 'visibility' : 'visibility_off'" />
				</button>
			</BoTooltip>
		</template>
	</InputField>
</template>
