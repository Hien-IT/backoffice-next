// Ported from directus/app/src/utils/get-asset-url.ts
// Backoffice: the base is the API URL of config.json (getApiUrl) instead of getPublicURL (the API may be on another
// origin); getFilesUrl and getFolderUrl are left out (no file module in 012).
import { getApiUrl } from '../api/sdk.ts';

type AssetUrlOptions = {
	isDownload?: boolean;
	imageKey?: string;
	cacheBuster?: boolean | string | number | Date;
	[key: string]: any;
};

export function getAssetUrl(
	filename: string,
	{ isDownload = false, imageKey = undefined, cacheBuster = false, ...params }: AssetUrlOptions = {},
): string {
	const assetUrl = new URL(`assets/${filename}`, getApiUrl());

	if (params) {
		Object.entries(params).forEach(([key, value]) => {
			if (value === undefined || value === null) return;

			assetUrl.searchParams.set(key, String(value));
		});
	}

	if (isDownload) assetUrl.searchParams.set('download', '');
	if (imageKey) assetUrl.searchParams.set('key', imageKey);
	if (cacheBuster) assetUrl.searchParams.set('v', cacheBuster === true ? Date.now().toString() : String(cacheBuster));

	return assetUrl.href;
}
