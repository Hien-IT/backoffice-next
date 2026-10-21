// Parity fixture (specs/020 data-model §9): a display extension using v-chip and v-icon.
import DisplayComponent from './display.vue';

export default {
	id: 'parity-display-badge',
	name: 'Parity Badge',
	icon: 'label',
	description: 'Shows the value in a chip (parity fixture)',
	component: DisplayComponent,
	types: ['string'],
	options: null,
};
