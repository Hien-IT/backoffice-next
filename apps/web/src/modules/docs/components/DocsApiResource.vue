<script setup lang="ts">
// Backoffice (spec 033, FR-024, Q-50): an API page of the documentation: the description of the resource, the list of
// its endpoints (method and path, each a link to its card), then one card per endpoint.
import { useRouter } from 'vue-router';
import type { DocsApiResource } from '../../../docs/types.ts';
import DocsEndpoint from './DocsEndpoint.vue';
import DocsInlineText from './DocsInlineText.vue';

defineProps<{ resource: DocsApiResource }>();

const router = useRouter();

const LINK =
	'grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg px-3 py-2 no-underline hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-white/[0.03] dark:focus-visible:outline-brand-400';
</script>

<template>
	<div data-docs-api>
		<p v-if="resource.description" class="text-base leading-7 text-gray-700 dark:text-gray-300" :lang="resource.lang">
			<DocsInlineText :text="resource.description" />
		</p>

		<nav
			class="mt-6 rounded-2xl border border-gray-200 p-2 dark:border-gray-800"
			:aria-label="$t('docs_endpoints')"
			data-docs-endpoints
		>
			<ul class="m-0 flex list-none flex-col p-0">
				<li v-for="operation in resource.operations" :key="operation.id">
					<a
						:href="`#${operation.anchor}`"
						:class="LINK"
						@click.prevent="router.replace({ hash: `#${operation.anchor}` })"
					>
						<span class="font-mono text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
							{{ operation.method }}
						</span>
						<span class="min-w-0">
							<code class="block truncate font-mono text-theme-sm text-gray-800 dark:text-white/90">
								{{ operation.path }}
							</code>
							<span class="block truncate text-theme-xs text-gray-500 dark:text-gray-400" :lang="operation.lang">
								{{ operation.summary }}
							</span>
						</span>
					</a>
				</li>
			</ul>
		</nav>

		<DocsEndpoint
			v-for="operation in resource.operations"
			:key="operation.id"
			:operation="operation"
			:schemas="resource.schemas"
		/>
	</div>
</template>
