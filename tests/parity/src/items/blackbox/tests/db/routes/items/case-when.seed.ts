// Ported from directus/tests/blackbox/tests/db/routes/items/case-when.seed.ts
import { getSetupUrl } from '@common/config';
import { DeleteCollection } from '@common/functions';
import vendors from '@common/get-dbs-to-test';
import { USER } from '@common/variables';
import request from 'supertest';
import { expect, it } from 'vitest';

export type Result = {
	isSeeded: boolean;
	editorToken: string | null;
};

export const collection = 'articles_case_when';

export const seedDBStructure = () => {
	it.each(vendors)(
		'%s',
		async (vendor) => {
			try {
				await DeleteCollection(vendor, { collection });

				// Backoffice: /collections and /relations are feature 006, made through the Directus of the pair.
				const collectionResponse = await request(getSetupUrl(vendor))
					.post(`/collections`)
					.set('Authorization', `Bearer ${USER.TESTS_FLOW.TOKEN}`)
					.send({
						collection,
						fields: [
							{
								field: 'id',
								type: 'integer',
								meta: {
									hidden: true,
									interface: 'input',
									readonly: true,
								},
								schema: {
									is_primary_key: true,
									has_auto_increment: true,
								},
							},
							{
								field: 'user_created',
								type: 'uuid',
								meta: {
									special: ['user-created'],
									interface: 'select-dropdown-m2o',
									options: {
										template: '{{avatar}} {{first_name}} {{last_name}}',
									},
									display: 'user',
									readonly: true,
									hidden: true,
									width: 'half',
								},
								schema: {},
							},
							{
								field: 'date_created',
								type: 'timestamp',
								meta: {
									special: ['date-created'],
									interface: 'datetime',
									readonly: true,
									hidden: true,
									width: 'half',
									display: 'datetime',
									display_options: {
										relative: true,
									},
								},
								schema: {},
							},
						],
						schema: {},
						meta: {
							singleton: false,
						},
					});

				if (!collectionResponse.ok) {
					throw new Error('Could not create collection', collectionResponse.body);
				}

				const relationsResponse = await request(getSetupUrl(vendor))
					.post(`/relations`)
					.set('Authorization', `Bearer ${USER.TESTS_FLOW.TOKEN}`)
					.send({
						collection,
						field: 'user_created',
						related_collection: 'directus_users',
						schema: {},
					});

				if (!relationsResponse.ok) {
					throw new Error('Could not create relation', relationsResponse.body);
				}

				expect(true).toBeTruthy();
			} catch (error) {
				expect(error).toBeFalsy();
			}
		},
		300000,
	);
};
