// Directus embeds these YAML files at build time (unplugin-yaml); Backoffice reads them once when the module
// loads (research R16.3). The files are copied next to the compiled modules by the build script.
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

export function loadYaml(url: URL): any {
	return yaml.load(readFileSync(url, 'utf8'));
}
