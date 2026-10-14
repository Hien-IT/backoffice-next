// Ported from directus/app/src/displays/filesize/index.ts
import { h } from 'vue';
import { formatFilesize } from '../../utils/format-filesize.ts';
import { defineDisplay } from '../types.ts';

export default defineDisplay({
	id: 'filesize',
	name: '$t:displays.filesize.filesize',
	description: '$t:displays.filesize.description',
	icon: 'description',
	component: ({ value }: { value: number }) => h('span', null, formatFilesize(value)),
	handler: (value: number) => formatFilesize(value),
	options: [],
	types: ['integer', 'bigInteger'],
});
