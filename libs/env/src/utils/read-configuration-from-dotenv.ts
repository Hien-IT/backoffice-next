// Ported from directus/packages/env/src/utils/read-configuration-from-dotenv.ts
import { readFileSync } from 'node:fs';
import { type DotenvParseOutput, parse } from 'dotenv';

export const readConfigurationFromDotEnv = (path: string): DotenvParseOutput => {
	return parse(readFileSync(path));
};
