<!-- Ported from directus/app/src/components/v-info.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): v-info on BoInfo; `center` places it in the middle of the positioned parent as
// v-info `.center`.
import BoInfo from '../../components/BoInfo.vue';

withDefaults(
	defineProps<{
		/** The title to display in the info */
		title: string;
		/** What icon to render above the title */
		icon?: string | false;
		/** Styling of the info */
		type?: 'info' | 'success' | 'warning' | 'danger' | 'primary';
		/** Displays the info centered */
		center?: boolean;
	}>(),
	{ icon: false, type: 'info', center: false },
);
</script>

<template>
	<BoInfo
		class="v-info"
		:title="title"
		:icon="icon"
		:type="type"
		:class="{ 'absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2': center }"
	>
		<template v-if="$slots['default']" #default><slot /></template>
		<template v-if="$slots['append']" #append><slot name="append" /></template>
	</BoInfo>
</template>
