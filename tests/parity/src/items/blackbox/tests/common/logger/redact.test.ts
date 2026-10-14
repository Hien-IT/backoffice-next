// Ported from directus/tests/blackbox/tests/common/logger/redact.test.ts
// Backoffice (feature 011, research R10): the Directus test spawns its own process with LOG_STYLE=raw and reads its
// stdout through TestLogger. The parity suite does not spawn processes; the blackbox pair runs with LOG_STYLE=raw and
// LOG_LEVEL=info (env/profile-blackbox.env), so ContainerLogger reads the container log of the app under test instead,
// with the same contract: the lines that contain the condition, written after it was created, once one appears.
import { getUrl } from '@common/config';
import vendors from '@common/get-dbs-to-test';
import { requestGraphQL } from '@common/transport';
import { TEST_USERS, USER } from '@common/variables';
import { EnumType } from 'json-to-graphql-query';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { logs } from '../../../../../docker.js';

const service = process.env['PARITY_BLACKBOX_APP'] === 'directus' ? 'directus-blackbox' : 'backoffice-api-blackbox';

class ContainerLogger {
	private readonly skip: number;

	constructor(private readonly condition: string) {
		this.skip = logs(service).split('\n').length - 1;
	}

	async getLogs(): Promise<string> {
		for (let attempt = 0; attempt < 50; attempt++) {
			const lines = logs(service)
				.split('\n')
				.slice(this.skip)
				.filter((line) => line.includes(this.condition));

			if (lines.length > 0) return lines.join('\n');
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		return '';
	}
}

describe('Logger Redact Tests', () => {
	describe('POST /refresh', () => {
		describe('json mode', () => {
			TEST_USERS.forEach((userKey) => {
				describe(USER[userKey].NAME, () => {
					it.each(vendors)('%s', async (vendor) => {
						// Setup
						const refreshToken = (
							await request(getUrl(vendor))
								.post(`/auth/login`)
								.send({ email: USER[userKey].EMAIL, password: USER[userKey].PASSWORD })
								.expect('Content-Type', /application\/json/)
						).body.data.refresh_token;

						const gqlRefreshToken = (
							await requestGraphQL(getUrl(vendor), true, null, {
								mutation: {
									auth_login: {
										__args: {
											email: USER[userKey].EMAIL,
											password: USER[userKey].PASSWORD,
										},
										refresh_token: true,
									},
								},
							})
						).body.data.auth_login.refresh_token;

						// Action
						const logger = new ContainerLogger('/auth/refresh', true);

						const response = await request(getUrl(vendor))
							.post(`/auth/refresh`)
							.send({ refresh_token: refreshToken })
							.expect('Content-Type', /application\/json/);

						const logs = await logger.getLogs();

						const loggerGql = new ContainerLogger('/graphql/system', true);

						const mutationKey = 'auth_refresh';

						const gqlResponse = await requestGraphQL(getUrl(vendor), true, null, {
							mutation: {
								[mutationKey]: {
									__args: {
										refresh_token: gqlRefreshToken,
									},
									access_token: true,
									expires: true,
									refresh_token: true,
								},
							},
						});

						const logsGql = await loggerGql.getLogs();

						// Assert
						expect(response.statusCode).toBe(200);

						expect(response.body).toMatchObject({
							data: {
								access_token: expect.any(String),
								expires: expect.any(Number),
								refresh_token: expect.any(String),
							},
						});

						for (const log of [logs, logsGql]) {
							expect((log.match(/"cookie":"--redacted--"/g) || []).length).toBe(0);
							expect((log.match(/"set-cookie":"--redacted--"/g) || []).length).toBe(0);
						}

						expect(gqlResponse.statusCode).toBe(200);

						expect(gqlResponse.body).toMatchObject({
							data: {
								[mutationKey]: {
									access_token: expect.any(String),
									expires: expect.any(String),
									refresh_token: expect.any(String),
								},
							},
						});
					});
				});
			});
		});

		const cookieModes = ['cookie', 'session'];

		describe.each(cookieModes)('%s mode', (mode) => {
			TEST_USERS.forEach((userKey) => {
				describe(USER[userKey].NAME, () => {
					it.each(vendors)('%s', async (vendor) => {
						// Setup
						const loginResponse = await request(getUrl(vendor))
							.post(`/auth/login`)
							.send({ email: USER[userKey].EMAIL, password: USER[userKey].PASSWORD, mode })
							.expect('Content-Type', /application\/json/);

						const cookie = loginResponse.get('Set-Cookie')!;

						const gqlLoginResponse = await requestGraphQL(getUrl(vendor), true, null, {
							mutation: {
								auth_login: {
									__args: {
										email: USER[userKey].EMAIL,
										password: USER[userKey].PASSWORD,
										mode: new EnumType(mode),
									},
									refresh_token: true,
								},
							},
						});

						const gqlCookie = gqlLoginResponse.get('Set-Cookie')![0]!;

						// Action
						const logger = new ContainerLogger('/auth/refresh', true);

						const response = await request(getUrl(vendor))
							.post(`/auth/refresh`)
							.set('Cookie', cookie)
							.send({ mode })
							.expect('Content-Type', /application\/json/);

						const logs = await logger.getLogs();

						const loggerGql = new ContainerLogger('/graphql/system', true);

						const mutationKey = 'auth_refresh';

						const gqlResponse = await requestGraphQL(
							getUrl(vendor),
							true,
							null,
							{
								mutation: {
									[mutationKey]: {
										__args: {
											mode: new EnumType(mode),
										},
										access_token: true,
										expires: true,
									},
								},
							},
							{ cookies: [gqlCookie] },
						);

						const logsGql = await loggerGql.getLogs();

						// Assert
						expect(response.statusCode).toBe(200);

						expect(response.body).toMatchObject({
							data: {
								...(mode === 'cookie' && { access_token: expect.any(String) }),
								expires: expect.any(Number),
							},
						});

						for (const log of [logs, logsGql]) {
							expect((log.match(/"cookie":"--redacted--"/g) || []).length).toBe(1);
							expect((log.match(/"set-cookie":"--redacted--"/g) || []).length).toBe(1);
						}

						expect(gqlResponse.statusCode).toBe(200);

						expect(gqlResponse.body).toMatchObject({
							data: {
								[mutationKey]: {
									...(mode === 'cookie' && { access_token: expect.any(String) }),
									expires: expect.any(String),
								},
							},
						});
					});
				});
			});
		});
	});
});
