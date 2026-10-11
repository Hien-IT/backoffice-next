// Directus embeds these YAML files at build time (unplugin-yaml); Backoffice reads them once when the module
// loads (research R16.3). The files are copied next to the compiled modules by the build script.
import yaml from 'js-yaml';

// Through getBuiltinModule: tests of consumers that mock `node:fs` (the ported env tests) must not empty the data.
const { readFileSync } = process.getBuiltinModule('node:fs');

export function loadYaml(url: URL): any {
	return yaml.load(readFileSync(url, 'utf8'));
}
