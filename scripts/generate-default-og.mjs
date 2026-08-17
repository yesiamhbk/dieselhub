import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = path.join(root, "public", "dh-logo-brand.png");
const outputPath = path.join(root, "public", "og-1200x630.png");

const background = Buffer.from(`<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#041012"/>
      <stop offset="1" stop-color="#0d292c"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#34b7b7"/>
      <stop offset="1" stop-color="#76dad8"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <path d="M520 0 C790 95 1000 18 1200 115 V0 Z" fill="#164145" opacity=".55"/>
  <path d="M0 545 C270 470 420 620 700 535 C900 475 1050 500 1200 458 V630 H0 Z" fill="#0a2023"/>
  <rect x="404" y="102" width="92" height="6" rx="3" fill="url(#accent)"/>
  <text x="404" y="188" fill="#ffffff" font-family="Arial,DejaVu Sans,sans-serif" font-size="72" font-weight="900">Diesel Hub</text>
  <text x="404" y="254" fill="#76dad8" font-family="Arial,DejaVu Sans,sans-serif" font-size="33" font-weight="750">Форсунки та ПНВТ Common Rail</text>
  <text x="404" y="318" fill="#b9c9ca" font-family="Arial,DejaVu Sans,sans-serif" font-size="27">Нові та відновлені деталі</text>
  <text x="404" y="365" fill="#b9c9ca" font-family="Arial,DejaVu Sans,sans-serif" font-size="27">Гарантія 6 місяців · Доставка по Україні</text>
  <rect x="404" y="429" width="338" height="68" rx="18" fill="none" stroke="#34b7b7" stroke-width="2"/>
  <text x="573" y="473" text-anchor="middle" fill="#76dad8" font-family="Arial,DejaVu Sans,sans-serif" font-size="27" font-weight="800">dieselhub.com.ua</text>
  <rect x="78" y="102" width="264" height="396" rx="42" fill="#07191b" stroke="#24575a" stroke-width="2"/>
</svg>`);

const logo = await sharp(logoPath).resize(230, 230, { fit: "contain" }).png().toBuffer();

await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#041012" } })
  .composite([
    { input: background, left: 0, top: 0 },
    { input: logo, left: 95, top: 185 },
  ])
  .png({ compressionLevel: 9, palette: true })
  .toFile(outputPath);

console.log(outputPath);
