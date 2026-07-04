import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const DATA_DIR = path.resolve(process.cwd(), 'public', 'data');
const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && !f.endsWith('.gz'));
for (const f of files) {
  const content = fs.readFileSync(path.join(DATA_DIR, f));
  const gz = zlib.gzipSync(content, { level: 9 });
  fs.writeFileSync(path.join(DATA_DIR, f + '.gz'), gz);
  const pct = ((gz.length/content.length)*100).toFixed(0);
  console.log(`${f}: ${(content.length/1024).toFixed(1)}KB -> ${(gz.length/1024).toFixed(1)}KB (${pct}%)`);
}
console.log('Compression done');
