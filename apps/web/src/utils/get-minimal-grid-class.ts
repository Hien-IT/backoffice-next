// Ported from directus/app/src/utils/get-minimal-grid-class.ts
// Backoffice: used by select-radio and select-multiple-checkbox; string-width is
// not a dependency, so the width is the UTF-16 length (shortcut: wide CJK/emoji labels count as 1, add string-width if
// such choices get a too dense grid).

type Option = {
	text: string;
};

export function getMinimalGridClass(choices?: Option[], interfaceWidth?: string) {
	if (!choices || choices.length === 0) return null;

	const widestOptionLength = choices.reduce((acc, value) => {
		const width = value.text.length;
		if (width > acc) acc = width;
		return acc;
	}, 0);

	const getMinimalGridClassName = (size: number) => {
		return `grid-${Math.min(choices.length, size)}`;
	};

	if (interfaceWidth?.startsWith('half')) {
		if (widestOptionLength <= 10) return getMinimalGridClassName(2);
		return getMinimalGridClassName(1);
	}

	if (widestOptionLength <= 10) return getMinimalGridClassName(4);
	if (widestOptionLength > 10 && widestOptionLength <= 15) return getMinimalGridClassName(3);
	if (widestOptionLength > 15 && widestOptionLength <= 25) return getMinimalGridClassName(2);
	return getMinimalGridClassName(1);
}
