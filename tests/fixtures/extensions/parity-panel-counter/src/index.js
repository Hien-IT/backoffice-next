// Parity fixture (specs/020 data-model §9): a panel extension with a query and a component options form.
import OptionsComponent from './options.vue';
import PanelComponent from './panel.vue';

export default {
	id: 'parity-panel-counter',
	name: 'Parity Counter',
	icon: 'pin',
	description: 'Counts the items of a collection (parity fixture)',
	component: PanelComponent,
	query(options) {
		if (!options?.collection) return;
		// count of the primary key: the insights store sends panel queries as GraphQL, where `count { * }` is not valid.
		return { collection: options.collection, query: { aggregate: { count: ['id'] } } };
	},
	options: OptionsComponent,
	minWidth: 8,
	minHeight: 6,
};
