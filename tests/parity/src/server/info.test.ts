// T047: /server/info for public requests (FR-042, FR-047), including the key order of `project` (ETag).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { directusRequest } from '../directus-api.js';
import { assertParity, parity } from '../parity.js';

const PROJECT_KEYS = [
	'project_name',
	'project_descriptor',
	'project_logo',
	'project_color',
	'default_appearance',
	'default_theme_light',
	'default_theme_dark',
	'theme_light_overrides',
	'theme_dark_overrides',
	'default_language',
	'public_foreground',
	'public_favicon',
	'public_note',
	'custom_css',
	'public_registration',
	'public_registration_verify_email',
	'public_background',
];

describe('/server/info (public)', () => {
	it('same body, 17 project keys in order, setupCompleted, no version once set up, same ETag', async () => {
		const result = await parity({ path: '/server/info' });
		assertParity(result);
		const data = (result.backoffice.json as any).data;
		expect(Object.keys(data.project)).toEqual(PROJECT_KEYS);
		expect(Object.keys((result.directus.json as any).data.project)).toEqual(PROJECT_KEYS);
		expect(data.setupCompleted).toBe(true);
		expect(data).not.toHaveProperty('version');
		expect(result.backoffice.headers['etag']).toBe(result.directus.headers['etag']);
	});

	it('invalid token: Directus 401, Backoffice public body (D-10)', async () => {
		for (const req of [
			{ path: '/server/info', headers: { authorization: 'Bearer invalid' } },
			{ path: '/server/info?access_token=invalid' },
		]) {
			const result = await parity(req);
			assertParity(result);
			expect(result.directus.status).toBe(401);
		}
	});

	describe('data variants (written through the Directus REST API)', () => {
		let original: Record<string, unknown>;
		let fileId: string;

		beforeAll(async () => {
			original = (await directusRequest('GET', '/settings')).data;
		});

		afterAll(async () => {
			await directusRequest('PATCH', '/settings', {
				public_background: original['public_background'] ?? null,
				public_registration: original['public_registration'],
				theme_light_overrides: original['theme_light_overrides'] ?? null,
			});

			if (fileId) await directusRequest('DELETE', `/files/${fileId}`);
		});

		it('public_background with a file, public_registration on, theme_light_overrides JSON', async () => {
			const form = new FormData();
			form.append('file', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'bg.png');
			fileId = (await directusRequest('POST', '/files', form)).data.id;

			await directusRequest('PATCH', '/settings', {
				public_background: fileId,
				public_registration: true,
				theme_light_overrides: { primary: '#FF0000' },
			});

			const result = await parity({ path: '/server/info' });
			assertParity(result);
			const project = (result.backoffice.json as any).data.project;
			expect(project.public_background).toEqual({ id: fileId, type: 'image/png' });
			expect(project.public_registration).toBe(true);
			expect(project.theme_light_overrides).toEqual({ primary: '#FF0000' });
		});
	});
});
