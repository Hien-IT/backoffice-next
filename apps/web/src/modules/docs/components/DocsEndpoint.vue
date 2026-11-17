<script setup lang="ts">
// Backoffice (spec 033, FR-024..FR-027, Q-50): one endpoint of an API page, a card. Head: the summary (`h2` with its
// anchor), the method chip with its name and the path. Body: description, path and query parameters, request body,
// responses (the structure of the success answer in a closed BoDetail), then the REST / GraphQL examples and the
// response example; from `2xl` the examples sit in a second column. Text from the static API description is English
// (`lang="en"`, FR-038, FR-039); the supplement is Vietnamese.
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import BoDetail from '../../../components/BoDetail.vue';
import BoTabs from '../../../components/BoTabs.vue';
import type { DocsApiOperation, DocsApiParameter, JsonSchema } from '../../../docs/types.ts';
import { useCopy } from '../copy.ts';
import DocsCodeBlock from './DocsCodeBlock.vue';
import DocsInlineText from './DocsInlineText.vue';

const { operation, schemas } = defineProps<{ operation: DocsApiOperation; schemas: Record<string, JsonSchema> }>();

const { t } = useI18n();
const router = useRouter();
const { announced, copy } = useCopy();

interface Row {
	name: string;
	type: string;
	required: boolean;
	description: string;
	lang: 'en' | 'vi';
}

// Badge "light" recipe of component-specs: the method is written, colour is not the only cue.
const METHOD_CLASS: Record<string, string> = {
	GET: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400',
	POST: 'bg-blue-light-50 text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-400',
	PATCH: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400',
	PUT: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400',
	DELETE: 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400',
};
const LIGHT = 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80';

const refName = (schema: JsonSchema) =>
	typeof schema['$ref'] === 'string' ? (schema['$ref'] as string).replace('#/schemas/', '') : null;

/** A schema with its own reference followed (one level). */
function deref(schema: JsonSchema | undefined): JsonSchema | undefined {
	const name = schema ? refName(schema) : null;
	return name ? (schemas[name] ?? schema) : schema;
}

/** The type shown for a schema: its reference name, `X[]` for a list, `A | B` for a choice. */
function typeOf(schema: JsonSchema | undefined): string {
	if (!schema) return '';
	const name = refName(schema);
	if (name) return name;
	const choice = (schema['oneOf'] ?? schema['anyOf']) as JsonSchema[] | undefined;
	if (choice) return choice.map(typeOf).join(' | ');
	if (schema['type'] === 'array') return `${typeOf(schema['items'] as JsonSchema) || 'string'}[]`;
	return (schema['type'] as string | undefined) ?? (schema['format'] === 'binary' ? 'file' : 'object');
}

/** The properties of a schema as rows; the language of a supplement schema is Vietnamese. */
function rowsOf(schema: JsonSchema | undefined): Row[] {
	const target = deref(schema);
	const properties = target?.['properties'] as Record<string, JsonSchema> | undefined;
	if (!target || !properties) return [];

	const required = new Set((target['required'] as string[] | undefined) ?? []);
	const lang = target['x-lang'] === 'vi' ? 'vi' : 'en';

	return Object.entries(properties).map(([name, value]) => ({
		name,
		type: typeOf(value),
		required: required.has(name),
		description: (value['description'] as string | undefined) ?? '',
		lang,
	}));
}

const paramRows = (params: DocsApiParameter[]): Row[] => params.map((param) => ({ ...param }));

const bodyRows = computed(() => {
	const schema = deref(operation.body?.schema);
	if (schema?.['type'] === 'array') return [];
	return rowsOf(schema);
});

const bodyType = computed(() => (operation.body ? typeOf(operation.body.schema) : ''));

/** The success answer: the item (or items) under `data`, else the whole object. */
const success = computed(() => {
	const response = operation.responses.find((candidate) => /^2/.test(candidate.status) && candidate.schema);
	if (!response?.schema) return null;

	const top = deref(response.schema);
	const data = (top?.['properties'] as Record<string, JsonSchema> | undefined)?.['data'];
	const inner = data ? (data['type'] === 'array' ? (data['items'] as JsonSchema) : data) : top;

	return { type: data ? typeOf(data) : typeOf(response.schema), rows: rowsOf(inner) };
});

