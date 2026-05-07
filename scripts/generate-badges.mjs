import sharp from "sharp";
import { mkdirSync } from "node:fs";

const outDir = "src-tauri/icons/badge";
mkdirSync(outDir, { recursive: true });

const variants = [
  { key: "1", label: "1" },
  { key: "2", label: "2" },
  { key: "3", label: "3" },
  { key: "4", label: "4" },
  { key: "5", label: "5" },
  { key: "6", label: "6" },
  { key: "7", label: "7" },
  { key: "8", label: "8" },
  { key: "9plus", label: "9+" },
];

for (const { key, label } of variants) {
  const fontSize = label.length > 1 ? 14 : 18;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="14" fill="#FF3B30"/>
  <text x="16" y="${label.length > 1 ? 21 : 22}" font-family="-apple-system, Segoe UI, system-ui, sans-serif"
        font-size="${fontSize}" font-weight="700" fill="white" text-anchor="middle">${label}</text>
</svg>`;

  const target = `${outDir}/${key}.png`;
  await sharp(Buffer.from(svg)).png().toFile(target);
  console.log(`wrote ${target}`);
}
