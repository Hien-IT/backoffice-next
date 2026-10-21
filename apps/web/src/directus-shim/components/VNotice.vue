<!-- Ported from directus/app/src/components/v-notice.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): v-notice on BoNotice. `icon` true or null = the icon of the type, false hides it;
// the title slot is the heading line. `multiline` and `indentContent` are accepted: BoNotice always wraps and puts the
// text beside the icon (the indented look).
import BoNotice from '../../components/BoNotice.vue';

withDefaults(
	defineProps<{
		/** Renders the components in each of it styles */
		type?: 'info' | 'success' | 'warning' | 'danger';
		/** Custom icon name, or false if you want to hide the icon completely */
		icon?: string | boolean | null;
		/** Render notice content centered */
		center?: boolean;
		/** Allow text wrapping within notice */
		multiline?: boolean;
		/** Align the default slot’s content with the title slot’s content */
		indentContent?: boolean;
	}>(),
	{ icon: null, type: 'info', center: false, multiline: false },
);
</script>

<template>
	<BoNotice
		class="v-notice"
		:type="type"
		:icon="icon === false ? false : typeof icon === 'string' ? icon : null"
		:center="center"
	>
		<template v-if="$slots['title']" #title><slot name="title" /></template>
		<slot />
	</BoNotice>
</template>
