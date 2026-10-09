import {
	cast,
	getConfigPath,
	isDirectusVariable,
	isFileKey,
	readConfigurationFromFile,
	readConfigurationFromProcess,
	removeFileSuffix,
} from '@backoffice/env';
import { useLogger } from '../logger/index.js';
import { isNotApplicable, isSupported } from './supported-variables.js';

export const UNSUPPORTED_MESSAGE =
	'The following Directus environment variables are not supported by Backoffice yet and will be ignored: ';
export const SERVE_APP_MESSAGE = '"SERVE_APP" is ignored: the Backoffice web app is served by its own container.';

/** Keys set in the raw configuration (process + CONFIG_PATH file); defaults do not count. `X_FILE` counts as `X`. */
export function getRawConfiguration(): Record<string, unknown> {
	return { ...readConfigurationFromProcess(), ...(readConfigurationFromFile(getConfigPath()) ?? {}) };
}

/** Group C names of contracts/config.md §5, sorted A–Z, each once. Never values. */
export function getUnsupportedVariables(raw: Record<string, unknown> = getRawConfiguration()): string[] {
	const names = new Set<string>();

	for (const key of Object.keys(raw)) {
		if (!isDirectusVariable(key)) continue;

		const name = isFileKey(key) ? removeFileSuffix(key) : key;

		if (name === 'SERVE_APP' || isSupported(name) || isNotApplicable(name)) continue;

		names.add(name);
	}

	return [...names].sort();
}

/** FR-014: one warning line listing unsupported variables; a separate line for SERVE_APP=true (D-08). */
export function warnUnsupportedVariables(raw: Record<string, unknown> = getRawConfiguration()): void {
	const logger = useLogger();
	const unsupported = getUnsupportedVariables(raw);

	if (unsupported.length > 0) logger.warn(UNSUPPORTED_MESSAGE + unsupported.join(', '));

	if ('SERVE_APP' in raw && cast(raw['SERVE_APP'], 'SERVE_APP') === true) logger.warn(SERVE_APP_MESSAGE);
}
