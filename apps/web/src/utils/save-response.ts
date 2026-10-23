// Backoffice: no DR source. DR downloads zips and assets with fetch -> blob -> a temporary <a download>
// (modules/files/routes/collection.vue `downloadFiles`, files-navigation-folder.vue `downloadFolder`); this does the
// same with file-saver like the 014 export (research R10). The file name comes from Content-Disposition, else the
// fallback. A non-2xx answer rejects with the SDK error shape (read by translateAPIError).
import fileSaver from 'file-saver';

export async function saveResponse(response: Response, fallbackName: string): Promise<void> {
	if (!response.ok) {
		let body: { errors?: unknown } | null = null;

		try {
			body = await response.json();
		} catch {
			// Not JSON: the status alone.
		}

		throw { errors: body?.errors, response: { status: response.status } };
	}

	const blob = await response.blob();
	const filename = response.headers.get('Content-Disposition')?.match(/filename="(.*?)"/)?.[1];

	fileSaver.saveAs(blob, filename ?? fallbackName);
}
