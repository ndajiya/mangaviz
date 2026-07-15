import fs from 'fs';
import path from 'path';
const D = path.resolve(process.cwd(), 'public', 'data');
const SUMMARY = path.resolve(process.cwd(), 'cache', 'raw', 'collector-summary.json');
const MAX_ATLAS_NODES = Math.max(1, parseInt(process.env.MAX_ATLAS_NODES || '500', 10) || 500);
const files = fs.readdirSync(D).filter(f=>f.endsWith('.json'));
const ns = files.filter(f=>f.startsWith('nodes.'));
const es = files.filter(f=>f.startsWith('edges.'));
let tn=0, te=0, sc=0;
for (const s of ns) { try { const d=JSON.parse(fs.readFileSync(path.join(D,s),'utf-8')); tn+=d.length||0; if(s==='nodes.series.json') sc=d.filter((node:any)=>node.seriesMetadata).length; } catch{} }
for (const s of es) { try { const d=JSON.parse(fs.readFileSync(path.join(D,s),'utf-8')); te+=d.length||0; } catch{} }
let strategy = 'unknown';
try {
  const summary = JSON.parse(fs.readFileSync(SUMMARY, 'utf-8'));
  if (typeof summary.strategy === 'string') strategy = summary.strategy;
} catch {}
const m = { version:'1.0.0', buildDate:new Date().toISOString(), strategy, seriesCount:sc, totalNodes:tn, totalEdges:te, maxNodes:MAX_ATLAS_NODES, previousSnapshot:'previous/manifest.json', shards:{nodes:ns,edges:es,positions:['positions.json'],clusters:['clusters.json']}, searchIndex:'search-index.json' };
fs.writeFileSync(path.join(D,'manifest.json'), JSON.stringify(m,null,2));
console.log(`Manifest: ${tn} nodes, ${te} edges, ${sc} series`);
