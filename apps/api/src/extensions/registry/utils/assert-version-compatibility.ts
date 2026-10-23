// Ported from directus/packages/extensions-registry/src/utils/assert-version-compatibility.ts
import { OutOfDateError } from '@backoffice/errors';
import { SUPPORTED_VERSION } from '../constants.js';
import { getApiVersion } from './get-api-version.js';

export interface ValidateApiVersionOptions {
	registry?: string;
}

export const assertVersionCompatibility = async (options?: ValidateApiVersionOptions): Promise<void> => {
	const version = await getApiVersion(options);

	/**
	 * The Registry API always targets the latest release of DR. If the current installation is
	 * out of date, the registry operations should fail with an instance out-of-date error.
	 */
	if (version !== SUPPORTED_VERSION) {
		throw new OutOfDateError();
	}
};
