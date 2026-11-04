// Parity fixture (specs/031 analyze C1): the display entry of an uploaded bundle. Both entries are app extensions: a
// bundle cannot be sandboxed, and the parity env runs MARKETPLACE_TRUST=sandbox (FR-006 accepts app-only packages).
import DisplayComponent from './display.vue';

export default {
	id: 'upload-display',
	name: 'Upload Bundle Display',
	icon: 'label',
	component: DisplayComponent,
	types: ['string'],
	options: null,
};
