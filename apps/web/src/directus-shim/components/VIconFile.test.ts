import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import VIconFile from './VIconFile.vue';

test('file icon with the extension', () => {
	const wrapper = mount(VIconFile, { props: { ext: 'pdf' } });

	expect(wrapper.find('[data-icon="insert_drive_file"]').exists()).toBe(true);
	expect(wrapper.text()).toContain('pdf');
});
