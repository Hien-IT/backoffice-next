// Test-only fake displays for the render components (013 registers the real ones later, US2).
import type { DisplayConfig } from '@directus/types';
import { defineComponent, h } from 'vue';

const Fake = defineComponent({
	name: 'FakeDisplay',
	inheritAttrs: false,
	props: ['value', 'interface', 'interfaceOptions', 'type', 'collection', 'field', 'suffix'],
	setup(props) {
		return () => h('span', { class: 'fake' }, `${JSON.stringify(props.value)}${props.suffix ?? ''}`);
	},
});

const Broken = defineComponent({
	name: 'BrokenDisplay',
	props: ['value'],
	setup() {
		return () => {
			throw new Error('broken display');
		};
	},
});

const display = (id: string, component = Fake) => ({ id, name: id, icon: 'box', component, options: null, types: [] });

export const FAKE_DISPLAYS: Record<string, DisplayConfig> = Object.fromEntries(
	[
		display('fake'),
		display('broken', Broken),
		display('formatted-value'),
		display('related-values'),
		display('file'),
		display('datetime'),
	].map((config) => [config.id, config as unknown as DisplayConfig]),
);
