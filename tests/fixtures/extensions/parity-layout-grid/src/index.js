// Parity fixture (specs/020 data-model §9): a layout extension using useItems, v-table and v-pagination.
import { useItems, useSync } from '@directus/extensions-sdk';
import { computed, ref, toRefs } from 'vue';
import LayoutActions from './actions.vue';
import LayoutComponent from './layout.vue';
import LayoutOptions from './options.vue';

export default {
	id: 'parity-layout-grid',
	name: 'Parity Grid',
	icon: 'grid_on',
	component: LayoutComponent,
	slots: {
		options: LayoutOptions,
		sidebar: () => null,
		actions: LayoutActions,
	},
	setup(props, { emit }) {
		const { collection, filter, search } = toRefs(props);
		const layoutOptions = useSync(props, 'layoutOptions', emit);
		const page = ref(1);
		const limit = computed(() => layoutOptions.value?.limit ?? 10);
		const fields = computed(() => (props.fields?.length ? props.fields : ['*']));

		const { items, loading, totalPages, itemCount } = useItems(collection, {
			sort: ref([]),
			limit,
			page,
			fields,
			filter,
			search,
		});

		return { items, loading, page, totalPages, itemCount, limit, layoutOptions };
	},
};
