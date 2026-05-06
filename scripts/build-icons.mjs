import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const svg = readFileSync(resolve('src-tauri/icons/icon.svg'));
await sharp(svg, { density: 384 })
  .resize(1024, 1024)
  .png({ compressionLevel: 9 })
  .toFile(resolve('src-tauri/icons/icon.png'));
console.log('✓ icon.png generado a 1024x1024');
