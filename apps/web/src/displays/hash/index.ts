// Ported from directus/app/src/displays/hash/index.ts
import { defineDisplay } from '../types.ts';
import DisplayHash from './DisplayHash.vue';

export default defineDisplay({
	id: 'hash',
	name: '$t:displays.hash.hash',
	description: '$t:displays.hash.description',
	types: ['hash'],
	icon: 'fingerprint',
	component: DisplayHash,
	options: [],
});
