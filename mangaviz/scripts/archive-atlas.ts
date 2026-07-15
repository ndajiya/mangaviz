import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'public', 'data');
const PREVIOUS_DIR = path.join(DATA_DIR, 'previous');

function main() {
  const manifestPath = path.join(DATA_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.log('No existing Atlas snapshot to archive.');
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    shards?: Record<string, string[]>;
    searchIndex?: string;
  };
  const activeFiles = new Set<string>(['manifest.json']);
  for (const files of Object.values(manifest.shards || {})) {
    for (const file of files || []) activeFiles.add(file);
  }
  if (manifest.searchIndex) activeFiles.add(manifest.searchIndex);

  fs.rmSync(PREVIOUS_DIR, { recursive: true, force: true });
  fs.mkdirSync(PREVIOUS_DIR, { recursive: true });
  for (const file of activeFiles) {
    const source = path.join(DATA_DIR, file);
    if (!fs.existsSync(source)) continue;
    fs.copyFileSync(source, path.join(PREVIOUS_DIR, file));
    const compressedSource = `${source}.gz`;
    if (fs.existsSync(compressedSource)) {
      fs.copyFileSync(compressedSource, path.join(PREVIOUS_DIR, `${file}.gz`));
    }
  }
  console.log(`Archived ${activeFiles.size} Atlas files to public/data/previous.`);
}

main();
