// Generates tests/parity/fixtures/files (feature 007, spec FR-082): one image per class that can change the output
// bytes of a transformation, plus non-image files for the import and pass-through cases. Deterministic, so the files
// can be regenerated:   node tests/parity/fixtures/make-images.mjs
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = join(dirname(fileURLToPath(import.meta.url)), 'files');
mkdirSync(out, { recursive: true });

const write = (name, buffer) => writeFileSync(join(out, name), buffer);

// A smooth gradient with a few hard edges: resizing and re-encoding it exercise the resampler and the encoders.
function gradient(width, height, channels = 3) {
	const data = Buffer.alloc(width * height * channels);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * channels;
			data[i] = Math.round((x / width) * 255);
			data[i + 1] = Math.round((y / height) * 255);
			data[i + 2] = (x + y) % 64 < 32 ? 40 : 220;
			if (channels === 4) data[i + 3] = Math.round(((x + y) / (width + height)) * 255);
		}
	}

	return sharp(data, { raw: { width, height, channels } });
}

// JPEG APP13 (Photoshop 3.0, 8BIM 0x0404) with IPTC records. The first record is ApplicationRecordVersion: the
// Directus parser (parse-image-metadata.ts) skips the first 1C 02 marker, as real files start with it too.
function withIptc(jpeg, records) {
	const iptc = Buffer.concat(
		records.map(([dataset, value]) => {
			const data = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
			const head = Buffer.from([0x1c, 0x02, dataset, 0, 0]);
			head.writeUInt16BE(data.length, 3);
			return Buffer.concat([head, data]);
		}),
	);

	const resource = Buffer.concat([Buffer.from('8BIM'), Buffer.from([0x04, 0x04, 0, 0]), Buffer.alloc(4), iptc]);
	resource.writeUInt32BE(iptc.length, 8);
	const padded = iptc.length % 2 ? Buffer.concat([resource, Buffer.alloc(1)]) : resource;
	const payload = Buffer.concat([Buffer.from('Photoshop 3.0\0'), padded]);
	const segment = Buffer.concat([Buffer.from([0xff, 0xed, 0, 0]), payload]);
	segment.writeUInt16BE(payload.length + 2, 2);

	return Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)]);
}

const exif = { IFD0: { Make: 'Backoffice', Model: 'Parity Fixture 1' } };

const photo = await gradient(640, 480).withExif(exif).jpeg({ quality: 85 }).toBuffer();
write('photo.jpg', photo);
write(
	'photo-iptc.jpg',
	withIptc(photo, [
		[0x00, Buffer.from([0x00, 0x04])],
		[0x78, 'Caption from IPTC'],
		[0x69, 'Headline from IPTC'],
		[0x19, 'alpha'],
		[0x19, 'beta'],
	]),
);
write('photo-rotated.jpg', await gradient(320, 200).withMetadata({ orientation: 6 }).jpeg({ quality: 85 }).toBuffer());
write('photo-cmyk.jpg', await gradient(320, 240).toColourspace('cmyk').jpeg({ quality: 85 }).toBuffer());
write('image-8bit.png', await gradient(320, 240).png().toBuffer());
write('image-16bit.png', await gradient(160, 120).toColourspace('rgb16').png().toBuffer());
write('image-alpha.png', await gradient(240, 180, 4).png().toBuffer());
write('image.webp', await gradient(320, 240).webp({ quality: 80 }).toBuffer());
write('image.tiff', await gradient(160, 120).tiff().toBuffer());
write('image.avif', await gradient(320, 240).avif({ quality: 50 }).toBuffer());
write('image-static.gif', await gradient(160, 120).gif().toBuffer());
write(
	'image-animated.gif',
	await sharp([await gradient(80, 60).png().toBuffer(), await gradient(80, 60).negate().png().toBuffer()], {
		join: { animated: true },
	})
		.gif({ loop: 0, delay: [200, 200] })
		.toBuffer(),
);
// Wider than ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION (6000): transformations of it must fail like Directus.
write('image-wide.png', await gradient(7000, 4, 3).png({ compressionLevel: 9 }).toBuffer());
// Cut in the middle of the entropy-coded data, for ASSETS_INVALID_IMAGE_SENSITIVITY_LEVEL.
write('photo-truncated.jpg', photo.subarray(0, Math.floor(photo.length / 2)));

write('photo.jpg.gz', gzipSync(photo, { level: 9 }));
write('photo.jpg.br', brotliCompressSync(photo));
write(
	'document.pdf',
	Buffer.from(
		'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
			'3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
	),
);
write(
	'drawing.svg',
	Buffer.from(
		'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#09f"/></svg>\n',
	),
);
