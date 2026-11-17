<script setup lang="ts">
// Backoffice (spec 033, FR-030..FR-033, Q-50): the tables of one group of environment variables. Names, descriptions
// and notes are hand-written (docs/configuration/variables.ts) and shown as text (FR-046), with `code` spans for the
// parts in backticks; the default comes from the generated list, so it is the one the API uses.
import BoNotice from '../../../components/BoNotice.vue';
import type { ConfigTable, DocsHeading } from '../../../docs/types.ts';
import { useDocsLang } from '../use-docs-lang.ts';
import DocsInlineText from './DocsInlineText.vue';

const { tables, headings, defaults } = defineProps<{
	tables: ConfigTable[];
	/** One per titled table, in order: the anchors (DocsRoute builds them, the "On this page" column shows them). */
	headings: DocsHeading[];
	/** Pattern → default of supported.generated.json. */
	defaults: Record<string, string | undefined>;
}>();

const { lang } = useDocsLang();

const titled = () => tables.filter((table) => table.title);
const headingOf = (table: ConfigTable) => headings[titled().indexOf(table)];
</script>

<template>
	<div class="docs-article">
		<template v-for="(table, index) in tables" :key="table.title ?? index">
			<h2 v-if="table.title" :id="headingOf(table)?.id" tabindex="-1" :lang="lang">{{ table.title }}</h2>

			<BoNotice v-if="table.note" type="info" class="mt-4" :lang="lang">
				<DocsInlineText :text="table.note" />
			</BoNotice>

			<div class="docs-table" role="region" tabindex="0" :aria-label="table.title ?? $t('docs_configuration')">
				<table>
					<caption class="sr-only">{{ table.title ?? $t('docs_configuration') }}</caption>
					<thead>
						<tr>
							<th scope="col">{{ $t('docs_variable') }}</th>
							<th scope="col">{{ $t('docs_description') }}</th>
							<th scope="col">{{ $t('docs_default') }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="row in table.rows" :key="row.pattern" :data-variable="row.name">
							<td>
								<code class="docs-inline-code whitespace-nowrap">{{ row.name }}</code>
							</td>
							<td :lang="lang">
								<DocsInlineText :text="row.description" />
								<p v-if="row.note" class="mt-1 text-gray-500 dark:text-gray-400" data-note>
									<DocsInlineText :text="row.note" />
								</p>
							</td>
							<td>
								<!-- A list default may wrap after its commas, nowhere else. -->
								<code v-if="defaults[row.pattern]" class="docs-inline-code">
									<template v-for="(piece, i) in defaults[row.pattern]!.split(',')" :key="i">
										<template v-if="i > 0">
											,
											<wbr />
										</template>
										{{ piece }}
									</template>
								</code>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</template>
	</div>
</template>
