/**
 * Rasterises public/icon.svg into the PNGs the home screen and the
 * notification tray need.
 *
 * Run it after changing the artwork; the PNGs are committed so neither the
 * build nor the deploy depends on sharp being present.
 *
 *   npx tsx scripts/make-icons.ts
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import sharp from 'sharp';

const PUBLIC = join(process.cwd(), 'public');

/** The green of the frame, used where the icon has to fill the whole square. */
const BRAND = '#3f8b32';

async function main() {
  const svg = await readFile(join(PUBLIC, 'icon.svg'));
  await mkdir(PUBLIC, { recursive: true });

  // Plain icons: the mark as drawn, transparent outside the rounded frame.
  for (const size of [192, 512]) {
    await sharp(svg, { density: 384 })
      .resize(size, size)
      .png()
      .toFile(join(PUBLIC, `icon-${size}.png`));
  }

  // Android masks adaptive icons to whatever shape the launcher uses, so the
  // mark is inset on a filled square rather than run to the edge.
  const inset = Math.round(512 * 0.62);
  const mark = await sharp(svg, { density: 512 })
    .resize(inset, inset)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: BRAND,
    },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toFile(join(PUBLIC, 'icon-maskable-512.png'));

  // iOS rounds the corners itself and shows transparency as black. This one
  // lives in app/ so Next.js emits the apple-touch-icon link for it — without
  // that tag, an iPhone added to the home screen shows a screenshot.
  await sharp(svg, { density: 384 })
    .resize(180, 180)
    .flatten({ background: '#fdfdf7' })
    .png()
    .toFile(join(process.cwd(), 'app', 'apple-icon.png'));

  // The tray badge is a silhouette: Android keeps the alpha and throws the
  // colour away, so the holes have to be punched out of the shape rather than
  // painted over it. evenodd does that in one path.
  const holes = [
    [40, 34],
    [58, 37],
    [37, 52],
    [56, 55],
    [46, 66],
  ];
  const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <path fill="#ffffff" fill-rule="evenodd" d="M48 12a36 36 0 1 0 0 72 36 36 0 0 0 0-72Z${holes
        .map(([cx, cy]) => `M${cx} ${cy - 5}a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z`)
        .join('')}"/>
    </svg>`;

  await writeFile(
    join(PUBLIC, 'badge.png'),
    await sharp(Buffer.from(badge), { density: 384 }).resize(96, 96).png().toBuffer(),
  );

  console.log('Wrote icon-192, icon-512, icon-maskable-512, apple-icon, badge');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