const examples = computed(() => [
	{ value: 'rest', label: 'REST', code: operation.rest, language: 'bash' },
	...(operation.graphql ? [{ value: 'graphql', label: 'GraphQL', code: operation.graphql, language: 'graphql' }] : []),
]);
const tab = ref('rest');

const responseExample = computed(() =>
	operation.responseExample === undefined ? null : JSON.stringify(operation.responseExample, null, 2),
);

const accessText = computed(() => (operation.access ? t(`docs_access_${operation.access}`) : null));

function copyLink() {
	void copy(new URL(`#${operation.anchor}`, window.location.href).toString());
	void router.replace({ hash: `#${operation.anchor}` });
}

const H3 = 'mt-6 text-theme-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';
const CELL = 'px-4 py-3 align-top';
</script>

<template>
	<section
		class="mt-8 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
		:aria-labelledby="operation.anchor"
		:data-operation="operation.id"
	>
		<h2
			:id="operation.anchor"
			tabindex="-1"
			class="group scroll-mt-24 text-theme-xl font-semibold text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-white/90 dark:focus-visible:outline-brand-400"
			:lang="operation.lang"
		>
			{{ operation.summary }}
			<a
				:href="`#${operation.anchor}`"
				class="docs-anchor"
				:aria-label="`${$t('docs_copy_link')}: ${operation.summary}`"
				@click.prevent="copyLink"
			>
				#
			</a>
		</h2>
		<span class="sr-only" aria-live="polite">{{ announced }}</span>

		<p class="mt-3 flex flex-wrap items-center gap-2">
			<span
				class="inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-theme-xs font-semibold"
				:class="METHOD_CLASS[operation.method] ?? LIGHT"
				data-method
			>
				{{ operation.method }}
			</span>
			<code class="docs-inline-code" data-path>{{ operation.path }}</code>
		</p>

		<p
			v-if="operation.backofficeOnly || accessText"
			class="mt-2 text-theme-sm text-gray-500 dark:text-gray-400"
			data-access
		>
			<template v-if="operation.backofficeOnly">{{ $t('docs_backoffice_only') }}</template>
			<template v-if="operation.backofficeOnly && accessText">{{ ' ' }}</template>
			<template v-if="accessText">{{ accessText }}.</template>
			<template v-if="operation.accessNote">
				<span lang="vi">{{ operation.accessNote }}</span>
			</template>
		</p>

		<div class="2xl:grid 2xl:grid-cols-2 2xl:gap-6">
			<div class="min-w-0">
				<p
					v-if="operation.description"
					class="mt-4 text-base leading-7 whitespace-pre-line text-gray-700 dark:text-gray-300"
					:lang="operation.lang"
				>
					<DocsInlineText :text="operation.description.trim()" />
				</p>

				<template
					v-for="group in [
						{ key: 'path', title: $t('docs_path_parameters'), rows: paramRows(operation.pathParams) },
						{ key: 'query', title: $t('docs_query_parameters'), rows: paramRows(operation.query) },
					]"
					:key="group.key"
				>
					<template v-if="group.rows.length">
						<h3 :class="H3">{{ group.title }}</h3>
						<div class="docs-table" role="region" tabindex="0" :aria-label="group.title">
							<table>
								<caption class="sr-only">{{ group.title }}</caption>
								<thead>
									<tr>
										<th scope="col">{{ $t('docs_name') }}</th>
										<th scope="col">{{ $t('docs_type') }}</th>
										<th scope="col">{{ $t('docs_description') }}</th>
									</tr>
								</thead>
								<tbody>
									<tr v-for="row in group.rows" :key="row.name">
										<td :class="CELL">
											<code class="docs-inline-code">{{ row.name }}</code>
											<span v-if="row.required" class="ms-1 text-theme-xs text-error-600 dark:text-error-400">
												{{ $t('docs_required') }}
											</span>
										</td>
										<td :class="CELL">
											<code class="docs-inline-code">{{ row.type }}</code>
										</td>
										<td :class="CELL" :lang="row.lang"><DocsInlineText :text="row.description" /></td>
									</tr>
								</tbody>
							</table>
						</div>
					</template>
				</template>

				<template v-if="operation.body">
					<h3 :class="H3">{{ $t('docs_request_body') }}</h3>
					<p class="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
						<code class="docs-inline-code">{{ operation.body.contentType }}</code>
						<template v-if="bodyType">
							·
							<code class="docs-inline-code">{{ bodyType }}</code>
						</template>
					</p>
					<div
						v-if="bodyRows.length"
						class="docs-table"
						role="region"
						tabindex="0"
						:aria-label="$t('docs_request_body')"
					>
						<table>
							<caption class="sr-only">{{ $t('docs_request_body') }}</caption>
							<thead>
								<tr>
									<th scope="col">{{ $t('docs_name') }}</th>
									<th scope="col">{{ $t('docs_type') }}</th>
									<th scope="col">{{ $t('docs_description') }}</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="row in bodyRows" :key="row.name">
									<td :class="CELL">
										<code class="docs-inline-code">{{ row.name }}</code>
										<span v-if="row.required" class="ms-1 text-theme-xs text-error-600 dark:text-error-400">
											{{ $t('docs_required') }}
										</span>
									</td>
									<td :class="CELL">
										<code class="docs-inline-code">{{ row.type }}</code>
									</td>
									<td :class="CELL" :lang="row.lang"><DocsInlineText :text="row.description" /></td>
								</tr>
							</tbody>
						</table>
					</div>
				</template>

				<h3 :class="H3">{{ $t('docs_responses') }}</h3>
				<ul class="mt-2 flex flex-col gap-1 p-0" data-responses>
					<li v-for="response in operation.responses" :key="response.status" class="flex list-none gap-3 text-theme-sm">
						<code class="docs-inline-code shrink-0">{{ response.status }}</code>
						<span class="text-gray-700 dark:text-gray-300" :lang="operation.lang">{{ response.description }}</span>
					</li>
				</ul>

				<BoDetail
					v-if="success && success.rows.length"
					class="mt-4"
					:title="`${$t('docs_response_structure')}: ${success.type}`"
				>
					<div class="docs-table" role="region" tabindex="0" :aria-label="$t('docs_response_structure')">
						<table>
							<caption class="sr-only">{{ $t('docs_response_structure') }}</caption>
							<thead>
								<tr>
									<th scope="col">{{ $t('docs_name') }}</th>
									<th scope="col">{{ $t('docs_type') }}</th>
									<th scope="col">{{ $t('docs_description') }}</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="row in success.rows" :key="row.name">
									<td :class="CELL">
										<code class="docs-inline-code">{{ row.name }}</code>
									</td>
									<td :class="CELL">
										<code class="docs-inline-code">{{ row.type }}</code>
									</td>
									<td :class="CELL" :lang="row.lang"><DocsInlineText :text="row.description" /></td>
								</tr>
							</tbody>
						</table>
					</div>
				</BoDetail>
			</div>

			<div class="min-w-0 2xl:sticky 2xl:top-24 2xl:self-start">
				<h3 :class="H3">{{ $t('docs_examples') }}</h3>
				<BoTabs v-if="examples.length > 1" v-model="tab" :items="examples" :label="$t('docs_examples')">
					<template #content="{ item }">
						<DocsCodeBlock
							:code="examples.find((example) => example.value === item.value)!.code"
							:language="examples.find((example) => example.value === item.value)!.language"
						/>
					</template>
				</BoTabs>
				<DocsCodeBlock v-else :code="operation.rest" language="bash" />

				<template v-if="responseExample">
					<h3 :class="H3">{{ $t('docs_response_example') }}</h3>
					<DocsCodeBlock :code="responseExample" language="json" />
				</template>
			</div>
		</div>
	</section>
</template>
