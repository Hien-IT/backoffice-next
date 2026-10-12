// Ported from directus/tests/e2e/tests/endpoints/files/old.test.ts
// Backoffice (research R7 of spec 007): the requests go to each app with the admin token of the parity environment
// (directus/tests/e2e uses the static token `admin`); the created rows are removed after each request.
import { describe, expect, test } from 'vitest';
import { APPS, urls } from '../auth/fixtures.js';
import { admin } from './helpers.js';

describe.each(APPS)('/files at %s', (app) => {
	describe('POST /', () => {
		describe('when only request body is provided without any multipart files', () => {
			test('returns created file when required properties are included', async () => {
				// Setup
				const payload = {
					title: 'Test File',
					storage: 'local',
					filename_download: 'test_file',
					type: 'application/octet-stream',
				};

				const response = await fetch(new URL('/files', urls()[app]), {
					method: 'POST',
					body: JSON.stringify(payload),
					headers: {
						['Content-Type']: 'application/json',
						...(await admin()),
					},
				});

				// Assert
				expect(response.status).toBe(200);

				const body = (await response.json()) as any;

				expect(body).toMatchObject({
					data: {
						title: payload.title,
						storage: payload.storage,
						filename_download: payload.filename_download,
					},
				});

				await fetch(new URL(`/files/${body.data.id}`, urls()[app]), { method: 'DELETE', headers: await admin() });
			});

			test('returns code: FAILED_VALIDATION when required property "storage" is not included', async () => {
				// Setup
				const payload = { title: 'Test File', filename_download: 'test_file', type: 'application/octet-stream' };

				const response = await fetch(new URL('/files', urls()[app]), {
					method: 'POST',
					body: JSON.stringify(payload),
					headers: {
						['Content-Type']: 'application/json',
						...(await admin()),
					},
				});

				// Assert
				expect(response.status).toBe(400);

				expect(await response.json()).toMatchObject({
					errors: [
						{
							message: 'Validation failed for field "storage". Value is required.',
							extensions: {
								code: 'FAILED_VALIDATION',
							},
						},
					],
				});
			});
		});
	});
});
