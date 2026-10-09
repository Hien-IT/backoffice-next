// Ported from directus/packages/system-data/src/fields/index.ts
import { loadYaml } from '../load-yaml.js';
import type { FieldIndex, FieldMeta } from '../types.js';
const defaults = loadYaml(new URL('./_defaults.yaml', import.meta.url));
const accessFields = loadYaml(new URL('./access.yaml', import.meta.url));
const activityFields = loadYaml(new URL('./activity.yaml', import.meta.url));
const collectionFields = loadYaml(new URL('./collections.yaml', import.meta.url));
const commentsFields = loadYaml(new URL('./comments.yaml', import.meta.url));
const dashboardFields = loadYaml(new URL('./dashboards.yaml', import.meta.url));
const deploymentProjectsFields = loadYaml(new URL('./deployment-projects.yaml', import.meta.url));
const deploymentRunsFields = loadYaml(new URL('./deployment-runs.yaml', import.meta.url));
const deploymentFields = loadYaml(new URL('./deployment.yaml', import.meta.url));
const extensionFields = loadYaml(new URL('./extensions.yaml', import.meta.url));
const fieldFields = loadYaml(new URL('./fields.yaml', import.meta.url));
const fileFields = loadYaml(new URL('./files.yaml', import.meta.url));
const flowFields = loadYaml(new URL('./flows.yaml', import.meta.url));
const folderFields = loadYaml(new URL('./folders.yaml', import.meta.url));
const migrationFields = loadYaml(new URL('./migrations.yaml', import.meta.url));
const notificationFields = loadYaml(new URL('./notifications.yaml', import.meta.url));
const operationFields = loadYaml(new URL('./operations.yaml', import.meta.url));
const panelFields = loadYaml(new URL('./panels.yaml', import.meta.url));
const permissionFields = loadYaml(new URL('./permissions.yaml', import.meta.url));
const policyFields = loadYaml(new URL('./policies.yaml', import.meta.url));
const presetFields = loadYaml(new URL('./presets.yaml', import.meta.url));
const relationFields = loadYaml(new URL('./relations.yaml', import.meta.url));
const revisionFields = loadYaml(new URL('./revisions.yaml', import.meta.url));
const roleFields = loadYaml(new URL('./roles.yaml', import.meta.url));
const sessionFields = loadYaml(new URL('./sessions.yaml', import.meta.url));
const settingsFields = loadYaml(new URL('./settings.yaml', import.meta.url));
const shareFields = loadYaml(new URL('./shares.yaml', import.meta.url));
const translationFields = loadYaml(new URL('./translations.yaml', import.meta.url));
const userFields = loadYaml(new URL('./users.yaml', import.meta.url));
const versionFields = loadYaml(new URL('./versions.yaml', import.meta.url));

export const systemFieldRows: FieldMeta[] = [];
export const systemIndexRows: FieldIndex[] = [];

export function hasSystemIndex(collection: string, field: string): boolean {
	return Boolean(systemIndexRows.find((row) => row.collection === collection && row.field === field));
}

export function isSystemField(collection: string, field: string): boolean {
	if (!collection.startsWith('directus_')) return false;

	return Boolean(systemFieldRows.find((fieldMeta) => fieldMeta.collection === collection && fieldMeta.field === field));
}

processFields(accessFields);
processFields(activityFields);
processFields(collectionFields);
processFields(commentsFields);
processFields(dashboardFields);
processFields(extensionFields);
processFields(fieldFields);
processFields(fileFields);
processFields(flowFields);
processFields(folderFields);
processFields(migrationFields);
processFields(notificationFields);
processFields(operationFields);
processFields(panelFields);
processFields(permissionFields);
processFields(policyFields);
processFields(presetFields);
processFields(relationFields);
processFields(revisionFields);
processFields(roleFields);
processFields(sessionFields);
processFields(settingsFields);
processFields(shareFields);
processFields(translationFields);
processFields(userFields);
processFields(versionFields);
processFields(deploymentFields);
processFields(deploymentProjectsFields);
processFields(deploymentRunsFields);

function processFields(systemFields: Record<string, any>) {
	const {
		table: collection,
		fields,
		indexed,
	} = systemFields as { table: string; fields: FieldMeta[]; indexed: Pick<FieldIndex, 'field'>[] | undefined };

	fields.forEach((field, index) => {
		systemFieldRows.push({
			system: true,
			...defaults,
			...field,
			collection,
			sort: index + 1,
		});
	});

	if (indexed) {
		indexed.forEach(({ field }) => {
			systemIndexRows.push({
				collection,
				field,
			});
		});
	}
}
