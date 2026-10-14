<script setup lang="ts">
// Temporary route component until the route's real screen lands (tasks Phase 3+). Shows the route name only.
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
	<main id="main-content" class="p-eh-6 text-eh-text-primary" :data-route="String(route.name ?? route.path)" />
</template>
