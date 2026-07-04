// ============================================================
// MangaViz – JSON Compression Script
// ============================================================
// Compresses JSON files with gzip for faster loading.
// Run: npx tsx scripts/compress-json.ts
// ============================================================

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const DATA_DIR = path.resolve(__dirname, '..', 'public', 'data');

async function compressFile(filepath: string): Promise<void> {
  const content = fs.readFileSync(filepath);
  const compressed = zlib.gzipSync(content, { level: 9 });
  const gzPath = filepath + '.gz';
  fs.writeFileSync(gzPath, compressed);

  const originalSize = (content.length / 1024).toFixed(1);
  const compressedSize = (compressed.length / 1024).toFixed(1);
  const ratio = ((compressed.length / content.length) * 100).toFixed(0);
  console.log(`  ${path.basename(filepath)}: ${originalSize}KB → ${compressedSize}KB (${ratio}%)`);
}

async function main() {
  console.log('Compressing data files...');

  if (!fs.existsSync(DATA_DIR)) {
    console.error('No data directory found. Run build-graph first.');
    process.exit(1);
  }

  const files = fs.readdirSync(DATA_DIR);
  const jsonFiles = files.filter(
    (f) => f.endsWith('.json') && !f.endsWith('.gz')
  );

  for (const file of jsonFiles) {
    const filepath = path.join(DATA_DIR, file);
    try {
      await compressFile(filepath);
    } catch (err) {
      console.error(`  Failed to compress ${file}:`, err);
    }
  }

  console.log('\nCompression complete!');
}

main().catch(console.error);
