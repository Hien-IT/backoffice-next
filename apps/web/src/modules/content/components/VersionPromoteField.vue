<!-- Ported from directus/app/src/modules/content/components/version-promote-field.vue -->
<script setup lang="ts">
import BoTextOverflow from '../../../components/BoTextOverflow.vue';
import ValueNull from '../../../components/render/ValueNull.vue';

defineProps<{ value?: string }>();
</script>

<template>
	<BoTextOverflow v-if="value" :text="value" />
	<ValueNull v-else />
</template>
