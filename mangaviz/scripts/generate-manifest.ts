import fs from 'fs';
import path from 'path';
const D = path.resolve(process.cwd(), 'public', 'data');
const files = fs.readdirSync(D).filter(f=>f.endsWith('.json'));
const ns = files.filter(f=>f.startsWith('nodes.'));
const es = files.filter(f=>f.startsWith('edges.'));
let tn=0, te=0, sc=0;
for (const s of ns) { try { const d=JSON.parse(fs.readFileSync(path.join(D,s),'utf-8')); tn+=d.length||0; if(s==='nodes.series.json') sc=d.length||0; } catch{} }
for (const s of es) { try { const d=JSON.parse(fs.readFileSync(path.join(D,s),'utf-8')); te+=d.length||0; } catch{} }
const m = { version:'1.0.0', buildDate:new Date().toISOString(), seriesCount:sc, totalNodes:tn, totalEdges:te, shards:{nodes:ns,edges:es,positions:['positions.json'],clusters:['clusters.json']}, searchIndex:'search-index.json' };
fs.writeFileSync(path.join(D,'manifest.json'), JSON.stringify(m,null,2));
console.log(`Manifest: ${tn} nodes, ${te} edges, ${sc} series`);
