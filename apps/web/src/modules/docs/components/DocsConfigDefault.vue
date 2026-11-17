<script setup lang="ts">
// Backoffice (spec 033, FR-031): the default of a variable in the configuration tables. A list default may wrap after
// its commas, nowhere else.
defineProps<{ value?: string | undefined }>();
</script>

<template>
	<code v-if="value" class="docs-inline-code">
		<template v-for="(piece, i) in value.split(',')" :key="i">
			<template v-if="i > 0">
				,
				<wbr />
			</template>
			{{ piece }}
		</template>
	</code>
</template>
