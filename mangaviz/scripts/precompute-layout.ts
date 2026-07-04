import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'public', 'data');

function main() {
  const allNodes: any[] = []; const allEdges: any[] = [];
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR,f),'utf-8'));
    if (f.startsWith('nodes.')) allNodes.push(...(Array.isArray(d)?d:[]));
    if (f.startsWith('edges.')) allEdges.push(...(Array.isArray(d)?d:[]));
  }
  console.log(`Computing layout for ${allNodes.length} nodes, ${allEdges.length} edges...`);

  const positions: Record<string,{x:number,y:number}> = {};
  let seed = 42;
  const rng = () => { seed = (seed*16807+0)%2147483647; return (seed-1)/2147483646; };
  for (const n of allNodes) positions[n.id] = {x:(rng()-0.5)*2000, y:(rng()-0.5)*2000};

  const adj = new Map<string,Set<string>>();
  for (const n of allNodes) adj.set(n.id, new Set());
  for (const e of allEdges) { adj.get(e.source)?.add(e.target); adj.get(e.target)?.add(e.source); }

  const N = allNodes.length;
  const k = Math.sqrt(2000*2000/Math.max(N,1));
  for (let iter = 0; iter < 80; iter++) {
    const temp = (1-iter/80)*100;
    const forces: Record<string,{fx:number,fy:number}> = {};
    for (const n of allNodes) forces[n.id] = {fx:0,fy:0};

    const sampleSize = Math.min(50, N);
    for (const n of allNodes) {
      const p1 = positions[n.id]; let fx=0, fy=0;
      const others = allNodes.filter(x => x.id !== n.id).sort(()=>rng()-0.5).slice(0, sampleSize);
      for (const o of others) {
        const p2 = positions[o.id]; let dx=p1.x-p2.x, dy=p1.y-p2.y;
        const dist = Math.sqrt(dx*dx+dy*dy)+1; const force = k*k/dist;
        fx += (dx/dist)*force; fy += (dy/dist)*force;
      }
      forces[n.id] = {fx,fy};
    }

    for (const e of allEdges) {
      const p1=positions[e.source], p2=positions[e.target];
      if (!p1||!p2) continue;
      let dx=p2.x-p1.x, dy=p2.y-p1.y; const dist=Math.sqrt(dx*dx+dy*dy)+1;
      const force = dist*dist/k;
      forces[e.source].fx += (dx/dist)*force; forces[e.source].fy += (dy/dist)*force;
      forces[e.target].fx -= (dx/dist)*force; forces[e.target].fy -= (dy/dist)*force;
    }

    for (const n of allNodes) {
      const f=forces[n.id]; const mag=Math.sqrt(f.fx*f.fx+f.fy*f.fy)+0.001;
      positions[n.id].x += (f.fx/mag)*Math.min(mag,temp);
      positions[n.id].y += (f.fy/mag)*Math.min(mag,temp);
    }
  }

  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for (const n of allNodes) { const p=positions[n.id]; minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y); }
  const rx=maxX-minX||1, ry=maxY-minY||1;
  for (const n of allNodes) { positions[n.id].x=((positions[n.id].x-minX)/rx)*1800-900; positions[n.id].y=((positions[n.id].y-minY)/ry)*1800-900; }

  const visited=new Set<string>(); const components: string[][] = [];
  function dfs(id: string, comp: string[]) { visited.add(id); comp.push(id); for (const nb of adj.get(id)||[]) { if (!visited.has(nb)) dfs(nb, comp); } }
  for (const n of allNodes) { if (!visited.has(n.id)) { const comp: string[]=[]; dfs(n.id, comp); if (comp.length>1) components.push(comp); } }

  const clusters: Record<string,number> = {}; let cid=0;
  for (const comp of components) { if (comp.length>100) { const s = comp.filter(id=>id.startsWith('series:')); const o = comp.filter(id=>!id.startsWith('series:')); s.forEach(id=>{clusters[id]=cid}); cid++; o.forEach(id=>{clusters[id]=cid}); cid++; } else { comp.forEach(id=>{clusters[id]=cid}); cid++; } }

  fs.writeFileSync(path.join(DATA_DIR,'positions.json'), JSON.stringify(positions));
  fs.writeFileSync(path.join(DATA_DIR,'clusters.json'), JSON.stringify(clusters));
  console.log(`Layout computed: ${Object.keys(positions).length} positions, ${Object.keys(clusters).length} clusters`);
}

main();
