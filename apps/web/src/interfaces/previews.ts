// The preview image of an interface card in the field drawer (spec 016 FR-033): the `preview` SVG of the Directus
// interface, copied next to the ported interface by scripts/sync-interface-previews.mjs. Loaded on demand so the main
// chunk does not carry them. Keyed by folder; the `header` interface lives in `presentation-header/`.
const loaders = import.meta.glob<string>('./*/preview.svg', { query: '?raw', import: 'default' });

const FOLDER: Record<string, string> = { header: 'presentation-header' };

/** The SVG text of the interface preview, or undefined when Directus has none (the card shows the icon). */
export async function loadInterfacePreview(id: string): Promise<string | undefined> {
	const loader = loaders[`./${FOLDER[id] ?? id}/preview.svg`];
	return loader ? await loader() : undefined;
}
