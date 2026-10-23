#!/usr/bin/env node
// Spec 021 (research R1): the `node cli.js <command>` entry of the image (/backoffice/cli.js, D-174), like the `directus` package
// entry of Directus (directus/directus/cli.js), without its update check.
import('./dist/cli/run.js');
