import { expect, test } from 'vitest';
import { decode } from './decode.ts';

test('decodes named and numeric entities and keeps whitespace', () => {
	expect(decode('&copy; 2024 &amp; &lt;b&gt; &#169; &#x41;')).toBe('© 2024 & <b> © A');
	expect(decode('  two  spaces\n')).toBe('  two  spaces\n');
	expect(decode('&lt;img src=x onerror=alert(1)&gt;')).toBe('<img src=x onerror=alert(1)>');
});
